// Twitter API v2 - Tweet 게시 함수
export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS 헤더
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const { text } = await request.json();

    if (!text || text.length === 0) {
      return new Response(JSON.stringify({ error: '트윗 내용이 없습니다' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (text.length > 280) {
      return new Response(JSON.stringify({ error: '트윗은 280자를 초과할 수 없습니다' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Twitter API 키 (환경 변수에서 가져옴)
    const apiKey = env.TWITTER_API_KEY;
    const apiSecret = env.TWITTER_API_SECRET;
    const accessToken = env.TWITTER_ACCESS_TOKEN;
    const accessTokenSecret = env.TWITTER_ACCESS_TOKEN_SECRET;

    if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
      return new Response(JSON.stringify({ error: 'Twitter API 키가 설정되지 않았습니다' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // OAuth 1.0a 서명 생성
    const oauth = generateOAuthHeader(
      'POST',
      'https://api.twitter.com/2/tweets',
      {},
      apiKey,
      apiSecret,
      accessToken,
      accessTokenSecret
    );

    // Twitter API v2 호출
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
      console.error('Twitter API Error:', data);
      return new Response(JSON.stringify({
        error: data.detail || data.title || '트윗 게시 실패',
        details: data
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      tweet: data,
      message: '트윗이 성공적으로 게시되었습니다!'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// OPTIONS 요청 처리 (CORS preflight)
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
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

  // 모든 파라미터 합치기
  const allParams = { ...params, ...oauthParams };

  // 파라미터 정렬 및 인코딩
  const sortedParams = Object.keys(allParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`)
    .join('&');

  // 서명 베이스 문자열
  const signatureBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;

  // 서명 키
  const signingKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessTokenSecret)}`;

  // HMAC-SHA1 서명
  const signature = hmacSha1(signingKey, signatureBase);

  oauthParams.oauth_signature = signature;

  // Authorization 헤더 생성
  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');

  return authHeader;
}

// Nonce 생성
function generateNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

// HMAC-SHA1 (Web Crypto API 사용)
async function hmacSha1Async(key, message) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// 동기 버전을 위한 래퍼 (실제로는 비동기로 처리)
function hmacSha1(key, message) {
  // Cloudflare Workers에서는 동기 crypto가 없으므로 간단한 구현 사용
  // 실제 배포시에는 비동기 버전 사용
  return hmacSha1Sync(key, message);
}

// 간단한 HMAC-SHA1 구현 (Cloudflare Workers 호환)
function hmacSha1Sync(key, message) {
  // Base64 인코딩된 HMAC-SHA1
  const keyBytes = stringToBytes(key);
  const messageBytes = stringToBytes(message);

  // SHA1 블록 크기는 64바이트
  const blockSize = 64;

  // 키가 블록 크기보다 크면 해시
  let keyToUse = keyBytes;
  if (keyBytes.length > blockSize) {
    keyToUse = sha1(keyBytes);
  }

  // 키를 블록 크기로 패딩
  const paddedKey = new Uint8Array(blockSize);
  paddedKey.set(keyToUse);

  // ipad와 opad 생성
  const ipad = new Uint8Array(blockSize);
  const opad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    ipad[i] = paddedKey[i] ^ 0x36;
    opad[i] = paddedKey[i] ^ 0x5c;
  }

  // 내부 해시
  const innerData = new Uint8Array(ipad.length + messageBytes.length);
  innerData.set(ipad);
  innerData.set(messageBytes, ipad.length);
  const innerHash = sha1(innerData);

  // 외부 해시
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

// SHA1 구현
function sha1(data) {
  const bytes = data instanceof Uint8Array ? data : stringToBytes(data);

  // 초기 해시 값
  let h0 = 0x67452301;
  let h1 = 0xEFCDAB89;
  let h2 = 0x98BADCFE;
  let h3 = 0x10325476;
  let h4 = 0xC3D2E1F0;

  // 메시지 패딩
  const msgLen = bytes.length;
  const bitLen = msgLen * 8;

  // 패딩 계산
  let padLen = 64 - ((msgLen + 9) % 64);
  if (padLen === 64) padLen = 0;

  const padded = new Uint8Array(msgLen + 1 + padLen + 8);
  padded.set(bytes);
  padded[msgLen] = 0x80;

  // 길이를 빅엔디안으로 추가
  const lenPos = padded.length - 8;
  for (let i = 0; i < 8; i++) {
    padded[lenPos + i] = (bitLen / Math.pow(2, (7 - i) * 8)) & 0xff;
  }

  // 512비트 블록 처리
  for (let offset = 0; offset < padded.length; offset += 64) {
    const w = new Array(80);

    // 16개의 32비트 워드로 분할
    for (let i = 0; i < 16; i++) {
      w[i] = (padded[offset + i * 4] << 24) |
             (padded[offset + i * 4 + 1] << 16) |
             (padded[offset + i * 4 + 2] << 8) |
             (padded[offset + i * 4 + 3]);
    }

    // 80개로 확장
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

  // 결과를 바이트 배열로 변환
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
