// Instagram API with Instagram Login (graph.instagram.com)
import { API_VERSION, IG_USER_ID } from './config.js';

async function call(path, token, { method = 'GET', form, json, query } = {}) {
  const url = new URL(`https://graph.instagram.com/${API_VERSION}/${path}`);
  for (const [k, v] of Object.entries(query || {})) url.searchParams.set(k, v);
  const headers = { Authorization: `Bearer ${token}` };
  let body;
  if (form) { body = new URLSearchParams(form); }
  if (json) { body = JSON.stringify(json); headers['Content-Type'] = 'application/json'; }

  const res = await fetch(url, { method, headers, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const e = data.error || {};
    throw new Error(`${e.message || `HTTP ${res.status}`} (code ${e.code ?? '-'}/${e.error_subcode ?? '-'})`);
  }
  return data;
}

// 댓글에 공개 답글
export function replyToComment(token, commentId, message) {
  return call(`${commentId}/replies`, token, { method: 'POST', form: { message } });
}

// Private Reply: 댓글 1개당 DM 1통, 댓글 작성 후 7일 이내
export function sendPrivateReply(token, commentId, text, quickReplies) {
  const message = { text };
  if (quickReplies?.length) message.quick_replies = quickReplies;
  return call(`${IG_USER_ID}/messages`, token, {
    method: 'POST',
    json: { recipient: { comment_id: commentId }, message },
  });
}

// 고객이 먼저 답장한 뒤 24시간 안에 보내는 일반 DM (텍스트·버튼 템플릿)
export function sendMessage(token, igsid, message) {
  return call(`${IG_USER_ID}/messages`, token, {
    method: 'POST',
    json: { recipient: { id: igsid }, message },
  });
}

export const buttonTemplate = (text, buttons) => ({
  attachment: { type: 'template', payload: { template_type: 'button', text: text.slice(0, 640), buttons } },
});

// 팔로우 여부 (고객이 우리에게 DM 을 보낸 뒤에만 조회 가능)
export function getUserProfile(token, igsid) {
  return call(igsid, token, { query: { fields: 'username,is_user_follow_business' } });
}

// 게시물 id → shortcode (게시물 주소의 /p/{shortcode}/). 인스턴스가 살아 있는 동안 캐시
const shortcodes = new Map();
export async function getShortcode(token, mediaId) {
  if (!shortcodes.has(mediaId)) {
    const { shortcode } = await call(mediaId, token, { query: { fields: 'shortcode' } });
    shortcodes.set(mediaId, shortcode);
  }
  return shortcodes.get(mediaId);
}

// 장기 토큰 갱신 (발급 24시간 이후부터 가능, 유효기간 60일로 다시 늘어남)
export async function refreshLongLivedToken(token) {
  const url = new URL('https://graph.instagram.com/refresh_access_token');
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', token);
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(data.error?.message || `refresh failed: HTTP ${res.status}`);
  }
  return data; // { access_token, token_type, expires_in }
}
