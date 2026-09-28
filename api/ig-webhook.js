// 인스타그램 댓글 웹훅 → 공개 답글 + Private Reply DM
// 환경변수: IG_APP_SECRET, IG_VERIFY_TOKEN, IG_ACCESS_TOKEN(초기값), FIREBASE_SERVICE_ACCOUNT
import crypto from 'node:crypto';
import { waitUntil } from '@vercel/functions';
import { IG_USER_ID, POST_RULES } from '../lib/ig/config.js';
import { decide } from '../lib/ig/rules.js';
import { replyToComment, sendPrivateReply, getShortcode } from '../lib/ig/graph.js';
import { getAccessToken, commentRef, FieldValue } from '../lib/ig/store.js';

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

// Meta 웹훅 등록 시 인증
export function GET(request) {
  const p = new URL(request.url).searchParams;
  const expected = process.env.IG_VERIFY_TOKEN;
  if (expected && p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') === expected) {
    return new Response(p.get('hub.challenge') || '', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return new Response('forbidden', { status: 403 });
}

export async function POST(request) {
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get('x-hub-signature-256'))) {
    console.warn('[ig] bad signature');
    return new Response('invalid signature', { status: 401 });
  }
  let body;
  try { body = JSON.parse(raw); } catch { return new Response('bad json', { status: 400 }); }

  // 먼저 200 을 돌려주고, 처리는 응답 뒤에 이어서 한다
  waitUntil(handlePayload(body).catch((e) => console.error('[ig] payload error:', e)));
  return new Response('EVENT_RECEIVED', { status: 200 });
}

function validSignature(raw, header) {
  const secret = process.env.IG_APP_SECRET;
  if (!secret || !header?.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', secret).update(raw, 'utf8').digest();
  const given = Buffer.from(header.slice(7), 'hex');
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

async function handlePayload(body) {
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'comments') continue;
      try {
        await handleComment(change.value || {}, entry.time);
      } catch (e) {
        console.error('[ig] comment error:', change.value?.id, e);
      }
    }
  }
}

async function handleComment(v, entryTime) {
  const commentId = v.id;
  const fromId = v.from?.id;
  const mediaId = v.media?.id;
  if (!commentId || !fromId) return;
  if (fromId === IG_USER_ID) return; // 내가 단 댓글(자동 답글 포함) → 무한루프 방지

  // Private Reply 는 댓글 작성 후 7일까지만 가능 (entry.time: 초 또는 밀리초)
  if (entryTime) {
    const ms = entryTime > 1e12 ? entryTime : entryTime * 1000;
    if (Date.now() - ms > SEVEN_DAYS) return;
  }

  const token = await getAccessToken();

  let shortcode = null;
  if (mediaId && Object.keys(POST_RULES).length) {
    try { shortcode = await getShortcode(token, mediaId); }
    catch (e) { console.warn('[ig] shortcode lookup failed:', mediaId, e.message); }
  }
  const action = decide(v.text, shortcode ? POST_RULES[shortcode] : undefined);
  if (!action) return; // 키워드 없는 댓글은 기록도 남기지 않는다

  // 같은 댓글 중복 처리 방지: 문서를 먼저 만든 쪽만 진행
  const ref = commentRef(commentId);
  try {
    await ref.create({
      mediaId: mediaId || null,
      shortcode,
      fromId,
      username: v.from?.username || null,
      text: String(v.text || '').slice(0, 500),
      kind: action.kind,
      pick: action.pick ?? null,
      status: 'processing',
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    if (e.code === 6) return; // ALREADY_EXISTS
    throw e;
  }

  const [reply, dm] = await Promise.all([
    run(() => replyToComment(token, commentId, action.reply)),
    run(() => sendPrivateReply(token, commentId, action.dm)),
  ]);
  const status = reply.ok && dm.ok ? 'done' : reply.ok || dm.ok ? 'partial' : 'failed';
  await ref.update({ status, reply, dm, updatedAt: FieldValue.serverTimestamp() });
  console.log('[ig]', commentId, action.kind, status, reply.error || '', dm.error || '');
}

async function run(fn) {
  try {
    const r = await fn();
    return { ok: true, id: r.id || r.message_id || null };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
