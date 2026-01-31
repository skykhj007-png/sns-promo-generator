// 4시간마다 자동 BTC 분석 Threads 게시
// Cron: 0 */4 * * * (트위터와 동일)

export async function onRequestGet(context) {
  const { env } = context;

  // CRON_SECRET 검증 (보안)
  const url = new URL(context.request.url);
  const secret = url.searchParams.get('secret');

  if (secret !== env.CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // 1. Threads User ID 가져오기
    const userId = await getThreadsUserId(env.THREADS_ACCESS_TOKEN);

    // 2. BTC & ETH 데이터 가져오기
    const btcData = await fetchCryptoData('BTC-USDT');
    const ethData = await fetchCryptoData('ETH-USDT');

    // 3. 어떤 코인이 더 핫한지 판단
    const mainCrypto = selectHotCrypto(btcData, ethData);

    // 4. 시장 데이터 가져오기 (금/은, Fear&Greed, 도미넌스)
    const marketData = await fetchMarketData();

    // 5. 실시간 뉴스 가져오기
    const news = await fetchCryptoNews();

    // 6. OpenAI로 Threads용 콘텐츠 생성
    const content = await generateThreadsContent(env.OPENAI_API_KEY, mainCrypto, ethData, news, marketData);

    // 7. 차트 이미지 URL 생성 (API 키가 있는 경우)
    let imageUrl = null;
    if (env.CHART_IMG_API_KEY) {
      try {
        imageUrl = generateChartImageUrl(env.CHART_IMG_API_KEY, mainCrypto.symbol);
        console.log('Chart image URL generated:', imageUrl);
      } catch (imgError) {
        console.error('Chart image URL error:', imgError.message);
      }
    }

    // 8. 메인 포스트 게시 (이미지 포함)
    const mainPost = await postToThreads(env.THREADS_ACCESS_TOKEN, userId, content.mainPost, null, imageUrl);

    // 5. 댓글 1: 매매 전략 (메인 포스트에 답글)
    await delay(3000);
    const reply1 = await postToThreads(env.THREADS_ACCESS_TOKEN, userId, content.strategyReply, mainPost.id);

    // 6. 댓글 2: 홍보 (댓글1에 답글)
    await delay(3000);
    const promoLink = getRandomPromoLink();
    const reply2 = await postToThreads(env.THREADS_ACCESS_TOKEN, userId, content.promoReply + '\n' + promoLink.text, reply1.id);

    return new Response(JSON.stringify({
      success: true,
      platform: 'threads',
      mainPost: content.mainPost,
      strategyReply: content.strategyReply,
      promoReply: content.promoReply,
      postIds: {
        main: mainPost.id,
        strategy: reply1.id,
        promo: reply2.id
      },
      hasImage: !!imageUrl,
      imageUrl: imageUrl,
      cryptoData: mainCrypto,
      ethData: ethData,
      marketData: marketData,
      promoLink: promoLink.type
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Cron Threads Error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 딜레이 함수
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 실시간 크립토 뉴스 가져오기 (CryptoCompare 무료 API)
async function fetchCryptoNews() {
  try {
    const response = await fetch(
      'https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=BTC,Bitcoin,Trading&excludeCategories=Sponsored'
    );
    const data = await response.json();

    if (data.Data && data.Data.length > 0) {
      const recentNews = data.Data.slice(0, 3).map(item => {
        // 본문에서 핵심 내용 추출 (첫 200자)
        const bodyText = item.body || '';
        const summary = bodyText.substring(0, 200).replace(/\s+/g, ' ').trim();

        return {
          title: item.title,
          source: item.source,
          categories: item.categories,
          summary: summary, // 본문 요약 추가
          url: item.url
        };
      });
      return recentNews;
    }
    return [];
  } catch (error) {
    console.error('뉴스 가져오기 실패:', error);
    return [];
  }
}

// 페르소나 정의 (4가지 전문적 스타일) - Twitter와 동일
function getPersona() {
  const hour = new Date().getUTCHours();
  const personaIndex = Math.floor(hour / 6) % 4; // 6시간마다 변경

  const personas = [
    {
      name: '전문 애널리스트',
      tone: 'professional',
      style: '격식있고 분석적인 톤. "~입니다", "~합니다" 사용. 데이터 중심 표현.',
      emoji: 2 // Threads는 조금 더 여유있게
    },
    {
      name: '경험많은 트레이더',
      tone: 'experienced',
      style: '경험을 바탕으로 한 실전 조언. "~네요", "~습니다" 혼용. 실전 팁 강조.',
      emoji: 3
    },
    {
      name: '리서치 분석가',
      tone: 'research',
      style: '객관적이고 데이터 기반. "~로 나타났습니다", "~확인됩니다" 사용. 시장 맥락 강조.',
      emoji: 2
    },
    {
      name: '시장 관찰자',
      tone: 'observer',
      style: '시장 흐름 관찰 중심. "~보입니다", "~것으로 관측됩니다" 사용. 심리적 측면 언급.',
      emoji: 3
    }
  ];

  return personas[personaIndex];
}

// 페르소나별 다양한 첫줄 훅 (Twitter와 동일)
function getRandomHook(btcData) {
  const change = parseFloat(btcData.change24h);
  const price = btcData.currentPrice.toLocaleString();
  const trend = btcData.trend;
  const rsi = parseFloat(btcData.rsi.value);
  const persona = getPersona();

  // 페르소나별 훅 세트
  const hooks = {
    professional: {
      bullish: [
        `BTC $${price} 돌파 확인`,
        `상승 모멘텀 강화 중`,
        `저항선 테스트 진행`,
        `매수세 유입 관측`,
        `상승 추세 지속`,
        `강세 시그널 확인`,
        `돌파 구간 진입`,
        `상승 압력 증가`,
        `매수 우위 지속`,
        `긍정적 차트 형성`
      ],
      bearish: [
        `BTC $${price} 지지 테스트`,
        `하락 압력 감지`,
        `조정 국면 진입`,
        `매도세 우세`,
        `약세 시그널 출현`,
        `하방 리스크 증가`,
        `지지선 근접`,
        `매수세 약화`,
        `하락 추세 전환 가능성`,
        `조정 필요 구간`
      ],
      sideways: [
        `BTC 박스권 유지`,
        `횡보 구간 지속`,
        `방향성 탐색 중`,
        `변동성 축소`,
        `균형 상태 유지`,
        `추세 전환 대기`,
        `관망세 우세`,
        `중립 구간 형성`,
        `방향성 불분명`,
        `레인지 구간 지속`
      ]
    },
    experienced: {
      bullish: [
        `$${price} 뚫고 올라오네요`,
        `이 흐름이면 갈 것 같습니다`,
        `저항 돌파 시도 중이네요`,
        `분위기가 괜찮아 보입니다`,
        `거래량 받쳐주고 있네요`,
        `상승세 타는 중입니다`,
        `롱 포지션 유리해 보입니다`,
        `여기서 눌리면 기회겠네요`,
        `추가 상승 여력 보입니다`,
        `강세 흐름 이어가는 중`
      ],
      bearish: [
        `$${price} 지지 테스트 중이네요`,
        `조금 불안한 모습입니다`,
        `하락 채널 진행 중`,
        `반등 나와야 할 시점`,
        `지지 확인 필요합니다`,
        `손절 관리 중요한 구간`,
        `조정 깊어지는 중`,
        `매수 타이밍 기다려야`,
        `하방 압력 커지는 중`,
        `관망이 나아 보입니다`
      ],
      sideways: [
        `횡보가 길어지네요`,
        `언제 터질지 지켜봐야`,
        `방향 못 잡고 있습니다`,
        `박스권 며칠째네요`,
        `위아래 열려있는 상황`,
        `눈치게임 지속 중`,
        `터지면 크게 갈 듯`,
        `기다림의 시간입니다`,
        `변동성 축소 중`,
        `곧 방향 나올 것 같습니다`
      ]
    },
    research: {
      bullish: [
        `BTC $${price} 상승 지속 중`,
        `매수 모멘텀 확인됩니다`,
        `기술적 돌파 관측`,
        `상승 추세 강화 확인`,
        `긍정적 지표 다수 확인`,
        `강세 패턴 형성 중`,
        `저항 돌파 시도 확인`,
        `상승 압력 지속 관측`,
        `매수세 우위 지속`,
        `긍정적 시장 심리 반영`
      ],
      bearish: [
        `BTC $${price} 조정 국면`,
        `하락 압력 지속 관측`,
        `약세 시그널 다수 확인`,
        `지지선 테스트 중`,
        `매도세 우세 확인`,
        `하방 리스크 증가`,
        `조정 필요 구간 진입`,
        `약세 패턴 형성 관측`,
        `매수세 약화 확인`,
        `부정적 지표 출현`
      ],
      sideways: [
        `BTC 레인지 구간 유지`,
        `횡보 패턴 지속 중`,
        `방향성 불분명 상태`,
        `변동성 축소 확인`,
        `균형 상태 지속`,
        `추세 전환 대기 중`,
        `박스권 거래 지속`,
        `중립 시그널 우세`,
        `관망세 지속 확인`,
        `방향성 탐색 단계`
      ]
    },
    observer: {
      bullish: [
        `$${price} 돌파 흐름 보입니다`,
        `상승 모멘텀 감지되네요`,
        `매수심리 강화 관측`,
        `긍정적 분위기 형성`,
        `강세 흐름 이어지는 중`,
        `저항 테스트 중으로 보임`,
        `상승세 지속 관측`,
        `시장 심리 개선 중`,
        `매수 압력 증가 보임`,
        `긍정적 차트 형성 중`
      ],
      bearish: [
        `$${price} 지지 테스트 관측`,
        `하락 압력 감지됩니다`,
        `조정 분위기 형성`,
        `매도 심리 우세 보임`,
        `약세 흐름 관측 중`,
        `지지선 근접 관측`,
        `하방 압력 증가 중`,
        `시장 심리 악화 관측`,
        `조정 국면 진입 보임`,
        `부정적 분위기 형성`
      ],
      sideways: [
        `박스권 유지 관측`,
        `횡보 지속되는 모습`,
        `방향성 불투명 상태`,
        `관망세 우세 보임`,
        `균형 상태 유지 중`,
        `변동성 축소 관측`,
        `추세 전환 대기 중`,
        `중립 분위기 지속`,
        `방향 못 잡는 모습`,
        `레인지 거래 지속 중`
      ]
    }
  };

  const rsiHooks = {
    professional: rsi >= 70 ? [
      `RSI ${rsi.toFixed(0)} 과매수 구간`,
      `과열 시그널 확인`,
      `단기 조정 가능성`
    ] : rsi <= 30 ? [
      `RSI ${rsi.toFixed(0)} 과매도 구간`,
      `저점 형성 국면`,
      `반등 가능성 증가`
    ] : [],
    experienced: rsi >= 70 ? [
      `RSI ${rsi.toFixed(0)} 과열 주의`,
      `조정 올 수 있습니다`,
      `단기 익절 고려 구간`
    ] : rsi <= 30 ? [
      `RSI ${rsi.toFixed(0)} 바닥권`,
      `반등 노려볼 만합니다`,
      `매수 기회 될 수 있어요`
    ] : [],
    research: rsi >= 70 ? [
      `RSI ${rsi.toFixed(0)} 과매수 확인`,
      `과열 지표 관측`,
      `조정 가능성 존재`
    ] : rsi <= 30 ? [
      `RSI ${rsi.toFixed(0)} 과매도 확인`,
      `반등 시그널 관측`,
      `저점 형성 가능성`
    ] : [],
    observer: rsi >= 70 ? [
      `RSI ${rsi.toFixed(0)} 과열 관측`,
      `조정 필요 보임`,
      `단기 조정 가능성`
    ] : rsi <= 30 ? [
      `RSI ${rsi.toFixed(0)} 저점 관측`,
      `반등 기회 보임`,
      `매수세 유입 가능성`
    ] : []
  };

  const personaTone = persona.tone;
  let selectedHooks;

  if (trend === '상승추세' || change > 1) {
    selectedHooks = [...hooks[personaTone].bullish, ...rsiHooks[personaTone]];
  } else if (trend === '하락추세' || change < -1) {
    selectedHooks = [...hooks[personaTone].bearish, ...rsiHooks[personaTone]];
  } else {
    selectedHooks = [...hooks[personaTone].sideways, ...rsiHooks[personaTone]];
  }

  // 시간+분을 시드로 사용
  const now = new Date();
  const seed = now.getUTCHours() * 60 + now.getUTCMinutes();
  const index = seed % selectedHooks.length;

  return selectedHooks[index];
}

// 다양한 해시태그 풀
function getHashtags() {
  const baseTags = ['#BTC', '#비트코인', '#Bitcoin'];

  const trendTags = [
    ['#암호화폐', '#크립토', '#Crypto', '#코인'],
    ['#차트분석', '#기술적분석', '#TechnicalAnalysis'],
    ['#트레이딩', '#선물거래', '#마진거래', '#Trading'],
    ['#투자', '#재테크', '#부업', '#경제적자유'],
    ['#코인투자', '#비트코인투자', '#알트코인'],
    ['#불장', '#상승장', '#Bull', '#BullRun'],
    ['#매매일지', '#수익인증', '#트레이더'],
    ['#바이낸스', '#업비트', '#비트겟', '#OKX']
  ];

  const hour = new Date().getUTCHours();
  const dayOfWeek = new Date().getUTCDay();

  // 시간과 요일에 따라 다른 태그 조합 선택
  const index1 = hour % trendTags.length;
  const index2 = (hour + dayOfWeek) % trendTags.length;
  const index3 = (dayOfWeek * 2) % trendTags.length;

  const selectedTrends = [
    ...trendTags[index1].slice(0, 2),
    ...trendTags[index2].slice(0, 2),
    trendTags[index3][0]
  ];

  return [...baseTags, ...selectedTrends].slice(0, 8).join(' ');
}

// Threads User ID 가져오기
async function getThreadsUserId(accessToken) {
  const response = await fetch(
    `https://graph.threads.net/v1.0/me?fields=id,username&access_token=${accessToken}`
  );
  const data = await response.json();

  if (!response.ok || !data.id) {
    throw new Error('Threads User ID 조회 실패: ' + JSON.stringify(data));
  }

  return data.id;
}

// chart-img.com URL 생성 (GET 방식)
function generateChartImageUrl(apiKey, symbol = 'BTC') {
  const tradingViewSymbol = symbol === 'BTC' ? 'BINANCE:BTCUSDT' : 'BINANCE:ETHUSDT';

  const params = new URLSearchParams({
    key: apiKey,
    symbol: tradingViewSymbol,
    interval: '4h',
    theme: 'dark',
    width: 800,
    height: 450,
    studies: 'RSI'
  });

  return `https://api.chart-img.com/v1/tradingview/advanced-chart?${params.toString()}`;
}

// Threads에 게시 (답글 + 이미지 지원)
async function postToThreads(accessToken, userId, text, replyToId = null, imageUrl = null) {
  // Step 1: 미디어 컨테이너 생성
  const createParams = new URLSearchParams({
    media_type: imageUrl ? 'IMAGE' : 'TEXT',
    text: text,
    access_token: accessToken
  });

  if (imageUrl) {
    createParams.append('image_url', imageUrl);
  }

  if (replyToId) {
    createParams.append('reply_to_id', replyToId);
  }

  const createResponse = await fetch(
    `https://graph.threads.net/v1.0/${userId}/threads`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: createParams
    }
  );

  const createData = await createResponse.json();

  if (!createResponse.ok || !createData.id) {
    throw new Error('Threads 컨테이너 생성 실패: ' + JSON.stringify(createData));
  }

  // Step 2: 게시
  await delay(1000); // 컨테이너 처리 대기

  const publishResponse = await fetch(
    `https://graph.threads.net/v1.0/${userId}/threads_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        creation_id: createData.id,
        access_token: accessToken
      })
    }
  );

  const publishData = await publishResponse.json();

  if (!publishResponse.ok || !publishData.id) {
    throw new Error('Threads 게시 실패: ' + JSON.stringify(publishData));
  }

  return publishData;
}

// OKX API에서 암호화폐 데이터 가져오기 (BTC, ETH 등)
async function fetchCryptoData(symbol) {
  const timeframe = '4H';
  const coinName = symbol.split('-')[0];

  const candleResponse = await fetch(
    `https://www.okx.com/api/v5/market/candles?instId=${symbol}&bar=${timeframe}&limit=100`
  );
  const candleData = await candleResponse.json();

  const tickerResponse = await fetch(
    `https://www.okx.com/api/v5/market/ticker?instId=${symbol}`
  );
  const tickerData = await tickerResponse.json();

  if (!candleData.data || !tickerData.data) {
    throw new Error(`OKX API 데이터 없음: ${symbol}`);
  }

  const candles = candleData.data.map(c => ({
    time: parseInt(c[0]),
    open: parseFloat(c[1]),
    high: parseFloat(c[2]),
    low: parseFloat(c[3]),
    close: parseFloat(c[4]),
    volume: parseFloat(c[5])
  })).reverse();

  const ticker = tickerData.data[0];
  const currentPrice = parseFloat(ticker.last);
  const change24h = parseFloat(ticker.changeUtc24h || ticker.change24h || 0);
  const changePercent = ((change24h / currentPrice) * 100).toFixed(2);

  const analysis = calculateTechnicalAnalysis(candles, currentPrice);

  return {
    symbol: coinName,
    timeframe: '4H',
    currentPrice,
    change24h: changePercent,
    ...analysis
  };
}

// BTC vs ETH 중 더 핫한 코인 선택
function selectHotCrypto(btcData, ethData) {
  const btcChange = Math.abs(parseFloat(btcData.change24h));
  const ethChange = Math.abs(parseFloat(ethData.change24h));
  if (ethChange > btcChange * 2 && ethChange > 3) {
    return ethData;
  }
  return btcData;
}

// 시장 데이터 가져오기 (금/은 + Fear&Greed + 경제 시황)
async function fetchMarketData() {
  const result = { gold: null, silver: null, fearGreed: null, dominance: null };

  try {
    const metalResponse = await fetch('https://data-asg.goldprice.org/dbXRates/USD');
    const metalData = await metalResponse.json();
    if (metalData.items && metalData.items[0]) {
      const item = metalData.items[0];
      result.gold = { price: Math.round(item.xauPrice), change: item.pcXau?.toFixed(2) };
      result.silver = { price: item.xagPrice?.toFixed(2), change: item.pcXag?.toFixed(2) };
    }
  } catch (e) { console.error('금/은 데이터 실패:', e); }

  try {
    const fgResponse = await fetch('https://api.alternative.me/fng/?limit=1');
    const fgData = await fgResponse.json();
    if (fgData.data?.[0]) {
      result.fearGreed = {
        value: parseInt(fgData.data[0].value),
        label: fgData.data[0].value_classification
      };
    }
  } catch (e) { console.error('Fear&Greed 데이터 실패:', e); }

  try {
    const domResponse = await fetch('https://api.coingecko.com/api/v3/global', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; CryptoBot/1.0)'
      }
    });
    if (domResponse.ok) {
      const domData = await domResponse.json();
      if (domData.data) {
        result.dominance = {
          btc: domData.data.market_cap_percentage?.btc?.toFixed(1),
          eth: domData.data.market_cap_percentage?.eth?.toFixed(1),
          totalMarketCap: (domData.data.total_market_cap?.usd / 1e12).toFixed(2)
        };
      }
    }
  } catch (e) { console.error('CoinGecko 도미넌스 실패:', e); }

  // 백업: 도미넌스 없으면 Coinlore에서 시도
  if (!result.dominance) {
    try {
      const backupResponse = await fetch('https://api.coinlore.net/api/global/');
      const backupData = await backupResponse.json();
      if (backupData?.[0]) {
        result.dominance = {
          btc: backupData[0].btc_d,
          eth: backupData[0].eth_d,
          totalMarketCap: (backupData[0].total_mcap / 1e12).toFixed(2)
        };
      }
    } catch (e) { console.error('백업 도미넌스 실패:', e); }
  }

  return result;
}

// 기술적 분석 계산
function calculateTechnicalAnalysis(candles, currentPrice) {
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);

  const ema7 = calculateEMA(closes, 7);
  const ema25 = calculateEMA(closes, 25);
  const ema99 = calculateEMA(closes, 99);

  const emaStatus = ema7 > ema25 && ema25 > ema99 ? '정배열' :
                    ema7 < ema25 && ema25 < ema99 ? '역배열' : '혼조';

  const rsi = calculateRSI(closes, 14);
  const rsiStatus = rsi >= 70 ? '과매수' : rsi <= 30 ? '과매도' :
                    rsi >= 50 ? '강세권' : '약세권';

  const bb = calculateBollingerBands(closes, 20);
  const bbPosition = currentPrice > bb.upper ? '상단돌파' :
                     currentPrice < bb.lower ? '하단이탈' :
                     currentPrice > bb.middle ? '중심선 위' : '중심선 아래';

  const recentHighs = highs.slice(-20);
  const recentLows = lows.slice(-20);
  const resistance = Math.max(...recentHighs);
  const support = Math.min(...recentLows);

  const lastCandle = candles[candles.length - 1];
  const candleBody = Math.abs(lastCandle.close - lastCandle.open);
  const candleRange = lastCandle.high - lastCandle.low;
  const candlePattern = candleBody < candleRange * 0.3 ? '도지' :
                        lastCandle.close > lastCandle.open ? '양봉' : '음봉';

  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const lastVolume = volumes[volumes.length - 1];
  const volumeStatus = lastVolume > avgVolume * 1.5 ? '급증' :
                       lastVolume > avgVolume ? '증가' : '감소';

  const trend = emaStatus === '정배열' && rsi > 50 ? '상승추세' :
                emaStatus === '역배열' && rsi < 50 ? '하락추세' : '횡보';

  const longEntry = support * 1.005;
  const shortEntry = resistance * 0.995;
  const longSL = support * 0.98;
  const shortSL = resistance * 1.02;
  const longTP1 = currentPrice * 1.02;
  const longTP2 = resistance * 0.99;
  const shortTP1 = currentPrice * 0.98;
  const shortTP2 = support * 1.01;

  return {
    ema: { ema7: ema7.toFixed(0), ema25: ema25.toFixed(0), ema99: ema99.toFixed(0), status: emaStatus },
    rsi: { value: rsi.toFixed(1), status: rsiStatus },
    bb: { upper: bb.upper.toFixed(0), middle: bb.middle.toFixed(0), lower: bb.lower.toFixed(0), position: bbPosition },
    support: support.toFixed(0),
    resistance: resistance.toFixed(0),
    candle: candlePattern,
    volume: volumeStatus,
    trend,
    tradingPoints: {
      longEntry: longEntry.toFixed(0),
      longSL: longSL.toFixed(0),
      longTP1: longTP1.toFixed(0),
      longTP2: longTP2.toFixed(0),
      shortEntry: shortEntry.toFixed(0),
      shortSL: shortSL.toFixed(0),
      shortTP1: shortTP1.toFixed(0),
      shortTP2: shortTP2.toFixed(0)
    }
  };
}

