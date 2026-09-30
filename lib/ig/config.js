// 별빛타로 인스타그램 댓글 자동응답 — 고정 설정과 기본값
// 문구·키워드·규칙은 관리자 페이지(인스타그램 탭)에서 고치고 Firestore ig_config/settings 에 저장된다.
// 아래 DEFAULT_SETTINGS 는 관리자 페이지에서 한 번도 저장하기 전에만 쓰인다.
// 이 파일은 관리자 페이지(브라우저)에서도 import 한다 → 토큰·시크릿은 절대 넣지 말 것.

export const API_VERSION = 'v26.0'; // 2026-07-29 출시, Graph API 최신
export const IG_USER_ID = '17841437874170252'; // @vkstpk78
export const SITE = 'https://starrytarotcom.vercel.app';

const TRACK = 'src=ig_dm_comment&utm_source=instagram&utm_medium=dm&utm_campaign=comment_auto';
export const LINK_READING = `${SITE}/?${TRACK}&utm_content=reading`;
export const LINK_SEMINAR = `${SITE}/seminar.html?${TRACK}&utm_content=seminar`;

export const DEFAULT_SETTINGS = {
  promo: `🌙 별빛이 당신의 댓글을 따라 여기까지 왔어요.

카드가 아직 다 들려주지 못한 이야기가 있다면,
별빛타로의 리딩 방으로 건너오세요.
당신이 직접 뽑은 세 장이 과거·현재·미래를 조용히 펼쳐 보일 거예요 🔮
✨ 나만의 리딩 받기 → {리딩링크}

그리고 카드를 '듣는' 사람에서 '읽는' 사람이 되고 싶다면,
별빛 아래 함께 모이는 타로 세미나가 기다리고 있어요.
다음 모임의 자리가 닫히기 전에, 먼저 손 들어 주세요 🕯
🌌 세미나 신청하기 → {세미나링크}

오늘 밤, 당신에게 꼭 필요한 카드가 찾아오길.
— 별빛타로 ✦`,
  rules: [
    {
      id: 'default',
      name: '기본 홍보',
      enabled: true,
      post: '',
      keywords: ['루미', '타로', '상담', '리딩', '세미나', '신청'],
      replies: [
        '🌙 별빛이 닿았어요. DM을 살짝 열어보세요 ✨',
        '🔮 카드가 당신에게 편지를 보냈어요. DM 확인해 주세요 💌',
        '✨ 당신만을 위한 별빛 메시지가 DM으로 날아갔어요 🌌',
        '🕯 조용히 DM으로 속삭여 두었어요. 확인해 보세요 🌙',
      ],
      dm: '',
      appendPromo: true,
    },
  ],
};
