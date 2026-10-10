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

이 사람에 대한 확신:
- 현재 카드 풀이의 첫 문장은 이 사람의 타고난 성향을 단정적으로 짚는 문장으로 시작 (참고 자료가 있으면 그 기질을 바탕으로)
- 성향은 "책임감이 강해서 남의 짐까지 떠안는 사람이에요"처럼 구체적인 생활 장면으로 말할 것
- 아래 말은 절대 쓰지 말 것: 사주, 팔자, 명리, 일간, 일주, 오행, 천간, 지지, 십성, 음양, 목·화·토·금·수 기운, 띠, ○○년(갑진년·병오년 등). 대신 카드의 상징, 태어난 계절, 별빛 같은 말로 표현

앞날:
- 미래 카드는 시기를 붙여 분명하게 말할 것: "앞으로 한두 달 안에", "올해가 가기 전에", "내년 봄 무렵" 등
- 참고 자료의 '올해' 흐름과 질문을 엮어, 올해 남은 기간이 이 사람에게 어떤 시기인지 한 문장으로 못박아 줄 것
- 질문이 있으면 답을 돌려 말하지 말고 앞부분에서 바로 말할 것 (예: "네, 풀립니다. 다만 ~")
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
