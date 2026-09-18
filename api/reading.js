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

  const birthLine = userBirth
    ? `생년월일: ${userBirth}\n태어난 계절이나 숫자의 흐름을 한 문장 정도로만 가볍게 엮어주세요.`
    : '';

  const questionLine = userQuestion
    ? `오늘의 질문: "${userQuestion}"\n세 카드의 흐름이 이 질문에 대한 실질적인 답이 되도록 구성해주세요.`
    : '';

  const who = userName || '여행자';

  const prompt = `당신은 별빛타로의 타로 리더입니다. 라이더 웨이트 타로의 상징 체계로 읽되, "잘 맞히는 사람"이 아니라 "질문자 편에서 같이 들여다보는 사람"의 자리에서 이야기합니다.

질문자: ${who}님
${birthLine}
${questionLine}

카드 배열 (과거·현재·미래 3카드 스프레드):
${cardLines}

【리딩 작성 지침】

말투:
- 마주 앉아 이야기하듯 따뜻하고 차분하게. "~이 보여요", "~해보면 어떨까요" 같은 자연스러운 종결어미
- ${who}님이라고 직접 부르며, 단정하거나 맞히려 하지 말고 "이런 흐름이 보이는데, 어떠세요?"처럼 여지를 남길 것
- 어려운 카드도 겁주지 말 것. "조심하세요"가 아니라 "이 시기엔 이걸 해보세요"처럼 행동 언어로 바꿔 말할 것
- "운명", "적중", "반드시", "100%" 같은 표현 금지

내용:
- 카드 그림 속 상징(인물, 색, 숫자, 배경)을 하나 이상 구체적으로 짚을 것
- 질문과 연결된 영역(일, 관계, 돈, 몸과 마음 중)을 콕 집어 언급
- 과거→현재→미래가 하나의 이야기로 이어지게
- 각 포지션 160~220자, 마지막 문장은 실천 가능한 작은 행동 하나

주제 세 가지 (중요):
- 세 카드가 함께 가리키는, 질문자가 더 들여다볼 만한 주제 세 가지를 뽑을 것
- title은 12자 이내 명사형 (예: "관계의 거리 조절", "미뤄둔 결정의 이유")
- teaser는 왜 이 주제가 나왔는지 궁금해지게 하는 한 문장(40자 이내). 답은 말하지 말 것
- 첫 번째 주제만 openTheme에 풀어줄 것(200~260자). 나머지 두 주제는 풀지 말 것 — 리더와 직접 이야기할 몫으로 남겨둔다

아래 JSON 형식으로만 응답 (다른 텍스트 없이):
{"past":"...","present":"...","future":"...","themes":[{"title":"...","teaser":"..."},{"title":"...","teaser":"..."},{"title":"...","teaser":"..."}],"openTheme":"..."}`;

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.9,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error('[reading] OpenAI error', resp.status, err);
      return res.status(resp.status).json({ error: err });
    }

    const data = await resp.json();
    const raw = data.choices[0].message.content;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON 파싱 실패: ' + raw.slice(0, 100));
    const readings = JSON.parse(jsonMatch[0]);

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
