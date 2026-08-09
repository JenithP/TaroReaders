export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { cards, userName } = req.body;
  if (!cards || cards.length !== 3) return res.status(400).json({ error: 'cards required' });

  const posLabels = ['과거', '현재', '미래'];
  const cardLines = cards.map((c, i) =>
    `${posLabels[i]}: ${c.name} (${c.reversed ? '역방향' : '정방향'}) — ${c.reversed ? c.rk : c.uk}`
  ).join('\n');

  const prompt = `당신은 경험 많은 한국 타로 리더입니다. 아래 3카드 스프레드를 보고 각 포지션에 대한 타로 리딩을 작성해주세요.

질문자: ${userName}
${cardLines}

각 카드에 대해 구체적이고 실생활에 적용 가능한 한국어 리딩을 3-4문장으로 작성해주세요.
직장·연애·금전·인간관계 등 현실적인 맥락에서 이야기하고, 실천 가능한 조언을 포함해주세요.
추상적이거나 뜬구름 잡는 표현은 피해주세요.

아래 JSON 형식으로만 응답해주세요 (다른 텍스트 없이):
{"past":"...","present":"...","future":"..."}`;

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-5',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.85,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(resp.status).json({ error: err });
    }

    const data = await resp.json();
    const readings = JSON.parse(data.choices[0].message.content);
    res.json(readings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
