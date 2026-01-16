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

    // 3. 메인 트윗 게시
    const mainTweet = await postToTwitter(env, content.mainTweet);
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

  // 1. 금/은 가격 (무료 API)
  try {
    const metalResponse = await fetch('https://api.metals.live/v1/spot');
    const metalData = await metalResponse.json();
    const gold = metalData.find(m => m.metal === 'gold');
    const silver = metalData.find(m => m.metal === 'silver');
    result.gold = gold ? { price: gold.price } : null;
    result.silver = silver ? { price: silver.price } : null;
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

  // 3. BTC 도미넌스 (CoinGecko 무료)
  try {
    const domResponse = await fetch('https://api.coingecko.com/api/v3/global');
    const domData = await domResponse.json();
    if (domData.data) {
      result.dominance = {
        btc: domData.data.market_cap_percentage?.btc?.toFixed(1),
        eth: domData.data.market_cap_percentage?.eth?.toFixed(1),
        totalMarketCap: (domData.data.total_market_cap?.usd / 1e12).toFixed(2) // 조 달러
      };
    }
  } catch (e) {
    console.error('도미넌스 데이터 실패:', e);
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

  const prompt = `너는 트위터에서 5년째 매매하는 개인 트레이더야.
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
  "mainTweet": "메인",
  "strategyReply": "매매전략 댓글",
  "promoReply": "홍보 댓글"
}

## 메인 트윗 작성법 (280자 이내)
1. 첫줄: "${hookExample}" 이런 식으로 시작 (🚨BTC주목 같은 AI틱한거 절대 금지)
2. 가격 정보: ${trendEmoji} $${mainCrypto.currentPrice.toLocaleString()}
3. 차트 핵심만 2-3줄
4. 뉴스/금/은/ETH 등 관련 내용 자연스럽게 섞기
5. 해시태그: ${hashtags}

## 매매전략 댓글 (280자 이내)
- 🎯 이모지로 시작
- 롱/숏 중 뭐가 나은지 + 구체적 가격
- "지금 아니면 추격각" 같은 긴박감

## 홍보 댓글 (100자 이내)
- "실시간으로 같이 보는 중" 처럼 자연스럽게

## 말투 (제일 중요!!!)
- "~입니다/됩니다" → "~임/~중/~듯/~네"
- 자연스럽게: "ㅋㅋ", "ㄷㄷ", "흠", "오", "ㄹㅇ", "아"
- 이모지 2-3개만
- 질문: "여기서 롱?", "어떻게 봄?"
- 완벽한 문장 말고 메모하듯이

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
      max_tokens: 800
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

// Twitter에 게시 (답글 지원)
async function postToTwitter(env, text, replyToId = null) {
  const body = { text };

  if (replyToId) {
    body.reply = { in_reply_to_tweet_id: replyToId };
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
