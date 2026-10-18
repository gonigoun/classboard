// 로그인과 저장: 화면 코드는 이 파일의 함수만 써요.
// 실제로는 Firebase(backend-firebase.js), 내 컴퓨터 시험 때는 가짜 저장소(tests/backend-mock.js)를 써요.

export let B = null;
export const isMock = location.hostname === 'localhost' && /[?&]mock/.test(location.search);

export async function init(onUser) {
  B = isMock ? await import('../tests/backend-mock.js') : await import('./backend-firebase.js');
  await B.init(onUser);
}
export const login = () => B.login();
export const logout = () => B.logout();

const ERR = {
  'auth/unauthorized-domain': '이 주소가 Firebase 승인된 도메인에 없어요',
  'auth/popup-blocked': '로그인 창(팝업)이 막혔어요. 주소창 오른쪽에서 팝업을 허용해 주세요',
  'auth/popup-closed-by-user': '로그인 창을 닫았어요',
  'auth/cancelled-popup-request': '로그인 창을 닫았어요',
  'auth/network-request-failed': '인터넷 연결을 확인해 주세요',
  'permission-denied': '권한이 없어요',
};
export const errText = (e) => ERR[e && e.code] || (e && e.message && !/^\w+$/.test(e.message) ? e.message : '잠시 뒤 다시 시도해 주세요');
const fail = (msg, code) => { const e = new Error(msg); e.code = code || 'app'; return e; };

/* ---------- 저장 상태 표시 + 1.2초 모아서 저장 ---------- */
let statusCb = () => {};
const timers = {}, waiting = new Map();
export function onStatus(cb) { statusCb = cb; }
function setStatus() { statusCb(!navigator.onLine ? 'off' : waiting.size ? 'ing' : 'ok'); }
window.addEventListener('online', setStatus);
window.addEventListener('offline', setStatus);
function write(key, fn, delay = 1200) {
  clearTimeout(timers[key]);
  const ver = (waiting.get(key) || 0) + 1;
  waiting.set(key, ver); setStatus();
  timers[key] = setTimeout(async () => {
    let failed = false;
    try { await fn(); } catch (e) { console.warn('저장 실패', key, e); failed = true; }
    if (waiting.get(key) === ver) waiting.delete(key);
    if (failed) statusCb('err'); else setStatus();
  }, delay);
}

/* ---------- 권한 ---------- */
export const ADMIN_EMAIL = 'gonigoun@gmail.com';
export const isAdminEmail = (e) => String(e || '').toLowerCase() === ADMIN_EMAIL;

/** 선생님 기능을 쓸 수 있는 계정인지 (허용 목록) */
export async function checkTeacher(user) {
  if (!user) return false;
  if (isAdminEmail(user.email)) return true;
  try { await B.get(`boards/${user.uid}/config/main`); return true; } catch (e) {
    if (e.code === 'permission-denied') return false;
    throw e;
  }
}
export async function loadAllow() { const d = await B.get('access/allow'); return (d && d.emails) || []; }
export const saveAllow = (emails) => B.set('access/allow', { emails, updatedAt: Date.now() });

export async function requestTeacher(user, info) {
  await B.set(`requests/${user.uid}`, { email: user.email, name: info.name, school: info.school || '', note: info.note || '', at: Date.now() });
}
export async function myRequest(uid) { try { return await B.get(`requests/${uid}`); } catch (e) { return null; } }
export const listRequests = () => B.list('requests');
export async function approveRequest(req, emails) {
  const next = [...new Set([...emails, req.email.toLowerCase()])];
  await B.batch([{ op: 'set', path: 'access/allow', data: { emails: next, updatedAt: Date.now() } }, { op: 'del', path: `requests/${req.id}` }]);
  return next;
}
export const denyRequest = (rid) => B.del(`requests/${rid}`);

/* ---------- 선생님 보드 ---------- */
export const loadConfig = (uid) => B.get(`boards/${uid}/config/main`);
export const saveConfig = (uid, cfg) => write('config', () => B.set(`boards/${uid}/config/main`, cfg));
export const loadDay = (uid, date) => B.get(`boards/${uid}/days/${date}`);
export const saveDay = (uid, date, day) => write('day:' + date, () => B.set(`boards/${uid}/days/${date}`, { ...day, updatedAt: Date.now() }));
export async function loadBgImage(uid) { const d = await B.get(`boards/${uid}/config/bgimage`); return d ? d.data : null; }
export const saveBgImage = (uid, data) => write('bgimage', () => (data ? B.set(`boards/${uid}/config/bgimage`, { data }) : B.del(`boards/${uid}/config/bgimage`)));
export async function deleteConfig(uid) { await B.batch([{ op: 'del', path: `boards/${uid}/config/main` }, { op: 'del', path: `boards/${uid}/config/bgimage` }]); }

