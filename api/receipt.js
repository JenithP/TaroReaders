// 회계장부: 영수증 사진에서 날짜·금액·거래처를 읽어 온다 (박영희, 김소영, 이야호(은하수), 박윤정(최고 관리자)만)
// 이미지는 브라우저가 줄여서 data URL 로 보내고, 저장은 관리자 페이지가 Firestore 에 직접 한다.
import { getAuth } from 'firebase-admin/auth';
import { db } from '../lib/ig/store.js';

// admin.html 의 LEDGER_EMAILS, firestore.rules 의 isAccounting()과 같아야 한다
const LEDGER_EMAILS = ['yhparkgg@gmail.com', 'vkstpk@gmail.com', 'jmyklove@gmail.com', 'leily.yoon@gmail.com'];

async function isAccounting(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return false;
  db(); // Admin 앱 초기화
  const t = await getAuth().verifyIdToken(h.slice(7)).catch(() => null);
  return !!t && t.email_verified === true && LEDGER_EMAILS.includes((t.email || '').toLowerCase());
}

const list = (v) => (Array.isArray(v) ? v : []).filter(s => typeof s === 'string' && s.length <= 20).slice(0, 30);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!(await isAccounting(req))) return res.status(403).json({ error: '회계 담당만 쓸 수 있어요' });

  let body = req.body;
  if (!body || typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); } catch { body = {}; }
  }
  const { image } = body;
  if (typeof image !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > 3_000_000) {
    return res.status(400).json({ error: '이미지가 없거나 너무 커요' });
  }
  const outCats = list(body.outCategories), inCats = list(body.inCategories);

  const prompt = `영수증(또는 카드 전표·계좌이체 내역·입금 확인 화면) 사진에서 회계장부에 적을 정보를 읽어 주세요.

- amount: 실제로 결제(또는 입금)된 최종 합계 금액. 원 단위 정수, 쉼표·기호 없이. 부가세 별도 표기가 있으면 부가세 포함 합계. 읽을 수 없으면 0
- date: 거래 날짜 "YYYY-MM-DD". 연도가 두 자리면 20xx. 없으면 ""
- vendor: 상호(가게·업체 이름). 없으면 ""
- item: 무엇을 샀는지 짧게 (30자 이내, 예: "커피 외 3건", "A4 용지·토너")
- type: 돈이 나간 영수증이면 "out", 받은 돈(입금 확인 등)이면 "in"
- category: type 이 out 이면 [${outCats.join(', ')}] 중, in 이면 [${inCats.join(', ')}] 중 가장 가까운 하나. 애매하면 ""
- method: "카드", "현금", "계좌이체" 중 하나. 알 수 없으면 ""
- confidence: 금액을 확실히 읽었으면 "high", 흐리거나 추정했으면 "low"

영수증이 아닌 사진이면 amount 0, confidence "low".
아래 JSON 형식으로만 응답:
{"amount":0,"date":"","vendor":"","item":"","type":"out","category":"","method":"","confidence":"high"}`;

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
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: image, detail: 'high' } },
          ],
        }],
        response_format: { type: 'json_object' },
        ...(reasoning ? { reasoning_effort: 'low' } : { temperature: 0 }),
      }),
    });
  };

  try {
    const primary = process.env.OPENAI_RECEIPT_MODEL || process.env.OPENAI_READING_MODEL || 'gpt-6.1-sol';
    const fallback = process.env.OPENAI_MODEL || 'gpt-4o';
    let resp = await callModel(primary);
    if (!resp.ok && fallback !== primary) {
      console.error('[receipt] primary model error', primary, resp.status, await resp.text());
      resp = await callModel(fallback);
    }
    if (!resp.ok) {
      const err = await resp.text();
      console.error('[receipt] OpenAI error', resp.status, err);
      return res.status(502).json({ error: '영수증을 읽지 못했어요' });
    }

    const data = await resp.json();
    const raw = data.choices[0].message.content;
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('JSON 파싱 실패: ' + raw.slice(0, 100));
    const r = JSON.parse(m[0]);

    const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
    const type = r.type === 'in' ? 'in' : 'out';
    const category = str(r.category, 20);
    res.json({
      amount: Math.max(0, Math.round(Number(String(r.amount).replace(/[^\d.]/g, '')) || 0)),
      date: /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : '',
      vendor: str(r.vendor, 40),
      item: str(r.item, 40),
      type,
      category: (type === 'in' ? inCats : outCats).includes(category) ? category : '',
      method: ['카드', '현금', '계좌이체'].includes(r.method) ? r.method : '',
      confidence: r.confidence === 'high' ? 'high' : 'low',
      model: data.model || '',
    });
  } catch (e) {
    console.error('[receipt] catch:', e.message);
    res.status(500).json({ error: e.message });
  }
}
