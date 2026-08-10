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

  const sajuLine = userBirth
    ? `생년월일: ${userBirth}\n이 생년월일을 바탕으로 사주의 연주(띠, 천간), 월주(계절 기운), 일주의 기본 에너지를 파악하여 리딩에 자연스럽게 녹여주세요.`
    : '';

  const questionLine = userQuestion
    ? `질문자의 오늘 질문: "${userQuestion}"\n세 카드의 리딩이 이 질문에 대한 실질적인 답이 되도록 구성해주세요.`
    : '';

  const prompt = `당신은 30년 경력의 한국 타로·사주 통합 상담가입니다. 라이더 웨이트 타로와 사주명리학을 결합하여 깊고 실질적인 리딩을 제공합니다.

질문자 이름: ${userName || '여행자'}
${sajuLine}
${questionLine}

카드 배열 (과거·현재·미래 3카드 스프레드):
${cardLines}

【리딩 작성 기준】

말투와 문체:
- 실제 타로 상담가가 내담자 앞에서 직접 말하는 것처럼 따뜻하고 신비로운 말투
- "~하고 있군요", "~네요", "~보이는군요", "~가 보입니다" 같은 자연스러운 종결어미
- ${userName || '여행자'}님이라고 직접 호칭하며, 마치 오래 알아온 사람처럼 친근하게
- 격식 있지만 차갑지 않게. 신비롭지만 뜬구름 잡지 않게

사주 통합 (생년월일이 있는 경우):
- 연주(띠, 천간의 오행)와 월주(계절)의 기운을 언급하며 타로 에너지와 연결
- 예: "목(木)의 기운을 타고난 ${userName}님에게 이 카드는..." 식으로 자연스럽게 통합
- 사주 용어는 한 문장 이내로, 리딩의 주인공은 카드와 질문

질문 집중:
- 모든 카드 해석이 질문에 대한 답의 흐름이 되도록
- 추상적 영적 메시지 대신 "지금 당장 무엇을 해야 하는가"에 집중
- 구체적 행동 조언을 각 포지션마다 반드시 포함

내용 깊이:
- 카드 그림 속 상징(인물, 색, 숫자, 배경)을 구체적으로 언급하며 의미를 풀어낼 것
- 직장/커리어, 연애/관계, 금전, 건강 중 해당 카드와 질문에 관련된 영역을 콕 집어 언급
- 역방향이면 어떤 에너지가 막히거나 왜곡되고 있는지 구체적으로
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
