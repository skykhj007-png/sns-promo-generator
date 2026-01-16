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

    // 4. 메인 포스트 게시
    const mainPost = await postToThreads(env.THREADS_ACCESS_TOKEN, userId, content.mainPost);

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

// 다양한 첫줄 훅 (30개 이상 - AI스럽지 않게)
function getRandomHook(btcData) {
  const change = parseFloat(btcData.change24h);
  const price = btcData.currentPrice.toLocaleString();
  const trend = btcData.trend;
  const rsi = parseFloat(btcData.rsi.value);

  // 상황별 훅 모음
  const bullishHooks = [
    `$${price} 뚫었다`,
    `오 이거 가는거 아님?`,
    `슬슬 올라오네`,
    `저항 테스트 중`,
    `흠 분위기 괜찮은데`,
    `ㄷㄷ 거래량 터지네`,
    `와 진짜 간다`,
    `롱충이들 축하해`,
    `여기서 눌리면 줍는다`,
    `이 구간 넘기면 날아갈듯`
  ];

  const bearishHooks = [
    `$${price} 지지 테스트`,
    `흠.. 좀 불안한데`,
    `숏충이 파티인가`,
    `지지선 깨지면 답없음`,
    `일단 관망 중`,
    `하락 채널 진행중`,
    `반등 나와야 하는데`,
    `여기서 버텨야함`,
    `손절 타이트하게`,
    `ㅋㅋ 또 떨어지네`
  ];

  const sidewaysHooks = [
    `횡보 지루하다`,
    `언제 터지냐`,
    `방향 못 잡는 중`,
    `눈치게임 중`,
    `위아래 다 열려있음`,
    `박스권 며칠째냐`,
    `터지면 크게 갈듯`,
    `아 답답해 ㅋㅋ`,
    `기다리는 중`,
    `곧 방향 나올듯`
  ];

  const rsiHooks = rsi >= 70 ? [
    `RSI ${rsi.toFixed(0)} 과매수 주의`,
    `좀 과열된거 아님?`,
    `단기 조정 올수도`
  ] : rsi <= 30 ? [
    `RSI ${rsi.toFixed(0)} 바닥권`,
    `ㄷㄷ 많이 빠졌네`,
    `반등 노려볼만?`
  ] : [];

  let hooks;
  if (trend === '상승추세' || change > 1) {
    hooks = [...bullishHooks, ...rsiHooks];
  } else if (trend === '하락추세' || change < -1) {
    hooks = [...bearishHooks, ...rsiHooks];
  } else {
    hooks = [...sidewaysHooks, ...rsiHooks];
  }

  // 시간+분을 시드로 사용해서 더 자주 바뀌게
  const now = new Date();
  const seed = now.getUTCHours() * 60 + now.getUTCMinutes();
  const index = seed % hooks.length;

  return hooks[index];
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

// Threads에 게시 (답글 지원)
async function postToThreads(accessToken, userId, text, replyToId = null) {
  // Step 1: 미디어 컨테이너 생성
  const createParams = new URLSearchParams({
    media_type: 'TEXT',
    text: text,
    access_token: accessToken
  });

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

  const prompt = `너는 Threads에서 5년째 매매하는 개인 트레이더야.
너무 전문가처럼 쓰지 말고, 그냥 매일 트레이딩하면서 느끼는 것들 툭툭 던지는 느낌으로.

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
- 롱/숏 중 뭐가 나은지 + 구체적 가격
- "지금 아니면 추격각" 같은 긴박감

## 홍보 댓글 (150자 이내)
- "실시간으로 같이 보는 중" 처럼 자연스럽게

## 말투 (제일 중요!!!)
- "~입니다/됩니다" → "~임/~중/~듯/~네"
- 자연스럽게: "ㅋㅋ", "ㄷㄷ", "흠", "오", "와", "ㄹㅇ", "아"
- 이모지 3-4개
- 질문: "여기서 롱?", "다들 어떻게 봄?"

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
