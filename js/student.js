// 학생 화면: 학급 코드로 들어와서 과제를 스스로 체크하고, 선생님께 메시지를 보내요.
import * as store from './store.js';
import { $, ic, esc, toast, confetti, confirmBox } from './ui.js';
import { ymd, getPhase, mmss } from './data.js';
import { tasksOf, isPick, needOf, isDone, isChecked, posOf, withPos, withToggle, nextTask, doneCount } from './tasks.js';

let pick = null; // 학생이 골라 보는 교시 (null이면 지금 시간대로)
let U = null, M = null, day = null, mark = { p: {}, k: {} }, msgs = [], unsubs = [], phaseKey = '', recentAt = 0, dateKey = '';
const box = () => $('#student [data-r=stu]');
const saveLocal = (m) => { try { if (m) localStorage.setItem('cb:stu', JSON.stringify(m)); else localStorage.removeItem('cb:stu'); } catch (e) { /* 무시 */ } };
const nowSec = () => { const d = new Date(); return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(); };

export async function startStudent(user, codeParam) {
  U = user;
  let m = null; try { m = JSON.parse(localStorage.getItem('cb:stu') || 'null'); } catch (e) { m = null; }
  if (m && (!codeParam || codeParam.toUpperCase() === m.code)) {
    const mem = await store.getMember(m.tuid, U.uid).catch(() => null);
    if (mem && String(mem.num) === String(m.num)) { M = m; return enter(); }
    saveLocal(null);
  }
  joinForm(codeParam || (m && m.code) || '');
}

/* ---------- 입장 ---------- */
function joinForm(code, err) {
  unsubs.forEach((u) => u()); unsubs = [];
  box().innerHTML = `<div class="stu-card join">
      <h2>학급에 들어가기</h2>
      <p class="hint">${esc(U.email)} 계정으로 들어가요. 선생님이 띄운 학급 코드와 <b>선생님 명단에 있는 내 이름</b>을 넣어 주세요. 번호는 저절로 정해져요.</p>
      ${err ? `<p class="help">${esc(err)}</p>` : ''}
      <form data-r="f">
        <label>학급 코드<input data-r="code" maxlength="6" required value="${esc(code)}" placeholder="예: K7P2QM" autocapitalize="characters" class="codein"></label>
        <label>내 이름<input data-r="name" maxlength="20" required value="${esc((U.name || '').slice(0, 20))}" autocomplete="name"></label>
        <button class="bigbtn">들어가기</button>
      </form>
      <div class="row end"><button class="linkbtn" data-a="out">다른 계정으로 로그인</button></div></div>`;
  box().querySelector('[data-r=f]').onsubmit = async (e) => {
    e.preventDefault();
    const v = (r) => box().querySelector(`[data-r=${r}]`).value.trim();
    const btn = box().querySelector('.bigbtn'); btn.disabled = true; btn.textContent = '들어가는 중…';
    try {
      M = await store.joinClass(U, v('code'), v('name'));
      saveLocal(M); toast(`${M.num}번 ${M.name}(으)로 들어왔어요`); enter();
    } catch (er) { joinForm(v('code'), store.errText(er)); }
  };
  box().querySelector('[data-a=out]').onclick = () => store.logout();
}

/* ---------- 들어온 뒤 ---------- */
function enter() {
  dateKey = ymd(new Date()); phaseKey = '';
  box().innerHTML = `<header class="stu-h"><div><small>${esc(M.title || '우리 반')} · ${esc(M.code)}</small><b>${esc(M.num)}번 ${esc(M.name)}</b></div>
      <button class="linkbtn" data-a="menu">나가기</button></header>
    <section class="stu-card" data-r="now"></section>
    <section class="stu-card" data-r="tasks"></section>
    <section class="stu-card stu-msg"><h3>${ic('chat')} 선생님께 메시지</h3><div class="thread" data-r="thread"></div>
      <form class="row" data-r="mf"><input data-r="mt" maxlength="300" placeholder="궁금한 것을 적어요" style="flex:1"><button class="btn">보내기</button></form></section>`;
  box().querySelector('[data-a=menu]').onclick = async () => {
    if (!(await confirmBox('학급에서 나갈까요?', '자리가 비워지고 입장 화면으로 돌아가요. 다시 들어올 수 있어요.', '나가기', false))) return;
    await store.leaveClass(M.tuid, U.uid, M.num).catch(() => {}); saveLocal(null); joinForm(M.code);
  };
  box().querySelector('[data-r=mf]').onsubmit = async (e) => {
    e.preventDefault();
    const inp = box().querySelector('[data-r=mt]'); const t = inp.value.trim(); if (!t) return;
    try { await store.sendMsg(M.tuid, { uid: U.uid, num: M.num, name: M.name, text: t }); inp.value = ''; } catch (er) { toast('보내지 못했어요: ' + store.errText(er)); }
  };
  watch();
  setInterval(tick, 1000); tick();
}

