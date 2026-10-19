// 선생님 쪽: 학생 입장(학급 코드·자리) 창과 메시지 창
import { $, ic, esc, toast, confirmBox, openWin, closeWin, isWinOpen } from './ui.js';
import * as store from './store.js';
import { FX } from './sound.js';

let ctx = null; // { user(), cfg(), saveCfg(), roster(), soundOn(), onChange() }
let seats = {}, msgs = [], seatCbs = [], msgCbs = [], started = false, firstMsgs = true;
export function initClassroom(c) { ctx = c; if (ctx.user()) start(); }
export const onSeats = (cb) => seatCbs.push(cb);
export const onMsgs = (cb) => msgCbs.push(cb);
export const unreadCount = () => msgs.filter((m) => m.from === 's' && !m.read).length;
const guest = () => !ctx.user();
const uid = () => ctx.user().uid;

function start() {
  if (started) return; started = true;
  store.watchSeats(uid(), (rows) => {
    seats = {}; rows.forEach((r) => { seats[r.id] = r; });
    seatCbs.forEach((cb) => cb(seats));
    if (isWinOpen('students')) drawStudents();
  }, () => {});
  store.watchMsgs(uid(), null, (rows) => {
    const before = new Set(msgs.map((m) => m.id));
    msgs = rows.sort((a, b) => a.at - b.at);
    const fresh = msgs.filter((m) => m.from === 's' && !before.has(m.id) && !m.read);
    if (!firstMsgs && fresh.length) {
      const m = fresh[fresh.length - 1];
      toast(`메시지 · ${m.num}번 ${m.name}: ${m.text.slice(0, 40)}`, 4000);
      if (ctx.soundOn()) FX.soon();
    }
    firstMsgs = false;
    msgCbs.forEach((cb) => cb(msgs));
    if (isWinOpen('msg')) drawMessages();
  }, () => {});
}

/* ---------- 학생 입장 ---------- */
const joinUrl = (code) => `${location.origin}${location.pathname}?code=${code}#/student`;
let qrLib = null;
async function qrSvg(text) {
  try {
    if (!qrLib) {
      await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
      qrLib = window.qrcode;
    }
    const q = qrLib(0, 'M'); q.addData(text); q.make();
    return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  } catch (e) { return '<p class="hint">QR 코드를 불러오지 못했어요. 주소나 코드를 알려 주세요.</p>'; }
}

