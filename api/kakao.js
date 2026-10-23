// 리딩 코드 화면의 '코드 복사하고 카톡으로 보내기' → 콜러 카톡 오픈프로필로 연결
//   GET /api/kakao?id=<리딩 문서 ID>
//   오픈프로필 링크를 등록한 콜러에게 돌아가며(가장 오래전에 배정받은 사람부터) 한 명씩 배정하고,
//   그 콜러의 링크로 넘겨준다. 고객 문서에 콜러를 바로 적어서 콜러의 '내 콜링' 목록에 곧장 보인다.
//   - 같은 리딩으로 다시 누르면 같은 콜러에게 간다
//   - 이미 콜러가 있는 고객(재방문)은 그 콜러가 링크를 등록해 두었으면 그대로 그 콜러에게 간다
//   - 링크를 등록한 콜러가 없으면 기본 링크로 보낸다
import { db, FieldValue } from '../lib/ig/store.js';

const DEFAULT_LINK = 'https://open.kakao.com/o/ssxl6MTi';
// admin.html 의 KAKAO_LINK_RE, firestore.rules 와 같아야 한다
const LINK_RE = /^https:\/\/open\.kakao\.com\/[A-Za-z0-9_\/-]{1,80}$/;
const linkOf = (u) => (u && u.roles && u.roles.caller && LINK_RE.test(u.kakaoLink || '') ? u.kakaoLink : '');
const ms = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : 0);

// admin.html 의 readingSummary 와 같은 모양
const summary = (r) => ({
  code: r.code, createdAt: r.createdAt || null, question: r.question || '',
  birth: r.birth || '', cards: r.cards || [], readings: r.readings || null,
  themes: r.themes || [], openTheme: r.openTheme || '',
});

async function assign(id) {
  const fs = db();
  const readingRef = fs.collection('readings').doc(id);
  return fs.runTransaction(async (tx) => {
    const rSnap = await tx.get(readingRef);
    if (!rSnap.exists) return DEFAULT_LINK;
    const r = rSnap.data();
    if (!r.phone) return DEFAULT_LINK; // 연락처를 남긴 뒤에만 연결한다

    const customerRef = fs.collection('customers').doc(r.phone);
    const [cSnap, usersSnap] = await Promise.all([
      tx.get(customerRef),
      tx.get(fs.collection('users').where('roles.caller', '==', true)),
    ]);
    const callers = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(linkOf);
    const c = cSnap.exists ? cSnap.data() : null;

    // 이미 정해진 콜러: 이 리딩으로 배정됐던 사람 → 고객에게 원래 배정돼 있던 사람
    const keep = callers.find(u => u.uid === r.kakaoCallerUid) || (c && callers.find(u => u.uid === c.callerUid));
    const caller = keep || callers.sort((a, b) =>
      ms(a.kakaoLastAssignedAt) - ms(b.kakaoLastAssignedAt) || (a.kakaoAssignCount || 0) - (b.kakaoAssignCount || 0))[0];

    const now = FieldValue.serverTimestamp();
    const readingPatch = {};
    if (!r.kakaoAt) readingPatch.kakaoAt = now;
    if (caller && r.kakaoCallerUid !== caller.uid) Object.assign(readingPatch, { kakaoCallerUid: caller.uid, kakaoCallerName: caller.name || '' });
    if (Object.keys(readingPatch).length) tx.update(readingRef, readingPatch);

    // 고객 문서 (관리자 페이지 syncCustomers 와 같은 필드). 없으면 이 리딩으로 새로 만든다
    const codes = (c && c.codes) || [];
    const isNewReading = !codes.includes(r.code);
    const cust = {
      phone: r.phone,
      kakaoAt: r.kakaoAt || now,
      kakaoCode: r.code,
    };
    if (isNewReading) Object.assign(cust, {
      name: r.name || '',
      region: r.region || '',
      marketingConsent: !!r.marketingConsent,
      lastContactAt: r.contactAt || r.createdAt || null,
      codes: [...codes, r.code],
      latestCode: r.code,
      latest: summary(r),
      history: [summary(r), ...((c && c.history) || [])],
      readingCount: ((c && c.readingCount) || 0) + 1,
    });
    if (!c) Object.assign(cust, {
      src: r.src || '',
      firstContactAt: r.contactAt || r.createdAt || null,
      applicationCount: 0,
      contactStatus: 'before', callResult: '', callAttempts: 0, memo: '',
      createdAt: now,
    });
    if (caller && (!c || c.callerUid !== caller.uid)) {
      Object.assign(cust, { callerUid: caller.uid, callerName: caller.name || '', callerAssignedAt: now });
    }
    tx.set(customerRef, cust, { merge: true });

    // 돌아가며 배정: 새로 배정했을 때만 순서를 넘긴다
    if (caller && !keep) {
      tx.update(fs.collection('users').doc(caller.uid), {
        kakaoLastAssignedAt: now,
        kakaoAssignCount: FieldValue.increment(1),
      });
    }
    return caller ? caller.kakaoLink : DEFAULT_LINK;
  });
}

export default async function handler(req, res) {
  const id = String((req.query && req.query.id) || '');
  let link = DEFAULT_LINK;
  if (/^[A-Za-z0-9]{10,40}$/.test(id)) {
    try { link = await assign(id); }
    catch (e) { console.error('카톡 배정 실패:', e.message); }
  }
  res.setHeader('Cache-Control', 'no-store');
  res.redirect(302, link);
}
