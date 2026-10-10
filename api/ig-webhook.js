// 인스타그램 웹훅
//   comments  → 공개 답글 + Private Reply DM
//               팔로우 확인을 켜면 DM 은 "팔로우하고 '팔로우했어요'를 눌러주세요" 안내
//   messages  → 안내를 받은 고객이 답장하면 팔로우를 확인하고 리딩 + 링크 버튼을 보낸다
//               (팔로우 여부는 고객이 먼저 DM 을 보낸 뒤에만 조회할 수 있다 — Meta 정책)
// 환경변수: IG_APP_SECRET, IG_VERIFY_TOKEN, IG_ACCESS_TOKEN(초기값), FIREBASE_SERVICE_ACCOUNT
import crypto from 'node:crypto';
import { waitUntil } from '@vercel/functions';
import { IG_USER_ID, FOLLOW_PAYLOAD, FOLLOW_BUTTON } from '../lib/ig/config.js';
import { decide, needsShortcode } from '../lib/ig/rules.js';
import {
  replyToComment, sendPrivateReply, sendMessage, buttonTemplate, getUserProfile, getShortcode,
} from '../lib/ig/graph.js';
import {
  db, getAccessToken, getSettings, commentRef, pendingRef, FieldValue,
} from '../lib/ig/store.js';

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const MAX_NOT_FOLLOWING = 3; // 팔로우 안 됨 안내는 3번까지만
const FOLLOW_QUICK_REPLY = [{ content_type: 'text', title: FOLLOW_BUTTON, payload: FOLLOW_PAYLOAD }];

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
    for (const event of entry.messaging || []) {
      try {
        await handleMessage(event);
      } catch (e) {
        console.error('[ig] message error:', event.sender?.id, e);
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

  const [token, settings] = await Promise.all([getAccessToken(), getSettings()]);

  let shortcode = null;
  if (mediaId && needsShortcode(settings)) {
    try { shortcode = await getShortcode(token, mediaId); }
    catch (e) { console.warn('[ig] shortcode lookup failed:', mediaId, e.message); }
  }
  const action = decide(v.text, settings, shortcode);
  if (!action) return; // 키워드 없는 댓글은 기록도 남기지 않는다

  // 같은 댓글 중복 처리 방지: 문서를 먼저 만든 쪽만 진행
  const ref = commentRef(commentId);
  const username = v.from?.username || null;
  const gate = settings.followGate !== false;
  try {
    await ref.create({
      mediaId: mediaId || null,
      shortcode,
      fromId,
      username,
      text: String(v.text || '').slice(0, 500),
      rule: action.rule.name || action.rule.id || '',
      keyword: action.keyword,
      gate,
      status: 'processing',
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    if (e.code === 6) return; // ALREADY_EXISTS
    throw e;
  }

  const skipped = { ok: true, skipped: true };
  let dmTask;
  if (gate) {
    // 빠른 답장 버튼이 거절되면 글자만으로 다시 보낸다 (보내기 실패는 1통 제한에 들어가지 않는다)
    dmTask = run(() => sendPrivateReply(token, commentId, settings.gateText, FOLLOW_QUICK_REPLY))
      .then((r) => (r.ok ? r : run(() => sendPrivateReply(token, commentId, settings.gateText))));
  } else {
    dmTask = action.dm ? run(() => sendPrivateReply(token, commentId, action.dm)) : Promise.resolve(skipped);
  }
  const [reply, dm] = await Promise.all([
    action.reply ? run(() => replyToComment(token, commentId, action.reply)) : skipped,
    dmTask,
  ]);

  if (gate && dm.ok) {
    // 같은 사람이 여러 게시물에 댓글을 달면 리딩을 모아 두었다가 팔로우 확인 후 한꺼번에 보낸다
    const pref = pendingRef(fromId);
    await db().runTransaction(async (tx) => {
      const cur = await tx.get(pref);
      const prev = cur.exists ? pendingItems(cur.data()) : [];
      const items = [...prev.filter((x) => x.content !== action.content), { commentId, content: action.content }].slice(-3);
      tx.set(pref, {
        username,
        items,
        buttons: action.buttons,
        buttonText: settings.buttonText,
        notFollowingText: settings.notFollowingText,
        notFollowingCount: cur.exists ? cur.get('notFollowingCount') || 0 : 0,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
  }
  const status = !dm.ok && !reply.ok ? 'failed'
    : !dm.ok || !reply.ok ? 'partial'
    : gate ? 'waiting' : 'done';
  await ref.update({ status, reply, dm, updatedAt: FieldValue.serverTimestamp() });
  console.log('[ig]', commentId, action.keyword, status, reply.error || '', dm.error || '');
}

// 고객이 보낸 DM: 팔로우 확인을 기다리는 사람일 때만 반응한다 (그 외 DM 은 운영자가 직접)
async function handleMessage(event) {
  const igsid = event.sender?.id;
  const msg = event.message;
  if (!igsid || igsid === IG_USER_ID) return;
  if (!msg && !event.postback) return; // 읽음·반응 등
  if (msg?.is_echo || msg?.is_deleted) return;

  const token = await getAccessToken();
  let ref = pendingRef(igsid);
  let snap = await ref.get();
  let profile = null;

  // 댓글 웹훅의 ID 와 DM 의 ID 가 다르면 사용자 이름으로 찾는다
  if (!snap.exists) {
    profile = await getUserProfile(token, igsid).catch(() => null);
    if (!profile?.username) return;
    const q = await db().collection('ig_pending').where('username', '==', profile.username).limit(1).get();
    if (q.empty) return;
    ref = q.docs[0].ref;
    snap = q.docs[0];
  }

  const p = snap.data();
  const created = p.createdAt?.toMillis?.() || 0;
  if (created && Date.now() - created > SEVEN_DAYS) { await ref.delete(); return; }

  profile ||= await getUserProfile(token, igsid);
  const items = pendingItems(p);
  const updateComments = (data) => Promise.all(items.map((it) =>
    commentRef(it.commentId).update({ ...data, updatedAt: FieldValue.serverTimestamp() }).catch(() => {})));

  if (!profile.is_user_follow_business) {
    const n = (p.notFollowingCount || 0) + 1;
    await ref.update({ notFollowingCount: n });
    if (n <= MAX_NOT_FOLLOWING) {
      await sendMessage(token, igsid, { text: p.notFollowingText, quick_replies: FOLLOW_QUICK_REPLY })
        .catch(() => sendMessage(token, igsid, { text: p.notFollowingText }));
    }
    await updateComments({ notFollowingCount: n });
    return;
  }

  // 두 번 눌러도 한 번만 보낸다: 대기 문서를 지운 쪽만 보낸다
  const claimed = await db().runTransaction(async (tx) => {
    const cur = await tx.get(ref);
    if (!cur.exists) return false;
    tx.delete(ref);
    return true;
  });
  if (!claimed) return;

  const delivered = await run(async () => {
    for (const it of items) if (it.content) await sendMessage(token, igsid, { text: it.content });
    if (p.buttons?.length) return sendMessage(token, igsid, buttonTemplate(p.buttonText || '✨', p.buttons));
    return {};
  });
  await updateComments({ status: delivered.ok ? 'done' : 'partial', delivered, followedAt: FieldValue.serverTimestamp() });
  console.log('[ig] delivered', items.map((it) => it.commentId).join(','), delivered.ok ? 'ok' : delivered.error);
}

// 예전 형식(댓글 1건) 대기 문서도 같이 처리한다
const pendingItems = (p) => p.items || (p.commentId ? [{ commentId: p.commentId, content: p.content }] : []);

async function run(fn) {
  try {
    const r = await fn();
    return { ok: true, id: r.id || r.message_id || null };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
