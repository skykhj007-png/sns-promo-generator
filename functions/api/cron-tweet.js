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
    // 1. OKX API에서 BTC 데이터 가져오기
    const btcData = await fetchBTCData();

    // 2. 실시간 크립토 뉴스 가져오기
    const news = await fetchCryptoNews();

    // 3. OpenAI로 메인 분석 + 댓글 내용 생성 (뉴스 포함)
    const content = await generateThreadContent(env.OPENAI_API_KEY, btcData, news);

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
      btcData: btcData,
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
      const recentNews = data.Data.slice(0, 3).map(item => ({
        title: item.title,
        source: item.source,
        categories: item.categories
      }));
      return recentNews;
    }
    return [];
  } catch (error) {
    console.error('뉴스 가져오기 실패:', error);
    return [];
  }
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

// OKX API에서 BTC 데이터 가져오기
async function fetchBTCData() {
  const symbol = 'BTC-USDT';
  const timeframe = '4H';

  const candleResponse = await fetch(
    `https://www.okx.com/api/v5/market/candles?instId=${symbol}&bar=${timeframe}&limit=100`
  );
  const candleData = await candleResponse.json();

  const tickerResponse = await fetch(
    `https://www.okx.com/api/v5/market/ticker?instId=${symbol}`
  );
  const tickerData = await tickerResponse.json();

  if (!candleData.data || !tickerData.data) {
    throw new Error('OKX API 데이터 없음');
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
    symbol: 'BTC',
    timeframe: '4H',
    currentPrice,
    change24h: changePercent,
    ...analysis
  };
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

// OpenAI로 스레드 콘텐츠 생성 (뉴스 포함)
async function generateThreadContent(apiKey, btcData, news = []) {
  const changeSign = parseFloat(btcData.change24h) >= 0 ? '+' : '';
  const trendEmoji = parseFloat(btcData.change24h) >= 0 ? '🟢' : '🔴';
  const tp = btcData.tradingPoints;
  const hashtags = getHashtags();

  // 뉴스 텍스트 구성
  const newsText = news.length > 0
    ? `\n## 최신 BTC 관련 뉴스\n${news.map((n, i) => `${i + 1}. ${n.title} (${n.source})`).join('\n')}`
    : '';

  const prompt = `너는 트위터에서 유명한 코인 트레이더야. 팔로워 5만명 있고 매일 차트 분석 올림.
사람들이 스크롤 멈추고 볼 정도로 눈길 끄는 BTC 분석 스레드를 작성해줘.

## 현재 BTC 데이터
- 현재가: $${btcData.currentPrice.toLocaleString()}
- 24h 변동: ${changeSign}${btcData.change24h}%
- EMA: ${btcData.ema.status} (7: ${btcData.ema.ema7} / 25: ${btcData.ema.ema25} / 99: ${btcData.ema.ema99})
- RSI: ${btcData.rsi.value} (${btcData.rsi.status})
- 볼밴: ${btcData.bb.position}
- 지지: $${btcData.support} / 저항: $${btcData.resistance}
- 캔들: ${btcData.candle}
- 거래량: ${btcData.volume}
- 추세: ${btcData.trend}

## 매매 포인트
- 롱 진입: $${tp.longEntry} / 손절: $${tp.longSL} / TP1: $${tp.longTP1} / TP2: $${tp.longTP2}
- 숏 진입: $${tp.shortEntry} / 손절: $${tp.shortSL} / TP1: $${tp.shortTP1} / TP2: $${tp.shortTP2}
${newsText}

## 출력 형식 (JSON)
{
  "mainTweet": "메인 트윗 (차트 분석 + 뉴스)",
  "strategyReply": "댓글1 (매매 전략)",
  "promoReply": "댓글2 (홍보 멘트)"
}

## 메인 트윗 규칙 (280자 이내) - 이목 끌기 중요!
- 첫줄 훅: 강렬하게 시작 (예: "🚨 BTC 주목", "⚠️ 중요 구간", "🔥 움직인다")
- 가격: ${trendEmoji} $${btcData.currentPrice.toLocaleString()} (${changeSign}${btcData.change24h}%)
- 차트 핵심: EMA, RSI, 지지/저항 짧게
- 뉴스 있으면 짧게 언급 (예: "~~ 뉴스 영향")
- 해시태그: ${hashtags}

## 댓글1 규칙 (매매 전략, 280자 이내)
- 🎯 롱/숏 방향 명확하게
- 구체적 수치: 진입가, 손절가, 목표가
- 긴박감 (예: "지금 아니면 늦음", "이 구간 놓치면 추격각")

## 댓글2 규칙 (홍보, 100자 이내)
- 자연스럽게 관심 유도만
- "가입하세요" 같은 직접적 권유 금지
- 예: "실시간으로 같이 보는 중"

## 말투 규칙 (매우 중요!)
- "~입니다", "~됩니다" 금지 → "~임", "~중", "~듯", "~ㅇㅇ"
- 가끔 "ㅋㅋ", "ㄷㄷ", "흠", "오", "ㄹㅇ" 자연스럽게
- 이모지 2-3개
- 질문 던지기 (예: "여기서 롱?", "다들 어떻게 봐?")
- 실제 트레이더처럼 급하게 쓴 느낌

JSON만 출력해.`;

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
