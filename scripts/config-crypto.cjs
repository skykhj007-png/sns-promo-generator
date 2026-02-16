#!/usr/bin/env node
/**
 * .env 파일 암호화/복호화 도구
 * 사용법:
 *   npm run config:encrypt   -- .env -> .env.encrypted (비밀번호 설정)
 *   npm run config:decrypt   -- .env.encrypted -> .env (비밀번호 입력)
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ENV_FILE = path.join(__dirname, '..', '.env');
const ENCRYPTED_FILE = path.join(__dirname, '..', '.env.encrypted');
const ALGORITHM = 'aes-256-gcm';

function askPassword(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
}

function encrypt(text, password) {
  const salt = crypto.randomBytes(16);
  const key = deriveKey(password, salt);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return JSON.stringify({
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    data: encrypted,
  });
}

function decrypt(encryptedJson, password) {
  const { salt, iv, authTag, data } = JSON.parse(encryptedJson);
  const key = deriveKey(password, Buffer.from(salt, 'hex'));
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function main() {
  const command = process.argv[2];

  if (command === 'encrypt') {
    if (!fs.existsSync(ENV_FILE)) {
      console.error('ERROR: .env 파일이 없습니다. 먼저 .env 파일을 생성해주세요.');
      process.exit(1);
    }
    const password = await askPassword('암호화 비밀번호 입력: ');
    if (!password) {
      console.error('ERROR: 비밀번호를 입력해주세요.');
      process.exit(1);
    }
    const confirm = await askPassword('비밀번호 확인: ');
    if (password !== confirm) {
      console.error('ERROR: 비밀번호가 일치하지 않습니다.');
      process.exit(1);
    }
    const envContent = fs.readFileSync(ENV_FILE, 'utf8');
    const encrypted = encrypt(envContent, password);
    fs.writeFileSync(ENCRYPTED_FILE, encrypted, 'utf8');
    console.log('SUCCESS: .env.encrypted 파일이 생성되었습니다.');
    console.log('이 파일은 Git에 커밋되어 다른 컴퓨터에서 복호화할 수 있습니다.');
  } else if (command === 'decrypt') {
    if (!fs.existsSync(ENCRYPTED_FILE)) {
      console.error('ERROR: .env.encrypted 파일이 없습니다.');
      process.exit(1);
    }
    const password = await askPassword('복호화 비밀번호 입력: ');
    if (!password) {
      console.error('ERROR: 비밀번호를 입력해주세요.');
      process.exit(1);
    }
    const encryptedContent = fs.readFileSync(ENCRYPTED_FILE, 'utf8');
    try {
      const decrypted = decrypt(encryptedContent, password);
      fs.writeFileSync(ENV_FILE, decrypted, 'utf8');
      console.log('SUCCESS: .env 파일이 복원되었습니다.');
    } catch (err) {
      console.error('ERROR: 비밀번호가 틀렸습니다.');
      process.exit(1);
    }
  } else {
    console.log('사용법:');
    console.log('  node scripts/config-crypto.js encrypt   - .env 암호화');
    console.log('  node scripts/config-crypto.js decrypt   - .env 복호화');
  }
}

main();
