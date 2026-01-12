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

    // 2. OKX API에서 BTC 데이터 가져오기
    const btcData = await fetchBTCData();

    // 3. OpenAI로 Threads용 콘텐츠 생성
    const content = await generateThreadsContent(env.OPENAI_API_KEY, btcData);

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
      btcData: btcData,
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

// OpenAI로 Threads용 콘텐츠 생성
async function generateThreadsContent(apiKey, btcData) {
  const changeSign = parseFloat(btcData.change24h) >= 0 ? '+' : '';
  const trendEmoji = parseFloat(btcData.change24h) >= 0 ? '🟢' : '🔴';
  const tp = btcData.tradingPoints;

  const prompt = `너는 Threads에서 유명한 코인 트레이더야. 팔로워 3만명 있고 매일 차트 분석 올림.
BTC 4시간봉 분석 스레드를 작성해줘.

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

## 출력 형식 (JSON)
{
  "mainPost": "메인 포스트 (차트 분석)",
  "strategyReply": "댓글1 (매매 전략)",
  "promoReply": "댓글2 (홍보 멘트)"
}

## 메인 포스트 규칙 (500자 이내)
- 첫줄: [BTC 4H] ${trendEmoji} $${btcData.currentPrice.toLocaleString()} (${changeSign}${btcData.change24h}%)
- 차트 분석 상세하게: EMA 배열, RSI, 볼밴, 주요 지지/저항
- 현재 상황 분석
- 해시태그: #BTC #비트코인 #차트분석 #암호화폐 #트레이딩

## 댓글1 규칙 (매매 전략, 400자 이내)
- 🎯 롱/숏 어느쪽이 유리한지
- 진입가, 손절가, 목표가 구체적으로
- 리스크 관리 언급
- 전문가처럼 but 친근하게

## 댓글2 규칙 (홍보, 150자 이내)
- 실시간 차트 분석이나 시그널 얘기
- "가입하세요" 이런 말 절대 금지
- 자연스럽게 관심 유도만

## 말투 규칙 (매우 중요!)
- "~입니다", "~됩니다" 금지 → "~임", "~중", "~듯", "~네"
- 가끔 "ㅋㅋ", "ㄷㄷ", "흠", "오" 자연스럽게
- 이모지 적당히 (2-3개)
- 실제 트레이더가 쓴 것처럼 전문적이면서 편함
- Threads는 트위터보다 좀 더 길게 써도 됨

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

// 랜덤 프로모 링크 선택
function getRandomPromoLink() {
  const links = [
    {
      type: 'telegram',
      text: '👉 https://t.me/V30_Signal_bot'
    },
    {
      type: 'bitget',
      text: '👉 비트겟 https://partner.bitget.com/bg/AZ6Z8S (추천코드: 63sl3029)'
    }
  ];
  return links[Math.floor(Math.random() * links.length)];
}