function calculateEMA(data, period) {
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

function calculateRSI(data, period) {
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = data[i] - data[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
  }
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateBollingerBands(data, period) {
  const slice = data.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const squaredDiffs = slice.map(x => Math.pow(x - middle, 2));
  const stdDev = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / period);
  return { upper: middle + stdDev * 2, middle, lower: middle - stdDev * 2 };
}

// OpenAI로 Threads용 콘텐츠 생성 (뉴스, ETH, 금/은 포함)
async function generateThreadsContent(apiKey, mainCrypto, ethData, news = [], marketData = null) {
  const changeSign = parseFloat(mainCrypto.change24h) >= 0 ? '+' : '';
  const trendEmoji = parseFloat(mainCrypto.change24h) >= 0 ? '🟢' : '🔴';
  const tp = mainCrypto.tradingPoints;
  const hashtags = getHashtags();
  const hookExample = getRandomHook(mainCrypto);
  const isSideways = mainCrypto.trend === '횡보';
  const isETH = mainCrypto.symbol === 'ETH';

  // 뉴스 텍스트
  const newsText = news.length > 0
    ? `\n## 🔴 최신 뉴스 (핵심 내용 언급!)
${news.map((n, i) => `### 뉴스 ${i + 1}: ${n.title}\n- 출처: ${n.source}\n- 내용: ${n.summary}...`).join('\n')}
구체적인 수치나 내용을 언급해줘!` : '';

  // ETH 정보
  const ethText = !isETH ? `
## 이더리움 현황
- ETH: $${ethData.currentPrice.toLocaleString()} (${parseFloat(ethData.change24h) >= 0 ? '+' : ''}${ethData.change24h}%)
- 추세: ${ethData.trend}` : '';

  // 시장 심리 & 경제 시황 (항상 포함)
  const fearGreedText = marketData?.fearGreed ?
    `Fear & Greed: ${marketData.fearGreed.value} (${marketData.fearGreed.label})` : '';
  const dominanceText = marketData?.dominance ?
    `BTC 도미넌스: ${marketData.dominance.btc}% / ETH 도미: ${marketData.dominance.eth}% / 전체 시총: $${marketData.dominance.totalMarketCap}조` : '';
  const goldText = marketData?.gold ? `금: $${marketData.gold.price?.toLocaleString()}/oz` : '';

  // 시장 심리에 따른 멘트 가이드
  let sentimentGuide = '';
  if (marketData?.fearGreed?.value <= 25) {
    sentimentGuide = '→ 극단적 공포! "다들 패닉인데 오히려 기회일수도" 멘트';
  } else if (marketData?.fearGreed?.value <= 40) {
    sentimentGuide = '→ 공포 구간. "분위기 안 좋긴 한데" 멘트';
  } else if (marketData?.fearGreed?.value >= 75) {
    sentimentGuide = '→ 극단적 탐욕! "FOMO 심한데 조심" 멘트';
  } else if (marketData?.fearGreed?.value >= 60) {
    sentimentGuide = '→ 탐욕 구간. "분위기 좋긴 한데 조심" 멘트';
  }

  const marketText = marketData ? `
## 📊 시장 심리 & 경제 시황 (반드시 1개 이상 언급!)
- ${fearGreedText}
- ${dominanceText}
- ${goldText}
${sentimentGuide}

💡 복합적으로 글 쓰는 예시:
- "${mainCrypto.symbol} 차트 보면서 금 가격도 체크해봤는데..."
- "공포지수 ${marketData.fearGreed?.value || '??'}인데 오히려 기회일수도"
- "도미넌스 ${marketData.dominance?.btc || '??'}%라 알트는 좀..."` : '';

  // 항상 포함되는 복합 콘텐츠 가이드
  const diverseTopics = `
## 💡 복합적인 글 작성 (차트 + 아래 중 1-2개 자연스럽게 섞기)
- 금/은 가격 ("금은 신고가인데...", "안전자산 흐름 보니까...")
- Fear & Greed ("공포지수 보니까...", "시장 심리가...")
- 도미넌스 ("BTC 도미 올라가네...", "알트 힘 빠지는 중")
- ETH 동향 ("이더는 어떤가 보니까...", "ETH도 비슷하네")
- 거시경제 ("금리가...", "달러가...", "나스닥 보니까...")
${isSideways ? '- 횡보 공감 ("언제 터지냐", "지루하다 ㅋㅋ")' : ''}`;

  const persona = getPersona();

  const prompt = `당신은 Threads에서 암호화폐 시장을 분석하는 "${persona.name}"입니다.
작성 스타일: ${persona.style}
이모지 사용: ${persona.emoji}개 정도 사용

## 현재 ${mainCrypto.symbol} 상황
- 가격: $${mainCrypto.currentPrice.toLocaleString()} (${changeSign}${mainCrypto.change24h}%)
- EMA: ${mainCrypto.ema.status}
- RSI: ${mainCrypto.rsi.value} (${mainCrypto.rsi.status})
- 볼밴: ${mainCrypto.bb.position}
- 지지/저항: $${mainCrypto.support} ~ $${mainCrypto.resistance}
- 캔들: ${mainCrypto.candle} / 거래량: ${mainCrypto.volume}
- 전체 추세: ${mainCrypto.trend}
${ethText}
${marketText}
${diverseTopics}
${newsText}

## 매매 포인트
- 롱: $${tp.longEntry} 진입 / $${tp.longSL} 손절 / $${tp.longTP1}~$${tp.longTP2} 익절
- 숏: $${tp.shortEntry} 진입 / $${tp.shortSL} 손절 / $${tp.shortTP1}~$${tp.shortTP2} 익절

## 출력 (JSON)
{
  "mainPost": "메인 포스트",
  "strategyReply": "매매전략 댓글",
  "promoReply": "홍보 댓글"
}

## 메인 포스트 작성법 (500자 이내)
1. 첫줄: "${hookExample}" 이런 식으로 시작 (🚨BTC주목 같은 AI틱한거 절대 금지)
2. 가격 정보: ${trendEmoji} $${mainCrypto.currentPrice.toLocaleString()}
3. 차트 분석 + 시장 심리/경제 시황 자연스럽게 섞기
4. 뉴스/금/ETH 등 관련 내용 언급
5. 해시태그: ${hashtags}

## 매매전략 댓글 (400자 이내)
- 🎯 이모지로 시작
- 롱/숏 중 어느 쪽이 유리한지 판단 + 구체적 가격 제시
- ${persona.name} 스타일로 작성

## 홍보 댓글 (150자 이내)
- 자연스럽게 참여 유도
- ${persona.name} 톤 유지

## 작성 가이드 (반드시 준수!)
${persona.tone === 'professional' ? `
- "~입니다", "~합니다" 사용
- 데이터와 지표 중심으로 서술
- 이모지 2개 정도
- 객관적이고 분석적인 표현
예: "BTC는 $95,000 지지선을 테스트하고 있습니다. EMA 정배열이 유지되고 있으며, RSI 51.2로 중립 구간에 위치합니다. 공포지수 49로 시장 심리는 중립적이네요."` : ''}
${persona.tone === 'experienced' ? `
- "~네요", "~습니다" 혼용
- 실전 경험 기반 조언
- 이모지 3개 정도
- 실용적이고 현실적인 표현
예: "$95K 지지 중이네요. EMA는 정배열 유지하고 있고, RSI 51.2로 강세권입니다. 공포지수 49니까 시장 심리는 중립적이구, 도미넌스 57.3%라 알트들은 힘 빠지는 중이네요."` : ''}
${persona.tone === 'research' ? `
- "~로 나타났습니다", "~확인됩니다" 사용
- 데이터 기반 객관적 서술
- 이모지 2개
- 시장 맥락 강조
예: "BTC $95,000 구간에서 지지를 확인하고 있습니다. 기술적 지표상 EMA 정배열이 유지되며, RSI 51.2로 강세권에 진입했습니다. Fear & Greed Index 49로 중립 구간이 관측됩니다."` : ''}
${persona.tone === 'observer' ? `
- "~보입니다", "~관측됩니다" 사용
- 시장 흐름 관찰 중심
- 이모지 3개
- 심리적 측면 언급
예: "$95K 지지하는 모습이 관측됩니다. EMA 정배열 유지 중이며, RSI 51.2로 강세권 진입이 보입니다. 공포지수 49니까 시장 심리는 중립적이네요. 도미넌스 보니 알트는 좀 힘든 상황입니다."` : ''}

JSON만 출력.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 1000
    })
  });

  const data = await response.json();

  if (!response.ok || !data.choices?.[0]?.message?.content) {
    throw new Error('OpenAI API 응답 오류: ' + JSON.stringify(data));
  }

  const content = data.choices[0].message.content.trim();

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('JSON 형식 아님');
  } catch (e) {
    return {
      mainPost: `[BTC 4H] ${trendEmoji} $${btcData.currentPrice.toLocaleString()} (${changeSign}${btcData.change24h}%)\n\nEMA ${btcData.ema.status}, RSI ${btcData.rsi.value}\n지지 $${btcData.support} / 저항 $${btcData.resistance}\n${btcData.trend} 구간\n\n#BTC #비트코인 #차트분석 #암호화폐`,
      strategyReply: `🎯 매매 전략\n\n롱: $${btcData.tradingPoints.longEntry} 진입 / SL $${btcData.tradingPoints.longSL}\n숏: $${btcData.tradingPoints.shortEntry} 진입 / SL $${btcData.tradingPoints.shortSL}\n\n손절은 필수로 잡고 들어가야 함`,
      promoReply: `실시간 차트 분석은 여기서 같이 보는 중`
    };
  }
}

// 시간 기반 순환 프로모 링크 선택 (4시간마다 다른 링크)
function getRandomPromoLink() {
  const links = [
    {
      type: 'telegram',
      text: '👉 https://t.me/V30_Signal_bot'
    },
    {
      type: 'bitget',
      text: '👉 비트겟 https://partner.bitget.com/bg/AZ6Z8S (추천코드: 63sl3029)'
    },
    {
      type: 'kakao',
      text: '👉 카톡방 https://open.kakao.com/o/sOAEK49h'
    }
  ];
  // 현재 시간(4시간 단위)을 기준으로 순환
  const hour = new Date().getUTCHours();
  const index = Math.floor(hour / 4) % links.length;
  return links[index];
}
