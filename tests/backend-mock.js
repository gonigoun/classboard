// 시험용 가짜 저장소 (localhost에서 ?mock 으로 열 때만 사용)
// tests/mockserver.py 가 데이터를 들고 있고, firestore.rules 와 같은 규칙을 여기서 흉내 내어 검사해요.
// 브라우저 창(컨텍스트)마다 로그인한 사람이 다를 수 있어 선생님·학생을 동시에 시험할 수 있어요.

let state = {}, ver = -1, user = null, onUserCb = () => {};
const watchers = new Set();
const ADMIN = 'gonigoun@gmail.com';
const deny = () => { const e = new Error('permission-denied'); e.code = 'permission-denied'; throw e; };

async function pull() {
  const r = await fetch('/mock/state?since=' + ver); const j = await r.json();
  if (j.v !== ver) { ver = j.v; state = j.data; watchers.forEach((w) => w()); }
}
setInterval(() => { pull().catch(() => {}); }, 350);

export async function init(onUser) {
  onUserCb = onUser; await pull();
  try { user = JSON.parse(localStorage.getItem('mock:auth') || 'null'); } catch (e) { user = null; }
  setTimeout(() => onUser(user), 50);
}
export async function login() {
  let next = null; try { next = JSON.parse(localStorage.getItem('mock:next') || 'null'); } catch (e) { /* 없음 */ }
  user = next || { uid: 'u-admin', email: ADMIN, name: '고운' };
  localStorage.setItem('mock:auth', JSON.stringify(user)); onUserCb(user);
}
export async function logout() { user = null; localStorage.removeItem('mock:auth'); onUserCb(null); }

/* ---------- 규칙 흉내 (firestore.rules 와 같은 판단) ---------- */
const doc = (s, p) => (s[p] === undefined ? null : s[p]);
function rules(op, path, data, before, after) {
  const a = user; const P = path.split('/');
  const allow = doc(before, 'access/allow');
  const isAdmin = !!a && a.email === ADMIN;
  const allowed = isAdmin || (!!a && !!allow && (allow.emails || []).includes(a.email));
  const owner = (uid) => !!a && a.uid === uid && allowed;
  const memberPath = (uid) => `boards/${uid}/members/${a && a.uid}`;
  const isMember = (uid) => !!a && !!doc(before, memberPath(uid));
  const myNum = (uid) => (doc(before, memberPath(uid)) || {}).num;
  const classOpenFor = (uid, code) => { const cl = doc(before, 'classes/' + code); return !!cl && cl.teacherUid === uid && cl.open === true; };
  const nameNum = (code, nh) => ((doc(before, 'classes/' + code) || {}).nh || {})[nh];
  const cur = doc(before, path);
  const write = ['create', 'update', 'delete'].includes(op);
  if (path === 'access/allow') return isAdmin;
  if (P[0] === 'requests') {
    if (op === 'create' || op === 'update') return !!a && P[1] === a.uid && data.email === a.email;
    if (op === 'get') return !!a && (P[1] === a.uid || isAdmin);
    return isAdmin;
  }
  if (P[0] === 'classes' && P.length === 2) {
    if (op === 'get') return !!a;
    if (op === 'create') return allowed && data.teacherUid === a.uid;
    if (op === 'update' || op === 'delete') return !!a && cur && cur.teacherUid === a.uid;
    return false;
  }
  if (P[0] === 'boards') {
    const uid = P[1];
    if (owner(uid)) return true;
    if (!a) return false;
    if (P[2] === 'seats' && P.length === 4) {
      if (op === 'get') return true;
      if (op === 'create') return data.uid === a.uid && classOpenFor(uid, data.code) && nameNum(data.code, data.nh) === P[3] && (doc(after, memberPath(uid)) || {}).num === P[3];
      if (op === 'delete') return cur && cur.uid === a.uid;
      return false;
    }
    if (P[2] === 'members' && P.length === 4) {
      if (op === 'get') return P[3] === a.uid;
      if (op === 'create') return P[3] === a.uid && classOpenFor(uid, data.code) && nameNum(data.code, data.nh) === data.num && (doc(after, `boards/${uid}/seats/${data.num}`) || {}).uid === a.uid;
      if (op === 'delete') return P[3] === a.uid;
      return false;
    }
    if (P[2] === 'days' && P.length === 4) return op === 'get' && isMember(uid);
    if (P[2] === 'days' && P[4] === 'marks' && P.length === 6) return ['get', 'create', 'update'].includes(op) && isMember(uid) && myNum(uid) === P[5];
    if (P[2] === 'msgs' && P.length === 4) {
      if (op === 'create') return isMember(uid) && data.uid === a.uid && data.from === 's' && data.num === myNum(uid) && typeof data.text === 'string' && data.text.length <= 300;
      if (op === 'get' || op === 'list') return isMember(uid) && cur && cur.uid === a.uid;
      return false;
    }
    return false;
  }
  return !write && false;
}
function check(op, path, data, after) { if (!rules(op, path, data, state, after || state)) deny(); }

