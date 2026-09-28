// 댓글 → 무엇을 보낼지 결정 (네트워크 없음, 순수 함수)
import {
  KEYWORDS, PUBLIC_REPLIES, PICK_PUBLIC_REPLIES, PROMO, PICK_HEADER,
} from './config.js';

const DM_LIMIT = 990; // 인스타 DM 텍스트 1000자 미만
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

export function hasKeyword(text, keywords = KEYWORDS) {
  const t = squash(text);
  return keywords.some((k) => k && t.includes(squash(k)));
}

// 1000자를 넘기면 리딩 쪽을 줄인다 (홍보 문구·링크는 지킨다)
function composeDm(head, body) {
  const tail = `\n\n━━━━━━━━━━━━\n\n${PROMO}`;
  let full = `${head}\n\n${body}${tail}`;
  if (full.length > DM_LIMIT) {
    const room = DM_LIMIT - head.length - tail.length - 3;
    full = `${head}\n\n${body.slice(0, Math.max(0, room))}…${tail}`;
  }
  return full;
}

// rule: POST_RULES[shortcode] 또는 undefined
// 반환: null(무시) | { kind, pick?, reply, dm }
export function decide(text, rule) {
  if (rule?.picks) {
    const n = detectPick(text);
    const reading = n && rule.picks[n];
    if (reading) {
      return {
        kind: 'pick',
        pick: n,
        reply: pickOne(PICK_PUBLIC_REPLIES).replaceAll('{n}', n),
        dm: composeDm(PICK_HEADER.replaceAll('{n}', n), reading.trim()),
      };
    }
  }
  if (hasKeyword(text, rule?.keywords || KEYWORDS)) {
    return { kind: 'promo', reply: pickOne(PUBLIC_REPLIES), dm: PROMO };
  }
  return null;
}
