// 4시간마다 자동 BTC 분석 트윗 게시
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

    // 2. OpenAI로 분석 글 생성
    const analysisText = await generateAnalysis(env.OPENAI_API_KEY, btcData);

    // 3. 랜덤으로 링크 선택 (텔레그램 or 비트겟)
    const promoLink = getRandomPromoLink();

    // 4. 최종 트윗 텍스트 생성 (280자 제한)
    const tweetText = formatTweet(analysisText, promoLink);

    // 5. Twitter에 게시
    const tweetResult = await postToTwitter(env, tweetText);

    return new Response(JSON.stringify({
      success: true,
      tweet: tweetText,
      twitterResponse: tweetResult,
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

// OKX API에서 BTC 데이터 가져오기
async function fetchBTCData() {
  const symbol = 'BTC-USDT';
  const timeframe = '4H';

  // 캔들 데이터 가져오기
  const candleResponse = await fetch(
    `https://www.okx.com/api/v5/market/candles?instId=${symbol}&bar=${timeframe}&limit=100`
  );
  const candleData = await candleResponse.json();

  // 티커 데이터 가져오기
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

  // 기술적 분석 계산
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

  // EMA 계산
  const ema7 = calculateEMA(closes, 7);
  const ema25 = calculateEMA(closes, 25);
  const ema99 = calculateEMA(closes, 99);

  // EMA 배열 상태
  const emaStatus = ema7 > ema25 && ema25 > ema99 ? '정배열' :
                    ema7 < ema25 && ema25 < ema99 ? '역배열' : '혼조';

  // RSI 계산
  const rsi = calculateRSI(closes, 14);
  const rsiStatus = rsi >= 70 ? '과매수' : rsi <= 30 ? '과매도' :
                    rsi >= 50 ? 'RSI 50 상회' : 'RSI 50 하회';

  // 볼린저 밴드
  const bb = calculateBollingerBands(closes, 20);
  const bbPosition = currentPrice > bb.upper ? '상단 돌파' :
                     currentPrice < bb.lower ? '하단 이탈' :
                     currentPrice > bb.middle ? '중심선 상방' : '중심선 하방';

  // 지지/저항 계산
  const recentHighs = highs.slice(-20);
  const recentLows = lows.slice(-20);
  const resistance = Math.max(...recentHighs);
  const support = Math.min(...recentLows);

  // 캔들 패턴 (최근 캔들)
  const lastCandle = candles[candles.length - 1];
  const candleBody = Math.abs(lastCandle.close - lastCandle.open);
  const candleRange = lastCandle.high - lastCandle.low;
  const candlePattern = candleBody < candleRange * 0.3 ? '도지' :
                        lastCandle.close > lastCandle.open ? '양봉' : '음봉';

  // 거래량 분석
  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const lastVolume = volumes[volumes.length - 1];
  const volumeStatus = lastVolume > avgVolume * 1.5 ? '거래량 급증' :
                       lastVolume > avgVolume ? '거래량 증가' : '거래량 감소';

  // 추세 판단
  const trend = emaStatus === '정배열' && rsi > 50 ? '상승 추세' :
                emaStatus === '역배열' && rsi < 50 ? '하락 추세' : '횡보/박스권';

  return {
    ema: { ema7: ema7.toFixed(2), ema25: ema25.toFixed(2), ema99: ema99.toFixed(2), status: emaStatus },
    rsi: { value: rsi.toFixed(1), status: rsiStatus },
    bb: { upper: bb.upper.toFixed(2), middle: bb.middle.toFixed(2), lower: bb.lower.toFixed(2), position: bbPosition },
    support: support.toFixed(2),
    resistance: resistance.toFixed(2),
    candle: candlePattern,
    volume: volumeStatus,
    trend
  };
}

// EMA 계산
function calculateEMA(data, period) {
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

// RSI 계산
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

// 볼린저 밴드 계산
function calculateBollingerBands(data, period) {
  const slice = data.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const squaredDiffs = slice.map(x => Math.pow(x - middle, 2));
  const stdDev = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / period);

  return {
    upper: middle + stdDev * 2,
    middle,
    lower: middle - stdDev * 2
  };
}

// OpenAI로 분석 글 생성
async function generateAnalysis(apiKey, btcData) {
  const prompt = `당신은 암호화폐 트레이더입니다. 아래 BTC 기술적 분석 데이터를 보고 트위터용 짧은 분석글을 작성하세요.

## 데이터
- 현재가: $${btcData.currentPrice.toLocaleString()}
- 24시간 변동: ${btcData.change24h}%
- EMA: ${btcData.ema.status} (EMA7: ${btcData.ema.ema7}, EMA25: ${btcData.ema.ema25})
- RSI: ${btcData.rsi.value} (${btcData.rsi.status})
- 볼린저밴드: ${btcData.bb.position}
- 지지: $${btcData.support} / 저항: $${btcData.resistance}
- 캔들: ${btcData.candle}
- 거래량: ${btcData.volume}
- 추세: ${btcData.trend}

## 규칙
1. 200자 이내로 작성 (링크/해시태그 제외)
2. 첫 줄: [BTC 4H봉] + 이모지 + 현재가, 변동률
3. 핵심 기술적 분석 포인트 2-3개
4. 매매 관점 (롱/숏/관망) 간단히
5. 마지막에 #BTC #비트코인 해시태그
6. 이모지 적절히 사용

바로 트윗 내용만 출력하세요.`;

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
      max_tokens: 300
    })
  });

  const data = await response.json();

  if (!response.ok || !data.choices?.[0]?.message?.content) {
    throw new Error('OpenAI API 응답 오류: ' + JSON.stringify(data));
  }

  return data.choices[0].message.content.trim();
}

// 랜덤 프로모 링크 선택
function getRandomPromoLink() {
  const links = [
    {
      type: 'telegram',
      text: '📢',
      url: 'https://t.me/V30_Signal_bot'
    },
    {
      type: 'bitget',
      text: '📢63sl3029',
      url: 'https://partner.bitget.com/bg/AZ6Z8S'
    }
  ];

  return links[Math.floor(Math.random() * links.length)];
}

// 트윗 포맷팅 (280자 제한)
function formatTweet(analysisText, promoLink) {
  // 해시태그와 프로모 링크
  const suffix = `\n${promoLink.text} ${promoLink.url}`;

  // 남은 글자 수 계산
  const maxAnalysisLength = 280 - suffix.length - 5; // 여유분 5자

  let text = analysisText;

  // 길이 초과시 자르기
  if (text.length > maxAnalysisLength) {
    text = text.substring(0, maxAnalysisLength - 3) + '...';
  }

  return text + suffix;
}

// Twitter에 게시
async function postToTwitter(env, text) {
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
    body: JSON.stringify({ text }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Twitter API 오류: ${JSON.stringify(data)}`);
  }

  return data;
}

// OAuth 1.0a 헤더 생성 (twitter.js에서 복사)
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

// HMAC-SHA1 구현
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
