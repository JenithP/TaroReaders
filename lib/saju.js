// 생년월일 → 리딩에 쓸 기질·흐름 힌트 (명리 기반, 용어는 AI 프롬프트 안에서만 쓰고 고객에게는 드러내지 않는다)
// 태어난 시각은 받지 않으므로 연·월·일 세 기둥만 본다. 절기는 해마다 하루 정도 차이가 나는 근사값.

const STEMS = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
const BRANCHES = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
const ELEMENT_OF_STEM = ['목', '목', '화', '화', '토', '토', '금', '금', '수', '수'];
const ELEMENTS = ['목', '화', '토', '금', '수']; // 생: 목→화→토→금→수→목

// 일간별 타고난 기질 (고객에게 들려줄 말의 재료)
const TEMPERAMENT = {
  갑: '곧게 뻗어 나가는 추진력이 있고, 한번 정하면 쉽게 굽히지 않는 사람. 앞장서서 길을 여는 리더형',
  을: '부드럽고 유연하게 상황에 맞춰 길을 찾는 사람. 섬세하고 관계를 소중히 여기며, 끈질긴 생명력이 있음',
  병: '밝고 솔직해서 어디서든 눈에 띄는 사람. 열정이 크고 표현이 시원하며 주변을 환하게 만듦',
  정: '겉은 차분해도 안에 꺼지지 않는 불씨를 품은 사람. 따뜻하게 배려하고, 한 가지에 깊이 몰입함',
  무: '산처럼 듬직해서 사람들이 기대는 사람. 포용력과 신뢰감이 크고, 한번 마음먹으면 흔들리지 않음',
  기: '실속 있고 세심하게 사람과 일을 돌보는 사람. 현실 감각이 좋고 조용히 기반을 다짐',
  경: '결단이 빠르고 의리가 강한 사람. 옳다고 믿는 것을 분명하게 말하고 밀고 나감',
  신: '감각이 예리하고 완성도에 대한 기준이 높은 사람. 자존심이 강하고 아름다운 것을 알아봄',
  임: '시야가 넓고 자유로운 사람. 흐르는 물처럼 융통성이 있고, 큰 그림을 그리는 지혜가 있음',
  계: '직관과 감수성이 깊은 사람. 말없이 사람의 마음을 읽고, 조용히 스며드는 지혜가 있음',
};

// 올해 기운이 이 사람에게 어떤 해인지 (일간 기준 관계)
const YEAR_FLOW = {
  same: '자기 힘으로 서는 해. 경쟁과 독립의 기운이 강해서, 남에게 기대기보다 스스로 판을 짤 때 성과가 남',
  output: '표현하고 만들어 내는 해. 재능과 말이 밖으로 드러나고, 새로 시작한 일이나 창작이 결실을 보기 쉬움',
  wealth: '손에 잡히는 성과의 해. 일과 돈의 흐름이 활발해지고, 움직인 만큼 결과가 따라옴',
  power: '책임과 평가의 해. 직장·조직에서 역할이 커지고 인정받을 기회가 오지만, 부담도 함께 옴',
  resource: '배우고 도움받는 해. 좋은 조언자와 공부 운이 따르고, 준비한 것이 단단해지는 시기',
};

// 절기로 본 생월 (월 지지): [절입 월, 일, 지지 인덱스]
const TERMS = [[1, 6, 1], [2, 4, 2], [3, 6, 3], [4, 5, 4], [5, 6, 5], [6, 6, 6], [7, 7, 7], [8, 8, 8], [9, 8, 9], [10, 8, 10], [11, 7, 11], [12, 7, 0]];
const SEASON_OF_BRANCH = ['겨울', '겨울', '봄', '봄', '봄', '여름', '여름', '여름', '가을', '가을', '가을', '겨울'];
const SEASON_NOTE = {
  봄: '새싹처럼 시작하고 자라나려는 기운이 강함',
  여름: '뜨겁게 드러나고 펼쳐지려는 기운이 강함',
  가을: '맺고 거두며 정리하려는 기운이 강함',
  겨울: '안으로 모으고 깊이 생각하려는 기운이 강함',
};

const jdn = (y, m, d) => {
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
};
const mod = (n, k) => ((n % k) + k) % k;

// 입춘(2/4) 전이면 전년도로 본다
const sajuYear = (y, m, d) => (m < 2 || (m === 2 && d < 4) ? y - 1 : y);

function relation(dayEl, otherEl) {
  const i = ELEMENTS.indexOf(dayEl), j = ELEMENTS.indexOf(otherEl);
  if (i === j) return 'same';
  if (j === mod(i + 1, 5)) return 'output';   // 내가 생하는 것
  if (j === mod(i + 2, 5)) return 'wealth';   // 내가 극하는 것
  if (j === mod(i - 2, 5)) return 'power';    // 나를 극하는 것
  return 'resource';                          // 나를 생하는 것
}

// birth: 'YYYY-MM-DD', now: Date → 힌트 문자열 (해석 불가면 '')
export function sajuHints(birth, now = new Date()) {
  const m = String(birth || '').match(/(\d{4})\D?(\d{1,2})\D?(\d{1,2})/);
  if (!m) return '';
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1900 || y > now.getFullYear() || mo < 1 || mo > 12 || d < 1 || d > 31) return '';

  // 일주: 2000-01-01 = 무오(60갑자 54번째)
  const dayIdx = mod(jdn(y, mo, d) - jdn(2000, 1, 1) + 54, 60);
  const dayStem = STEMS[dayIdx % 10];
  const dayEl = ELEMENT_OF_STEM[dayIdx % 10];

  // 생월 계절
  let mb = 0; // 1월 소한(1/6) 전은 자월
  for (const [tm, td, b] of TERMS) if (mo > tm || (mo === tm && d >= td)) mb = b;
  const season = SEASON_OF_BRANCH[mb];

  // 올해 (오늘 날짜 기준 입춘 경계)
  const cy = sajuYear(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const yStem = mod(cy - 4, 10), yBranch = mod(cy - 4, 12);
  const flow = YEAR_FLOW[relation(dayEl, ELEMENT_OF_STEM[yStem])];

  return [
    `타고난 기질: ${TEMPERAMENT[dayStem]}`,
    `태어난 계절: ${season} — ${SEASON_NOTE[season]}`,
    `올해(${STEMS[yStem]}${BRANCHES[yBranch]}년) 이 사람에게: ${flow}`,
  ].join('\n');
}
