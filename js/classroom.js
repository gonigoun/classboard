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
    if (cl && cl.teacherUid === uid()) return cl;
  }
  c.classCode = await store.createClass(uid(), '우리 반'); ctx.saveCfg();
  return store.getClass(c.classCode);
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
    <p class="note">학생은 폰에서 주소(또는 QR)를 열고 Google 계정으로 로그인한 뒤, 코드와 번호·이름을 넣으면 바로 들어와요(자동 승인). 누가 들어왔는지는 아래 이메일로 확인하세요.</p>
    <div class="row"><b>들어온 학생 ${list.length}명</b><span class="sp"></span>
      <button class="btn ghost" data-a="clearall" ${list.length ? '' : 'disabled'}>모든 자리 비우기</button>
      <button class="btn ghost" data-a="newcode">새 코드로 바꾸기</button></div>
    <div class="seatlist">${list.map((s) => `<div class="seat"><b>${esc(s.id)}번</b><span>${esc(s.name)}${names[+s.id - 1] && names[+s.id - 1] !== s.name ? ` <em class="warn">명단: ${esc(names[+s.id - 1])}</em>` : ''}</span>
        <small>${esc(s.email || '')} · ${new Date(s.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>
        <button class="mini rm" data-rm="${esc(s.id)}" title="자리 비우기">${ic('x')}</button></div>`).join('') || '<p class="hint">아직 들어온 학생이 없어요.</p>'}</div>`;
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
    try { ctx.cfg().classCode = await store.createClass(uid(), '우리 반'); ctx.saveCfg(); await store.deleteClass(old).catch(() => {}); drawStudents(); }
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
  if (thread && !byUid[thread]) thread = null;
  if (!thread) {
    w.innerHTML = people.length ? `<div class="plist">${people.map((p) => `<button data-u="${esc(p.uid)}"><b>${esc(p.num)}번 ${esc(p.name)}</b><span>${esc(p.list[p.list.length - 1].text.slice(0, 30))}</span>${p.unread ? `<i class="badge">${p.unread}</i>` : ''}</button>`).join('')}</div>
      <div class="row end"><button class="btn ghost" data-a="clear">메시지 모두 지우기</button></div>` : '<p class="hint">아직 받은 메시지가 없어요. 학생이 폰에서 "선생님께 메시지"를 보내면 여기에 와요.</p>';
    w.querySelectorAll('[data-u]').forEach((b) => { b.onclick = () => { thread = b.dataset.u; drawMessages(); }; });
    const c = w.querySelector('[data-a=clear]');
    if (c) c.onclick = async () => { if (await confirmBox('메시지를 모두 지울까요?', '학생 폰에서도 지난 메시지가 사라져요.', '모두 지우기')) store.clearMsgs(uid(), msgs).catch(() => toast('지우지 못했어요')); };
    return;
  }
  const p = people.find((x) => x.uid === thread);
  p.list.filter((m) => m.from === 's' && !m.read).forEach((m) => store.markRead(uid(), m.id).catch(() => {}));
  w.innerHTML = `<div class="row"><button class="btn ghost" data-a="back">← 목록</button><b>${esc(p.num)}번 ${esc(p.name)}</b></div>
    <div class="thread">${p.list.map((m) => `<div class="bub ${m.from}">${esc(m.text)}<small>${new Date(m.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</small></div>`).join('')}</div>
    <form class="row" data-r="f"><input type="text" maxlength="300" placeholder="답장 쓰기" data-r="t" style="flex:1"><button class="btn">보내기</button></form>`;
  const th = w.querySelector('.thread'); th.scrollTop = th.scrollHeight;
  w.querySelector('[data-a=back]').onclick = () => { thread = null; drawMessages(); };
  w.querySelector('[data-r=f]').onsubmit = async (e) => {
    e.preventDefault();
    const t = w.querySelector('[data-r=t]').value.trim(); if (!t) return;
    try { await store.replyMsg(uid(), { uid: thread, num: p.num, name: p.name, text: t }); } catch (er) { toast('보내지 못했어요'); }
  };
  ctx.onChange();
}
