import { sajuHints } from '../lib/saju.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  let body = req.body;
  if (!body || typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); } catch { body = {}; }
  }

  const { cards, userName, userBirth, userQuestion } = body;
  console.log('[reading] cards:', cards?.length, 'q:', userQuestion ? 'yes' : 'no');

  if (!cards || cards.length !== 3) {
    console.error('[reading] invalid cards:', cards);
    return res.status(400).json({ error: 'cards required', received: cards });
  }

  const posLabels = ['과거', '현재', '미래'];
  const cardLines = cards.map((c, i) =>
    `${posLabels[i]}: ${c.name} (${c.reversed ? '역방향' : '정방향'}) — ${c.reversed ? c.rk : c.uk}`
  ).join('\n');

  // 생년월일로 본 기질·올해 흐름 (리더만 아는 참고 자료, 출처는 드러내지 않는다)
  const hints = sajuHints(userBirth);
  const birthLine = hints
    ? `【리더만 보는 참고 자료 — 이 사람의 타고난 결】\n${hints}\n이 내용을 카드 해석에 자연스럽게 녹여, 이 사람을 오래 지켜본 사람처럼 확신 있게 말해주세요. 출처(사주·명리)는 절대 드러내지 마세요.`
    : '';

  const questionLine = userQuestion
    ? `오늘의 질문: "${userQuestion}"\n세 카드의 흐름이 이 질문에 대한 실질적인 답이 되도록 구성해주세요.`
    : '';

  const who = userName || '여행자';

  const prompt = `당신은 별빛타로의 노련한 타로 리더입니다. 라이더 웨이트 타로의 상징 체계로 읽고, 이 사람을 오래 지켜본 사람처럼 성향과 앞날을 분명하게 짚어 줍니다.

질문자: ${who}님
${birthLine}
${questionLine}

카드 배열 (과거·현재·미래 3카드 스프레드):
${cardLines}

【리딩 작성 지침】

말투:
- 마주 앉은 리더처럼 따뜻하지만 분명하게. 종결은 "~한 사람이에요", "~하게 됩니다", "~가 찾아와요"처럼 단정형으로
- "~일지도 몰라요", "~같아요", "어떠세요?", "~할 수도 있어요" 같은 흐릿한 표현은 쓰지 말 것
- 반드시 "${who}님"이라고 부를 것 ("질문자님", "당신" 금지)
- 어려운 카드도 겁주지 말 것. 경고 대신 "이 시기엔 이렇게 하면 풀려요"처럼 분명한 행동으로 바꿔 말할 것
- "100%", "무조건", "운명적으로 정해진" 같은 과장은 쓰지 말 것
- "~해요", "~예요"체로 쓸 것 ("~입니다", "~합니다" 같은 딱딱한 말투 금지)
- 카드 이름과 방향은 화면에 이미 나오므로 "○○ 카드가 나타났습니다/위치해 있습니다"처럼 다시 소개하지 말고 바로 해석으로 들어갈 것

이 사람에 대한 확신:
- 성향(trait)은 참고 자료가 있으면 그 기질을 바탕으로, 본문에서도 이 성향이 카드와 어떻게 맞물리는지 이어서 말할 것
- 성향은 "책임감이 강해서 남의 짐까지 떠안는 사람이에요"처럼 구체적인 생활 장면으로 말할 것
- 아래 말은 절대 쓰지 말 것: 사주, 팔자, 명리, 일간, 일주, 오행, 천간, 지지, 십성, 음양, 목·화·토·금·수 기운, 띠, ○○년(갑진년·병오년 등). 대신 카드의 상징, 태어난 계절, 별빛 같은 말로 표현

앞날:
- 미래 카드는 시기를 붙여 분명하게 말할 것: "앞으로 한두 달 안에", "올해가 가기 전에", "내년 봄 무렵" 등
- 참고 자료의 '올해' 흐름과 질문을 엮어, 올해 남은 기간이 이 사람에게 어떤 시기인지 한 문장으로 못박아 줄 것
- 질문의 답은 answer에서 돌려 말하지 말고 바로 말할 것 (예: "네, 풀립니다. 다만 ~")
- 건강·사고·죽음·임신·시험 합격·투자 수익은 단정해서 예언하지 말 것 (이 영역은 "이렇게 준비하면 좋아요"로)

내용:
- 카드 그림 속 상징(인물, 색, 숫자, 배경)을 하나 이상 구체적으로 짚되, 라이더 웨이트 그림에 실제로 있는 것만 말할 것
- 질문과 연결된 영역(일, 관계, 돈, 몸과 마음 중)을 콕 집어 언급
- 과거→현재→미래가 하나의 이야기로 이어지게
- 각 포지션 180~240자, 마지막 문장은 실천 가능한 작은 행동 하나

주제 세 가지 (중요):
- 세 카드가 함께 가리키는, 질문자가 더 들여다볼 만한 주제 세 가지를 뽑을 것
- title은 12자 이내 명사형 (예: "관계의 거리 조절", "미뤄둔 결정의 이유")
- teaser는 왜 이 주제가 나왔는지 궁금해지게 하는 한 문장(40자 이내). 답은 말하지 말 것
- 첫 번째 주제만 openTheme에 풀어줄 것(200~260자). 나머지 두 주제는 풀지 말 것 — 리더와 직접 이야기할 몫으로 남겨둔다

따로 쓸 두 문장 (화면에서 맨 앞에 붙는다 — 본문에서 반복하지 말 것):
- trait: ${who}님의 타고난 성향을 단정하는 한 문장 (40~70자, "${who}님은"으로 시작)
- answer: 질문에 대한 직접적인 답 한 문장 (질문이 없으면 올해 남은 기간이 어떤 시기인지). 시기를 넣어 분명하게

말투 예시:
- 나쁜 예: "새로운 기회가 올 수도 있어요. 어떠세요?" → 좋은 예: "올해가 가기 전에 새 제안이 들어옵니다. 망설이지 말고 잡으세요."
- 나쁜 예: "책임감이 있는 편인 것 같아요." → 좋은 예: "${who}님은 맡은 일은 끝까지 해내야 마음이 놓이는 사람이에요."
- 나쁜 예: "관계가 복잡해질 수 있음을 암시해요." → 좋은 예: "한두 달 안에 관계에서 선택할 순간이 옵니다. 마음이 먼저 향하는 쪽이 답이에요."

아래 JSON 형식으로만 응답 (다른 텍스트 없이):
{"trait":"...","answer":"...","past":"...","present":"...","future":"...","themes":[{"title":"...","teaser":"..."},{"title":"...","teaser":"..."},{"title":"...","teaser":"..."}],"openTheme":"..."}`;

  // 최신 추론 모델로 먼저 쓰고, 실패하면 예전 모델로 한 번 더 시도한다
  const callModel = (model) => {
    const reasoning = /^(gpt-[5-9]|o\d)/.test(model);
    return fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: '지침대로 리딩을 JSON으로 작성해 주세요.' },
        ],
        response_format: { type: 'json_object' },
        // 추론 모델은 temperature 대신 추론 강도를 받는다 (low = 빠른 응답)
        ...(reasoning ? { reasoning_effort: 'low' } : { temperature: 0.75 }),
      }),
    });
  };

  try {
    const primary = process.env.OPENAI_READING_MODEL || 'gpt-6.1-sol';
    const fallback = process.env.OPENAI_MODEL || 'gpt-4o';
    let resp = await callModel(primary);
    if (!resp.ok && fallback !== primary) {
      console.error('[reading] primary model error', primary, resp.status, await resp.text());
      resp = await callModel(fallback);
    }

    if (!resp.ok) {
      const err = await resp.text();
      console.error('[reading] OpenAI error', resp.status, err);
      return res.status(resp.status).json({ error: err });
    }

    const data = await resp.json();
    console.log('[reading] model', data.model);
    res.setHeader('X-Reading-Model', String(data.model || ''));
    const raw = data.choices[0].message.content;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON 파싱 실패: ' + raw.slice(0, 100));
    const readings = JSON.parse(jsonMatch[0]);

    // 질문의 답은 첫 카드 앞에, 타고난 성향은 현재 카드 앞에 붙여 반드시 보이게 한다
    const lead = (s) => (typeof s === 'string' ? s.trim() : '');
    const answer = lead(readings.answer), trait = lead(readings.trait);
    if (answer && typeof readings.past === 'string') readings.past = `${answer} ${readings.past}`;
    if (trait && typeof readings.present === 'string' && !readings.present.includes(trait)) {
      readings.present = `${trait} ${readings.present}`;
    }

    // 주제가 빠지거나 형식이 틀리면 클라이언트가 기본 주제로 대체하도록 제거
    const themesOk = Array.isArray(readings.themes) && readings.themes.length === 3 &&
      readings.themes.every(t => t && typeof t.title === 'string' && typeof t.teaser === 'string');
    if (!themesOk || typeof readings.openTheme !== 'string') {
      delete readings.themes;
      delete readings.openTheme;
    }
    res.json(readings);
  } catch (e) {
    console.error('[reading] catch:', e.message);
    res.status(500).json({ error: e.message });
  }
}
