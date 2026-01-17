# 포맷 후 복구 가이드

## 1단계: 필수 프로그램 설치

```bash
# Node.js 설치 (https://nodejs.org)
# Git 설치 (https://git-scm.com)
# VS Code 설치 (https://code.visualstudio.com)
```

## 2단계: 프로젝트 Clone

```bash
cd C:\Users\kim
git clone https://github.com/skykhj007-png/sns-promo-generator.git
cd sns-promo-generator
npm install
```

## 3단계: 암호화된 파일 복호화

```bash
# 암호화 비밀번호 필요 (포맷 전 설정한 비밀번호)
openssl enc -aes-256-cbc -d -pbkdf2 -in RECOVERY_SECRETS.enc -out RECOVERY_SECRETS.txt -pass pass:여기에비밀번호입력
```

## 4단계: 환경변수 설정

### 4-1. 로컬 개발용 (.dev.vars)
복호화된 파일에서 [4] 섹션 내용을 복사해서 `.dev.vars` 파일 생성

### 4-2. Cloudflare Secrets 설정
```bash
npx wrangler pages secret put CRON_SECRET --project-name=sns-promo-generator
npx wrangler pages secret put OPENAI_API_KEY --project-name=sns-promo-generator
npx wrangler pages secret put TWITTER_API_KEY --project-name=sns-promo-generator
npx wrangler pages secret put TWITTER_API_SECRET --project-name=sns-promo-generator
npx wrangler pages secret put TWITTER_ACCESS_TOKEN --project-name=sns-promo-generator
npx wrangler pages secret put TWITTER_ACCESS_TOKEN_SECRET --project-name=sns-promo-generator
npx wrangler pages secret put THREADS_ACCESS_TOKEN --project-name=sns-promo-generator
npx wrangler pages secret put THREADS_APP_ID --project-name=sns-promo-generator
npx wrangler pages secret put THREADS_APP_SECRET --project-name=sns-promo-generator
```

### 4-3. GitHub Secrets (이미 설정됨 - 변경 불필요)
- https://github.com/skykhj007-png/sns-promo-generator/settings/secrets/actions

## 5단계: 배포

```bash
npm run deploy
```

## 6단계: 테스트

```bash
curl "https://sns-promo-generator.pages.dev/api/cron-tweet?secret=btc2024secret"
```

---

## API 키 재발급 방법

### OpenAI API Key
1. https://platform.openai.com/api-keys 접속
2. "Create new secret key" 클릭
3. 키 복사해서 Cloudflare secret에 저장

### Twitter API Keys
1. https://developer.twitter.com/en/portal/dashboard 접속
2. 프로젝트 선택 → Keys and tokens
3. 키 확인 또는 재생성

### Threads API
1. https://developers.facebook.com/ 접속
2. 앱 선택 → 설정 → 기본 설정
3. App ID, App Secret 확인
4. Threads API → Access Token 재생성

---

## 다른 프로젝트들 Clone

```bash
cd C:\Users\kim
git clone https://github.com/skykhj007-png/blog-gen.git
git clone https://github.com/skykhj007-png/trading-automation.git
git clone https://github.com/skykhj007-png/overtimemoney.git
```

---

## 문제 발생 시

Claude Code에서 이 파일을 보여주고 도움 요청하세요.
