// 댓글 → 무엇을 보낼지 결정 (네트워크 없음, 순수 함수)
// 서버(웹훅)와 관리자 페이지(댓글 테스트)가 함께 쓴다.
import { LINK_READING, LINK_SEMINAR } from './config.js';

export const DM_LIMIT = 990; // 인스타 DM 텍스트 1000자 미만
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
const squash = (s) => String(s || '').toLowerCase().replace(/\s+/g, '');

const ORDINALS = { 첫: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9 };

// "1번", "2 번이요", "3️⃣", "두번째", 짧은 댓글의 "1" → 번호
export function detectPick(text) {
  const t = String(text || '');
  let m = t.match(/([1-9])\s*번/) || t.match(/([1-9])️?⃣/);
  if (m) return Number(m[1]);
  m = t.replace(/\s+/g, '').match(/(첫|두|세|네|다섯|여섯|일곱|여덟|아홉)번째/);
  if (m) return ORDINALS[m[1]];
  const digits = t.match(/[0-9]+/g);
  if (t.trim().length <= 10 && digits?.length === 1 && /^[1-9]$/.test(digits[0])) return Number(digits[0]);
  return null;
}

// 키워드 "1번" 은 번호 댓글("1", "1️⃣", "첫번째")까지 잡는다. 나머지는 띄어쓰기·대소문자 무시 포함 검사
export function matchKeyword(text, keyword) {
  const k = squash(keyword);
  if (!k) return false;
  const num = k.match(/^([1-9])번$/);
  if (num) return detectPick(text) === Number(num[1]);
  return squash(text).includes(k);
}

// 게시물 주소나 shortcode → shortcode
export function toShortcode(post) {
  const s = String(post || '').trim();
  const m = s.match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : s.replace(/[^A-Za-z0-9_-]/g, '');
}

export const fillLinks = (s) => String(s || '')
  .replaceAll('{리딩링크}', LINK_READING)
  .replaceAll('{세미나링크}', LINK_SEMINAR);

// 1000자를 넘기면 규칙 DM 쪽을 줄인다 (홍보 문구·링크는 지킨다)
export function composeDm(rule, promo) {
  const body = fillLinks(rule.dm).trim();
  const tail = rule.appendPromo ? fillLinks(promo).trim() : '';
  const sep = body && tail ? '\n\n━━━━━━━━━━━━\n\n' : '';
  let full = body + sep + tail;
  if (full.length > DM_LIMIT) {
    const room = Math.max(0, DM_LIMIT - sep.length - tail.length - 1);
    full = (room ? body.slice(0, room) + '…' : '') + sep + tail;
    full = full.slice(0, DM_LIMIT);
  }
  return full;
}

// settings: { promo, rules[] }, shortcode: 댓글이 달린 게시물 (모르면 null)
// 반환: null(무시) | { rule, keyword, reply, dm }
// 특정 게시물 규칙을 먼저, 그다음 전체 게시물 규칙을 목록 순서대로 본다
export function decide(text, settings, shortcode) {
  const rules = (settings?.rules || []).filter((r) => r.enabled !== false && r.keywords?.length);
  const ordered = [
    ...rules.filter((r) => r.post && toShortcode(r.post) === shortcode),
    ...rules.filter((r) => !r.post),
  ];
  for (const rule of ordered) {
    const keyword = rule.keywords.find((k) => matchKeyword(text, k));
    if (!keyword) continue;
    const replies = (rule.replies || []).map((s) => s.trim()).filter(Boolean);
    return {
      rule,
      keyword,
      reply: replies.length ? fillLinks(pickOne(replies)) : '',
      dm: composeDm(rule, settings.promo),
    };
  }
  return null;
}

export const needsShortcode = (settings) => (settings?.rules || []).some((r) => r.enabled !== false && r.post);