/** 이번 학기 기록 (그날 학생별 체크 포함) */
export async function listDays(uid, fromDate) {
  const days = await B.list(`boards/${uid}/days`, ['__id__', '>=', fromDate]);
  for (const d of days) d.marks = await B.list(`boards/${uid}/days/${d.id}/marks`);
  return days.map((d) => ({ date: d.id, ...d }));
}
/** 지난 학기 기록 지우기 (한 학기만 보관) */
export async function purgeBefore(uid, fromDate) {
  const old = await B.list(`boards/${uid}/days`, ['__id__', '<', fromDate]);
  for (const d of old.slice(0, 50)) {
    const marks = await B.list(`boards/${uid}/days/${d.id}/marks`);
    await B.batch([...marks.map((m) => ({ op: 'del', path: `boards/${uid}/days/${d.id}/marks/${m.id}` })), { op: 'del', path: `boards/${uid}/days/${d.id}` }]);
  }
  return old.length;
}

/* ---------- 학생별 체크 (선생님·학생이 함께 씀) ---------- */
export const watchMarks = (uid, date, cb, onErr) => B.watchCol(`boards/${uid}/days/${date}/marks`, null, cb, onErr);
export const setMark = (uid, date, num, mark) => write(`mark:${date}:${num}`, () => B.set(`boards/${uid}/days/${date}/marks/${num}`, { ...mark, at: Date.now() }), 400);

/* ---------- 학급 코드와 학생 자리 ---------- */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const randCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
export async function getClass(code) { return B.get(`classes/${String(code || '').toUpperCase()}`); }
export async function createClass(uid, title) {
  for (let i = 0; i < 8; i++) {
    const code = randCode();
    if (await getClass(code)) continue;
    await B.set(`classes/${code}`, { teacherUid: uid, title: title || '우리 반', open: true, at: Date.now() });
    return code;
  }
  throw fail('학급 코드를 만들지 못했어요');
}
export const setClassOpen = (code, open) => B.set(`classes/${code}`, { open }, true);
export const deleteClass = (code) => B.del(`classes/${code}`);
export const watchSeats = (uid, cb, onErr) => B.watchCol(`boards/${uid}/seats`, null, cb, onErr);
export async function clearSeat(uid, seat) {
  await B.batch([{ op: 'del', path: `boards/${uid}/seats/${seat.id}` }, { op: 'del', path: `boards/${uid}/members/${seat.uid}` }]);
}

/** 학생 입장: 코드 확인 → 번호가 비어 있으면 자리와 명단을 함께 만듦 (자동 승인) */
export async function joinClass(user, code, num, name) {
  code = String(code || '').trim().toUpperCase();
  const cl = await getClass(code).catch(() => null);
  if (!cl) throw fail('학급 코드를 찾지 못했어요. 칠판의 코드를 다시 확인해 주세요');
  if (!cl.open) throw fail('지금은 학생 입장이 닫혀 있어요. 선생님께 열어 달라고 말해 주세요');
  const tuid = cl.teacherUid; const n = String(num);
  const seat = await B.get(`boards/${tuid}/seats/${n}`).catch(() => null);
  if (seat && seat.uid !== user.uid) throw fail(`${n}번은 벌써 다른 계정이 쓰고 있어요. 내 번호가 맞다면 선생님께 말해 주세요`);
  if (!seat) {
    const info = { name, email: user.email, code, at: Date.now() };
    await B.batch([
      { op: 'set', path: `boards/${tuid}/seats/${n}`, data: { uid: user.uid, ...info } },
      { op: 'set', path: `boards/${tuid}/members/${user.uid}`, data: { num: n, ...info } },
    ]);
  }
  return { tuid, code, num: n, name, title: cl.title };
}
export const getMember = (tuid, uid) => B.get(`boards/${tuid}/members/${uid}`);
export const watchMember = (tuid, uid, cb, onErr) => B.watchDoc(`boards/${tuid}/members/${uid}`, cb, onErr);
export const watchDay = (tuid, date, cb, onErr) => B.watchDoc(`boards/${tuid}/days/${date}`, cb, onErr);
export const watchMyMark = (tuid, date, num, cb, onErr) => B.watchDoc(`boards/${tuid}/days/${date}/marks/${num}`, cb, onErr);
export async function leaveClass(tuid, uid, num) {
  await B.batch([{ op: 'del', path: `boards/${tuid}/seats/${num}` }, { op: 'del', path: `boards/${tuid}/members/${uid}` }]);
}

/* ---------- 메시지 ---------- */
const mid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
export const sendMsg = (tuid, m) => B.set(`boards/${tuid}/msgs/${mid()}`, { ...m, from: 's', at: Date.now() });
export const replyMsg = (tuid, m) => B.set(`boards/${tuid}/msgs/${mid()}`, { ...m, from: 't', at: Date.now(), read: true });
export const watchMsgs = (tuid, uid, cb, onErr) => B.watchCol(`boards/${tuid}/msgs`, uid ? ['uid', '==', uid] : null, cb, onErr);
export const markRead = (tuid, id) => B.set(`boards/${tuid}/msgs/${id}`, { read: true }, true);
export async function clearMsgs(tuid, list) { if (list.length) await B.batch(list.map((m) => ({ op: 'del', path: `boards/${tuid}/msgs/${m.id}` }))); }