function watch() {
  unsubs.forEach((u) => u()); unsubs = [];
  // 선생님이 자리를 비우면 바로 입장 화면으로
  unsubs.push(store.watchMember(M.tuid, U.uid, (mem) => {
    if (!mem) { saveLocal(null); toast('선생님이 자리를 비웠어요. 다시 들어와 주세요', 4000); joinForm(M.code); }
  }, () => {}));
  unsubs.push(store.watchDay(M.tuid, dateKey, (d) => { day = d; phaseKey = ''; tick(); }, () => { day = null; tick(); }));
  unsubs.push(store.watchMyMark(M.tuid, dateKey, M.num, (m) => {
    if (Date.now() - recentAt > 2500) { mark = { p: (m && m.p) || {}, k: (m && m.k) || {} }; drawTasks(); }
  }, () => {}));
  let firstMsgs = true;
  unsubs.push(store.watchMsgs(M.tuid, U.uid, (rows) => {
    const had = new Set(msgs.map((m) => m.id)); msgs = rows.sort((a, b) => a.at - b.at); drawThread();
    const fresh = msgs.filter((m) => m.from === 't' && !had.has(m.id));
    if (!firstMsgs && fresh.length) { toast(`선생님 메시지: ${fresh[fresh.length - 1].text.slice(0, 40)}`, 4000); try { navigator.vibrate && navigator.vibrate(200); } catch (e) { /* 무시 */ } }
    firstMsgs = false;
  }, () => {}));
}

function tick() {
  if (!M || !box().querySelector('[data-r=now]')) return;
  if (ymd(new Date()) !== dateKey) { dateKey = ymd(new Date()); watch(); return; }
  const T = (day && day.table) || [];
  const ph = getPhase(T, nowSec());
  const key = `${ph.kind}:${ph.cur ?? ph.next ?? ''}:${T.length}`;
  const now = box().querySelector('[data-r=now]');
  if (key !== phaseKey) {
    phaseKey = key;
    let h;
    if (!day) h = '<h3>오늘 시간표를 기다리는 중</h3><p class="hint">선생님이 오늘 교실 보드를 열면 시간표가 나와요.</p>';
    else if (ph.kind === 'class') h = `<div class="pill-b">${T[ph.cur].morning ? '아침 시간이에요' : T[ph.cur].lunch ? '점심시간이에요' : `${esc(T[ph.cur].name)} 수업 중`}</div><h2>${esc(T[ph.cur].subject || T[ph.cur].name)}</h2>${chips(T[ph.cur])}`;
    else if (ph.kind === 'break' || ph.kind === 'soon') h = `<div class="pill-b brk">${ph.kind === 'soon' ? '곧 수업 시작' : ph.lunch ? '점심시간이에요' : '쉬는 시간이에요'}</div><h2>다음 수업: ${esc(T[ph.next].name)} ${esc(T[ph.next].subject)}</h2><div class="num cd" data-r="cd">${mmss(ph.remain)}</div>${chips(T[ph.next])}`;
    else if (ph.kind === 'morning') h = `<div class="pill-b">좋은 아침이에요</div><h2>${esc(T[ph.next].name)} ${esc(T[ph.next].subject)} · ${esc(T[ph.next].start)} 시작</h2>${chips(T[ph.next])}`;
    else if (ph.kind === 'end') h = '<div class="pill-b ok">오늘 수업 끝!</div><h2>남은 과제가 있으면 마저 체크해요</h2>';
    else h = '<h2>오늘은 수업이 없어요</h2>';
    now.innerHTML = h; now.className = 'stu-card now-' + ph.kind;
    drawTasks();
  } else if (ph.remain !== undefined) { const cd = now.querySelector('[data-r=cd]'); if (cd) cd.textContent = mmss(ph.remain); }
}
const chips = (p) => `<div class="chips sm">${(p.items || []).map((b) => `<span class="chip">${esc(b)}</span>`).join('')}</div>`;

