// 4시간마다 자동 BTC 분석 트윗 + 댓글 스레드 게시
// Cron: 0 */4 * * * (0시, 4시, 8시, 12시, 16시, 20시)

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
    // 1. BTC & ETH 데이터 가져오기
    const btcData = await fetchCryptoData('BTC-USDT');
    const ethData = await fetchCryptoData('ETH-USDT');

    // 2. 어떤 코인이 더 핫한지 판단 (변동률 기준)
    const mainCrypto = selectHotCrypto(btcData, ethData);

    // 3. 시장 데이터 가져오기 (금/은, Fear&Greed, 도미넌스)
    const marketData = await fetchMarketData();

    // 4. 실시간 뉴스 가져오기 (크립토 + 매크로)
    const news = await fetchCryptoNews();

    // 5. OpenAI로 콘텐츠 생성
    const content = await generateThreadContent(env.OPENAI_API_KEY, mainCrypto, ethData, news, marketData);

    // 6. 차트 이미지 생성 (API 키가 있는 경우)
    let mediaId = null;
    if (env.CHART_IMG_API_KEY) {
      try {
        console.log('Generating chart image...');
        const imageBuffer = await generateChartImage(env.CHART_IMG_API_KEY, mainCrypto.symbol);
        console.log('Uploading image to Twitter...');
        mediaId = await uploadMediaToTwitter(env, imageBuffer);
        console.log('Image uploaded, mediaId:', mediaId);
      } catch (imgError) {
        console.error('Chart image error (continuing without image):', imgError.message);
        // 이미지 실패해도 텍스트만 게시
      }
    }

    // 7. 메인 트윗 게시 (이미지 포함)
    const mainTweet = await postToTwitter(env, content.mainTweet, null, mediaId);
    const mainTweetId = mainTweet.data.id;

    // 4. 댓글 1: 매매 전략 (메인 트윗에 답글)
    await delay(2000); // 2초 대기
    const reply1 = await postToTwitter(env, content.strategyReply, mainTweetId);

    // 5. 댓글 2: 자연스러운 홍보 (댓글1에 답글)
    await delay(2000);
    const promoLink = getRandomPromoLink();
    const reply2 = await postToTwitter(env, content.promoReply + '\n' + promoLink.text, reply1.data.id);

    return new Response(JSON.stringify({
      success: true,
      mainTweet: content.mainTweet,
      strategyReply: content.strategyReply,
      promoReply: content.promoReply,
      tweetIds: {
        main: mainTweetId,
        strategy: reply1.data.id,
        promo: reply2.data.id
      },
      hasImage: !!mediaId,
      mediaId: mediaId,
      cryptoData: mainCrypto,
      ethData: ethData,
      marketData: marketData,
      promoLink: promoLink.type
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Cron Tweet Error:', error);
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

// chart-img.com API로 TradingView 차트 이미지 생성 (바이너리 직접 반환)
async function generateChartImage(apiKey, symbol = 'BTC') {
  const tradingViewSymbol = symbol === 'BTC' ? 'BINANCE:BTCUSDT' : 'BINANCE:ETHUSDT';

  const response = await fetch('https://api.chart-img.com/v1/tradingview/advanced-chart', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      symbol: tradingViewSymbol,
      interval: '4h',
      theme: 'dark',
      width: 800,
      height: 450,
      studies: [
        { name: 'RSI' }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Chart-img API error: ${error}`);
  }

  // chart-img.com은 이미지 바이너리를 직접 반환
  const imageBuffer = await response.arrayBuffer();
  return imageBuffer;
}

// ArrayBuffer를 Base64로 변환 (Cloudflare Workers 호환)
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

// Twitter에 이미지 업로드 (v1.1 media upload API)
async function uploadMediaToTwitter(env, imageBuffer) {
  // 이미지 버퍼를 base64로 변환
  const base64Image = arrayBufferToBase64(imageBuffer);

  // 2. Twitter media upload API (v1.1)
  const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';

  // OAuth 서명에는 media_data를 포함하지 않음 (빈 객체 전달)
  const oauth = generateOAuthHeader(
    'POST',
    uploadUrl,
    {},
    env.TWITTER_API_KEY,
    env.TWITTER_API_SECRET,
    env.TWITTER_ACCESS_TOKEN,
    env.TWITTER_ACCESS_TOKEN_SECRET
  );

  const formData = new URLSearchParams();
  formData.append('media_data', base64Image);

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': oauth,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: formData.toString()
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Twitter media upload error: ${JSON.stringify(data)}`);
  }

  return data.media_id_string;
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

// 페르소나 정의 (4가지 전문적 스타일)
function getPersona() {
  const hour = new Date().getUTCHours();
  const personaIndex = Math.floor(hour / 6) % 4; // 6시간마다 변경

  const personas = [
    {
      name: '전문 애널리스트',
      tone: 'professional',
      style: '격식있고 분석적인 톤. "~입니다", "~합니다" 사용. 데이터 중심 표현.',
      emoji: 1 // 이모지 최소화
    },
    {
      name: '경험많은 트레이더',
      tone: 'experienced',
      style: '경험을 바탕으로 한 실전 조언. "~네요", "~습니다" 혼용. 실전 팁 강조.',
      emoji: 2
    },
    {
      name: '리서치 분석가',
      tone: 'research',
      style: '객관적이고 데이터 기반. "~로 나타났습니다", "~확인됩니다" 사용. 시장 맥락 강조.',
      emoji: 1
    },
    {
      name: '시장 관찰자',
      tone: 'observer',
      style: '시장 흐름 관찰 중심. "~보입니다", "~것으로 관측됩니다" 사용. 심리적 측면 언급.',
      emoji: 2
    }
  ];

  return personas[personaIndex];
}

// 페르소나별 다양한 첫줄 훅
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

// 다양한 해시태그 풀 (트위터용 - 더 짧게)
function getHashtags() {
  const baseTags = ['#BTC', '#비트코인'];

  const trendTags = [
    ['#암호화폐', '#Crypto'],
    ['#차트분석', '#TA'],
    ['#트레이딩', '#Trading'],
    ['#코인투자', '#재테크'],
    ['#선물거래', '#마진'],
    ['#불장', '#Bull'],
    ['#매매일지', '#트레이더'],
    ['#비트겟', '#OKX']
  ];

  const hour = new Date().getUTCHours();
  const dayOfWeek = new Date().getUTCDay();

  const index1 = hour % trendTags.length;
  const index2 = (hour + dayOfWeek) % trendTags.length;

  const selectedTrends = [
    trendTags[index1][0],
    trendTags[index2][1] || trendTags[index2][0]
  ];

  return [...baseTags, ...selectedTrends].join(' ');
}

// OKX API에서 암호화폐 데이터 가져오기 (BTC, ETH 등)
async function fetchCryptoData(symbol) {
  const timeframe = '4H';
  const coinName = symbol.split('-')[0]; // BTC-USDT -> BTC

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

  // ETH가 BTC보다 2배 이상 변동률이 크면 ETH 선택
  if (ethChange > btcChange * 2 && ethChange > 3) {
    return ethData;
  }
  // 기본적으로 BTC
  return btcData;
}

// 시장 데이터 가져오기 (금/은 + Fear&Greed + 경제 시황)
async function fetchMarketData() {
  const result = {
    gold: null,
    silver: null,
    fearGreed: null,
    dominance: null
  };

  // 1. 금/은 가격 (GoldPrice API)
  try {
    const metalResponse = await fetch('https://data-asg.goldprice.org/dbXRates/USD');
    const metalData = await metalResponse.json();
    if (metalData.items && metalData.items[0]) {
      const item = metalData.items[0];
      result.gold = { price: Math.round(item.xauPrice), change: item.pcXau?.toFixed(2) };
      result.silver = { price: item.xagPrice?.toFixed(2), change: item.pcXag?.toFixed(2) };
    }
  } catch (e) {
    console.error('금/은 데이터 실패:', e);
  }

  // 2. Fear & Greed Index (Alternative.me 무료)
  try {
    const fgResponse = await fetch('https://api.alternative.me/fng/?limit=1');
    const fgData = await fgResponse.json();
    if (fgData.data && fgData.data[0]) {
      result.fearGreed = {
        value: parseInt(fgData.data[0].value),
        label: fgData.data[0].value_classification // Extreme Fear, Fear, Neutral, Greed, Extreme Greed
      };
    }
  } catch (e) {
    console.error('Fear&Greed 데이터 실패:', e);
  }

  // 3. BTC 도미넌스 (CoinGecko + 백업)
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
  } catch (e) {
    console.error('CoinGecko 도미넌스 실패:', e);
  }

  // 백업: 도미넌스 없으면 Blockchain.info에서 시도
  if (!result.dominance) {
    try {
      const btcMcap = await fetch('https://blockchain.info/q/marketcap');
      const totalMcap = await fetch('https://api.coinlore.net/api/global/');
      const btcMcapData = await btcMcap.text();
      const totalData = await totalMcap.json();
      if (btcMcapData && totalData?.[0]) {
        const btcDom = (parseFloat(btcMcapData) / (totalData[0].total_mcap * 1e9) * 100).toFixed(1);
        result.dominance = {
          btc: btcDom,
          eth: null,
          totalMarketCap: (totalData[0].total_mcap / 1000).toFixed(2)
        };
      }
    } catch (e) {
      console.error('백업 도미넌스 실패:', e);
    }
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

  // 매매 포인트 계산
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

// OpenAI로 스레드 콘텐츠 생성 (뉴스, ETH, 금/은 포함)
async function generateThreadContent(apiKey, mainCrypto, ethData, news = [], marketData = null) {
  const changeSign = parseFloat(mainCrypto.change24h) >= 0 ? '+' : '';
  const trendEmoji = parseFloat(mainCrypto.change24h) >= 0 ? '🟢' : '🔴';
  const tp = mainCrypto.tradingPoints;
  const hashtags = getHashtags();
  const hookExample = getRandomHook(mainCrypto);
  const isSideways = mainCrypto.trend === '횡보';
  const isETH = mainCrypto.symbol === 'ETH';

  // 뉴스 텍스트 구성 (제목 + 본문 요약 포함)
  const newsText = news.length > 0
    ? `\n## 🔴 중요: 최신 뉴스 (반드시 1개 이상 핵심 내용을 언급할 것!)
${news.map((n, i) => `
### 뉴스 ${i + 1}: ${n.title}
- 출처: ${n.source}
- 내용: ${n.summary}...
`).join('')}
위 뉴스 중 가장 중요한 것을 골라서 구체적인 수치나 내용을 언급해줘!`
    : '';

  // ETH 정보 (메인이 BTC일 때)
  const ethText = !isETH ? `
## 이더리움 현황 (참고용)
- ETH: $${ethData.currentPrice.toLocaleString()} (${parseFloat(ethData.change24h) >= 0 ? '+' : ''}${ethData.change24h}%)
- 추세: ${ethData.trend}
ETH가 특별히 움직이면 언급해도 좋음` : '';

  // 시장 심리 & 경제 시황 (항상 포함)
  const fearGreedText = marketData?.fearGreed ?
    `Fear & Greed: ${marketData.fearGreed.value} (${marketData.fearGreed.label})` : '';
  const dominanceText = marketData?.dominance ?
    `BTC 도미넌스: ${marketData.dominance.btc}% / ETH 도미: ${marketData.dominance.eth}% / 전체 시총: $${marketData.dominance.totalMarketCap}조` : '';
  const goldText = marketData?.gold ? `금: $${marketData.gold.price?.toLocaleString()}/oz` : '';

  // 시장 심리에 따른 멘트 가이드
  let sentimentGuide = '';
  if (marketData?.fearGreed?.value <= 25) {
    sentimentGuide = '→ 극단적 공포! "다들 패닉인데 오히려 기회일수도", "공포에 사라" 멘트';
  } else if (marketData?.fearGreed?.value <= 40) {
    sentimentGuide = '→ 공포 구간. "분위기 안 좋긴 한데", "무서워하는 사람 많네" 멘트';
  } else if (marketData?.fearGreed?.value >= 75) {
    sentimentGuide = '→ 극단적 탐욕! "FOMO 심한데 조심", "다들 불장이라는데 위험신호일수도" 멘트';
  } else if (marketData?.fearGreed?.value >= 60) {
    sentimentGuide = '→ 탐욕 구간. "분위기 좋긴 한데", "너무 낙관적인거 아닌가" 멘트';
  }

  const marketText = marketData ? `
## 📊 시장 심리 & 경제 시황 (반드시 1개 이상 자연스럽게 언급!)
- ${fearGreedText}
- ${dominanceText}
- ${goldText}
${sentimentGuide}

💡 복합적으로 글 쓰는 예시:
- "${mainCrypto.symbol} 횡보 중인데 금은 $${marketData.gold?.price?.toLocaleString() || '2700'} 신고가네"
- "공포지수 ${marketData.fearGreed?.value || '??'}인데 차트는 나쁘지 않음"
- "도미넌스 ${marketData.dominance?.btc || '??'}%라 알트 힘 빠지는 중"
- "ETH가 ${ethData.change24h}% 움직였네 비트보다 변동 큼"` : '';

  // 항상 포함되는 복합 콘텐츠 가이드
  const diverseTopics = `
## 💡 복합적인 글 작성 (차트 분석 + 아래 중 1-2개 섞기)
- 금/은 가격과 비트코인 비교 ("금은 올랐는데 비트는...", "안전자산 흐름이...")
- Fear & Greed 지수 ("공포지수 보니까...", "시장 심리가...")
- 도미넌스 흐름 ("BTC 도미 올라가는데...", "알트들 힘 빠지네")
- ETH 동향 ("이더는 ${ethData.change24h}%인데...", "이더 차트도 비슷하네")
- 거시경제 ("금리 동결이라...", "달러가...", "나스닥이...")
${isSideways ? '- 횡보 공감 ("언제 터지냐", "지루하다 ㅋㅋ")' : ''}`;

  const persona = getPersona();

  // 랜덤 스타일 선택 (매번 다른 느낌)
  const styleVariations = [
    { type: '질문형', hook: '솔직히 지금 들어가도 될까?', tone: '고민하는 느낌으로' },
    { type: '단정형', hook: '오늘 이 자리가 중요하다', tone: '확신 있게' },
    { type: '비교형', hook: '어제랑 분위기가 다르다', tone: '변화를 포착한 느낌' },
    { type: '경고형', hook: '이 구간 무시하면 안 됨', tone: '주의를 주는 느낌' },
    { type: '기회형', hook: '여기가 기회일 수 있다', tone: '긍정적이지만 신중하게' },
    { type: '관찰형', hook: '재밌는 게 보인다', tone: '발견한 느낌으로' },
  ];
  const randomStyle = styleVariations[Math.floor(Math.random() * styleVariations.length)];

  const prompt = `당신은 "${persona.name}" 스타일의 트위터 트레이더입니다.
${persona.style}

오늘의 글 스타일: ${randomStyle.type}
톤: ${randomStyle.tone}
참고 훅 예시: "${randomStyle.hook}"

## 현재 ${mainCrypto.symbol} 데이터
- 현재가: $${mainCrypto.currentPrice.toLocaleString()} (${changeSign}${mainCrypto.change24h}%)
- EMA: ${mainCrypto.ema.status}
- RSI: ${mainCrypto.rsi.value} (${mainCrypto.rsi.status})
- 볼밴: ${mainCrypto.bb.position}
- 지지: $${mainCrypto.support} / 저항: $${mainCrypto.resistance}
- 추세: ${mainCrypto.trend}
${ethText}
${marketText}
${newsText}

## 매매 포인트
- 롱: $${tp.longEntry} 진입 → $${tp.longTP1}~$${tp.longTP2} 목표
- 숏: $${tp.shortEntry} 진입 → $${tp.shortTP1}~$${tp.shortTP2} 목표

## 출력 (JSON)
{
  "mainTweet": "메인",
  "strategyReply": "전략",
  "promoReply": "홍보"
}

## 메인 트윗 (280자 이내) - ${randomStyle.type} 스타일로 작성

### 이번 글의 훅: "${randomStyle.hook}" 비슷한 느낌으로 시작
(매번 다른 표현 사용, 위 예시 그대로 복사 금지!)

### 구조 (자유롭게 변형 가능)
- 훅으로 시작 (${randomStyle.tone})
- 현재가 언급: ${trendEmoji} $${mainCrypto.currentPrice.toLocaleString()}
- 핵심 포인트 1-2개 (지지/저항, RSI, 추세 중 선택)
- 결론 또는 다음 액션
- ${hashtags}

### 포맷 변형 예시 (매번 다르게!)
A) 짧고 임팩트 있게 (3-4줄)
B) 분석적으로 (지표 언급하며)
C) 스토리텔링 (흐름 설명)
D) 질문으로 끝내기 (참여 유도)

## 전략 댓글 (280자 이내) - 실전 트레이더 스타일

### 구조
- 현재 유리한 방향 (롱/숏/관망)
- 진입가 & 손절가 (구체적 숫자)
- 목표가 (현실적으로)
- 한줄 조언 (멘탈 관리 or 리스크 관리)

### 예시 말투
- "나라면 여기서 롱 잡는다"
- "숏 치기엔 아직 이른 느낌"
- "손절 안 잡으면 거기서 끝이야"

## 홍보 댓글 (100자 이내) - 자연스럽게 (매번 다른 표현!)

### 다양한 유도 방식 (하나만 선택, 매번 다르게)
- 팔로우 유도: "이런 거 매일 올림 👀"
- 참여 유도: "너희 생각은? 댓글로"
- RT 유도: "공유하면 더 좋은 분석 올림"
- 링크 유도: "자세한 건 프로필 링크에서"
- 감사 인사: "봐줘서 고마움 🙏"
- 예고: "다음 분석은 ETH 예정"
- 질문: "진입 고민되면 물어봐"

## 절대 금지
- "🚨긴급!", "주목!", "필독!" 같은 스팸성 표현
- 너무 뻔한 말 ("변동성 주의하세요", "투자는 본인 책임")
- 확신 없는 표현 ("~일수도 있어요", "~인 것 같아요")
- 이모지 남발 (2-3개만)
- **이전과 똑같은 문장 구조 반복 금지**

## 다양성 규칙 (중요!)
- 매번 다른 훅으로 시작
- 매번 다른 포맷 사용
- 같은 표현 2번 연속 사용 금지
- 창의적이고 신선하게

## 핵심
- 읽는 사람이 "이 사람 팔로우해야겠다" 느끼게
- 남들과 다른 인사이트 제공
- 자신감 있되 겸손하게
- 실제 트레이더처럼

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
      temperature: 0.7,
      max_tokens: 2000
    })
  });

  const data = await response.json();

  if (!response.ok || !data.choices?.[0]?.message?.content) {
    throw new Error('OpenAI API 응답 오류: ' + JSON.stringify(data));
  }

  const content = data.choices[0].message.content.trim();

  // JSON 파싱
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('JSON 형식 아님');
  } catch (e) {
    // JSON 파싱 실패시 기본 형식
    return {
      mainTweet: `[BTC 4H] ${trendEmoji} $${btcData.currentPrice.toLocaleString()} (${changeSign}${btcData.change24h}%)\n\nEMA ${btcData.ema.status}, RSI ${btcData.rsi.value}\n지지 $${btcData.support} / 저항 $${btcData.resistance}\n${btcData.trend} 구간\n\n#BTC #비트코인 #차트분석`,
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

// Twitter에 게시 (답글 + 이미지 지원)
async function postToTwitter(env, text, replyToId = null, mediaId = null) {
  const body = { text };

  if (replyToId) {
    body.reply = { in_reply_to_tweet_id: replyToId };
  }

  if (mediaId) {
    body.media = { media_ids: [mediaId] };
  }

  const oauth = generateOAuthHeader(
    'POST',
    'https://api.twitter.com/2/tweets',
    {},
    env.TWITTER_API_KEY,
    env.TWITTER_API_SECRET,
    env.TWITTER_ACCESS_TOKEN,
    env.TWITTER_ACCESS_TOKEN_SECRET
  );

  const response = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      'Authorization': oauth,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Twitter API 오류: ${JSON.stringify(data)}`);
  }

  return data;
}

// OAuth 1.0a 헤더 생성
function generateOAuthHeader(method, url, params, apiKey, apiSecret, accessToken, accessTokenSecret) {
  const oauthParams = {
    oauth_consumer_key: apiKey,
    oauth_nonce: generateNonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: '1.0',
  };

  const allParams = { ...params, ...oauthParams };
  const sortedParams = Object.keys(allParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`)
    .join('&');

  const signatureBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessTokenSecret)}`;
  const signature = hmacSha1Sync(signingKey, signatureBase);

  oauthParams.oauth_signature = signature;

  return 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');
}

function generateNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

function hmacSha1Sync(key, message) {
  const keyBytes = stringToBytes(key);
  const messageBytes = stringToBytes(message);
  const blockSize = 64;

  let keyToUse = keyBytes;
  if (keyBytes.length > blockSize) {
    keyToUse = sha1(keyBytes);
  }

  const paddedKey = new Uint8Array(blockSize);
  paddedKey.set(keyToUse);

  const ipad = new Uint8Array(blockSize);
  const opad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    ipad[i] = paddedKey[i] ^ 0x36;
    opad[i] = paddedKey[i] ^ 0x5c;
  }

  const innerData = new Uint8Array(ipad.length + messageBytes.length);
  innerData.set(ipad);
  innerData.set(messageBytes, ipad.length);
  const innerHash = sha1(innerData);

  const outerData = new Uint8Array(opad.length + innerHash.length);
  outerData.set(opad);
  outerData.set(innerHash, opad.length);
  const outerHash = sha1(outerData);

  return btoa(String.fromCharCode(...outerHash));
}

function stringToBytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    bytes.push(str.charCodeAt(i) & 0xff);
  }
  return new Uint8Array(bytes);
}

function sha1(data) {
  const bytes = data instanceof Uint8Array ? data : stringToBytes(data);

  let h0 = 0x67452301;
  let h1 = 0xEFCDAB89;
  let h2 = 0x98BADCFE;
  let h3 = 0x10325476;
  let h4 = 0xC3D2E1F0;

  const msgLen = bytes.length;
  const bitLen = msgLen * 8;

  let padLen = 64 - ((msgLen + 9) % 64);
  if (padLen === 64) padLen = 0;

  const padded = new Uint8Array(msgLen + 1 + padLen + 8);
  padded.set(bytes);
  padded[msgLen] = 0x80;

  const lenPos = padded.length - 8;
  for (let i = 0; i < 8; i++) {
    padded[lenPos + i] = (bitLen / Math.pow(2, (7 - i) * 8)) & 0xff;
  }

  for (let offset = 0; offset < padded.length; offset += 64) {
    const w = new Array(80);

    for (let i = 0; i < 16; i++) {
      w[i] = (padded[offset + i * 4] << 24) |
             (padded[offset + i * 4 + 1] << 16) |
             (padded[offset + i * 4 + 2] << 8) |
             (padded[offset + i * 4 + 3]);
    }

    for (let i = 16; i < 80; i++) {
      const val = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = (val << 1) | (val >>> 31);
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4;

    for (let i = 0; i < 80; i++) {
      let f, k;
      if (i < 20) {
        f = (b & c) | ((~b) & d);
        k = 0x5A827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ED9EBA1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8F1BBCDC;
      } else {
        f = b ^ c ^ d;
        k = 0xCA62C1D6;
      }

      const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) & 0xffffffff;
      e = d;
      d = c;
      c = ((b << 30) | (b >>> 2)) & 0xffffffff;
      b = a;
      a = temp;
    }

    h0 = (h0 + a) & 0xffffffff;
    h1 = (h1 + b) & 0xffffffff;
    h2 = (h2 + c) & 0xffffffff;
    h3 = (h3 + d) & 0xffffffff;
    h4 = (h4 + e) & 0xffffffff;
  }

  const result = new Uint8Array(20);
  for (let i = 0; i < 4; i++) {
    result[i] = (h0 >>> (24 - i * 8)) & 0xff;
    result[i + 4] = (h1 >>> (24 - i * 8)) & 0xff;
    result[i + 8] = (h2 >>> (24 - i * 8)) & 0xff;
    result[i + 12] = (h3 >>> (24 - i * 8)) & 0xff;
    result[i + 16] = (h4 >>> (24 - i * 8)) & 0xff;
  }

  return result;
}
