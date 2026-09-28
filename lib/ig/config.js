// 별빛타로 인스타그램 댓글 자동응답 설정
// 문구·키워드·게시물별 규칙은 이 파일만 고치면 된다. (토큰·시크릿은 절대 여기 넣지 말 것 → Vercel 환경변수)

export const API_VERSION = 'v26.0'; // 2026-07-29 출시, Graph API 최신
export const IG_USER_ID = '17841437874170252'; // @vkstpk78
export const SITE = 'https://starrytarotcom.vercel.app';

const TRACK = 'src=ig_dm_comment&utm_source=instagram&utm_medium=dm&utm_campaign=comment_auto';
export const LINK_READING = `${SITE}/?${TRACK}&utm_content=reading`;
export const LINK_SEMINAR = `${SITE}/seminar.html?${TRACK}&utm_content=seminar`;

// ── 반응 키워드 (댓글에 하나라도 들어 있으면 홍보 DM) ──
// 띄어쓰기·대소문자 무시. 게시물별 규칙에서 keywords 로 따로 덮어쓸 수 있다.
export const KEYWORDS = ['루미', '타로', '상담', '리딩', '세미나', '신청'];

// ── 댓글 공개 답글 (여러 개 중 무작위 → 같은 문구 반복으로 스팸 처리되는 것 방지) ──
export const PUBLIC_REPLIES = [
  '🌙 별빛이 닿았어요. DM을 살짝 열어보세요 ✨',
  '🔮 카드가 당신에게 편지를 보냈어요. DM 확인해 주세요 💌',
  '✨ 당신만을 위한 별빛 메시지가 DM으로 날아갔어요 🌌',
  '🕯 조용히 DM으로 속삭여 두었어요. 확인해 보세요 🌙',
];
// {n} → 고른 번호
export const PICK_PUBLIC_REPLIES = [
  '🔮 {n}번 카드의 이야기를 DM으로 보내드렸어요 ✨',
  '🌙 {n}번을 고른 당신에게, 카드의 속삭임을 DM으로 전했어요 💌',
  '✨ {n}번 카드가 당신을 기다리고 있었어요. DM을 열어보세요 🌌',
];

// ── DM 홍보 문구 (모든 DM 끝에 붙는다) ──
export const PROMO = `🌙 별빛이 당신의 댓글을 따라 여기까지 왔어요.

카드가 아직 다 들려주지 못한 이야기가 있다면,
별빛타로의 리딩 방으로 건너오세요.
당신이 직접 뽑은 세 장이 과거·현재·미래를 조용히 펼쳐 보일 거예요 🔮
✨ 나만의 리딩 받기 → ${LINK_READING}

그리고 카드를 '듣는' 사람에서 '읽는' 사람이 되고 싶다면,
별빛 아래 함께 모이는 타로 세미나가 기다리고 있어요.
다음 모임의 자리가 닫히기 전에, 먼저 손 들어 주세요 🕯
🌌 세미나 신청하기 → ${LINK_SEMINAR}

오늘 밤, 당신에게 꼭 필요한 카드가 찾아오길.
— 별빛타로 ✦`;

// 번호 게시물의 DM 머리말. {n} → 고른 번호
export const PICK_HEADER = '🔮 {n}번 카드를 고른 당신에게';

// ── 게시물별 규칙 ──
// 키: 게시물 주소의 shortcode  (instagram.com/p/여기/  또는  instagram.com/reel/여기/)
//   picks    : "1번", "2", "두번째", "3️⃣" 같은 댓글 → 해당 번호 리딩 + 홍보 문구를 DM으로
//   keywords : (선택) 이 게시물에서만 쓸 키워드. 없으면 위 KEYWORDS
// 번호가 없는 댓글이라도 키워드가 있으면 홍보 문구 DM은 간다.
// 규칙이 없는 게시물은 KEYWORDS 로만 반응한다.
// DM은 한 통에 1000자 제한 → 리딩 하나는 350자 안쪽으로.
//
// 예시:
// 'DAbCdEfGhIj': {
//   picks: {
//     1: `달빛 아래 컵을 든 여인이 보여요. 요즘 마음이 먼저 알아챈 것이 있죠?
// 머리로 따지기 전에 그 느낌을 한 번 믿어보세요. 이번 주, 미뤄둔 연락 하나가 흐름을 바꿔요 🌙`,
//     2: `...`,
//     3: `...`,
//   },
// },
export const POST_RULES = {
};