/* ---------- 기본 동작 ---------- */
export async function get(p) { await pull(); check('get', p); return doc(state, p) ? JSON.parse(JSON.stringify(state[p])) : null; }
export async function set(p, data, merge = false) { await batch([{ op: 'set', path: p, data, merge }]); }
export async function del(p) { await batch([{ op: 'del', path: p }]); }

function match(col, where) {
  const depth = col.split('/').length + 1;
  return Object.keys(state).filter((k) => k.startsWith(col + '/') && k.split('/').length === depth).map((k) => ({ id: k.split('/').pop(), path: k, ...state[k] }))
    .filter((r) => {
      if (!where) return true;
      const [f, op, v] = where; const x = f === '__id__' ? r.id : r[f];
      return op === '==' ? x === v : op === '>=' ? x >= v : op === '<' ? x < v : true;
    });
}
function listChecked(col, where) {
  const P = col.split('/');
  let ok = rules('list', col + '/__probe__', null, state, state);
  // 학생은 자기 uid로 거른 메시지만 목록으로 읽을 수 있음
  if (!ok && P[0] === 'boards' && P[2] === 'msgs' && user && where && where[0] === 'uid' && where[1] === '==' && where[2] === user.uid) ok = !!doc(state, `boards/${P[1]}/members/${user.uid}`);
  if (!ok) deny();
  return match(col, where).map(({ path, ...r }) => r);
}
export async function list(col, where) { await pull(); return listChecked(col, where); }

export async function batch(ops) {
  await pull();
  const after = JSON.parse(JSON.stringify(state));
  ops.forEach((o) => { if (o.op === 'del') delete after[o.path]; else after[o.path] = o.merge && after[o.path] ? { ...after[o.path], ...o.data } : o.data; });
  ops.forEach((o) => {
    const exists = state[o.path] !== undefined;
    const op = o.op === 'del' ? 'delete' : exists ? 'update' : 'create';
    check(op, o.path, after[o.path], after);
  });
  const r = await fetch('/mock/commit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ops }) });
  if (!r.ok) throw new Error('mock commit failed');
  await pull();
}

export function watchDoc(p, cb, onErr) {
  let last;
  const w = () => {
    try { check('get', p); } catch (e) { if (onErr) onErr(e); return; }
    const v = JSON.stringify(state[p] ?? null);
    if (v !== last) { last = v; cb(state[p] ? JSON.parse(v) : null); }
  };
  watchers.add(w); w();
  return () => watchers.delete(w);
}
export function watchCol(col, where, cb, onErr) {
  let last;
  const w = () => {
    let rows; try { rows = listChecked(col, where); } catch (e) { if (onErr) onErr(e); return; }
    const v = JSON.stringify(rows);
    if (v !== last) { last = v; cb(JSON.parse(v)); }
  };
  watchers.add(w); w();
  return () => watchers.delete(w);
}