/* ---------- 과제 스스로 체크 ---------- */
function drawTasks() {
  const el = box().querySelector('[data-r=tasks]'); if (!el) return;
  const T = (day && day.table) || [];
  const ph = getPhase(T, nowSec());
  const special = (p) => !!(p && (p.morning || p.lunch));
  const nowPi = ph.kind === 'class' ? ph.cur : (ph.kind === 'morning' || ph.kind === 'soon') && special(T[ph.next]) ? ph.next : null;
  const all = T.map((p, i) => [p, i]).filter(([p]) => tasksOf(p).length);
  if (pick != null && !tasksOf(T[pick]).length) pick = null;
  const list = pick != null ? [[T[pick], pick]] : nowPi != null ? [[T[nowPi], nowPi]] : ph.kind === 'end' ? T.map((p, i) => [p, i]) : [];
  const withT = list.filter(([p]) => tasksOf(p).length);
  if (!all.length) { el.hidden = true; return; }
  el.hidden = false;
  // 오늘 과제가 있는 교시 고르기: 지난 교시 과제도 이어서 할 수 있어요
  const tabs = `<div class="ptabs"><span>교시 고르기</span><button data-pk="now" class="${pick == null ? 'sel' : ''}">지금</button>${all.map(([p, i]) => `<button data-pk="${i}" class="${pick === i ? 'sel' : ''} ${all.length && isDone(p, mark, i) ? 'ok' : ''}">${esc(p.name)}</button>`).join('')}</div>`;
  el.innerHTML = tabs + (withT.length ? '' : '<p class="hint">지금은 과제가 없어요. 위에서 교시를 고르면 그 교시 과제를 할 수 있어요.</p>') + withT.map(([p, pi]) => {
    const done = isDone(p, mark, pi);
    let body;
    if (isPick(p)) {
      body = `<p class="hint">${tasksOf(p).length}개 중 ${needOf(p)}개를 골라서 해요 · 지금 ${doneCount(p, mark, pi)}개</p>
        <div class="picks">${tasksOf(p).map((t, ti) => `<button class="pk ${isChecked(p, mark, pi, ti) ? 'on' : ''}" data-pi="${pi}" data-ti="${ti}"><i>${ic('flag')}</i>${esc(t)}</button>`).join('')}</div>`;
    } else {
      const nx = nextTask(p, mark, pi), pos = posOf(mark, pi);
      body = `<div class="vtrack">${tasksOf(p).map((t, ti) => `<div class="vst ${ti < pos ? 'done' : ti === pos ? 'cur' : ''}"><div class="mark">${ti < pos ? ic('flag') : ti + 1}</div><div class="lbl">${esc(t)}</div></div>`).join('')}</div>
        ${nx ? `<button class="bigbtn go" data-go="${pi}">‘${esc(nx.label)}’ 다 했어요!</button>` : ''}
        ${pos > 0 ? `<button class="linkbtn" data-back="${pi}">${ic('undo')} 한 단계 되돌리기</button>` : ''}`;
    }
    return `<div class="stu-task ${done ? 'ok' : ''}"><h3>${esc(p.name)} ${esc(p.subject)} 과제 ${done ? '<span class="pill-b ok">완료</span>' : ''}</h3>${body}</div>`;
  }).join('');
  el.querySelectorAll('[data-pk]').forEach((b) => { b.onclick = () => { pick = b.dataset.pk === 'now' ? null : +b.dataset.pk; drawTasks(); }; });
  const T2 = T;
  const save = (m, wasDone, p, pi) => {
    mark = m; recentAt = Date.now();
    store.setMark(M.tuid, dateKey, M.num, mark);
    if (!wasDone && isDone(p, mark, pi)) { confetti(); toast(`${p.name} 과제를 모두 했어요!`); }
    drawTasks();
  };
  el.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => { const pi = +b.dataset.go, p = T2[pi]; save(withPos(mark, pi, posOf(mark, pi) + 1), isDone(p, mark, pi), p, pi); }; });
  el.querySelectorAll('[data-back]').forEach((b) => { b.onclick = () => { const pi = +b.dataset.back, p = T2[pi]; save(withPos(mark, pi, posOf(mark, pi) - 1), true, p, pi); }; });
  el.querySelectorAll('[data-ti]').forEach((b) => { b.onclick = () => { const pi = +b.dataset.pi, p = T2[pi]; save(withToggle(mark, pi, +b.dataset.ti), isDone(p, mark, pi), p, pi); }; });
}

function drawThread() {
  const th = box().querySelector('[data-r=thread]'); if (!th) return;
  th.innerHTML = msgs.length ? msgs.map((m) => `<div class="bub ${m.from}">${esc(m.text)}<small>${m.from === 't' ? '선생님 · ' : ''}${new Date(m.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</small></div>`).join('')
    : '<p class="hint">수업 중에 궁금한 것이 있으면 선생님께 보내요. 선생님 화면에 바로 떠요.</p>';
  th.scrollTop = th.scrollHeight;
}