export function openStudents() {
  openWin('students', '학생 입장', 'phone', '<div class="stuw"></div>', () => drawStudents());
}
async function ensureCode() {
  const c = ctx.cfg();
  if (c.classCode) {
    const cl = await store.getClass(c.classCode).catch(() => null);
    if (cl && cl.teacherUid === uid()) { if (!cl.nh) await syncNames(); return store.getClass(c.classCode); }
  }
  c.classCode = await store.createClass(uid(), '우리 반'); ctx.saveCfg();
  await syncNames();
  return store.getClass(c.classCode);
}
/** 명단 이름(지문)을 학급 코드에 반영: 학생은 이 이름으로만 들어올 수 있어요. 같은 이름 목록을 돌려줘요 */
export async function syncNames() {
  if (guest() || !ctx.cfg().classCode) return [];
  try { const r = await store.syncClassNames(ctx.cfg().classCode, ctx.roster()); return r.dup; } catch (e) { return []; }
}
async function drawStudents() {
  const w = $('.win .stuw'); if (!w) return;
  if (guest()) {
    w.innerHTML = `<div class="code-big num">DEMO</div><p class="hint" style="text-align:center">게스트 모드에서는 예시만 보여요.<br>선생님 계정으로 로그인하면 학급 코드가 생기고, 학생이 폰으로 들어와 과제를 스스로 체크하고 메시지를 보낼 수 있어요.</p>
      <div class="seatlist"><div class="seat"><b>3번</b><span>박도윤</span><small>doyun@school.kr · 예시</small></div><div class="seat"><b>6번</b><span>강민준</span><small>minjun@school.kr · 예시</small></div></div>`;
    return;
  }
  w.innerHTML = '<p class="hint">학급 코드를 준비하는 중…</p>';
  let cl;
  try { cl = await ensureCode(); } catch (e) { w.innerHTML = `<p class="hint">학급 코드를 만들지 못했어요. (${esc(store.errText(e))})</p>`; return; }
  const code = ctx.cfg().classCode, names = ctx.roster();
  const list = Object.values(seats).sort((a, b) => +a.id - +b.id);
  w.innerHTML = `<div class="stu-top"><div><div class="hint">학급 코드</div><div class="code-big num">${code}</div>
      <div class="hint url">${esc(joinUrl(code))}</div>
      <div class="row"><button class="btn ghost" data-a="copy">주소 복사</button>
        <label class="chk"><input type="checkbox" data-a="open" ${cl && cl.open ? 'checked' : ''}> 학생 입장 열기</label></div></div>
      <div class="qr-box" data-r="qr"></div></div>
    <p class="note">학생은 폰에서 주소(또는 QR)를 열고 Google 계정으로 로그인한 뒤, 코드와 <b>명단에 있는 이름</b>을 넣으면 바로 들어와요. 번호는 설정 → 학생 명단의 번호로 정해져요. 누가 들어왔는지는 아래 이메일로 확인하세요.</p>
    <div class="row"><b>들어온 학생 ${list.length}명</b><span class="hint">/ 명단 ${names.filter((x) => x).length}명</span><span class="sp"></span>
      <button class="btn ghost" data-a="clearall" ${list.length ? '' : 'disabled'}>모든 자리 비우기</button>
      <button class="btn ghost" data-a="newcode">새 코드로 바꾸기</button></div>
    <div class="seatlist">${list.map((s) => `<div class="seat"><b>${esc(s.id)}번</b><span>${esc(s.name)}${names[+s.id - 1] && store.normName(names[+s.id - 1]) !== store.normName(s.name) ? ` <em class="warn">명단: ${esc(names[+s.id - 1])}</em>` : ''}</span>
        <small>${esc(s.email || '')} · ${new Date(s.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>
        <button class="mini rm" data-rm="${esc(s.id)}" title="자리 비우기">${ic('x')}</button></div>`).join('') || '<p class="hint">아직 들어온 학생이 없어요.</p>'}</div>
    ${(() => { const wait = names.map((n, i) => [i + 1, n]).filter(([k, n]) => n && !seats[String(k)]); return wait.length ? `<p class="note">아직 안 들어온 학생: ${wait.map(([k, n]) => `${k} ${esc(n)}`).join(', ')}</p>` : ''; })()}`;
  qrSvg(joinUrl(code)).then((svg) => { const q = w.querySelector('[data-r=qr]'); if (q) q.innerHTML = svg; });
  w.querySelector('[data-a=copy]').onclick = () => navigator.clipboard.writeText(joinUrl(code)).then(() => toast('주소를 복사했어요')).catch(() => toast('복사하지 못했어요'));
  w.querySelector('[data-a=open]').onchange = async (e) => {
    try { await store.setClassOpen(code, e.target.checked); toast(e.target.checked ? '학생 입장을 열었어요' : '학생 입장을 닫았어요. 이미 들어온 학생은 그대로예요'); }
    catch (er) { toast('바꾸지 못했어요'); }
  };
  w.querySelectorAll('[data-rm]').forEach((b) => {
    b.onclick = async () => {
      const s = seats[b.dataset.rm];
      if (!(await confirmBox(`${s.id}번 자리를 비울까요?`, `${s.name}(${s.email}) 학생 폰이 입장 화면으로 돌아가요. 폰을 바꿨을 때 쓰세요.`, '자리 비우기'))) return;
      await store.clearSeat(uid(), s).catch(() => toast('비우지 못했어요'));
    };
  });
  w.querySelector('[data-a=clearall]').onclick = async () => {
    if (!(await confirmBox('모든 자리를 비울까요?', '들어온 학생 폰이 모두 입장 화면으로 돌아가요.', '모두 비우기'))) return;
    for (const s of Object.values(seats)) await store.clearSeat(uid(), s).catch(() => {});
  };
  w.querySelector('[data-a=newcode]').onclick = async () => {
    if (!(await confirmBox('새 코드로 바꿀까요?', '지금 코드로는 더 이상 들어올 수 없어요. 이미 들어온 학생은 그대로예요.', '새 코드 만들기', false))) return;
    const old = ctx.cfg().classCode;
    try { ctx.cfg().classCode = await store.createClass(uid(), '우리 반'); ctx.saveCfg(); await syncNames(); await store.deleteClass(old).catch(() => {}); drawStudents(); }
    catch (e) { toast('새 코드를 만들지 못했어요'); }
  };
}

/* ---------- 메시지 ---------- */
let thread = null; // 지금 보고 있는 학생 uid
export function openMessages() {
  openWin('msg', '학생 메시지', 'chat', '<div class="msgw"></div>', () => drawMessages(), () => { thread = null; });
}
function drawMessages() {
  const w = $('.win .msgw'); if (!w) return;
  if (guest()) {
    w.innerHTML = `<p class="hint">게스트 모드 예시예요. 로그인하면 학생이 폰에서 보낸 메시지가 여기에 오고, 답장할 수 있어요.</p>
      <div class="thread"><div class="bub s"><b>3번 박도윤</b>선생님, 익힘 34쪽 2번 문제를 잘 모르겠어요</div><div class="bub t">쉬는 시간에 선생님 자리로 오세요!</div></div>`;
    return;
  }
  const byUid = {};
  msgs.forEach((m) => { (byUid[m.uid] = byUid[m.uid] || []).push(m); });
  const people = Object.entries(byUid).map(([u, list]) => ({ uid: u, num: list[0].num, name: list.find((x) => x.from === 's')?.name || list[0].name, list, unread: list.filter((x) => x.from === 's' && !x.read).length, last: list[list.length - 1].at }))
    .sort((a, b) => b.last - a.last);
  // 폰으로 들어온 학생에게는 먼저 보낼 수 있어요
  const seated = Object.values(seats).sort((a, b) => +a.id - +b.id);
  seated.forEach((s) => { if (!byUid[s.uid]) byUid[s.uid] = null; });
  if (thread && thread !== '*' && !(thread in byUid)) thread = null;
  if (!thread) {
    const newTo = seated.length ? `<form class="row newmsg" data-r="nf"><select data-r="to"><option value="">받는 학생 고르기</option><option value="*">모두에게 (${seated.length}명)</option>${seated.map((s) => `<option value="${esc(s.uid)}">${esc(s.id)}번 ${esc(s.name)}</option>`).join('')}</select><button class="btn">${ic('chat')} 쓰기</button></form>`
      : '<p class="note">폰으로 들어온 학생이 있으면 선생님이 먼저 메시지를 보낼 수 있어요.</p>';
    w.innerHTML = newTo + (people.length ? `<div class="plist">${people.map((p) => `<button data-u="${esc(p.uid)}"><b>${esc(p.num)}번 ${esc(p.name)}</b><span>${p.list[p.list.length - 1].from === 't' ? '나: ' : ''}${esc(p.list[p.list.length - 1].text.slice(0, 30))}</span>${p.unread ? `<i class="badge">${p.unread}</i>` : ''}</button>`).join('')}</div>
      <div class="row end"><button class="btn ghost" data-a="clear">메시지 모두 지우기</button></div>` : '<p class="hint">아직 주고받은 메시지가 없어요. 학생이 폰에서 "선생님께 메시지"를 보내면 여기에 와요.</p>');
    w.querySelectorAll('[data-u]').forEach((b) => { b.onclick = () => { thread = b.dataset.u; drawMessages(); }; });
    const nf = w.querySelector('[data-r=nf]');
    if (nf) nf.onsubmit = (e) => { e.preventDefault(); const v = nf.querySelector('[data-r=to]').value; if (!v) { toast('받는 학생을 골라 주세요'); return; } thread = v; drawMessages(); };
    const c = w.querySelector('[data-a=clear]');
    if (c) c.onclick = async () => { if (await confirmBox('메시지를 모두 지울까요?', '학생 폰에서도 지난 메시지가 사라져요.', '모두 지우기')) store.clearMsgs(uid(), msgs).catch(() => toast('지우지 못했어요')); };
    return;
  }
  if (thread === '*') { // 모두에게
    w.innerHTML = `<div class="row"><button class="btn ghost" data-a="back">← 목록</button><b>모두에게 (${seated.length}명)</b></div>
      <p class="note">폰으로 들어온 학생 모두에게 같은 메시지를 보내요. 학생마다 따로 답장할 수 있어요.</p>
      <form class="row" data-r="f"><input type="text" maxlength="300" placeholder="메시지 쓰기" data-r="t" style="flex:1"><button class="btn">보내기</button></form>`;
    w.querySelector('[data-a=back]').onclick = () => { thread = null; drawMessages(); };
    w.querySelector('[data-r=f]').onsubmit = async (e) => {
      e.preventDefault();
      const t = w.querySelector('[data-r=t]').value.trim(); if (!t) return;
      try { for (const s of seated) await store.teacherMsg(uid(), { uid: s.uid, num: s.id, name: s.name, text: t }); toast(`${seated.length}명에게 보냈어요`); thread = null; drawMessages(); } catch (er) { toast('보내지 못했어요'); }
    };
    return;
  }
  const st = seated.find((s) => s.uid === thread);
  const p = people.find((x) => x.uid === thread) || { uid: thread, num: st.id, name: st.name, list: [] };
  p.list.filter((m) => m.from === 's' && !m.read).forEach((m) => store.markRead(uid(), m.id).catch(() => {}));
  w.innerHTML = `<div class="row"><button class="btn ghost" data-a="back">← 목록</button><b>${esc(p.num)}번 ${esc(p.name)}</b></div>
    <div class="thread">${p.list.map((m) => `<div class="bub ${m.from}">${esc(m.text)}<small>${new Date(m.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</small></div>`).join('') || '<p class="hint">첫 메시지를 보내 보세요. 학생 폰에 바로 떠요.</p>'}</div>
    <form class="row" data-r="f"><input type="text" maxlength="300" placeholder="${p.list.length ? '답장 쓰기' : '메시지 쓰기'}" data-r="t" style="flex:1"><button class="btn">보내기</button></form>`;
  const th = w.querySelector('.thread'); th.scrollTop = th.scrollHeight;
  w.querySelector('[data-a=back]').onclick = () => { thread = null; drawMessages(); };
  w.querySelector('[data-r=f]').onsubmit = async (e) => {
    e.preventDefault();
    const t = w.querySelector('[data-r=t]').value.trim(); if (!t) return;
    try { await store.teacherMsg(uid(), { uid: thread, num: p.num, name: p.name, text: t }); } catch (er) { toast('보내지 못했어요'); }
  };
  ctx.onChange();
}
