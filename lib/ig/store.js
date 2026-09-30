// Firestore (서버 전용, Admin SDK → firestore.rules 를 거치지 않는다)
//   ig_config/token        : 자동 갱신되는 인스타 액세스 토큰 (서버 전용)
//   ig_config/settings     : 관리자 페이지에서 고치는 문구·키워드·규칙
//   ig_comments/{commentId}: 댓글 처리 기록 (중복 방지 + 결과 로그, 90일 후 삭제)
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

// Firestore 에 갱신된 토큰이 있으면 그걸, 없으면 환경변수(초기값)를 쓴다
let cached = null; // { token, at }
export async function getAccessToken() {
  if (cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.token;
  const snap = await tokenRef().get();
  const token = snap.exists && snap.get('accessToken') ? snap.get('accessToken') : process.env.IG_ACCESS_TOKEN;
  if (!token) throw new Error('IG access token missing');
  cached = { token, at: Date.now() };
  return token;
}

// 관리자 페이지에서 저장한 문구·규칙 (1분 캐시 → 저장 후 1분 안에 반영). 없으면 기본값
let settingsCache = null; // { value, at }
export async function getSettings() {
  if (settingsCache && Date.now() - settingsCache.at < 60 * 1000) return settingsCache.value;
  const snap = await db().collection('ig_config').doc('settings').get();
  const value = snap.exists ? snap.data() : DEFAULT_SETTINGS;
  settingsCache = { value, at: Date.now() };
  return value;
}

export async function saveAccessToken(token, expiresIn) {
  await tokenRef().set({
    accessToken: token,
    expiresAt: Timestamp.fromMillis(Date.now() + expiresIn * 1000),
    refreshedAt: FieldValue.serverTimestamp(),
  });
  cached = { token, at: Date.now() };
}
