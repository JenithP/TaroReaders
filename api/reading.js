export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Vercel에서 req.body가 파싱 안 될 경우 대비
  let body = req.body;
  if (!body || typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); } catch { body = {}; }
  }

  const { cards, userName } = body;
  console.log('[reading] cards:', cards?.length, 'user:', userName);

  if (!cards || cards.length !== 3) {
    console.error('[reading] invalid cards:', cards);
    return res.status(400).json({ error: 'cards required', received: cards });
  }

  const posLabels = ['과거', '현재', '미래'];
  const cardLines = cards.map((c, i) =>
    `${posLabels[i]}: ${c.name} (${c.reversed ? '역방향' : '정방향'}) — ${c.reversed ? c.rk : c.uk}`
  ).join('\n');

  const prompt = `당신은 20년 이상의 경력을 가진 한국의 타로 마스터이자 점성술사입니다.
라이더 웨이트 타로의 상징 체계와 카발라, 수비학, 점성술의 깊은 지식을 바탕으로 리딩합니다.
당신의 리딩은 구체적이고 현실적이며, 마치 내담자 앞에 앉아서 직접 이야기해주는 것처럼 생생합니다.

질문자 이름: ${userName}
카드 배열 (3카드 스프레드 — 과거·현재·미래):
${cardLines}

각 포지션에 대해 다음 기준으로 리딩을 작성하세요:
- 분량: 각 포지션당 200자 이상, 풍부하고 구체적으로
- 카드의 상징(그림 속 인물, 배경, 색상, 숫자)을 언급하며 의미를 풀어낼 것
- 직장/커리어, 연애/관계, 금전/재물, 건강/에너지 중 해당 카드와 연관된 영역을 구체적으로 언급
- 역방향인 경우 그 에너지가 어떻게 막히거나 왜곡되어 나타나는지 설명
- "~할 수 있습니다" 같은 모호한 표현 대신 "~하고 있습니다", "~가 찾아옵니다"처럼 확신 있게
- 실천 가능한 조언(지금 당장 취할 수 있는 행동)을 반드시 포함
- 세 카드의 흐름(과거→현재→미래)이 하나의 이야기처럼 연결되도록
- 신비롭고 품격 있는 한국어 문체 사용, 하지만 이해하기 쉽게
- 뜬구름 잡는 추상적 표현 절대 금지

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
        temperature: 0.85,
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
