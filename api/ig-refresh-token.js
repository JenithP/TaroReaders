// Vercel Cron (주 1회): 인스타 장기 토큰 갱신 + 90일 지난 댓글 처리 기록·7일 지난 팔로우 대기 삭제
// 환경변수: CRON_SECRET (Vercel 이 Authorization: Bearer 로 붙여 보낸다)
import { refreshLongLivedToken } from '../lib/ig/graph.js';
import { db, getAccessToken, saveAccessToken, Timestamp } from '../lib/ig/store.js';

const RETENTION_DAYS = 90;

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('unauthorized', { status: 401 });
  }

  const result = {};
  try {
    const current = await getAccessToken();
    const { access_token, expires_in } = await refreshLongLivedToken(current);
    await saveAccessToken(access_token, expires_in);
    result.token = { ok: true, expiresInDays: Math.round(expires_in / 86400) };
  } catch (e) {
    console.error('[ig-refresh] token refresh failed:', e.message);
    result.token = { ok: false, error: e.message };
  }

  try {
    const cutoff = Timestamp.fromMillis(Date.now() - RETENTION_DAYS * 86400 * 1000);
    const old = await db().collection('ig_comments').where('createdAt', '<', cutoff).limit(400).get();
    const batch = db().batch();
    old.docs.forEach((d) => batch.delete(d.ref));
    if (!old.empty) await batch.commit();
    result.purged = old.size;
    // 7일 지난 팔로우 대기 (Private Reply 이후 대화 기한이 지남)
    const stale = await db().collection('ig_pending')
      .where('createdAt', '<', Timestamp.fromMillis(Date.now() - 7 * 86400 * 1000)).limit(400).get();
    if (!stale.empty) { const b = db().batch(); stale.docs.forEach((d) => b.delete(d.ref)); await b.commit(); }
    result.pendingPurged = stale.size;
  } catch (e) {
    console.error('[ig-refresh] purge failed:', e.message);
    result.purgeError = e.message;
  }

  console.log('[ig-refresh]', JSON.stringify(result));
  return Response.json(result, { status: result.token.ok ? 200 : 500 });
}
