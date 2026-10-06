// Firestore (서버 전용, Admin SDK → firestore.rules 를 거치지 않는다)
//   ig_config/token        : 자동 갱신되는 인스타 액세스 토큰 (서버 전용)
//   ig_config/settings     : 관리자 페이지에서 고치는 문구·키워드·규칙
//   ig_comments/{commentId}: 댓글 처리 기록 (중복 방지 + 결과 로그, 90일 후 삭제)
//   ig_pending/{igsid}     : 팔로우 확인을 기다리는 고객과 보낼 내용 (7일 후 무효)
import crypto from 'node:crypto';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

import { DEFAULT_SETTINGS } from './config.js';

export { FieldValue, Timestamp };

export function db() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  }
  return getFirestore();
}

const tokenRef = () => db().collection('ig_config').doc('token');
export const commentRef = (id) => db().collection('ig_comments').doc(String(id));
// 팔로우 확인을 기다리는 고객 (고객 인스타 ID = 문서 ID)
export const pendingRef = (igsid) => db().collection('ig_pending').doc(String(igsid));

// Firestore 에 갱신된 토큰이 있으면 그걸, 없으면 환경변수(초기값)를 쓴다.
// 관리자가 토큰을 새로 받아 IG_ACCESS_TOKEN 을 바꾸면(seed 가 달라지면) 환경변수 쪽을 쓴다.
const seedOf = (t) => (t ? crypto.createHash('sha256').update(t).digest('hex').slice(0, 16) : '');
let cached = null; // { token, at }
export async function getAccessToken() {
  if (cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.token;
  const envToken = process.env.IG_ACCESS_TOKEN;
  const snap = await tokenRef().get();
  const stored = snap.exists ? snap.data() : null;
  const useStored = stored?.accessToken && (!envToken || stored.seed === seedOf(envToken));
  const token = useStored ? stored.accessToken : envToken;
  if (!token) throw new Error('IG access token missing');
  cached = { token, at: Date.now() };
  return token;
}

// 관리자 페이지에서 저장한 문구·규칙 (1분 캐시 → 저장 후 1분 안에 반영). 없으면 기본값
let settingsCache = null; // { value, at }
export async function getSettings() {
  if (settingsCache && Date.now() - settingsCache.at < 60 * 1000) return settingsCache.value;
  const snap = await db().collection('ig_config').doc('settings').get();
  const value = { ...DEFAULT_SETTINGS, ...(snap.exists ? snap.data() : {}) };
  settingsCache = { value, at: Date.now() };
  return value;
}

export async function saveAccessToken(token, expiresIn) {
  await tokenRef().set({
    accessToken: token,
    seed: seedOf(process.env.IG_ACCESS_TOKEN),
    expiresAt: Timestamp.fromMillis(Date.now() + expiresIn * 1000),
    refreshedAt: FieldValue.serverTimestamp(),
  });
  cached = { token, at: Date.now() };
}
