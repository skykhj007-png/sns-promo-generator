import React, { useState, useEffect, useRef } from 'react';
import { Copy, Upload, ChevronDown, ChevronUp, Instagram, Facebook, Twitter, Sparkles, Target, MessageSquare, Hash, Image, Zap, Settings, Loader, Key, Camera, Eye, X, Lock, Shield, AlertTriangle, TrendingUp, Download } from 'lucide-react';
import html2canvas from 'html2canvas';

// v1.6 - 패턴 분석 기능 추가 (2026-01-09)
const API_URL = 'https://blog-gen-api.myblog-tools.workers.dev';

const SNSPromoGenerator = () => {
  // 플랫폼 선택 (다중 선택 가능)
  const [platforms, setPlatforms] = useState({
    instagram: true,
    facebook: false,
    twitter: false,
    threads: false
  });

  // 콘텐츠 유형
  const [contentType, setContentType] = useState('product'); // product, brand, event, general

  // 인스타그램 콘텐츠 형식
  const [instaFormat, setInstaFormat] = useState('feed'); // feed, story, reels

  // 기본 정보
  const [brandName, setBrandName] = useState('');
  const [productName, setProductName] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [keyMessage, setKeyMessage] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [cta, setCta] = useState(''); // Call to Action
  const [tone, setTone] = useState('friendly'); // friendly, professional, trendy, humorous

  // 추가 옵션
  const [includeEmoji, setIncludeEmoji] = useState(true);
  const [includePrice, setIncludePrice] = useState(false);
  const [price, setPrice] = useState('');
  const [discountInfo, setDiscountInfo] = useState('');
  const [eventPeriod, setEventPeriod] = useState('');

  // MD 파일 업로드
  const [mdContent, setMdContent] = useState('');

  // 생성된 프롬프트
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // AI API 관련 상태
  const [aiApiKey, setAiApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [contentCopySuccess, setContentCopySuccess] = useState(false);

  // 이미지 분석 관련 상태
  const [productImage, setProductImage] = useState(null); // 제품 사진 (base64)
  const [productImagePreview, setProductImagePreview] = useState(''); // 미리보기 URL
  const [referenceImage, setReferenceImage] = useState(null); // 기준 사진 (base64)
  const [referenceImagePreview, setReferenceImagePreview] = useState(''); // 기준 사진 미리보기
  const [referenceText, setReferenceText] = useState(''); // 기준 스타일 텍스트
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [imageAnalysisResult, setImageAnalysisResult] = useState('');
  const productImageRef = useRef(null);
  const referenceImageRef = useRef(null);
  const cardPreviewRef = useRef(null);

  // 이미지 카드 다운로드 상태
  const [showCardPreview, setShowCardPreview] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // 암호화폐 분석 관련 추가 필드
  const [referralCode, setReferralCode] = useState('63sl3029'); // 레퍼럴 코드 (비트겟 추천인)
  const [telegramUrl, setTelegramUrl] = useState('https://t.me/V30_Signal_bot'); // 텔레그램 주소
  const [cryptoTimeframe, setCryptoTimeframe] = useState('4H'); // 분석 시간대
  const [cryptoSymbol, setCryptoSymbol] = useState('BTC'); // 코인 심볼
  const [patternAnalysisResult, setPatternAnalysisResult] = useState(null); // 패턴 분석 결과
  const [isAnalyzingPattern, setIsAnalyzingPattern] = useState(false); // 패턴 분석 중

  // 실시간 트렌드 분석 관련 상태
  const [useTrendAnalysis, setUseTrendAnalysis] = useState(true);
  const [trendAnalysisResult, setTrendAnalysisResult] = useState('');

  // 라이선스 관련 상태
  const [licenseKey, setLicenseKey] = useState('');
  const [licenseInfo, setLicenseInfo] = useState(null);
  const [licenseError, setLicenseError] = useState('');
  const [isVerifyingLicense, setIsVerifyingLicense] = useState(false);
  const [showLicenseModal, setShowLicenseModal] = useState(false);

  // 블로그 생성기와 API 키 공유 (localStorage)
  useEffect(() => {
    const savedApiKey = localStorage.getItem('aiApiKey');
    if (savedApiKey) {
      setAiApiKey(savedApiKey);
    }
    // 저장된 라이선스 키 불러오기
    const savedLicenseKey = localStorage.getItem('snsLicenseKey');
    if (savedLicenseKey) {
      setLicenseKey(savedLicenseKey);
      verifyLicense(savedLicenseKey);
    }
  }, []);

  // 라이선스 검증 함수
  const verifyLicense = async (key) => {
    if (!key) {
      setLicenseInfo(null);
      setLicenseError('');
      return;
    }

    setIsVerifyingLicense(true);
    setLicenseError('');

    try {
      // 기존 블로그 생성기와 같은 API 사용
      const response = await fetch(`${API_URL}/api/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: key })
      });

      const data = await response.json();

      if (data.valid) {
        // 모든 유효한 라이선스로 SNS 생성기 사용 가능
        // tier에 따라 Pro 기능 제한
        const tier = data.tier || 'basic';
        const isSNSPro = tier === 'snsDeluxe' || tier === 'snsPremium' || tier === 'snsPro' || tier === 'pro' || tier === 'exchange' || tier === 'master';

        setLicenseInfo({
          ...data,
          tier: isSNSPro ? 'snsPro' : 'sns',
          originalTier: tier // 원본 tier 저장 (암호화폐 기능 체크용)
        });
        localStorage.setItem('snsLicenseKey', key);
        setShowLicenseModal(false);
      } else {
        setLicenseError(data.error || '유효하지 않은 라이선스 키입니다.');
        setLicenseInfo(null);
        localStorage.removeItem('snsLicenseKey');
      }
    } catch (err) {
      setLicenseError('라이선스 검증에 실패했습니다. 네트워크를 확인해주세요.');
      setLicenseInfo(null);
    }

    setIsVerifyingLicense(false);
  };

  // 라이선스 저장 및 검증
  const handleLicenseSubmit = () => {
    if (licenseKey.trim()) {
      verifyLicense(licenseKey.trim());
    }
  };

  // 라이선스 해제
  const handleLicenseLogout = () => {
    setLicenseKey('');
    setLicenseInfo(null);
    localStorage.removeItem('snsLicenseKey');
  };

  // Pro 기능 사용 가능 여부
  const isProFeatureAvailable = () => {
    return licenseInfo?.tier === 'snsPro';
  };

  // 암호화폐 분석 기능 사용 가능 여부 (master 또는 cryptoAccess 권한)
  const isCryptoAvailable = () => {
    const originalTier = licenseInfo?.originalTier;
    // master는 항상 가능, cryptoAccess tier는 문의 후 부여
    return originalTier === 'master' || originalTier === 'cryptoAccess';
  };

  // API 키 저장
  const saveApiKey = (key) => {
    setAiApiKey(key);
    localStorage.setItem('aiApiKey', key);
    localStorage.setItem('aiProvider', 'gemini');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setMdContent(event.target.result);
      };
      reader.readAsText(file);
    }
  };

  // 제품 이미지 업로드 처리
  const handleProductImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // 미리보기용 URL
      setProductImagePreview(URL.createObjectURL(file));

      // base64 변환
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target.result.split(',')[1];
        setProductImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  // 기준 이미지 업로드 처리
  const handleReferenceImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setReferenceImagePreview(URL.createObjectURL(file));

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target.result.split(',')[1];
        setReferenceImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  // 이미지 삭제
  const removeProductImage = () => {
    setProductImage(null);
    setProductImagePreview('');
    if (productImageRef.current) productImageRef.current.value = '';
  };

  const removeReferenceImage = () => {
    setReferenceImage(null);
    setReferenceImagePreview('');
    if (referenceImageRef.current) referenceImageRef.current.value = '';
  };

  // AI 이미지 분석 함수
  const analyzeImageWithAI = async () => {
    if (!aiApiKey) {
      alert('AI 이미지 분석을 위해 설정에서 Gemini API 키를 입력해주세요.');
      setShowSettings(true);
      return;
    }

    if (!productImage) {
      alert('분석할 제품 사진을 먼저 업로드해주세요.');
      return;
    }

    setIsAnalyzing(true);
    setImageAnalysisResult('');

    try {
      const selectedPlatforms = getSelectedPlatforms();
      const platformInfo = selectedPlatforms.length > 0
        ? selectedPlatforms.map(p => getPlatformLabel(p)).join(', ')
        : '인스타그램';

      let prompt = '';
      let imageParts = [];

      if (referenceImage) {
        // 기준 사진이 있는 경우 - 비교 분석
        prompt = `당신은 SNS 마케팅 전문 카피라이터입니다.

## 작업 요청
1. 먼저 "기준 사진"의 스타일, 톤, 분위기, 글쓰기 방식을 분석하세요.
2. 그 다음 "제품 사진"을 분석하세요.
3. 기준 사진의 스타일을 참고하여 제품 사진에 대한 SNS 홍보 글을 작성하세요.

## 기준 사진 분석 포인트
- 전체적인 분위기와 톤
- 사용된 색감과 조명
- 구도와 배치
- 어떤 감정/느낌을 전달하는지

## 제품 사진 분석 및 글쓰기
- 제품의 특징과 장점
- 타겟 고객에게 어필할 포인트
- 기준 사진 스타일에 맞는 톤앤매너로 작성

## 출력 형식
**[기준 사진 스타일 분석]**
(분석 내용)

**[제품 사진 분석]**
(분석 내용)

**[SNS 홍보 글 - ${platformInfo}]**
(기준 스타일을 적용한 홍보 글)

${includeEmoji ? '이모지를 적극 활용하세요.' : ''}
톤앤매너: ${getToneLabel(tone)}
${brandName ? `브랜드명: ${brandName}` : ''}
${productName ? `제품명: ${productName}` : ''}`;

        imageParts = [
          { inlineData: { mimeType: 'image/jpeg', data: referenceImage } },
          { text: '위는 기준 사진입니다.' },
          { inlineData: { mimeType: 'image/jpeg', data: productImage } },
          { text: '위는 제품 사진입니다.\n\n' + prompt }
        ];
      } else {
        // 제품 사진만 있는 경우 - 단독 분석
        if (contentType === 'crypto') {
          // 암호화폐 차트 분석 모드
          // 패턴 분석 결과가 있으면 프롬프트에 포함
          const patternInfo = patternAnalysisResult && !patternAnalysisResult.error ? `
## 실시간 패턴 분석 데이터 (OKX API)
아래 데이터를 분석에 반드시 참고하여 글에 반영하세요:
- 코인: ${patternAnalysisResult.symbol}
- 시간대: ${getTimeframeLabel(patternAnalysisResult.timeframe)}봉
- 현재가: $${patternAnalysisResult.currentPrice?.toLocaleString()}
- 거래량: ${patternAnalysisResult.features.volRatio.toFixed(1)}x (${patternAnalysisResult.features.volRatio >= 2 ? '급증' : patternAnalysisResult.features.volRatio >= 1.5 ? '증가' : '보통'})
- 위치: ${patternAnalysisResult.features.position.toFixed(0)}% (${patternAnalysisResult.features.position >= 80 ? '고점권' : patternAnalysisResult.features.position >= 60 ? '상단' : patternAnalysisResult.features.position >= 40 ? '중간' : patternAnalysisResult.features.position >= 20 ? '하단' : '저점권'})
- 추세: ${patternAnalysisResult.features.upCount}/5 양봉 (${patternAnalysisResult.features.upCount >= 4 ? '강상승' : patternAnalysisResult.features.upCount >= 3 ? '상승' : patternAnalysisResult.features.upCount <= 1 ? '하락' : '횡보'})
- 유사패턴: ${patternAnalysisResult.stats.count}건 분석됨
- 10봉 후 상승확률: ${patternAnalysisResult.stats.upProb10}%
- 평균 변화율: ${patternAnalysisResult.stats.avgChange10 > 0 ? '+' : ''}${patternAnalysisResult.stats.avgChange10}%
- 예측 방향: ${patternAnalysisResult.prediction} (신뢰도: ${patternAnalysisResult.confidence})
` : '';

          prompt = `암호화폐 차트 이미지를 상세히 분석하고 SNS 글을 작성하세요.
${patternInfo}
${referenceText ? `참고 스타일:\n${referenceText}\n` : ''}

## 🔍 차트 이미지 분석 (이미지 기반 + 전문 분석!)

### 차트에서 보이는 것 분석:
1. **거래량 분석**: 거래량 바 - 증가/감소 추세, 거래량 폭발 캔들, 거래량 다이버전스
2. **지지/저항 구간**: 여러 번 반등/저항받은 가격대, 매물대 분석
3. **캔들 패턴**: 도지, 망치형, 장악형, 샅별형, 하라미 등
4. **이동평균선**: MA 배열 (정배열/역배열), 골든크로스/데드크로스, 지지/저항 역할
5. **볼린저밴드**: 밴드 폭 (수축=큰 변동 예고), 현재 가격 위치
6. **추세선 & 채널**: 상승/하락 추세선, 평행 채널
7. **보조지표**: RSI (과매수/과매도), MACD (시그널 크로스), 스토캐스틱

### 전문 분석 요소 (글에 포함):
- **CME 갭**: 주말 CME 선물 마감 후 발생한 갭 위치, 갭 메우기 가능성
- **피보나치 되돌림**: 0.382, 0.5, 0.618 레벨 분석
- **청산 레벨**: 예상 롱/숏 청산 집중 구간
- **펀딩비**: 롱/숏 과열 여부
- **미결제약정(OI)**: 포지션 증가/감소 추세
- **공포탐욕지수**: 현재 시장 심리

## 출력 규칙
🚫 절대 금지: "좋습니다", "알겠습니다" 등 인사말, "**[라벨]**" 형식
✅ 바로 복사 가능한 글만 출력!

## 출력 형식 (${platformInfo})
${selectedPlatforms.includes('threads') ? `
---메인글---
(480~500자 꽉 채워서!)

🚨 [코인명] [시간봉] 긴급 분석 🚨

📊 시장 현황:
- 현재가 & 24h 변동
- 거래량 분석 (특이사항)
- CME 갭 위치 언급 (있다면)

🔍 기술적 분석:
- 주요 지지/저항 구간 (피보나치 레벨 포함)
- 이평선 배열 & 볼린저밴드 상태
- 캔들 패턴 & RSI/MACD 신호

💰 매매 전략:
📈 롱: 진입 / TP1 / TP2 / SL
📉 숏: 진입 / TP1 / TP2 / SL

🔥 텔레그램에서 제가 직접 제작한 시그널 지표 무료 공유! 실시간 차트 분석 & 토론 함께해요!
👉 비트겟: https://partner.bitget.com/bg/AZ6Z8S (추천인: 63sl3029)
📢 채널: https://t.me/V38_Signal

#BTC #비트코인 #차트분석 #매매전략 #코인

⚠️ 투자 책임은 본인에게 있습니다.

---댓글글---
📌 심화 분석

🎯 청산 레벨:
- 롱 청산 집중구간: $XX,XXX
- 숏 청산 집중구간: $XX,XXX

📈 추가 지표:
- 펀딩비 현황
- 미결제약정(OI) 추세
- 시장 심리 (공포/탐욕)

💬 더 자세한 분석이 궁금하시면 텔레그램에서 만나요!
문의: https://t.me/V30_Signal_bot
` : ''}${selectedPlatforms.includes('instagram') ? `
---인스타그램--- (1500~2000자 상세하게!)

🚨 [코인명] [시간봉] 전문 분석 🚨

📊 시장 현황 분석:
- 현재가, 24h 변동률, 주요 뉴스
- 거래량 분석 (이전 대비, 특이 캔들)
- CME 갭 분석 (위치, 메우기 가능성)

🔍 기술적 분석:
- 주요 지지선/저항선 (가격대 + 이유)
- 피보나치 되돌림 레벨 (0.382, 0.5, 0.618)
- 이평선 분석 (골든크로스/데드크로스, 배열)
- 볼린저밴드 (수축/확장, 현재 위치)
- RSI & MACD 분석
- 캔들 패턴

📈 온체인 & 파생상품:
- 청산 레벨 (롱/숏 집중 구간)
- 펀딩비 현황
- 미결제약정(OI) 추세
- 공포탐욕지수

💰 매매 전략:
📈 롱: 진입가 / 목표1 / 목표2 / 손절가 (근거 설명)
📉 숏: 진입가 / 목표1 / 목표2 / 손절가 (근거 설명)

🔥 텔레그램 채널에서 제가 직접 제작한 시그널 지표를 무료로 공유하고 있습니다! 실시간으로 차트 분석하고 함께 토론해요!

👉 비트겟 가입: https://partner.bitget.com/bg/AZ6Z8S (추천인: 63sl3029)
📢 텔레그램 채널: https://t.me/V38_Signal
💬 문의: https://t.me/V30_Signal_bot

해시태그 15개

⚠️ 본 분석은 개인적인 의견이며 투자 권유가 아닙니다. 투자의 책임은 본인에게 있습니다.
` : ''}${selectedPlatforms.includes('twitter') ? `
---트위터--- (280자 이내)

🚨 [코인명] [시간봉] 분석

📊 현재가 $XX,XXX
📈 지지: $XX,XXX / 저항: $XX,XXX
🎯 롱 진입 $XX,XXX → TP $XX,XXX
⚠️ CME갭 $XX,XXX 주목

🔥 시그널 지표 무료 공유 중!
📢 https://t.me/V38_Signal

#BTC #비트코인 #차트분석
` : ''}${selectedPlatforms.includes('facebook') ? `
---페이스북--- (800~1000자)

🚨 [코인명] [시간봉] 차트 분석 🚨

📊 시장 현황:
- 현재가 & 거래량 분석
- CME 갭 위치 (있다면)
- 주요 지지/저항 구간

🔍 기술적 분석:
- 이평선 & 볼린저밴드
- RSI/MACD 신호
- 피보나치 레벨

💰 매매 전략:
📈 롱: 진입 / TP1 / TP2 / SL
📉 숏: 진입 / TP1 / TP2 / SL

📈 파생상품 지표:
- 청산 레벨, 펀딩비, OI 추세

🔥 텔레그램에서 제가 직접 만든 시그널 지표 무료 공유! 함께 차트 보며 토론해요!
👉 비트겟: https://partner.bitget.com/bg/AZ6Z8S (추천인: 63sl3029)
📢 텔레그램: https://t.me/V38_Signal
💬 문의: https://t.me/V30_Signal_bot

#BTC #비트코인 #차트분석 #매매전략 #코인

⚠️ 투자 책임은 본인에게 있습니다.
` : ''}
${includeEmoji ? '이모지 적극 활용! (📈📉🎯⚠️💰🔥🚀📊💹)' : ''}
톤: ${getToneLabel(tone)}`;
        } else {
          prompt = `당신은 SNS 마케팅 전문 카피라이터입니다.

## 작업 요청
이 제품 사진을 분석하고 SNS 홍보 글을 작성해주세요.

## 분석 포인트
- 제품의 종류와 특징
- 색상, 디자인, 질감
- 사용 용도와 장점
- 타겟 고객층

## 출력 형식
**[사진 분석]**
(제품 분석 내용)

**[SNS 홍보 글 - ${platformInfo}]**
(완성된 홍보 글)

**[추천 해시태그]**
(관련 해시태그 15~20개)

${includeEmoji ? '이모지를 적극 활용하세요.' : ''}
톤앤매너: ${getToneLabel(tone)}
${brandName ? `브랜드명: ${brandName}` : ''}
${productName ? `제품명: ${productName}` : ''}`;
        }

        imageParts = [
          { inlineData: { mimeType: 'image/jpeg', data: productImage } },
          { text: prompt }
        ];
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${aiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: imageParts }],
            generationConfig: {
              temperature: 0.8,
              maxOutputTokens: 4000
            }
          })
        }
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || 'API 오류가 발생했습니다.');
      }

      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (content) {
        setImageAnalysisResult(content);
        // 분석 결과를 제품 설명에도 반영
        if (!productDesc) {
          const analysisMatch = content.match(/\[사진 분석\]\n?([\s\S]*?)(?=\n\*\*|\n##|$)/);
          if (analysisMatch) {
            setProductDesc(analysisMatch[1].trim().substring(0, 300));
          }
        }
      } else {
        throw new Error('이미지 분석에 실패했습니다.');
      }
    } catch (error) {
      console.error('이미지 분석 오류:', error);
      alert(`이미지 분석 중 오류가 발생했습니다.\n\n${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePlatformChange = (platform) => {
    setPlatforms(prev => ({
      ...prev,
      [platform]: !prev[platform]
    }));
  };

  const getSelectedPlatforms = () => {
    return Object.entries(platforms)
      .filter(([_, selected]) => selected)
      .map(([platform, _]) => platform);
  };

  const getPlatformLabel = (platform) => {
    const labels = {
      instagram: '인스타그램',
      facebook: '페이스북',
      twitter: '트위터/X',
      threads: '쓰레드'
    };
    return labels[platform];
  };

  const getToneLabel = (toneValue) => {
    const labels = {
      friendly: '친근한',
      professional: '전문적인',
      trendy: '트렌디한',
      humorous: '유머러스한'
    };
    return labels[toneValue];
  };

  const getContentTypeLabel = (type) => {
    const labels = {
      product: '제품/서비스 홍보',
      brand: '브랜드 홍보',
      event: '이벤트/캠페인',
      general: '일반 마케팅',
      crypto: '암호화폐 차트 분석'
    };
    return labels[type];
  };

  const generatePrompt = () => {
    const selectedPlatforms = getSelectedPlatforms();

    if (selectedPlatforms.length === 0) {
      alert('최소 1개 이상의 플랫폼을 선택해주세요!');
      return;
    }

    let prompt = `# SNS 홍보 콘텐츠 생성기 v1.0

당신은 SNS 마케팅 전문 카피라이터입니다. 바이럴 효과를 극대화하고 타겟 오디언스의 참여를 이끌어내는 콘텐츠를 작성합니다.

## 기본 정보
- **타겟 플랫폼**: ${selectedPlatforms.map(p => getPlatformLabel(p)).join(', ')}
- **콘텐츠 유형**: ${getContentTypeLabel(contentType)}
- **톤앤매너**: ${getToneLabel(tone)}
- **이모지 사용**: ${includeEmoji ? '사용' : '미사용'}
`;

    if (brandName) {
      prompt += `- **브랜드명**: ${brandName}\n`;
    }

    if (productName) {
      prompt += `- **제품/서비스명**: ${productName}\n`;
    }

    if (productDesc) {
      prompt += `- **제품 설명**: ${productDesc}\n`;
    }

    if (targetAudience) {
      prompt += `- **타겟 오디언스**: ${targetAudience}\n`;
    }

    if (keyMessage) {
      prompt += `- **핵심 메시지**: ${keyMessage}\n`;
    }

    if (cta) {
      prompt += `- **CTA (행동 유도)**: ${cta}\n`;
    }

    if (includePrice && price) {
      prompt += `- **가격 정보**: ${price}\n`;
    }

    if (discountInfo) {
      prompt += `- **할인/프로모션**: ${discountInfo}\n`;
    }

    if (eventPeriod) {
      prompt += `- **이벤트 기간**: ${eventPeriod}\n`;
    }

    if (hashtags) {
      prompt += `- **필수 해시태그**: ${hashtags}\n`;
    }

    // MD 파일 내용이 있는 경우
    if (mdContent.trim()) {
      prompt += `\n## 참고 자료\n\`\`\`\n${mdContent}\n\`\`\`\n\n위 내용을 참고하여 SNS 콘텐츠를 작성해주세요.\n`;
    }

    prompt += `\n---\n\n`;

    // 플랫폼별 작성 규칙
    prompt += `## 플랫폼별 작성 규칙\n\n`;

    if (platforms.instagram) {
      prompt += `### 인스타그램\n`;
      prompt += `**콘텐츠 형식**: ${instaFormat === 'feed' ? '피드 게시물' : instaFormat === 'story' ? '스토리' : '릴스'}\n\n`;

      if (instaFormat === 'feed') {
        prompt += `**피드 게시물 규칙**:\n`;
        prompt += `- 캡션 최대 2,200자 (권장: 150~300자)\n`;
        prompt += `- 첫 줄에 후킹 문구 (스크롤 멈추게 하는 한 문장)\n`;
        prompt += `- 줄바꿈으로 가독성 확보\n`;
        prompt += `- 해시태그 20~30개 (본문 아래 또는 첫 댓글)\n`;
        prompt += `- CTA 명확하게 (링크인바이오, 댓글, DM 등)\n`;
        prompt += `- 저장/공유 유도 문구 포함\n\n`;
        prompt += `**피드 캡션 구조**:\n`;
        prompt += `\`\`\`\n`;
        prompt += `[후킹 문구 - 호기심 유발]\n\n`;
        prompt += `[본문 - 핵심 내용 3~5줄]\n\n`;
        prompt += `[CTA - 행동 유도]\n\n`;
        prompt += `.\n.\n.\n`;
        prompt += `#해시태그 #해시태그 #해시태그...\n`;
        prompt += `\`\`\`\n\n`;
      } else if (instaFormat === 'story') {
        prompt += `**스토리 규칙**:\n`;
        prompt += `- 텍스트 짧고 임팩트 있게 (15자 내외)\n`;
        prompt += `- 이모지 적극 활용\n`;
        prompt += `- 스티커 활용 제안 (투표, 질문, 카운트다운 등)\n`;
        prompt += `- 스와이프 업 또는 링크 스티커 CTA\n`;
        prompt += `- 여러 장 시퀀스 구성\n\n`;
        prompt += `**스토리 구조 (3~5장)**:\n`;
        prompt += `\`\`\`\n`;
        prompt += `[1장] 주목 끌기 - 강렬한 질문/문장\n`;
        prompt += `[2장] 문제 제기 또는 공감\n`;
        prompt += `[3장] 솔루션/제품 소개\n`;
        prompt += `[4장] 혜택/특징 강조\n`;
        prompt += `[5장] CTA - 다음 행동 유도\n`;
        prompt += `\`\`\`\n\n`;
      } else {
        prompt += `**릴스 규칙**:\n`;
        prompt += `- 스크립트 15~60초 분량\n`;
        prompt += `- 첫 3초 강력한 후킹 (끝까지 보게 만들기)\n`;
        prompt += `- 자막용 텍스트 제공\n`;
        prompt += `- 트렌디한 표현과 밈 활용\n`;
        prompt += `- 캡션은 간결하게 + 해시태그\n\n`;
        prompt += `**릴스 스크립트 구조**:\n`;
        prompt += `\`\`\`\n`;
        prompt += `[0~3초] 후킹 - "이거 모르면 손해!"\n`;
        prompt += `[3~15초] 문제 상황 or 공감 포인트\n`;
        prompt += `[15~45초] 솔루션/제품 소개 및 시연\n`;
        prompt += `[45~60초] 결과 및 CTA\n\n`;
        prompt += `+ 릴스 캡션 (50자 내외)\n`;
        prompt += `+ 해시태그 15~20개\n`;
        prompt += `\`\`\`\n\n`;
      }
    }

    if (platforms.facebook) {
      prompt += `### 페이스북\n`;
      prompt += `**게시물 규칙**:\n`;
      prompt += `- 최적 길이: 40~80자 (짧을수록 참여율 높음)\n`;
      prompt += `- 긴 글은 '더 보기' 전에 핵심 배치\n`;
      prompt += `- 질문형 포스트로 댓글 유도\n`;
      prompt += `- 해시태그 2~5개 (과하면 역효과)\n`;
      prompt += `- 링크는 본문에 직접 삽입\n`;
      prompt += `- 공유하고 싶은 콘텐츠 (정보성, 감성)\n\n`;
      prompt += `**페이스북 구조**:\n`;
      prompt += `\`\`\`\n`;
      prompt += `[후킹 - 공감 또는 질문]\n\n`;
      prompt += `[본문 - 핵심 가치 전달]\n\n`;
      prompt += `[CTA - 링크, 댓글, 공유 유도]\n\n`;
      prompt += `#해시태그 #해시태그\n`;
      prompt += `\`\`\`\n\n`;
    }

    if (platforms.twitter) {
      prompt += `### 트위터/X\n`;
      prompt += `**게시물 규칙**:\n`;
      prompt += `- 280자 제한 (한글 기준 140자)\n`;
      prompt += `- 단문으로 임팩트 있게\n`;
      prompt += `- 스레드 활용 시 첫 트윗에 핵심\n`;
      prompt += `- 해시태그 1~2개 (너무 많으면 스팸처럼 보임)\n`;
      prompt += `- 리트윗 유도 문구\n`;
      prompt += `- 트렌드 키워드 활용\n\n`;
      prompt += `**트위터 구조**:\n`;
      prompt += `\`\`\`\n`;
      prompt += `[메인 트윗 - 140자 내외]\n`;
      prompt += `짧고 강렬한 메시지 + CTA + #해시태그\n\n`;
      prompt += `[스레드 필요시]\n`;
      prompt += `1/ 첫 번째 트윗 (메인 포인트)\n`;
      prompt += `2/ 세부 설명\n`;
      prompt += `3/ 추가 정보\n`;
      prompt += `4/ CTA\n`;
      prompt += `\`\`\`\n\n`;
    }

    if (platforms.threads) {
      prompt += `### 쓰레드 (Threads)\n`;
      prompt += `**게시물 규칙**:\n`;
      prompt += `- 500자 제한 (트위터보다 여유있음)\n`;
      prompt += `- 인스타그램 감성 + 트위터 대화체 결합\n`;
      prompt += `- 첫 줄에 강력한 후킹 문구\n`;
      prompt += `- 줄바꿈으로 가독성 확보\n`;
      prompt += `- 해시태그 3~5개 권장\n`;
      prompt += `- 댓글 유도하는 질문형 마무리\n`;
      prompt += `- 이모지 자연스럽게 활용\n`;
      prompt += `- 인스타그램 연동 시너지 고려\n\n`;
      prompt += `**쓰레드 구조**:\n`;
      prompt += `\`\`\`\n`;
      prompt += `[후킹 - 강렬한 첫 문장]\n\n`;
      prompt += `[본문 - 핵심 내용 2~4줄]\n`;
      prompt += `(줄바꿈으로 가독성 확보)\n\n`;
      prompt += `[CTA - 댓글/공유 유도 질문]\n\n`;
      prompt += `#해시태그 #해시태그 #해시태그\n`;
      prompt += `\`\`\`\n\n`;
    }

    // 콘텐츠 유형별 추가 지침
    prompt += `---\n\n## 콘텐츠 유형별 지침\n\n`;

    if (contentType === 'product') {
      prompt += `### 제품/서비스 홍보\n`;
      prompt += `- 제품의 핵심 USP(차별점) 강조\n`;
      prompt += `- 사용 전/후 비교 또는 문제 해결 스토리\n`;
      prompt += `- 사회적 증거 (리뷰, 판매량 등) 언급\n`;
      prompt += `- 구매 혜택 명확히 제시\n`;
      prompt += `- 긴급성/희소성 활용 (한정 수량, 기간 등)\n\n`;
    } else if (contentType === 'brand') {
      prompt += `### 브랜드 홍보\n`;
      prompt += `- 브랜드 스토리/비전 전달\n`;
      prompt += `- 감성적 연결 유도\n`;
      prompt += `- 브랜드 가치와 일상 연결\n`;
      prompt += `- 비하인드 스토리, 인사이드 콘텐츠\n`;
      prompt += `- 브랜드 톤앤매너 일관성 유지\n\n`;
    } else if (contentType === 'event') {
      prompt += `### 이벤트/캠페인\n`;
      prompt += `- 참여 방법 명확하게 설명\n`;
      prompt += `- 경품/혜택 매력적으로 강조\n`;
      prompt += `- 마감 기한으로 긴급성 부여\n`;
      prompt += `- 친구 태그, 공유 등 바이럴 요소\n`;
      prompt += `- 당첨자 발표 방법 안내\n\n`;
    } else if (contentType === 'crypto') {
      prompt += `### 암호화폐 차트 분석\n`;
      prompt += `- 차트 패턴 분석 (캔들스틱, 이동평균선, 지지/저항선)\n`;
      prompt += `- 기술적 지표 해석 (RSI, MACD, 볼린저밴드 등)\n`;
      prompt += `- 현재 시장 상황 요약\n`;
      prompt += `- 매수/매도 관점 제시 (롱/숏 포지션)\n`;
      prompt += `- 주요 가격대 (지지선, 저항선, 목표가)\n`;
      prompt += `- 리스크 관리 포인트 언급\n`;
      prompt += `- 투자 주의 문구 포함\n\n`;
    } else {
      prompt += `### 일반 마케팅\n`;
      prompt += `- 타겟 오디언스 공감 포인트 파악\n`;
      prompt += `- 정보성 + 엔터테인먼트 밸런스\n`;
      prompt += `- 시즌/트렌드 반영\n`;
      prompt += `- 팔로워와 대화하는 톤\n`;
      prompt += `- 저장하고 싶은 유용한 정보 제공\n\n`;
    }

    // 해시태그 전략
    prompt += `---\n\n## 해시태그 전략\n\n`;
    prompt += `**인스타그램**: 20~30개 권장\n`;
    prompt += `- 대형 태그 (100만+): 5개 - 노출 확대\n`;
    prompt += `- 중형 태그 (1만~100만): 15개 - 탐색 진입\n`;
    prompt += `- 소형 태그 (1만 미만): 10개 - 상위 노출\n`;
    prompt += `- 브랜드 고유 태그: 1~2개\n\n`;
    prompt += `**페이스북**: 2~5개 권장\n`;
    prompt += `**트위터**: 1~2개 권장\n`;
    prompt += `**쓰레드**: 3~5개 권장 (인스타그램보다 적게)\n\n`;

    // 출력 형식
    prompt += `---\n\n## 출력 형식\n\n`;
    prompt += `각 플랫폼별로 바로 복사-붙여넣기 가능한 완성된 콘텐츠를 제공해주세요.\n\n`;
    prompt += `**출력 구조**:\n`;
    prompt += `\`\`\`\n`;

    if (platforms.instagram) {
      prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      prompt += `인스타그램 ${instaFormat === 'feed' ? '피드' : instaFormat === 'story' ? '스토리' : '릴스'}\n`;
      prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      prompt += `[완성된 콘텐츠]\n\n`;
    }

    if (platforms.facebook) {
      prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      prompt += `페이스북\n`;
      prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      prompt += `[완성된 콘텐츠]\n\n`;
    }

    if (platforms.twitter) {
      prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      prompt += `트위터/X\n`;
      prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      prompt += `[완성된 콘텐츠]\n\n`;
    }

    if (platforms.threads) {
      prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      prompt += `쓰레드 (Threads)\n`;
      prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      prompt += `[완성된 콘텐츠]\n\n`;
    }

    prompt += `\`\`\`\n\n`;

    // 이미지 프롬프트
    prompt += `---\n\n## 이미지/영상 가이드\n\n`;
    prompt += `각 플랫폼별 콘텐츠에 어울리는 이미지 프롬프트도 함께 제공해주세요.\n\n`;
    prompt += `**이미지 프롬프트 형식**:\n`;
    prompt += `\`\`\`\n`;
    prompt += `추천 이미지 프롬프트:\n`;
    prompt += `[플랫폼명] - [구체적인 이미지 설명 100자 내외]\n`;
    prompt += `\`\`\`\n\n`;

    prompt += `---\n\n`;
    prompt += `## 버전 정보\n`;
    prompt += `- **버전**: v1.0\n`;
    prompt += `- **생성일**: ${new Date().toISOString().split('T')[0]}\n\n`;
    prompt += `**지금 바로 콘텐츠 작성을 시작해주세요!**`;

    setGeneratedPrompt(prompt);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedPrompt);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const copyContentToClipboard = () => {
    navigator.clipboard.writeText(generatedContent);
    setContentCopySuccess(true);
    setTimeout(() => setContentCopySuccess(false), 2000);
  };

  // 카드 이미지 다운로드 함수
  const downloadCardAsImage = async () => {
    if (!cardPreviewRef.current) return;

    setIsDownloading(true);
    try {
      const canvas = await html2canvas(cardPreviewRef.current, {
        backgroundColor: '#1a1a2e',
        scale: 2,
        useCORS: true,
        allowTaint: true
      });

      const link = document.createElement('a');
      link.download = `crypto-analysis-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('이미지 다운로드 오류:', error);
      alert('이미지 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsDownloading(false);
    }
  };

  // 분석 결과에서 SNS 포스팅 글만 추출
  const extractSNSContent = (result) => {
    if (!result) return '';

    let content = result;

    // 불필요한 서론 제거 (좋습니다, 알겠습니다 등으로 시작하는 문장)
    content = content.replace(/^(좋습니다|알겠습니다|네|물론|분석해|작성해)[^\n]*\n*/gi, '');

    // **[라벨]** 형식 제거
    content = content.replace(/\*\*\[[^\]]+\]\*\*\n?/g, '');

    // ## 헤더 제거
    content = content.replace(/^##[^\n]*\n/gm, '');

    // ---메인글---, ---댓글글--- 등 라벨 제거 (깔끔하게)
    content = content.replace(/---메인글---\n?/g, '');
    content = content.replace(/---댓글글---[^\n]*\n?/g, '\n');
    content = content.replace(/---인스타그램---[^\n]*\n?/g, '');
    content = content.replace(/---트위터---[^\n]*\n?/g, '');
    content = content.replace(/---페이스북---[^\n]*\n?/g, '');

    // 연속 빈줄 정리
    content = content.replace(/\n{3,}/g, '\n\n');

    return content.trim();
  };

  // 분석 결과에서 지지/저항선 및 방향성 정보 추출
  const extractChartAnalysis = (result) => {
    if (!result) return null;

    const analysis = {
      support: [],
      resistance: [],
      direction: 'neutral', // 'up', 'down', 'neutral'
      targets: []
    };

    // 지지선 추출 (다양한 패턴)
    const supportPatterns = [
      /주요\s*지지선?[:\s]*\$?([\d,]+)/gi,
      /지지[가대선]?[:\s]*\$?([\d,]+)/gi,
      /support[:\s]*\$?([\d,]+)/gi,
      /바닥[가대]?[:\s]*\$?([\d,]+)/gi
    ];

    supportPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(result)) !== null) {
        const price = match[1].replace(/,/g, '');
        if (!analysis.support.includes(price)) {
          analysis.support.push(price);
        }
      }
    });

    // 저항선 추출
    const resistancePatterns = [
      /주요\s*저항선?[:\s]*\$?([\d,]+)/gi,
      /저항[가대선]?[:\s]*\$?([\d,]+)/gi,
      /resistance[:\s]*\$?([\d,]+)/gi,
      /목표[가대]?[:\s]*\$?([\d,]+)/gi,
      /돌파\s*시도[:\s]*\$?([\d,]+)/gi
    ];

    resistancePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(result)) !== null) {
        const price = match[1].replace(/,/g, '');
        if (!analysis.resistance.includes(price)) {
          analysis.resistance.push(price);
        }
      }
    });

    // 방향성 추출
    if (/상승|롱|매수|강세|bullish|상방/i.test(result)) {
      analysis.direction = 'up';
    } else if (/하락|숏|매도|약세|bearish|하방/i.test(result)) {
      analysis.direction = 'down';
    }

    return analysis;
  };

  // ============================================
  // 패턴 분석 함수들 (OKX API)
  // ============================================

  // OKX 캔들 데이터 가져오기
  const getOKXCandles = async (symbol = 'BTC-USDT', interval = '4H', limit = 100) => {
    try {
      const url = `https://www.okx.com/api/v5/market/candles?instId=${symbol}&bar=${interval}&limit=${limit}`;
      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        return { error: `API 오류: ${response.status}` };
      }

      const result = await response.json();
      if (result.code !== '0' || !result.data || !Array.isArray(result.data)) {
        return { error: `데이터 오류: ${result.msg || result.code}` };
      }

      // OKX 데이터 형식: [timestamp, open, high, low, close, vol, volCcy, volCcyQuote, confirm]
      const candles = [...result.data].reverse().map(c => ({
        timestamp: parseInt(c[0]),
        open: parseFloat(c[1]),
        high: parseFloat(c[2]),
        low: parseFloat(c[3]),
        close: parseFloat(c[4]),
        volume: parseFloat(c[5]),
        quoteVolume: parseFloat(c[7])
      }));

      return candles;
    } catch (error) {
      return { error: `예외: ${error.message}` };
    }
  };

  // 거래량 비율 계산
  const calculateVolumeRatio = (candles, index, period = 20) => {
    if (index < period) return 1;
    let sumVol = 0;
    for (let i = index - period; i < index; i++) {
      sumVol += candles[i].volume;
    }
    return candles[index].volume / (sumVol / period);
  };

  // 현재 상황 특성 추출
  const extractPatternFeatures = (candles, index) => {
    if (index < 20) return null;

    const current = candles[index];
    const prev = candles[index - 1];

    const priceChange = ((current.close - prev.close) / prev.close) * 100;
    const volRatio = calculateVolumeRatio(candles, index, 20);

    const bodySize = Math.abs(current.close - current.open);
    const totalRange = current.high - current.low;
    const bodyRatio = totalRange > 0 ? bodySize / totalRange : 0;
    const isBullish = current.close > current.open;

    const upperWick = current.high - Math.max(current.open, current.close);
    const lowerWick = Math.min(current.open, current.close) - current.low;
    const upperWickRatio = totalRange > 0 ? upperWick / totalRange : 0;
    const lowerWickRatio = totalRange > 0 ? lowerWick / totalRange : 0;

    let upCount = 0;
    for (let i = index - 4; i <= index; i++) {
      if (candles[i].close > candles[i].open) upCount++;
    }

    let high20 = candles[index].high;
    let low20 = candles[index].low;
    for (let i = index - 19; i < index; i++) {
      high20 = Math.max(high20, candles[i].high);
      low20 = Math.min(low20, candles[i].low);
    }
    const position = high20 !== low20 ? ((current.close - low20) / (high20 - low20)) * 100 : 50;

    return {
      priceChange,
      volRatio,
      bodyRatio,
      isBullish,
      upperWickRatio,
      lowerWickRatio,
      upCount,
      position,
      totalRange: (totalRange / current.close) * 100
    };
  };

  // 유사도 점수 계산
  const calculateSimilarity = (features1, features2) => {
    const weights = {
      volRatio: 25, position: 20, priceChange: 15,
      bodyRatio: 10, upCount: 15, upperWickRatio: 7.5, lowerWickRatio: 7.5
    };

    let totalScore = 0;
    totalScore += Math.max(0, 100 - Math.abs(features1.volRatio - features2.volRatio) * 30) * (weights.volRatio / 100);
    totalScore += Math.max(0, 100 - Math.abs(features1.position - features2.position)) * (weights.position / 100);
    totalScore += Math.max(0, 100 - Math.abs(features1.priceChange - features2.priceChange) * 20) * (weights.priceChange / 100);
    totalScore += Math.max(0, 100 - Math.abs(features1.bodyRatio - features2.bodyRatio) * 100) * (weights.bodyRatio / 100);
    totalScore += Math.max(0, 100 - Math.abs(features1.upCount - features2.upCount) * 20) * (weights.upCount / 100);
    totalScore += Math.max(0, 100 - Math.abs(features1.upperWickRatio - features2.upperWickRatio) * 100) * (weights.upperWickRatio / 100);
    totalScore += Math.max(0, 100 - Math.abs(features1.lowerWickRatio - features2.lowerWickRatio) * 100) * (weights.lowerWickRatio / 100);

    return totalScore;
  };

  // 유사 패턴 찾기
  const findSimilarPatterns = (candles, currentFeatures, minSimilarity = 55) => {
    const results = [];

    for (let i = 25; i < candles.length - 25; i++) {
      const pastFeatures = extractPatternFeatures(candles, i);
      if (!pastFeatures) continue;

      const similarity = calculateSimilarity(currentFeatures, pastFeatures);

      if (similarity >= minSimilarity) {
        const price0 = candles[i].close;
        const after5 = i + 5 < candles.length ? candles[i + 5].close : null;
        const after10 = i + 10 < candles.length ? candles[i + 10].close : null;

        let maxUp = 0, maxDown = 0;
        for (let j = i + 1; j <= Math.min(i + 10, candles.length - 1); j++) {
          maxUp = Math.max(maxUp, ((candles[j].high - price0) / price0) * 100);
          maxDown = Math.min(maxDown, ((candles[j].low - price0) / price0) * 100);
        }

        results.push({
          index: i,
          date: new Date(candles[i].timestamp).toISOString().split('T')[0],
          similarity,
          after5Change: after5 ? ((after5 - price0) / price0) * 100 : null,
          after10Change: after10 ? ((after10 - price0) / price0) * 100 : null,
          maxUp,
          maxDown
        });
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, 15);
  };

  // 패턴 통계 계산
  const calculatePatternStats = (patterns) => {
    if (patterns.length === 0) return { count: 0 };

    let upCount5 = 0, upCount10 = 0;
    let totalChange5 = 0, totalChange10 = 0;
    let totalMaxUp = 0, totalMaxDown = 0;
    let validCount5 = 0, validCount10 = 0;

    for (const p of patterns) {
      if (p.after5Change !== null) {
        validCount5++;
        totalChange5 += p.after5Change;
        if (p.after5Change > 0) upCount5++;
      }
      if (p.after10Change !== null) {
        validCount10++;
        totalChange10 += p.after10Change;
        if (p.after10Change > 0) upCount10++;
      }
      totalMaxUp += p.maxUp;
      totalMaxDown += p.maxDown;
    }

    return {
      count: patterns.length,
      upProb5: validCount5 > 0 ? Math.round((upCount5 / validCount5) * 100) : 0,
      avgChange5: validCount5 > 0 ? (totalChange5 / validCount5).toFixed(2) : 0,
      upProb10: validCount10 > 0 ? Math.round((upCount10 / validCount10) * 100) : 0,
      avgChange10: validCount10 > 0 ? (totalChange10 / validCount10).toFixed(2) : 0,
      avgMaxUp: (totalMaxUp / patterns.length).toFixed(2),
      avgMaxDown: (totalMaxDown / patterns.length).toFixed(2)
    };
  };

  // 패턴 분석 실행
  const runPatternAnalysis = async () => {
    setIsAnalyzingPattern(true);
    setPatternAnalysisResult(null);

    try {
      const symbol = cryptoSymbol.toUpperCase() + '-USDT';
      const candles = await getOKXCandles(symbol, cryptoTimeframe, 100);

      if (candles.error) {
        setPatternAnalysisResult({ error: candles.error });
        return;
      }

      if (!Array.isArray(candles) || candles.length < 50) {
        setPatternAnalysisResult({ error: `데이터 부족 (${candles?.length || 0}개)` });
        return;
      }

      const currentIndex = candles.length - 1;
      const currentFeatures = extractPatternFeatures(candles, currentIndex);

      if (!currentFeatures) {
        setPatternAnalysisResult({ error: '분석 데이터 부족' });
        return;
      }

      const similarPatterns = findSimilarPatterns(candles, currentFeatures, 55);
      const stats = calculatePatternStats(similarPatterns);

      // 현재 가격
      const currentPrice = candles[currentIndex].close;

      // 예측 결정
      let prediction = '중립';
      let confidence = '낮음';
      if (stats.count >= 5) {
        if (stats.upProb10 >= 70) {
          prediction = '상승';
          confidence = stats.upProb10 >= 80 ? '높음' : '중간';
        } else if (stats.upProb10 <= 30) {
          prediction = '하락';
          confidence = stats.upProb10 <= 20 ? '높음' : '중간';
        }
      }

      setPatternAnalysisResult({
        symbol: cryptoSymbol,
        timeframe: cryptoTimeframe,
        currentPrice,
        features: currentFeatures,
        stats,
        prediction,
        confidence,
        topPatterns: similarPatterns.slice(0, 3)
      });

    } catch (error) {
      setPatternAnalysisResult({ error: error.message });
    } finally {
      setIsAnalyzingPattern(false);
    }
  };

  // 시간대 레이블
  const getTimeframeLabel = (tf) => {
    const labels = {
      '1H': '1시간', '4H': '4시간', '1D': '1일', '1W': '1주'
    };
    return labels[tf] || tf;
  };

  // 패턴 분석 결과를 텍스트로 변환
  const formatPatternResult = () => {
    if (!patternAnalysisResult || patternAnalysisResult.error) return '';

    const { symbol, timeframe, currentPrice, features, stats, prediction, confidence, topPatterns } = patternAnalysisResult;

    const volStatus = features.volRatio >= 2 ? '급증' : features.volRatio >= 1.5 ? '증가' : features.volRatio >= 1 ? '보통' : '감소';
    const posStatus = features.position >= 80 ? '고점권' : features.position >= 60 ? '상단' : features.position >= 40 ? '중간' : features.position >= 20 ? '하단' : '저점권';
    const trendStatus = features.upCount >= 4 ? '강상승' : features.upCount >= 3 ? '상승' : features.upCount <= 1 ? '하락' : '횡보';

    let text = `\n\n━━━━━━━━━━━━━━━━
📊 ${symbol} ${getTimeframeLabel(timeframe)}봉 패턴 분석
━━━━━━━━━━━━━━━━

💰 현재가: $${currentPrice.toLocaleString()}

📍 현재 상황
• 거래량: ${features.volRatio.toFixed(1)}x (${volStatus})
• 위치: ${features.position.toFixed(0)}% (${posStatus})
• 추세: ${features.upCount}/5 양봉 (${trendStatus})
`;

    if (stats.count > 0) {
      text += `
🔍 유사 패턴 분석 (${stats.count}건)

📈 5봉 후: 상승확률 ${stats.upProb5}% / 평균 ${stats.avgChange5 > 0 ? '+' : ''}${stats.avgChange5}%
📈 10봉 후: 상승확률 ${stats.upProb10}% / 평균 ${stats.avgChange10 > 0 ? '+' : ''}${stats.avgChange10}%

📊 10봉 내 변동폭
• 최대 상승: +${stats.avgMaxUp}%
• 최대 하락: ${stats.avgMaxDown}%

🎯 예측: ${prediction === '상승' ? '🟢' : prediction === '하락' ? '🔴' : '🟡'} ${prediction} (신뢰도: ${confidence})
`;
    } else {
      text += `\n유사 패턴을 찾지 못했습니다.`;
    }

    return text;
  };

  // AI로 SNS 콘텐츠 직접 생성
  const generateWithAI = async () => {
    if (!aiApiKey) {
      alert('AI 콘텐츠 생성을 위해 설정에서 Gemini API 키를 입력해주세요.\n\n무료로 발급받을 수 있습니다!');
      setShowSettings(true);
      return;
    }

    const selectedPlatforms = getSelectedPlatforms();
    if (selectedPlatforms.length === 0) {
      alert('최소 1개 이상의 플랫폼을 선택해주세요!');
      return;
    }

    if (!productName && !brandName && !keyMessage) {
      alert('브랜드명, 제품명, 또는 핵심 메시지 중 하나 이상을 입력해주세요.');
      return;
    }

    setIsGenerating(true);
    setGeneratedContent('');
    setTrendAnalysisResult('');

    try {
      const platformInfo = selectedPlatforms.map(p => {
        if (p === 'instagram') {
          return `인스타그램 (${instaFormat === 'feed' ? '피드 게시물' : instaFormat === 'story' ? '스토리' : '릴스'})`;
        }
        return getPlatformLabel(p);
      }).join(', ');

      // 실시간 트렌드 분석이 활성화된 경우
      const trendSection = useTrendAnalysis ? `
## 중요: 실시간 트렌드 분석 요청
아래 작업을 먼저 수행하고, 그 결과를 콘텐츠에 반영해주세요:

1. **인터넷에서 실시간으로 검색하여** 각 플랫폼별 현재 트렌드를 분석하세요:
${selectedPlatforms.includes('instagram') ? '   - 인스타그램: 현재 인기 해시태그, 릴스 트렌드, 인기 콘텐츠 스타일' : ''}
${selectedPlatforms.includes('facebook') ? '   - 페이스북: 현재 바이럴 콘텐츠 유형, 인기 주제' : ''}
${selectedPlatforms.includes('twitter') ? '   - 트위터/X: 실시간 트렌드, 인기 해시태그, 화제 키워드' : ''}
${selectedPlatforms.includes('threads') ? '   - 쓰레드: 현재 인기 토픽, 대화 스타일 트렌드' : ''}

2. **제품/브랜드 관련 트렌드 검색**:
   - "${productName || brandName || keyMessage}" 관련 최신 SNS 트렌드
   - 관련 업계의 현재 마케팅 트렌드
   - 경쟁사 또는 유사 브랜드의 SNS 전략

3. **분석 결과를 출력 시작 부분에 포함**:
   각 플랫폼별 콘텐츠 작성 전에 "[트렌드 분석]" 섹션을 추가하여
   실제 검색한 트렌드 정보를 요약해주세요.

` : '';

      const prompt = `당신은 SNS 마케팅 전문 카피라이터입니다. 바이럴 효과를 극대화하는 콘텐츠를 작성해주세요.
${trendSection}
## 요청 정보
- 타겟 플랫폼: ${platformInfo}
- 콘텐츠 유형: ${getContentTypeLabel(contentType)}
- 톤앤매너: ${getToneLabel(tone)}
- 이모지 사용: ${includeEmoji ? '적극 사용' : '사용 안 함'}
${brandName ? `- 브랜드명: ${brandName}` : ''}
${productName ? `- 제품/서비스명: ${productName}` : ''}
${productDesc ? `- 제품 설명: ${productDesc}` : ''}
${targetAudience ? `- 타겟 오디언스: ${targetAudience}` : ''}
${keyMessage ? `- 핵심 메시지: ${keyMessage}` : ''}
${cta ? `- CTA (행동 유도): ${cta}` : ''}
${includePrice && price ? `- 가격 정보: ${price}` : ''}
${discountInfo ? `- 할인/프로모션: ${discountInfo}` : ''}
${eventPeriod ? `- 이벤트 기간: ${eventPeriod}` : ''}
${hashtags ? `- 필수 해시태그: ${hashtags}` : ''}
${mdContent ? `\n## 참고 자료\n${mdContent}` : ''}

## 플랫폼별 규칙
${selectedPlatforms.includes('instagram') ? `
### 인스타그램 ${instaFormat === 'feed' ? '피드' : instaFormat === 'story' ? '스토리' : '릴스'}
${instaFormat === 'feed' ? `- 첫 줄: 강력한 후킹 문구 (스크롤 멈추게)
- 본문: 150~300자, 줄바꿈으로 가독성 확보
- 마지막: CTA + 저장/공유 유도
- 해시태그: 20~30개 (본문 아래) - 실시간 인기 해시태그 포함!` :
instaFormat === 'story' ? `- 3~5장 시퀀스로 구성
- 각 장 15자 내외 임팩트 있는 문구
- 스티커 활용 제안 (투표, 질문 등)
- 마지막 장: CTA` :
`- 0~3초: 강력한 후킹 (현재 트렌드 반영!)
- 15~60초 스크립트
- 자막용 텍스트 제공
- 캡션 50자 + 해시태그 15~20개 (트렌드 태그 포함)`}` : ''}
${selectedPlatforms.includes('facebook') ? `
### 페이스북
- 40~80자 권장 (짧을수록 참여율 높음)
- 질문형으로 댓글 유도
- 해시태그 2~5개 (현재 인기 태그 포함)
- 현재 페이스북에서 바이럴되는 콘텐츠 스타일 참고` : ''}
${selectedPlatforms.includes('twitter') ? `
### 트위터/X
- 140자 내외 (한글 기준)
- 단문으로 임팩트 있게
- 해시태그 1~2개 (실시간 트렌드 태그 활용!)
- 리트윗 유도
- 현재 X에서 화제인 밈이나 표현 적절히 활용` : ''}
${selectedPlatforms.includes('threads') ? `
### 쓰레드
- 500자 이내
- 인스타그램 감성 + 트위터 대화체
- 줄바꿈으로 가독성 확보
- 해시태그 3~5개
- 댓글 유도 질문형 마무리
- 쓰레드에서 현재 유행하는 대화 스타일 반영` : ''}
${contentType === 'crypto' ? `
## 암호화폐 차트 분석 규칙
당신은 암호화폐 기술적 분석 전문가입니다.

### 분석 포인트
- 캔들스틱 패턴 분석 (도지, 해머, 인걸핑 등)
- 이동평균선 분석 (MA, EMA - 20일, 50일, 200일)
- 지지선/저항선 분석
- 추세선 및 채널 분석
- 거래량 분석
- 기술적 지표 (RSI, MACD, 볼린저밴드 등)

### 출력 구조
**[차트 분석 요약]**
- 현재 가격대 및 추세
- 주요 지지/저항 레벨
- 단기/중기 전망

**[매매 관점]**
- 롱(매수) 관점: 진입가, 목표가, 손절가
- 숏(매도) 관점: 진입가, 목표가, 손절가

**[주의사항]**
- 투자 주의 문구 필수 포함
- "본 분석은 개인적인 의견이며 투자 권유가 아닙니다"

### 작성 스타일
- 전문적이면서도 이해하기 쉽게
- 핵심 숫자(가격, %)는 명확하게
- 이모지로 시각적 구분 (📈📉🎯⚠️)
` : ''}

## 출력 형식
${useTrendAnalysis ? `먼저 **[📊 실시간 트렌드 분석]** 섹션에서 검색한 트렌드 정보를 요약하고,
그 다음` : ''} 각 플랫폼별로 바로 복사해서 사용할 수 있는 완성된 콘텐츠를 제공하세요.
구분선(━━━)으로 플랫폼을 구분하고, 플랫폼명을 명시하세요.
${useTrendAnalysis ? '\n트렌드를 반영한 해시태그와 표현을 적극 활용하세요!' : ''}

지금 바로 작성해주세요!`;

      // Gemini API 호출 (Google Search grounding 활성화)
      const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 4000
        }
      };

      // 실시간 트렌드 분석이 활성화된 경우 Google Search 도구 추가
      if (useTrendAnalysis) {
        requestBody.tools = [{
          google_search: {}
        }];
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${aiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        }
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || 'API 오류가 발생했습니다.');
      }

      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // 검색 결과 메타데이터 추출 (있는 경우)
      const groundingMetadata = data.candidates?.[0]?.groundingMetadata;
      if (groundingMetadata) {
        const searchQueries = groundingMetadata.webSearchQueries || [];
        if (searchQueries.length > 0) {
          setTrendAnalysisResult(`검색 쿼리: ${searchQueries.join(', ')}`);
        }
      }

      if (content) {
        setGeneratedContent(content);
      } else {
        throw new Error('콘텐츠 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('AI 생성 오류:', error);
      alert(`콘텐츠 생성 중 오류가 발생했습니다.\n\n${error.message}\n\nAPI 키를 확인해주세요.`);
    } finally {
      setIsGenerating(false);
    }
  };

  // 공통 스타일
  const cardStyle = {
    backgroundColor: '#fff',
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    padding: '24px',
    marginBottom: '20px'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '12px',
    color: '#1a1a2e'
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    border: '2px solid #e5e7eb',
    borderRadius: '10px',
    fontSize: '14px',
    transition: 'border-color 0.2s',
    outline: 'none',
    boxSizing: 'border-box'
  };

  const buttonBaseStyle = {
    padding: '14px 20px',
    borderRadius: '12px',
    border: '2px solid',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  };

  // 라이선스가 없는 경우 라이선스 입력 화면 표시
  if (!licenseInfo) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #E1306C 0%, #833AB4 50%, #405DE6 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        zIndex: 9999
      }}>
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          padding: '40px',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          border: '3px solid rgba(255,255,255,0.3)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 20px',
              background: 'linear-gradient(135deg, #E1306C, #833AB4)',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Shield size={40} color="#fff" />
            </div>
            <h1 style={{
              fontSize: '28px',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #E1306C, #833AB4, #405DE6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '8px'
            }}>
              SNS 홍보 콘텐츠 생성기
            </h1>
            <p style={{ color: '#666', fontSize: '14px' }}>
              라이선스 키를 입력하여 시작하세요
            </p>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px'
            }}>
              라이선스 키
            </label>
            <input
              type="text"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLicenseSubmit()}
              placeholder="SNS-XXXX-XXXX-XXXX"
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                fontSize: '16px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s'
              }}
            />
            {licenseError && (
              <div style={{
                marginTop: '12px',
                padding: '12px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#dc2626',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertTriangle size={16} />
                {licenseError}
              </div>
            )}
          </div>

          <button
            onClick={handleLicenseSubmit}
            disabled={isVerifyingLicense || !licenseKey.trim()}
            style={{
              width: '100%',
              padding: '16px',
              background: isVerifyingLicense ? '#9ca3af' : 'linear-gradient(135deg, #E1306C, #833AB4)',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '700',
              cursor: isVerifyingLicense ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '24px'
            }}
          >
            {isVerifyingLicense ? (
              <>
                <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
                검증 중...
              </>
            ) : (
              <>
                <Key size={18} />
                라이선스 활성화
              </>
            )}
          </button>

          <div style={{
            padding: '20px',
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            border: '1px solid #e5e7eb'
          }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Sparkles size={16} color="#833AB4" />
              라이선스 구매 안내
            </h3>
            <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.6' }}>
              <p style={{ marginBottom: '8px' }}>
                <strong style={{ color: '#E1306C' }}>SNS Basic:</strong> 인스타/페북/트위터/쓰레드 콘텐츠 생성
              </p>
              <p style={{ marginBottom: '12px' }}>
                <strong style={{ color: '#833AB4' }}>SNS Pro:</strong> + 실시간 트렌드 분석 + AI 이미지 분석
              </p>
              <a
                href="https://kmong.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  padding: '10px 20px',
                  background: 'linear-gradient(135deg, #E1306C, #833AB4)',
                  color: '#fff',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontSize: '13px',
                  fontWeight: '600'
                }}
              >
                크몽에서 구매하기
              </a>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* 헤더 */}
      <div style={{ textAlign: 'center', marginBottom: '32px', position: 'relative' }}>
        {/* 라이선스 상태 표시 */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{
            padding: '8px 12px',
            backgroundColor: licenseInfo?.tier === 'snsPro' ? '#8b5cf6' : '#E1306C',
            color: '#fff',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <Shield size={14} />
            {licenseInfo?.tier === 'snsPro' ? 'PRO' : 'BASIC'}
          </div>
          <button
            onClick={handleLicenseLogout}
            style={{
              padding: '8px',
              backgroundColor: '#f3f4f6',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              color: '#6b7280'
            }}
            title="로그아웃"
          >
            <X size={14} />
          </button>
        </div>

        {/* 설정 버튼 */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            padding: '12px 16px',
            backgroundColor: aiApiKey ? '#10b981' : '#ef4444',
            color: '#fff',
            border: '3px solid #fff',
            borderRadius: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: '700',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            transition: 'transform 0.2s'
          }}
        >
          <Settings size={18} />
          {aiApiKey ? 'API 연결됨' : 'API 설정'}
        </button>

        <h1 style={{
          fontSize: '28px',
          fontWeight: '700',
          background: 'linear-gradient(135deg, #E1306C, #833AB4, #405DE6)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '8px'
        }}>
          SNS 홍보 콘텐츠 생성기
        </h1>
        <p style={{ color: '#666', fontSize: '14px' }}>
          인스타그램, 페이스북, 트위터, 쓰레드용 마케팅 콘텐츠를 한 번에 생성하세요!
        </p>
        <p style={{ color: '#10b981', fontSize: '12px', marginTop: '4px' }}>
          {aiApiKey ? 'AI 자동 생성 사용 가능' : 'Gemini API 키를 설정하면 AI가 직접 콘텐츠를 생성해드립니다!'}
        </p>
      </div>

      {/* 전체 사용 가이드 */}
      <div style={{
        ...cardStyle,
        backgroundColor: '#fefce8',
        border: '2px solid #eab308',
        marginTop: '16px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer'
        }}>
          <div style={{ fontWeight: '600', color: '#854d0e', fontSize: '16px' }}>
            📚 전체 사용 가이드
          </div>
        </div>

        <div style={{ marginTop: '12px', color: '#713f12', fontSize: '13px', lineHeight: '1.8' }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontWeight: '600', marginBottom: '8px', color: '#854d0e' }}>🎯 일반 콘텐츠 생성 (블로그/상품 홍보)</div>
            <div style={{ paddingLeft: '12px' }}>
              <strong>1.</strong> 상단 ⚙️ 버튼 → Gemini API 키 설정<br/>
              <strong>2.</strong> 콘텐츠 유형 선택 (블로그 홍보 / 상품 홍보)<br/>
              <strong>3.</strong> 블로그 URL 또는 상품 정보 입력<br/>
              <strong>4.</strong> 원하는 SNS 플랫폼 선택<br/>
              <strong>5.</strong> "AI 자동 생성" 버튼 클릭<br/>
              <strong>6.</strong> 생성된 콘텐츠 복사 → SNS에 붙여넣기!
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontWeight: '600', marginBottom: '8px', color: '#854d0e' }}>📊 암호화폐 차트 분석 (권한 필요)</div>
            <div style={{ paddingLeft: '12px' }}>
              <strong>1.</strong> 암호화폐 차트 분석 버튼 클릭<br/>
              <strong>2.</strong> 코인 심볼(BTC, ETH 등) & 시간대 선택<br/>
              <strong>3.</strong> "패턴 분석" 클릭 → 과거 패턴 유사도 확인<br/>
              <strong>4.</strong> 차트 스크린샷 업로드 (거래소에서 캡처)<br/>
              <strong>5.</strong> "AI 이미지 분석 & 글쓰기" 클릭<br/>
              <strong>6.</strong> 녹색 박스에서 "글 복사하기" → SNS 붙여넣기!
            </div>
          </div>

          <div style={{
            backgroundColor: '#fef3c7',
            padding: '10px',
            borderRadius: '6px',
            marginTop: '8px'
          }}>
            <strong>💡 Tip:</strong> Gemini API 키는 <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>Google AI Studio</a>에서 무료로 발급받을 수 있습니다!
          </div>
        </div>
      </div>

      {/* 설정 모달 */}
      {showSettings && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <label style={labelStyle}>AI API 설정 (Gemini - 무료)</label>
            <button
              onClick={() => setShowSettings(false)}
              style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', display: 'block' }}>
              Gemini API 키 (블로그 생성기와 공유됨)
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="AIzaSy..."
                value={aiApiKey}
                onChange={(e) => saveApiKey(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              />
              {aiApiKey && (
                <button
                  onClick={() => {
                    saveApiKey('');
                    alert('API 키가 삭제되었습니다.');
                  }}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontWeight: '500',
                    fontSize: '13px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  삭제
                </button>
              )}
            </div>
            {aiApiKey && (
              <p style={{ fontSize: '11px', color: '#10b981', marginTop: '6px' }}>
                API 키가 저장되어 있습니다. 변경하려면 새 키를 입력하세요.
              </p>
            )}
          </div>

          <div style={{ backgroundColor: '#f0f9ff', padding: '16px', borderRadius: '10px', border: '1px solid #0ea5e9' }}>
            <p style={{ fontWeight: '600', color: '#0369a1', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Key size={16} />
              무료 API 키 발급 방법
            </p>
            <ol style={{ color: '#0c4a6e', fontSize: '13px', paddingLeft: '20px', margin: 0, lineHeight: '1.8' }}>
              <li><a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#0369a1', textDecoration: 'underline' }}>Google AI Studio</a> 접속</li>
              <li>Google 계정으로 로그인</li>
              <li>"Create API Key" 클릭</li>
              <li>생성된 키 복사 후 위에 붙여넣기</li>
            </ol>
            <p style={{ color: '#0369a1', fontSize: '12px', marginTop: '8px' }}>
              * 무료로 하루 1,500회 요청 가능!
            </p>
          </div>
        </div>
      )}

      {/* 1. 플랫폼 선택 */}
      <div style={cardStyle} className="card">
        <label style={labelStyle}>1. 플랫폼 선택 (다중 선택 가능)</label>
        <div className="platform-buttons" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => handlePlatformChange('instagram')}
            style={{
              ...buttonBaseStyle,
              flex: '1',
              minWidth: '140px',
              backgroundColor: platforms.instagram ? 'linear-gradient(135deg, #E1306C, #833AB4)' : '#fff',
              background: platforms.instagram ? 'linear-gradient(135deg, #E1306C, #833AB4)' : '#fff',
              borderColor: platforms.instagram ? '#E1306C' : '#E1306C',
              color: platforms.instagram ? '#fff' : '#E1306C',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            <Instagram size={18} />
            인스타그램
          </button>
          <button
            onClick={() => handlePlatformChange('facebook')}
            style={{
              ...buttonBaseStyle,
              flex: '1',
              minWidth: '140px',
              backgroundColor: platforms.facebook ? '#1877F2' : '#fff',
              borderColor: platforms.facebook ? '#1877F2' : '#1877F2',
              color: platforms.facebook ? '#fff' : '#1877F2',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            <Facebook size={18} />
            페이스북
          </button>
          <button
            onClick={() => handlePlatformChange('twitter')}
            style={{
              ...buttonBaseStyle,
              flex: '1',
              minWidth: '140px',
              backgroundColor: platforms.twitter ? '#1DA1F2' : '#fff',
              borderColor: platforms.twitter ? '#1DA1F2' : '#1DA1F2',
              color: platforms.twitter ? '#fff' : '#1DA1F2',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            <Twitter size={18} />
            트위터/X
          </button>
          <button
            onClick={() => handlePlatformChange('threads')}
            style={{
              ...buttonBaseStyle,
              flex: '1',
              minWidth: '140px',
              backgroundColor: platforms.threads ? '#000000' : '#fff',
              borderColor: platforms.threads ? '#000000' : '#374151',
              color: platforms.threads ? '#fff' : '#374151',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            <MessageSquare size={18} />
            쓰레드 (Threads)
          </button>
        </div>

        {/* 인스타그램 형식 선택 */}
        {platforms.instagram && (
          <div style={{
            marginTop: '16px',
            padding: '16px',
            background: 'linear-gradient(135deg, #fdf2f8, #faf5ff)',
            borderRadius: '12px',
            border: '1px solid #f9a8d4'
          }}>
            <label style={{ ...labelStyle, color: '#9333ea', marginBottom: '10px' }}>
              인스타그램 콘텐츠 형식
            </label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {['feed', 'story', 'reels'].map((format) => (
                <button
                  key={format}
                  onClick={() => setInstaFormat(format)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: `2px solid ${instaFormat === format ? '#9333ea' : '#e5e7eb'}`,
                    backgroundColor: instaFormat === format ? '#f3e8ff' : '#fff',
                    color: instaFormat === format ? '#9333ea' : '#374151',
                    fontWeight: instaFormat === format ? '600' : '400',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {format === 'feed' ? '피드 게시물' : format === 'story' ? '스토리' : '릴스'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. 콘텐츠 유형 */}
      <div style={cardStyle}>
        <label style={labelStyle}>2. 콘텐츠 유형</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          {[
            { value: 'product', label: '제품/서비스 홍보', icon: <Target size={18} />, color: '#10b981' },
            { value: 'brand', label: '브랜드 홍보', icon: <Sparkles size={18} />, color: '#8b5cf6' },
            { value: 'event', label: '이벤트/캠페인', icon: <Zap size={18} />, color: '#f59e0b' },
            { value: 'general', label: '일반 마케팅', icon: <MessageSquare size={18} />, color: '#3b82f6' }
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => setContentType(item.value)}
              style={{
                ...buttonBaseStyle,
                backgroundColor: contentType === item.value ? `${item.color}15` : '#fff',
                borderColor: contentType === item.value ? item.color : '#e5e7eb',
                color: contentType === item.value ? item.color : '#374151'
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
          {/* 암호화폐 옵션 - 항상 표시하되 권한 없으면 잠금 */}
          <button
            onClick={() => {
              if (isCryptoAvailable()) {
                setContentType('crypto');
              } else {
                alert('🔒 암호화폐 차트 분석 기능\n\n이 기능은 별도 권한이 필요합니다.\n\n📢 비트겟 가입 (추천인: 63sl3029)\nhttps://partner.bitget.com/bg/AZ6Z8S\n\n문의: 텔레그램 @V30_Signal_bot');
              }
            }}
            style={{
              ...buttonBaseStyle,
              backgroundColor: contentType === 'crypto' ? '#f7931a15' : isCryptoAvailable() ? '#fff' : '#f3f4f6',
              borderColor: contentType === 'crypto' ? '#f7931a' : isCryptoAvailable() ? '#e5e7eb' : '#d1d5db',
              color: contentType === 'crypto' ? '#f7931a' : isCryptoAvailable() ? '#374151' : '#9ca3af',
              position: 'relative',
              opacity: isCryptoAvailable() ? 1 : 0.8
            }}
          >
            <TrendingUp size={18} />
            암호화폐 차트 분석
            {!isCryptoAvailable() && (
              <Lock size={14} style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                color: '#9ca3af'
              }} />
            )}
          </button>
        </div>
      </div>

      {/* 3. 톤앤매너 */}
      <div style={cardStyle}>
        <label style={labelStyle}>3. 톤앤매너</label>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { value: 'friendly', label: '친근한', emoji: '' },
            { value: 'professional', label: '전문적인', emoji: '' },
            { value: 'trendy', label: '트렌디한', emoji: '' },
            { value: 'humorous', label: '유머러스한', emoji: '' }
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => setTone(item.value)}
              style={{
                padding: '10px 18px',
                borderRadius: '20px',
                border: `2px solid ${tone === item.value ? '#6366f1' : '#e5e7eb'}`,
                backgroundColor: tone === item.value ? '#eef2ff' : '#fff',
                color: tone === item.value ? '#4f46e5' : '#374151',
                fontWeight: tone === item.value ? '600' : '400',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {item.emoji} {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. 기본 정보 */}
      <div style={cardStyle}>
        <label style={labelStyle}>4. 기본 정보</label>

        <div className="info-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', display: 'block' }}>브랜드명</label>
            <input
              type="text"
              placeholder="예: 홍길동 베이커리"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', display: 'block' }}>제품/서비스명</label>
            <input
              type="text"
              placeholder="예: 수제 크로와상"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', display: 'block' }}>제품/서비스 설명</label>
          <textarea
            placeholder="예: 프랑스 정통 방식으로 72시간 저온 숙성한 크로와상. 겉은 바삭, 속은 촉촉하며 버터 향이 가득합니다."
            value={productDesc}
            onChange={(e) => setProductDesc(e.target.value)}
            style={{ ...inputStyle, height: '100px', resize: 'vertical' }}
          />
        </div>

        <div className="info-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', display: 'block' }}>타겟 오디언스</label>
            <input
              type="text"
              placeholder="예: 20-30대 여성, 베이킹 관심자"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', display: 'block' }}>핵심 메시지</label>
            <input
              type="text"
              placeholder="예: 진짜 맛있는 크로와상은 다르다"
              value={keyMessage}
              onChange={(e) => setKeyMessage(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', display: 'block' }}>CTA (행동 유도)</label>
          <input
            type="text"
            placeholder="예: 링크인바이오에서 주문하세요! / 지금 바로 DM 주세요!"
            value={cta}
            onChange={(e) => setCta(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', display: 'block' }}>필수 해시태그 (쉼표로 구분)</label>
          <input
            type="text"
            placeholder="예: #홍길동베이커리, #수제크로와상, #브런치맛집"
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      {/* 5. 추가 옵션 (접이식) */}
      <div style={cardStyle}>
        <div
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer'
          }}
        >
          <label style={{ ...labelStyle, marginBottom: 0, cursor: 'pointer' }}>
            5. 추가 옵션
          </label>
          {showAdvanced ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>

        {showAdvanced && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeEmoji}
                  onChange={(e) => setIncludeEmoji(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ fontSize: '14px' }}>이모지 사용</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includePrice}
                  onChange={(e) => setIncludePrice(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ fontSize: '14px' }}>가격 정보 포함</span>
              </label>
            </div>

            {includePrice && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', display: 'block' }}>가격</label>
                <input
                  type="text"
                  placeholder="예: 4,500원 / 3개 세트 12,000원"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  style={inputStyle}
                />
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', display: 'block' }}>할인/프로모션 정보</label>
              <input
                type="text"
                placeholder="예: 오픈 기념 30% 할인 / 1+1 이벤트"
                value={discountInfo}
                onChange={(e) => setDiscountInfo(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', display: 'block' }}>이벤트 기간</label>
              <input
                type="text"
                placeholder="예: 1/5~1/15 (10일간 한정)"
                value={eventPeriod}
                onChange={(e) => setEventPeriod(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        )}
      </div>

      {/* 5.5 암호화폐 분석 추가 정보 (crypto 모드에서만 표시) */}
      {contentType === 'crypto' && (
        <div style={{
          ...cardStyle,
          border: '2px solid #f7931a',
          background: 'linear-gradient(135deg, #fffbeb, #fef3c7)'
        }}>
          <label style={{...labelStyle, color: '#d97706', display: 'flex', alignItems: 'center', gap: '8px'}}>
            <TrendingUp size={20} />
            암호화폐 분석 추가 정보
          </label>

          {/* 사용 설명서 */}
          <div style={{
            marginBottom: '16px',
            padding: '16px',
            backgroundColor: '#fef3c7',
            borderRadius: '12px',
            border: '2px dashed #f59e0b'
          }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#92400e', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              📖 사용 방법
            </div>
            <div style={{ fontSize: '13px', color: '#78350f', lineHeight: '1.8' }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>Step 1.</strong> 코인 심볼 입력 & 시간대 선택 → <strong style={{ color: '#f7931a' }}>패턴 분석</strong> 클릭
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>Step 2.</strong> 아래 <strong style={{ color: '#8b5cf6' }}>AI 이미지 분석</strong>에서 차트 스크린샷 업로드
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>Step 3.</strong> <strong style={{ color: '#8b5cf6' }}>AI 이미지 분석 & 글쓰기</strong> 버튼 클릭
              </div>
              <div>
                <strong>Step 4.</strong> 결과에서 <strong style={{ color: '#10b981' }}>복사할 글</strong>만 복사 → SNS 붙여넣기 완료!
              </div>
            </div>
          </div>

          {/* 코인 & 시간대 선택 + 패턴 분석 */}
          <div style={{ marginBottom: '16px', padding: '16px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #fcd34d' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#92400e', marginBottom: '6px', display: 'block' }}>
                  코인 심볼
                </label>
                <input
                  type="text"
                  placeholder="BTC"
                  value={cryptoSymbol}
                  onChange={(e) => setCryptoSymbol(e.target.value.toUpperCase())}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #f7931a',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    backgroundColor: '#fffbeb',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#92400e', marginBottom: '6px', display: 'block' }}>
                  분석 시간대
                </label>
                <select
                  value={cryptoTimeframe}
                  onChange={(e) => setCryptoTimeframe(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #f7931a',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    backgroundColor: '#fffbeb',
                    outline: 'none',
                    cursor: 'pointer',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="1H">1시간</option>
                  <option value="4H">4시간</option>
                  <option value="1D">1일</option>
                  <option value="1W">1주</option>
                </select>
              </div>
              <button
                onClick={runPatternAnalysis}
                disabled={isAnalyzingPattern}
                style={{
                  padding: '10px 20px',
                  background: isAnalyzingPattern ? '#9ca3af' : 'linear-gradient(135deg, #f7931a, #d97706)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: isAnalyzingPattern ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                {isAnalyzingPattern ? (
                  <>
                    <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    분석중...
                  </>
                ) : (
                  <>
                    <TrendingUp size={16} />
                    패턴 분석
                  </>
                )}
              </button>
            </div>

            {/* 패턴 분석 결과 표시 */}
            {patternAnalysisResult && (
              <div style={{
                marginTop: '16px',
                padding: '12px',
                backgroundColor: patternAnalysisResult.error ? '#fef2f2' : '#f0fdf4',
                borderRadius: '8px',
                border: `1px solid ${patternAnalysisResult.error ? '#fecaca' : '#bbf7d0'}`
              }}>
                {patternAnalysisResult.error ? (
                  <p style={{ color: '#dc2626', fontSize: '13px', margin: 0 }}>
                    {patternAnalysisResult.error}
                  </p>
                ) : (
                  <div style={{ fontSize: '13px', color: '#166534' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong>{patternAnalysisResult.symbol} {getTimeframeLabel(patternAnalysisResult.timeframe)}봉</strong>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '700',
                        backgroundColor: patternAnalysisResult.prediction === '상승' ? '#22c55e' :
                                        patternAnalysisResult.prediction === '하락' ? '#ef4444' : '#9ca3af',
                        color: '#fff'
                      }}>
                        {patternAnalysisResult.prediction === '상승' ? '📈' : patternAnalysisResult.prediction === '하락' ? '📉' : '➡️'} {patternAnalysisResult.prediction}
                      </span>
                    </div>
                    <p style={{ margin: '4px 0', color: '#374151' }}>
                      💰 현재가: <strong>${patternAnalysisResult.currentPrice?.toLocaleString()}</strong>
                    </p>
                    <p style={{ margin: '4px 0', color: '#374151' }}>
                      📊 유사패턴: {patternAnalysisResult.stats.count}건 / 10봉후 상승확률: <strong>{patternAnalysisResult.stats.upProb10}%</strong>
                    </p>
                    <p style={{ margin: '4px 0', color: '#374151' }}>
                      📈 평균 변화: {patternAnalysisResult.stats.avgChange10 > 0 ? '+' : ''}{patternAnalysisResult.stats.avgChange10}% |
                      최대상승 +{patternAnalysisResult.stats.avgMaxUp}% / 최대하락 {patternAnalysisResult.stats.avgMaxDown}%
                    </p>
                    <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#6b7280' }}>
                      신뢰도: {patternAnalysisResult.confidence} · 분석 결과가 AI 글 생성에 자동 반영됩니다
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 기준 스타일 텍스트 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#92400e', marginBottom: '6px', display: 'block' }}>
              기준 글쓰기 스타일 (선택)
            </label>
            <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px' }}>
              이 스타일을 참고해서 비슷한 톤으로 글을 작성합니다
            </p>
            <textarea
              placeholder={`[BTC 1시간 캔들 차트]

중요했던 200선(흰색) 이탈되었습니다.

기존에 핸들 만들어가는 과정에서의 이탈이기에 아쉽다고 느끼실만 하지만 왠지모를 위화감이 드는 하락이었습니다.

바닥($89,300) 잡고 롱포지션 유효하겠습니다.`}
              value={referenceText}
              onChange={(e) => setReferenceText(e.target.value)}
              style={{
                width: '100%',
                height: '150px',
                padding: '12px',
                border: '2px solid #fcd34d',
                borderRadius: '8px',
                fontSize: '13px',
                lineHeight: '1.6',
                resize: 'vertical',
                backgroundColor: '#fff',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* 레퍼럴 & 텔레그램 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#f7931a', marginBottom: '6px', display: 'block' }}>
                레퍼럴 코드 (선택)
              </label>
              <input
                type="text"
                placeholder="예: ABC123"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #fcd34d',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: '#fff',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#0088cc', marginBottom: '6px', display: 'block' }}>
                텔레그램 주소 (선택)
              </label>
              <input
                type="text"
                placeholder="예: https://t.me/yourchannel"
                value={telegramUrl}
                onChange={(e) => setTelegramUrl(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #0088cc',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: '#f0f9ff',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 6. AI 이미지 분석 (Pro 전용) */}
      <div style={{
        ...cardStyle,
        border: isProFeatureAvailable() ? '2px solid #8b5cf6' : '2px solid #d1d5db',
        background: isProFeatureAvailable() ? 'linear-gradient(135deg, #faf5ff, #f5f3ff)' : '#f9fafb',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {!isProFeatureAvailable() && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255,255,255,0.8)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10
          }}>
            <Lock size={32} color="#8b5cf6" />
            <p style={{ marginTop: '12px', fontWeight: '600', color: '#8b5cf6' }}>SNS Pro 전용 기능</p>
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>AI 이미지 분석 기능을 사용하려면 Pro 라이선스가 필요합니다</p>
          </div>
        )}
        <label style={{...labelStyle, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '8px'}}>
          <Camera size={20} />
          6. AI 이미지 분석
          <span style={{
            padding: '2px 8px',
            backgroundColor: '#8b5cf6',
            color: '#fff',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: '700'
          }}>PRO</span>
        </label>
        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
          제품 사진을 업로드하면 AI가 분석하여 SNS 홍보 글을 자동 생성합니다.
          <br />기준 사진을 함께 올리면 그 스타일을 참고해서 글을 작성합니다.
        </p>

        <div className="image-upload-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          {/* 제품 사진 업로드 */}
          <div style={{
            padding: '16px',
            backgroundColor: '#fff',
            borderRadius: '12px',
            border: '2px dashed #8b5cf6'
          }}>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#7c3aed', marginBottom: '10px', display: 'block' }}>
              제품 사진 (필수)
            </label>
            {productImagePreview ? (
              <div style={{ position: 'relative' }}>
                <img
                  src={productImagePreview}
                  alt="제품 사진"
                  style={{
                    width: '100%',
                    height: '150px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    marginBottom: '8px'
                  }}
                />
                <button
                  onClick={removeProductImage}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    backgroundColor: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '50%',
                    width: '28px',
                    height: '28px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <label style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '150px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}>
                <Camera size={32} color="#8b5cf6" />
                <span style={{ color: '#6b7280', fontSize: '13px', marginTop: '8px' }}>클릭하여 업로드</span>
                <input
                  ref={productImageRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProductImageUpload}
                  style={{ display: 'none' }}
                />
              </label>
            )}
          </div>

        </div>

        {/* 이미지 분석 버튼 */}
        <button
          onClick={analyzeImageWithAI}
          disabled={isAnalyzing || !productImage}
          style={{
            width: '100%',
            padding: '14px',
            background: isAnalyzing ? '#9ca3af' : (!productImage ? '#d1d5db' : 'linear-gradient(135deg, #8b5cf6, #7c3aed)'),
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: isAnalyzing || !productImage ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: productImage ? '0 4px 12px rgba(139, 92, 246, 0.3)' : 'none'
          }}
        >
          {isAnalyzing ? (
            <>
              <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
              AI가 이미지를 분석하고 있습니다...
            </>
          ) : (
            <>
              <Sparkles size={18} />
              {referenceText || referenceImage ? 'AI 비교 분석 & 글쓰기' : 'AI 이미지 분석 & 글쓰기'}
            </>
          )}
        </button>

        {/* 이미지 분석 결과 */}
        {imageAnalysisResult && (
          <div style={{
            marginTop: '16px',
            padding: '16px',
            backgroundColor: '#fff',
            borderRadius: '10px',
            border: '1px solid #8b5cf6'
          }}>
            {/* 복사할 글 (crypto 모드) - 맨 상단에 표시 */}
            {contentType === 'crypto' && (
              <div style={{
                marginBottom: '20px',
                padding: '20px',
                backgroundColor: '#f0fdf4',
                borderRadius: '12px',
                border: '2px solid #22c55e'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label style={{ fontWeight: '700', color: '#16a34a', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📋 복사할 글 (이것만 복사하세요!)
                  </label>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(extractSNSContent(imageAnalysisResult));
                      alert('SNS 글이 복사되었습니다!');
                    }}
                    style={{
                      padding: '10px 20px',
                      background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)'
                    }}
                  >
                    <Copy size={16} />
                    글 복사하기
                  </button>
                </div>
                <div style={{
                  whiteSpace: 'pre-wrap',
                  fontSize: '14px',
                  lineHeight: '1.8',
                  color: '#166534',
                  backgroundColor: '#fff',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #bbf7d0',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {extractSNSContent(imageAnalysisResult)}
                </div>
              </div>
            )}

            {/* 전체 분석 결과 (접기/펼치기) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <label style={{ fontWeight: '600', color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={16} />
                {contentType === 'crypto' ? '전체 분석 결과 (참고용)' : 'AI 분석 결과'}
              </label>
              <button
                onClick={() => {
                  const fullContent = imageAnalysisResult + (contentType === 'crypto' && patternAnalysisResult && !patternAnalysisResult.error ? formatPatternResult() : '');
                  navigator.clipboard.writeText(fullContent);
                  alert('복사되었습니다!');
                }}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#8b5cf6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Copy size={14} />
                전체 복사
              </button>
            </div>
            <div style={{
              whiteSpace: 'pre-wrap',
              fontSize: '14px',
              lineHeight: '1.7',
              color: '#374151',
              maxHeight: contentType === 'crypto' ? '200px' : '400px',
              overflowY: 'auto',
              backgroundColor: contentType === 'crypto' ? '#f9fafb' : 'transparent',
              padding: contentType === 'crypto' ? '12px' : '0',
              borderRadius: '8px'
            }}>
              {imageAnalysisResult}
              {/* 패턴 분석 결과가 있으면 추가 표시 */}
              {contentType === 'crypto' && patternAnalysisResult && !patternAnalysisResult.error && (
                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  backgroundColor: '#fef3c7',
                  borderRadius: '8px',
                  border: '1px solid #f59e0b'
                }}>
                  {formatPatternResult()}
                </div>
              )}
            </div>

            {/* 이미지로 저장 버튼 */}
            {contentType === 'crypto' && productImagePreview && (
              <button
                onClick={() => setShowCardPreview(!showCardPreview)}
                style={{
                  marginTop: '16px',
                  padding: '12px 20px',
                  background: showCardPreview ? '#6b7280' : 'linear-gradient(135deg, #f7931a, #ff6b00)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Image size={18} />
                {showCardPreview ? '카드 미리보기 닫기' : '이미지 카드로 만들기'}
              </button>
            )}
          </div>
        )}

        {/* 텔레그램 스타일 카드 미리보기 */}
        {showCardPreview && imageAnalysisResult && contentType === 'crypto' && (
          <div style={{ marginTop: '20px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px'
            }}>
              <label style={{ fontWeight: '600', color: '#f7931a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <TrendingUp size={16} />
                이미지 카드 미리보기
              </label>
              <button
                onClick={downloadCardAsImage}
                disabled={isDownloading}
                style={{
                  padding: '10px 20px',
                  background: isDownloading ? '#9ca3af' : 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: isDownloading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isDownloading ? (
                  <>
                    <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    다운로드 중...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    이미지 다운로드
                  </>
                )}
              </button>
            </div>

            {/* 텔레그램 스타일 카드 */}
            <div
              ref={cardPreviewRef}
              style={{
                width: '100%',
                maxWidth: '500px',
                backgroundColor: '#1a1a2e',
                borderRadius: '16px',
                overflow: 'hidden',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
              }}
            >
              {/* 차트 이미지 + 분석 오버레이 */}
              <div style={{ position: 'relative' }}>
                <img
                  src={productImagePreview}
                  alt="차트"
                  style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block'
                  }}
                />
                {/* 상단 코인명 오버레이 */}
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  {productName || 'BTC/USDT'} · 차트 분석
                </div>

                {/* 방향 화살표 오버레이 */}
                {(() => {
                  const chartAnalysis = extractChartAnalysis(imageAnalysisResult);
                  if (!chartAnalysis) return null;

                  return (
                    <>
                      {/* 방향 표시 (우측 상단) */}
                      <div style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        backgroundColor: chartAnalysis.direction === 'up' ? 'rgba(34, 197, 94, 0.9)' :
                                        chartAnalysis.direction === 'down' ? 'rgba(239, 68, 68, 0.9)' :
                                        'rgba(156, 163, 175, 0.9)',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '14px',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                      }}>
                        {chartAnalysis.direction === 'up' ? '📈 상승' :
                         chartAnalysis.direction === 'down' ? '📉 하락' : '➡️ 횡보'}
                      </div>

                      {/* 저항선 표시 (상단) */}
                      {chartAnalysis.resistance.length > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '20%',
                          left: '0',
                          right: '0',
                          borderTop: '2px dashed #ef4444',
                          opacity: 0.8
                        }}>
                          <span style={{
                            position: 'absolute',
                            right: '8px',
                            top: '-10px',
                            backgroundColor: '#ef4444',
                            color: '#fff',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}>
                            저항 ${Number(chartAnalysis.resistance[0]).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {/* 지지선 표시 (하단) */}
                      {chartAnalysis.support.length > 0 && (
                        <div style={{
                          position: 'absolute',
                          bottom: '20%',
                          left: '0',
                          right: '0',
                          borderTop: '2px dashed #22c55e',
                          opacity: 0.8
                        }}>
                          <span style={{
                            position: 'absolute',
                            right: '8px',
                            top: '-10px',
                            backgroundColor: '#22c55e',
                            color: '#fff',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}>
                            지지 ${Number(chartAnalysis.support[0]).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {/* 예상 방향 화살표 (중앙) */}
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        right: '15%',
                        transform: 'translateY(-50%)',
                        fontSize: '48px',
                        opacity: 0.7,
                        textShadow: '0 2px 10px rgba(0,0,0,0.5)'
                      }}>
                        {chartAnalysis.direction === 'up' ? '⬆️' :
                         chartAnalysis.direction === 'down' ? '⬇️' : '↔️'}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* 분석 텍스트 */}
              <div style={{
                padding: '20px',
                color: '#e5e7eb',
                fontSize: '14px',
                lineHeight: '1.8'
              }}>
                <div style={{
                  whiteSpace: 'pre-wrap'
                }}>
                  {extractSNSContent(imageAnalysisResult)}
                </div>

                {/* 하단 정보 */}
                <div style={{
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderTop: '1px solid #374151',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  color: '#9ca3af',
                  fontSize: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: '#ef4444' }}>❤️</span>
                    <span>{Math.floor(Math.random() * 500) + 100}</span>
                  </div>
                  <div>
                    {new Date().toLocaleString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </div>
                </div>
              </div>

              {/* 주의 문구 */}
              <div style={{
                padding: '12px 20px',
                backgroundColor: '#2d2d44',
                color: '#f59e0b',
                fontSize: '11px',
                textAlign: 'center'
              }}>
                ⚠️ 본 분석은 개인적인 의견이며 투자 권유가 아닙니다
              </div>
            </div>

            {/* 레퍼럴 & 텔레그램 정보 (이미지에 포함 안됨 - 나만 보기) */}
            {(referralCode || telegramUrl) && (
              <div style={{
                marginTop: '12px',
                padding: '16px',
                backgroundColor: '#fff',
                borderRadius: '12px',
                border: '2px dashed #e5e7eb'
              }}>
                <div style={{
                  fontSize: '11px',
                  color: '#9ca3af',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  🔒 나만 보기 (이미지에 포함되지 않음)
                </div>
                {referralCode && (
                  <div style={{
                    color: '#f7931a',
                    fontSize: '13px',
                    marginBottom: telegramUrl ? '8px' : '0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    🎁 레퍼럴 코드: <span style={{ fontWeight: '600' }}>{referralCode}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(referralCode);
                        alert('레퍼럴 코드가 복사되었습니다!');
                      }}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#fef3c7',
                        border: '1px solid #f7931a',
                        borderRadius: '4px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        marginLeft: '8px'
                      }}
                    >
                      복사
                    </button>
                  </div>
                )}
                {telegramUrl && (
                  <div style={{
                    color: '#0088cc',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    📱 텔레그램: <span style={{ fontWeight: '600' }}>{telegramUrl}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(telegramUrl);
                        alert('텔레그램 주소가 복사되었습니다!');
                      }}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#e0f2fe',
                        border: '1px solid #0088cc',
                        borderRadius: '4px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        marginLeft: '8px'
                      }}
                    >
                      복사
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 7. 참고 자료 업로드 */}
      <div style={cardStyle}>
        <label style={labelStyle}>7. 참고 자료 업로드 (선택)</label>
        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
          제품 정보, 기획안 등을 업로드하면 참고하여 콘텐츠를 생성합니다
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            backgroundColor: '#3b82f6',
            color: '#fff',
            borderRadius: '10px',
            cursor: 'pointer',
            fontWeight: '500',
            transition: 'background-color 0.2s'
          }}>
            <Upload size={18} />
            파일 선택
            <input
              type="file"
              accept=".md,.txt"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </label>
          {mdContent && (
            <span style={{ fontSize: '14px', color: '#10b981' }}>
              파일 업로드됨 ({mdContent.length}자)
            </span>
          )}
        </div>
      </div>

      {/* 실시간 트렌드 분석 옵션 (Pro 전용) */}
      <div style={{
        padding: '16px',
        marginBottom: '16px',
        backgroundColor: !isProFeatureAvailable() ? '#f9fafb' : (useTrendAnalysis ? '#ecfdf5' : '#f9fafb'),
        borderRadius: '12px',
        border: !isProFeatureAvailable() ? '2px solid #d1d5db' : (useTrendAnalysis ? '2px solid #10b981' : '1px solid #e5e7eb'),
        transition: 'all 0.2s',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {!isProFeatureAvailable() && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255,255,255,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            zIndex: 10
          }}>
            <Lock size={20} color="#10b981" />
            <span style={{ fontWeight: '600', color: '#10b981' }}>SNS Pro 전용 기능</span>
          </div>
        )}
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: isProFeatureAvailable() ? 'pointer' : 'not-allowed'
        }}>
          <input
            type="checkbox"
            checked={isProFeatureAvailable() && useTrendAnalysis}
            onChange={(e) => isProFeatureAvailable() && setUseTrendAnalysis(e.target.checked)}
            disabled={!isProFeatureAvailable()}
            style={{ width: '20px', height: '20px', accentColor: '#10b981' }}
          />
          <div>
            <span style={{
              fontWeight: '600',
              color: useTrendAnalysis && isProFeatureAvailable() ? '#047857' : '#374151',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              실시간 트렌드 분석
              <span style={{
                padding: '2px 8px',
                backgroundColor: '#8b5cf6',
                color: '#fff',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: '700'
              }}>PRO</span>
            </span>
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              AI가 인터넷에서 실시간으로 각 SNS 플랫폼의 트렌드를 검색하고, 현재 인기 해시태그와 콘텐츠 스타일을 분석하여 글을 작성합니다.
            </p>
          </div>
        </label>
      </div>

      {/* 생성 버튼 그룹 */}
      <div className="button-group" style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        {/* AI 직접 생성 버튼 */}
        <button
          onClick={generateWithAI}
          disabled={isGenerating}
          style={{
            flex: '1',
            padding: '18px',
            background: isGenerating ? '#9ca3af' : 'linear-gradient(135deg, #10b981, #059669)',
            color: '#fff',
            border: 'none',
            borderRadius: '14px',
            fontSize: '16px',
            fontWeight: '700',
            cursor: isGenerating ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
        >
          {isGenerating ? (
            <>
              <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
              {useTrendAnalysis ? '트렌드 분석 & 생성 중...' : 'AI 생성 중...'}
            </>
          ) : (
            <>
              <Zap size={20} />
              {useTrendAnalysis ? '🔍 트렌드 분석 + AI 생성' : 'AI 자동 생성'}
            </>
          )}
        </button>

        {/* 프롬프트 생성 버튼 */}
        <button
          onClick={generatePrompt}
          style={{
            flex: '1',
            padding: '18px',
            background: 'linear-gradient(135deg, #E1306C, #833AB4, #405DE6)',
            color: '#fff',
            border: 'none',
            borderRadius: '14px',
            fontSize: '16px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: '0 4px 15px rgba(131, 58, 180, 0.4)',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
        >
          <Sparkles size={20} />
          프롬프트 생성
        </button>
      </div>

      {/* AI 생성 콘텐츠 */}
      {generatedContent && (
        <div style={{...cardStyle, border: '2px solid #10b981', background: 'linear-gradient(135deg, #ecfdf5, #f0fdf4)'}}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <label style={{...labelStyle, color: '#047857', display: 'flex', alignItems: 'center', gap: '8px'}}>
              <Zap size={18} />
              AI 생성 콘텐츠 (바로 사용 가능!)
            </label>
            <button
              onClick={copyContentToClipboard}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                backgroundColor: contentCopySuccess ? '#059669' : '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
            >
              <Copy size={16} />
              {contentCopySuccess ? '복사됨!' : '전체 복사'}
            </button>
          </div>
          <div
            style={{
              width: '100%',
              padding: '20px',
              border: '2px solid #10b981',
              borderRadius: '12px',
              backgroundColor: '#fff',
              fontSize: '14px',
              lineHeight: '1.8',
              whiteSpace: 'pre-wrap',
              maxHeight: '600px',
              overflowY: 'auto',
              boxSizing: 'border-box'
            }}
          >
            {generatedContent}
          </div>
          <div style={{
            marginTop: '16px',
            padding: '12px 16px',
            backgroundColor: '#d1fae5',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '18px' }}>✨</span>
            <span style={{ color: '#065f46', fontSize: '13px' }}>
              위 콘텐츠를 복사해서 바로 SNS에 게시하세요! 플랫폼별로 구분되어 있습니다.
            </span>
          </div>
        </div>
      )}

      {/* 생성된 프롬프트 */}
      {generatedPrompt && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <label style={labelStyle}>생성된 프롬프트</label>
            <button
              onClick={copyToClipboard}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                backgroundColor: copySuccess ? '#10b981' : '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
            >
              <Copy size={16} />
              {copySuccess ? '복사됨!' : '복사하기'}
            </button>
          </div>
          <textarea
            value={generatedPrompt}
            readOnly
            style={{
              width: '100%',
              height: '400px',
              padding: '16px',
              border: '2px solid #10b981',
              borderRadius: '12px',
              fontFamily: 'monospace',
              fontSize: '13px',
              backgroundColor: '#f8fafc',
              resize: 'vertical',
              boxSizing: 'border-box'
            }}
          />
          <div style={{
            marginTop: '16px',
            padding: '16px',
            backgroundColor: '#ecfdf5',
            border: '2px solid #10b981',
            borderRadius: '12px'
          }}>
            <p style={{ fontWeight: '600', color: '#047857', marginBottom: '8px' }}>다음 단계:</p>
            <ol style={{ color: '#065f46', fontSize: '14px', paddingLeft: '20px', margin: 0 }}>
              <li style={{ marginBottom: '4px' }}>"복사하기" 버튼을 클릭하여 프롬프트를 복사하세요</li>
              <li style={{ marginBottom: '4px' }}>Claude AI에게 붙여넣기 하세요</li>
              <li style={{ marginBottom: '4px' }}>생성된 콘텐츠를 각 SNS 플랫폼에 업로드하세요</li>
              <li>이미지 프롬프트로 AI 이미지를 생성하세요</li>
            </ol>
          </div>
        </div>
      )}

      {/* 버전 정보 */}
      <div style={{
        padding: '16px',
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        fontSize: '12px',
        color: '#6b7280'
      }}>
        <p style={{ fontWeight: '600', marginBottom: '8px' }}>버전 이력</p>
        <p><strong>v1.5</strong> (2026-01-04): 라이선스 시스템 통합 (SNS Basic / SNS Pro 티어 구분)</p>
        <p><strong>v1.4</strong> (2026-01-04): 실시간 트렌드 분석 기능 추가 (Pro 전용)</p>
        <p><strong>v1.3</strong> (2026-01-04): AI 이미지 분석 기능 추가 (Pro 전용)</p>
        <p><strong>v1.2</strong> (2026-01-04): Gemini AI 자동 생성 기능 추가</p>
        <p><strong>v1.1</strong> (2026-01-04): 쓰레드(Threads) 플랫폼 추가</p>
        <p><strong>v1.0</strong> (2026-01-04): 첫 출시! 인스타그램/페이스북/트위터 통합 지원</p>
      </div>

      {/* CSS 애니메이션 및 모바일 최적화 */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* 모바일 최적화 */
        @media (max-width: 768px) {
          /* 플랫폼 버튼 세로 배치 */
          .platform-buttons {
            flex-direction: column !important;
          }

          /* 이미지 업로드 영역 세로 배치 */
          .image-upload-grid {
            grid-template-columns: 1fr !important;
          }

          /* 기본 정보 입력 세로 배치 */
          .info-grid {
            grid-template-columns: 1fr !important;
          }

          /* 버튼 그룹 세로 배치 */
          .button-group {
            flex-direction: column !important;
          }

          /* 폰트 크기 조정 */
          h1 {
            font-size: 22px !important;
          }

          /* 패딩 조정 */
          .card {
            padding: 16px !important;
          }
        }

        @media (max-width: 480px) {
          /* 더 작은 화면 */
          h1 {
            font-size: 20px !important;
          }

          button {
            font-size: 14px !important;
            padding: 12px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default SNSPromoGenerator;
