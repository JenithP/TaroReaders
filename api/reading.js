export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  let body = req.body;
  if (!body || typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); } catch { body = {}; }
  }

  const { cards, userName, userBirth, userQuestion } = body;
  console.log('[reading] cards:', cards?.length, 'user:', userName, 'birth:', userBirth, 'q:', userQuestion);

  if (!cards || cards.length !== 3) {
    console.error('[reading] invalid cards:', cards);
    return res.status(400).json({ error: 'cards required', received: cards });
  }

  const posLabels = ['과거', '현재', '미래'];
  const cardLines = cards.map((c, i) =>
    `${posLabels[i]}: ${c.name} (${c.reversed ? '역방향' : '정방향'}) — ${c.reversed ? c.rk : c.uk}`
  ).join('\n');

  const birthLine = userBirth
    ? `생년월일: ${userBirth}\n이 날에 태어난 분이 지닌 고유한 타로적 기운과 에너지의 흐름을 읽어, 카드 해석과 자연스럽게 연결해주세요.`
    : '';

  const questionLine = userQuestion
    ? `오늘의 질문: "${userQuestion}"\n세 카드의 흐름이 이 질문에 대한 실질적인 답이 되도록 구성해주세요.`
    : '';

  const prompt = `당신은 30년 경력의 한국 타로 마스터입니다. 라이더 웨이트 타로의 상징 체계와 신비로운 직관으로 깊고 실질적인 리딩을 제공합니다.

질문자: ${userName || '여행자'}님
${birthLine}
${questionLine}

카드 배열 (과거·현재·미래 3카드 스프레드):
${cardLines}

【리딩 작성 지침】

말투와 문체:
- 실제 타로 상담가가 내담자와 마주 앉아 이야기하듯 따뜻하고 신비로운 말투
- "~하고 있군요", "~네요", "~보이는군요", "~이 느껴집니다" 같은 자연스럽고 살아있는 종결어미
- ${userName || '여행자'}님이라고 직접 호칭하며 친근하고 진심 어린 어조로
- 뜬구름 잡는 표현 금지. 신비롭되 구체적이고 현실에 발 디딘 리딩

생년월일 활용:
- 태어난 날의 타로적 기운(수비학적 에너지, 계절의 흐름 등)을 카드 해석과 자연스럽게 엮을 것
- 전문 용어 남발 금지. 한 문장이면 충분히 녹아들게

질문 집중:
- 모든 카드 해석이 질문에 대한 답의 흐름을 이루도록
- "지금 당장 어떻게 행동해야 하는가"를 구체적으로 제시
- 각 포지션마다 실천 가능한 행동 조언 필수

내용 깊이:
- 카드 그림 속 상징(인물, 색, 숫자, 배경)을 구체적으로 언급하며 의미를 풀어낼 것
- 직장/커리어, 연애/관계, 금전, 건강 중 해당 카드·질문에 맞는 영역을 콕 집어 언급
- 역방향이면 어떤 기운이 막히거나 왜곡되는지 구체적으로 짚을 것
- 과거→현재→미래가 하나의 이야기 흐름이 되도록
- 각 포지션당 최소 220자 이상

아래 JSON 형식으로만 응답 (다른 텍스트 없이):
{"past":"...","present":"...","future":"..."}`;

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
    res.json(readings);
  } catch (e) {
    console.error('[reading] catch:', e.message);
    res.status(500).json({ error: e.message });
  }
}
