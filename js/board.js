// 선생님 보드 (게스트 모드 포함): 시계·수업 화면·과제 정류장·위젯 바
import { $, $$, ic, esc, toast, confetti, confirmBox, setWinStore, closeWin, timerSvg } from './ui.js';
import { WEEKDAYS, sampleConfig, normalizeConfig, clone, ymd, semesterStart, getPhase, jumpGroups, mmss, isMorning, isLunch, isSpecial } from './data.js';
import { BELLS, ringBell, FX, setVolume, unlockAudio } from './sound.js';
import * as store from './store.js';
import { getWB, fitWB, setWbFull, wbIsFull, setWbWidgets, setWbHead, onWbFull, isPhone, setWbSync, applyRemote, setTvRatio, myRatio } from './whiteboard.js';
import { initWidgets, applyBg, applyTheme, openBg, openPick, openNoise, openLight, openTimer, applyRemoteTimer } from './widgets.js';
import { initSettings, openSettings } from './settings.js';
import { openHistory } from './history.js';
import { initClassroom, openStudents, openMessages, onSeats, onMsgs, unreadCount, syncNames } from './classroom.js';
import { tasksOf, isPick, needOf, isDone, isChecked, posOf, withPos, withToggle, withReset } from './tasks.js';

/* ---------- 상태 ---------- */
const S = {
  user: null,          // 로그인한 선생님 (허용된 계정만)
  cfg: sampleConfig(), // 설정 (시간표·명단·소리·배경…)
  day: null,           // 오늘 기록 { table, custom, roster, progress(요약) }
  dateKey: null,
  marks: {},           // 학생별 체크 { "번호": {p,k} }
  recent: {},          // 방금 내가 바꾼 번호 (서버 응답이 늦게 와도 화면이 되돌아가지 않게)
  seats: {},           // 폰으로 들어온 학생 { "번호": {...} }
  bgImage: null,
  offset: 0,           // 시간 이동(확인용) 초
  phaseKey: '',
  phase: { kind: 'none' },
  wbOn: false,
  tasksFull: false,
  pin: null,           // 위쪽 시간표에서 눌러 다시 보는 교시 (null이면 지금 시간대로)
  pinLive: '',
  saveState: 'ok',
  guestWarned: false,
  unsubs: [],
};
const guest = () => !S.user;
const now = () => new Date(Date.now() + S.offset * 1000);
const nowSec = () => { const d = now(); return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(); };
const table = () => (S.day ? S.day.table : []) || [];
const roster = () => S.cfg.roster || [];
const soundOn = () => !!S.cfg.sound.on;
const fx = (name, ...a) => { if (soundOn()) FX[name](...a); };

/* ---------- 저장 ---------- */
function warnGuest() { if (!S.guestWarned) { S.guestWarned = true; toast('게스트 모드라서 바꾼 내용은 저장되지 않아요'); } }
function saveCfg() {
  if (guest()) { warnGuest(); return; }
  LIVE.lastCfg = stable(S.cfg);
  try { localStorage.setItem('cb:cache', JSON.stringify({ uid: S.user.uid, cfg: S.cfg })); } catch (e) { /* 저장 공간 막힘 */ }
  store.saveConfig(S.user.uid, S.cfg);
}
/** 하루 기록: 시간표 + 학생별 체크 요약 (지난 기록용) */
function saveDay() {
  if (guest() || !S.day) { if (guest()) warnGuest(); return; }
  if (!S.day.table.length) return; // 수업 없는 날은 기록하지 않음
  S.day.roster = [...roster()];
  const progress = {}, picks = {};
  table().forEach((p, pi) => {
    if (!tasksOf(p).length) return; // 과제가 없는 교과는 기록하지 않음
    progress[pi] = roster().map((_, k) => posOf(markOf(k), pi));
    picks[pi] = roster().map((_, k) => +((markOf(k).k || {})[pi] || 0));
  });
  S.day.progress = progress; S.day.picks = picks;
  store.saveDay(S.user.uid, S.dateKey, S.day);
}
store.onStatus((st) => { S.saveState = st; drawAcct(); });

/* ---------- 학생별 체크 ---------- */
const markOf = (k) => S.marks[String(k + 1)] || { p: {}, k: {} };
function setMark(k, mark) {
  const num = String(k + 1);
  S.marks[num] = mark; S.recent[num] = Date.now();
  if (!guest()) { store.setMark(S.user.uid, S.dateKey, num, mark); saveDay(); } else warnGuest();
}

/* ---------- 오늘 기록 불러오기 ---------- */
async function loadToday() {
  const d = now(); const key = ymd(d); const wd = d.getDay();
  S.dateKey = key;
  let day = null;
  if (!guest()) { try { day = await store.loadDay(S.user.uid, key); } catch (e) { /* 오프라인: 아래에서 새로 만듦 */ } }
  if (!day) day = { table: clone(S.cfg.weekTables[wd] || []), custom: false };
  else if (!day.custom) { // '오늘만 바꾸기'를 안 했으면 요일 기본 시간표를 따라감
    const wt = S.cfg.weekTables[wd] || [];
    // 아침 시간이 새로 생긴 날: 이미 체크한 기록이 어긋나지 않게 오늘은 저장된 시간표를 그대로 씀 (내일부터 아침 시간이 나와요)
    const keepToday = (day.table || []).length && !day.table.some(isMorning) && wt.some(isMorning);
    if (!keepToday) day.table = clone(wt);
  }
  S.day = day; S.marks = {}; S.phaseKey = '';
  // 예전 형식(그날 기록에 진행 상황을 바로 담던 방식)도 읽어 줌
  if (day.progress && !guest()) Object.entries(day.progress).forEach(([pi, arr]) => (arr || []).forEach((v, k) => { if (v) { const m = markOf(k); m.p[pi] = v; S.marks[String(k + 1)] = m; } }));
  if (!guest()) {
    S.unsubs.forEach((u) => u()); S.unsubs = [];
    S.unsubs.push(store.watchMarks(S.user.uid, key, (rows) => {
      const t = Date.now();
      rows.forEach((r) => { if (!S.recent[r.id] || t - S.recent[r.id] > 2500) S.marks[r.id] = { p: r.p || {}, k: r.k || {} }; });
      drawTasks(true);
    }, () => {}));
    // 다른 화면에서 '오늘만 바꾸기'를 하면 여기도 바뀜
    S.unsubs.push(store.watchTeacherDay(S.user.uid, key, (d) => {
      if (!d || !S.day || store.isPending('day:' + key)) return;
      if (stable(d.table || []) === stable(S.day.table) && !!d.custom === !!S.day.custom) return;
      if (!d.custom && !S.day.custom) return; // 요일 기본 시간표는 설정 연동으로 맞춰짐
      S.day.table = d.table || []; S.day.custom = !!d.custom; S.phaseKey = ''; tick();
    }, () => {}));
    if (day.table.length) saveDay(); // 오늘 시간표를 그날 기록으로 남김 (학생 폰도 이걸 봄)
  }
}

/* ---------- 위쪽 막대 ---------- */
function drawClock() {
  const d = now();
  $('#hm').textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  $('#ss').textContent = String(d.getSeconds()).padStart(2, '0');
  $('#date').innerHTML = `<b>${d.getMonth() + 1}월 ${d.getDate()}일</b>${WEEKDAYS[d.getDay()]}요일`;
}
function drawTT() {
  const ph = S.phase, t = nowSec();
  const toS = (x) => { const [h, m] = x.split(':'); return h * 3600 + m * 60; };
  $('#tt').innerHTML = table().map((p, i) => {
    let c = '';
    if (ph.kind === 'class' && ph.cur === i) c = ph.pinned ? 'now pin' : 'now';
    else if (toS(p.end) <= t) c = 'past';
    else if ((ph.kind === 'break' || ph.kind === 'soon' || ph.kind === 'morning') && ph.next === i) c = 'next';
    return `<button class="p ${c}" data-pi="${i}" title="눌러서 ${esc(p.name)} 화면 보기"><small>${esc(p.name)} · ${esc(p.start)}</small><b>${esc(p.subject || p.name)}</b></button>`;
  }).join('') || '<span class="hint">오늘은 시간표가 없어요</span>';
  $$('#tt [data-pi]').forEach((b) => { b.onclick = () => pinTo(+b.dataset.pi, true); });
}
/** 위쪽 시간표의 교시를 누르면 그 교시 화면으로 (지난 과제를 이어서 체크) — 다시 누르면 지금 시간으로 */
function pinTo(pi, mine) {
  const live = getPhase(table(), nowSec());
  const isNow = live.kind === 'class' && live.cur === pi;
  const next = (pi === S.pin || isNow || pi == null) ? null : pi;
  if (next === S.pin) return;
  S.pin = next; S.pinLive = next == null ? '' : `${live.kind}:${live.cur ?? live.next ?? ''}`;
  if (next != null) toast(`${table()[pi].name} 화면이에요. 다시 누르거나 '지금 시간으로'를 누르면 돌아가요`, 3200);
  if (mine && !guest()) store.setLive(S.user.uid, { pin: { pi: next, date: S.dateKey, at: Date.now(), dev: DEV } }).catch(() => {});
  S.phaseKey = ''; tick();
}
function setLight(c, user) {
  S.cfg.light.state = c;
  $$('#miniLight i').forEach((i) => i.classList.toggle('on', i.classList.contains(c)));
  $$('.lights button').forEach((b) => b.classList.toggle('on', b.classList.contains(c)));
  if (user) saveCfg();
}
function drawBellSel() {
  const s = S.cfg.sound;
  $('#bellSel').innerHTML = [...BELLS.map((b) => b.name), ...s.custom.map((c) => c.name)].map((n, i) => `<option value="${i}" ${i === s.bell ? 'selected' : ''}>${esc(n)}</option>`).join('');
}

/* ---------- 로그인·저장 상태 ---------- */
function drawAcct() {
  const a = $('#acct');
  $('#guestbar').hidden = !guest();
  if (guest()) {
    a.innerHTML = `<span class="save guest"><span class="d"></span>게스트 모드</span><button class="loginbtn" data-a="login">선생님 로그인</button>`;
    a.querySelector('[data-a=login]').onclick = () => { localStorage.setItem('cb:intent', 'teacher'); location.hash = '#/role'; location.reload(); };
    return;
  }
  const st = S.saveState;
  const label = { ok: '저장됨', ing: '저장 중…', off: '인터넷 끊김 · 이 노트북에 보관 중', err: '저장 실패 · 다시 시도 중' }[st];
  const name = (S.user.name || S.user.email || '선생님').trim();
  a.innerHTML = `<span class="save ${st}"><span class="d"></span>${label}</span><button class="avatar" data-a="av" title="${esc(name)}">${esc(name[0])}</button>`;
  a.querySelector('[data-a=av]').onclick = (e) => {
    e.stopPropagation();
    const av = e.currentTarget, m = av.querySelector('.menu'); if (m) { m.remove(); return; }
    av.insertAdjacentHTML('beforeend', `<div class="menu"><div>Google 계정 · ${esc(S.user.email || '')}</div>
      <button data-m="set">${ic('gear')} 설정 (시간표·명단·소리${store.isAdminEmail(S.user.email) ? '·허용' : ''})</button>
      <button data-m="hist">${ic('history')} 지난 기록 보기</button>
      <button data-m="home">${ic('image')} 시작 화면으로</button>
      <button data-m="out">${ic('logout')} 로그아웃</button></div>`);
    const close = (ev) => { ev.stopPropagation(); av.querySelector('.menu').remove(); };
    av.querySelector('[data-m=set]').onclick = (ev) => { close(ev); openSettings('table'); };
    av.querySelector('[data-m=hist]').onclick = (ev) => { close(ev); openHistory(() => store.listDays(S.user.uid, semesterStart(now()))); };
    av.querySelector('[data-m=home]').onclick = (ev) => { close(ev); location.hash = '#/'; location.reload(); };
    av.querySelector('[data-m=out]').onclick = async (ev) => { close(ev); try { localStorage.removeItem('cb:cache'); } catch (er) { /* 무시 */ } await store.logout(); };
  };
}
document.addEventListener('click', () => { const m = $('.menu'); if (m) m.remove(); });

/* ---------- 가운데 수업 화면 ---------- */
const chips = (p) => `<div class="chips">${(p.items || []).map((b) => `<span class="chip">${esc(b)}</span>`).join('')}</div>`;

/** 판서를 쓸 수 있는 때: 수업·아침 시간·쉬는 시간·점심시간·곧 시작 */
const wbOK = () => ['class', 'soon', 'break', 'morning'].includes(S.phase.kind);
/** 판서 위쪽 줄: 과목과 준비물, 수업이 아닐 때는 남은 시간 */
function wbHead() {
  const ph = S.phase, T = table();
  const left = (label) => `<span class="wb-left"><small>${label}</small><b class="num" data-r="wbl">${mmss(ph.remain)}</b></span>`;
  if (ph.kind === 'class') {
    const p = T[ph.cur];
    return `<div class="subject">${esc(p.subject || p.name)}</div>${chips(p)}${isSpecial(p) && !ph.pinned ? left(`${esc(p.name)} 남은 시간`) : ''}`;
  }
  const p = T[ph.next] || {};
  const title = ph.kind === 'break' ? (ph.lunch ? '점심시간' : '쉬는 시간') : ph.kind === 'soon' ? `곧 ${esc(p.name)}` : '좋은 아침이에요';
  return `<div class="subject wb-ph ${ph.kind}">${title}</div>${left(`${esc(p.name)}${p.subject ? ' ' + esc(p.subject) : ''}까지`)}`;
}
const wbBtn = () => `<button class="wb-toggle ${S.wbOn ? 'on' : ''}" data-a="wb">${ic('pen')}판서</button>`;

function drawStage() {
  const ph = S.phase, st = $('#stage'), T = table();
  document.body.classList.toggle('is-break', ph.kind === 'break');
  $('#app').className = 'mode-' + (ph.kind === 'morning' ? 'class' : ph.kind) + (S.wbOn && wbOK() ? ' wb-on' : '');
  if (!wbOK() && S.wbOn) { S.wbOn = false; if (wbIsFull()) setWbFull(false); }
  if (S.wbOn) { // 판서 중: 판서 화면 (수업 중이면 위에 교시 띠)
    st.innerHTML = (ph.kind === 'class' ? band(T[ph.cur]) : '') + wbBtn();
    st.appendChild(getWB(wbHead())); bindWbBtn(st);
    requestAnimationFrame(() => { fitWB(); if (isPhone() && !wbIsFull()) setWbFull(true); else publishRatio(); });
    return;
  }
  let h = '';
  if (ph.kind === 'class') {
    const p = T[ph.cur];
    h = band(p) + wbBtn();
    if (isSpecial(p) && !ph.pinned) { // 아침 시간·점심시간: 남은 시간과 다음 수업
      const nx = T.map((x, i) => [x, i]).filter(([x]) => x.start >= p.end && !isSpecial(x)).sort((a, b) => a[0].start.localeCompare(b[0].start))[0];
      h += `<div class="stage-body"><div class="lesson special pop ${isLunch(p) ? 'lunch' : 'am'}"><div class="subject">${esc(p.subject || p.name)}</div>${chips(p)}
        <div class="sp-left"><span>남은 시간</span><b class="num" data-r="spl">${mmss(ph.remain)}</b>${nx ? `<em>다음: ${esc(nx[0].name)} ${esc(nx[0].subject)} · ${esc(nx[0].start)}</em>` : ''}</div></div></div>`;
    } else h += `<div class="stage-body"><div class="lesson pop"><div class="subject">${esc(p.subject || p.name)}</div>${chips(p)}</div></div>`;
  } else if (ph.kind === 'soon') {
    const p = T[ph.next];
    h = `<div class="band soon">${ic('bell')}곧 ${esc(p.name)}</div>${wbBtn()}<div class="stage-body"><div class="lesson pop"><div class="subject">${esc(p.subject || p.name)}</div>${chips(p)}</div></div>`;
  } else if (ph.kind === 'break') {
    const p = T[ph.next], tt = S.cfg.timerType;
    // 숫자만 고르면 큰 숫자 하나만 보여 줌 (글자·숫자·준비물이 겹치지 않게 세로로 쌓음)
    h = `${wbBtn()}<div class="stage-body"><div class="brk pop t-${tt}">
        ${tt === 'num' ? '' : `<div class="timer-vis">${timerSvg(tt, ph.remain / ph.total)}</div>`}
        <div class="brk-info"><div class="brk-title">${ph.lunch ? '점심시간' : '쉬는 시간'}</div>
          <div class="brk-time num" data-r="bt">${mmss(ph.remain)}</div>
          <div class="next"><h3>곧 ${esc(p.name)} ${esc(p.subject)}</h3>${chips(p)}</div></div></div></div>`;
  } else if (ph.kind === 'morning') {
    const p = T[ph.next];
    h = `${wbBtn()}<div class="stage-body"><div class="morning pop"><div class="hello">좋은 아침이에요!</div><div class="first">${esc(p.name)} ${esc(p.subject)}</div><div class="hint">${esc(p.start)} 시작</div>${chips(p)}</div></div>`;
  } else if (ph.kind === 'end') {
    // 별 다섯 개가 차례로 반짝이고, 둘레에 작은 반짝이
    h = `<div class="stage-body"><div class="done pop"><div class="stars">${[0, 1, 2, 3, 4].map((i) => `<span class="star s${i}">${ic('star')}</span>`).join('')}</div>
      <div class="sparkles">${Array.from({ length: 10 }, (_, i) => `<i style="--x:${(i * 37 + 7) % 100}%;--y:${(i * 53 + 11) % 100}%;--d:${(i * 0.37) % 2.4}s"></i>`).join('')}</div>
      <div class="t">오늘 수업 끝!</div></div></div>`;
  } else {
    h = `<div class="stage-body"><div class="none pop"><div class="t">오늘은 수업이 없어요</div><p class="hint" style="text-align:center">시간표는 위젯 바의 '설정'에서 바꿀 수 있어요${guest() ? ' · 확인용 \'시간 이동\'으로 평일 화면을 볼 수 있어요' : ''}</p></div></div>`;
  }
  st.innerHTML = h;
  bindWbBtn(st);
  const up = st.querySelector('[data-a=unpin]'); if (up) up.onclick = () => pinTo(null, true);
}
/** 교시 띠: 다시 보는 교시면 '지금 시간으로' 버튼 */
const band = (p) => `<div class="band ${S.phase.pinned ? 'pinned' : ''}">${esc(p.name)}${S.phase.pinned ? `<span class="pin-tag">다시 보는 중</span><button class="unpin" data-a="unpin">${ic('clock')}지금 시간으로</button>` : ''}</div>`;
function bindWbBtn(st) {
  const wbb = st.querySelector('[data-a=wb]'); if (!wbb) return;
  wbb.onclick = () => setWbOn(!S.wbOn, true);
}
function setWbOn(on, mine) {
  if (on === S.wbOn) return;
  S.wbOn = on;
  if (S.wbOn && !S.cfg.tasksClosed && !isPhone()) { S.cfg.tasksClosed = true; drawTasks(); }
  if (!S.wbOn && wbIsFull()) setWbFull(false);
  drawStage();
  // 휴대폰에서 판서를 켜면 TV는 판서를 크게 띄움 (휴대폰 판서가 TV에 넓게 보이도록)
  if (mine && !guest()) store.setLive(S.user.uid, { wb: { on, full: isPhone(), at: Date.now(), dev: DEV } }).catch(() => {});
}
// 휴대폰에서는 판서를 화면 가득 띄우고, '판서 닫기'를 누르면 판서를 끔
onWbFull((on) => { if (!on && isPhone() && S.wbOn) setWbOn(false, true); if (on || !isPhone()) publishRatio(); });
function tickBreak() {
  const ph = S.phase; if (ph.kind !== 'break') return;
  const tv = $('#stage [data-r=tv]');
  if (tv) tv.outerHTML = timerSvg(S.cfg.timerType, ph.remain / ph.total);
  const bt = $('#stage [data-r=bt]'); if (bt) bt.textContent = mmss(ph.remain);
}

/* ---------- 과제 현황 ---------- */
/** 지금 보여 줄 과제의 칸: 수업 중이면 그 교시, 첫 칸(아침 시간) 전이면 아침 시간 과제 */
function taskPi() {
  const ph = S.phase;
  if (ph.kind === 'class') return ph.cur;
  if ((ph.kind === 'morning' || ph.kind === 'soon') && isSpecial(table()[ph.next])) return ph.next;
  return null;
}
function tasksVisible() {
  const ph = S.phase;
  if (!S.cfg.showTasks || !S.day) return false;
  if (taskPi() != null) return tasksOf(table()[taskPi()]).length > 0;
  if (ph.kind === 'end') return table().some((p) => tasksOf(p).length);
  return false;
}
/** 순서대로 과제의 정류장 보기. 수업 끝이면 오늘 과제를 한 줄로 */
function lineView() {
  const ph = S.phase, T = table();
  if (ph.kind === 'end') {
    const st = []; T.forEach((p, pi) => tasksOf(p).forEach((t) => st.push({ label: t, p: p.name, pi })));
    const last = st.length;
    const pos = (k) => { let off = 0; for (let pi = 0; pi < T.length; pi++) { const n = tasksOf(T[pi]).length; const v = posOf(markOf(k), pi); if (v < n) return off + v; off += n; } return last; };
    return {
      day: true, title: '오늘 과제', stations: [...st, { label: '완료' }], last, pos,
      fwd(k) { for (let pi = 0; pi < T.length; pi++) { const n = tasksOf(T[pi]).length; const v = posOf(markOf(k), pi); if (v < n) { setMark(k, withPos(markOf(k), pi, v + 1)); return true; } } return false; },
      back(k) { const g = pos(k); if (!g) return false; const t = g - 1; let off = 0; for (let pi = 0; pi < T.length; pi++) { const n = tasksOf(T[pi]).length; if (t < off + n) { setMark(k, withPos(markOf(k), pi, t - off)); return true; } off += n; } return false; },
    };
  }
  const pi = taskPi(), p = T[pi], last = tasksOf(p).length;
  return {
    title: `${p.name} 과제`, stations: [...tasksOf(p).map((t) => ({ label: t })), { label: '완료' }], last, pos: (k) => Math.min(posOf(markOf(k), pi), last),
    fwd(k) { const v = posOf(markOf(k), pi); if (v < last) { setMark(k, withPos(markOf(k), pi, v + 1)); return true; } return false; },
    back(k) { const v = posOf(markOf(k), pi); if (v > 0) { setMark(k, withPos(markOf(k), pi, v - 1)); return true; } return false; },
  };
}
function rects() { const m = {}; $$('#tasks .tag').forEach((t) => { m[t.dataset.k] = t.getBoundingClientRect(); }); return m; }
function flip(before) {
  $$('#tasks .tag').forEach((t) => {
    const b = before[t.dataset.k]; if (!b) return;
    const a = t.getBoundingClientRect(), dx = b.left - a.left, dy = b.top - a.top;
    if (dx || dy) t.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.34,1.3,.64,1)' });
  });
}
const phoneDot = (k) => (S.seats[String(k + 1)] ? ' ph' : '');
let lastDoneAll = false;

function drawTasks(animate) {
  const el = $('#tasks');
  $$('.w[data-w=tasks]').forEach((b) => b.classList.toggle('on', S.cfg.showTasks));
  if (!tasksVisible()) { el.style.display = 'none'; if (S.tasksFull) setTasksFull(false); return; }
  el.style.display = '';
  const ph = S.phase, T = table(), names = roster();
  const tpi = taskPi(), periods = ph.kind === 'end' ? T.map((p, pi) => [p, pi]).filter(([p]) => tasksOf(p).length) : [[T[tpi], tpi]];
  const useGrid = periods.some(([p]) => isPick(p));
  const doneAll = (k) => periods.every(([p, pi]) => isDone(p, markOf(k), pi));
  const done = names.filter((n, k) => n && doneAll(k)).length, total = names.filter((n) => n).length; // 명단 빈 번호는 빼고 셈
  const title = ph.kind === 'end' ? '오늘 과제' : `${T[tpi].name} 과제${isPick(T[tpi]) ? ` · 골라서 ${needOf(T[tpi])}개` : ''}`;
  const before = animate && !useGrid ? rects() : null;
  el.classList.toggle('closed', S.cfg.tasksClosed && !S.tasksFull);
  el.classList.toggle('full', S.tasksFull);
  let body;
  if (useGrid) {
    // 골라서 하는 과제: 학생 × 과제 표, 칸을 눌러 체크
    body = `<div class="tgrid"><table><thead>${ph.kind === 'end' ? `<tr><th></th>${periods.map(([p]) => `<th colspan="${tasksOf(p).length}" class="pg">${esc(p.name)} ${esc(p.subject)}${isPick(p) ? ` · ${needOf(p)}개` : ''}</th>`).join('')}<th></th></tr>` : ''}
      <tr><th class="nm">학생</th>${periods.map(([p]) => tasksOf(p).map((t) => `<th>${esc(t)}</th>`).join('')).join('')}<th>완료</th></tr></thead><tbody>
      ${names.map((n, k) => (!n ? '' : `<tr class="${doneAll(k) ? 'ok' : ''}"><td class="nm"><span class="tag${phoneDot(k)}"><small>${k + 1}</small>${esc(n)}</span></td>
        ${periods.map(([p, pi]) => tasksOf(p).map((_, ti) => `<td><button class="ck ${isChecked(p, markOf(k), pi, ti) ? 'on' : ''}" data-k="${k}" data-pi="${pi}" data-ti="${ti}" aria-label="${esc(n)} ${ti + 1}번 과제">${ic('flag')}</button></td>`).join('')).join('')}
        <td class="fin">${doneAll(k) ? '완료' : ''}</td></tr>`)).join('')}</tbody></table></div>`;
  } else {
    const V = lineView(), last = V.last, P = names.map((_, k) => V.pos(k));
    body = `<div class="track ${V.day ? 'day' : ''}">
      ${V.stations.map((s, i) => `<div class="st ${i === last ? 'fin' : ''} ${V.day && s.p && (i === 0 || V.stations[i - 1].pi !== s.pi) ? 'pstart' : ''}">
        <div class="mark">${i === last ? ic('flag') : i + 1}</div><div class="lbl">${s.p ? `<small class="pt">${esc(s.p)}</small>` : ''}${esc(s.label)}</div>
        <div class="tags">${names.map((n, k) => (n && P[k] === i ? `<span class="tag${phoneDot(k)}" data-k="${k}"><small>${k + 1}</small>${esc(n)}</span>` : '')).join('')}</div>
      </div>`).join('')}</div>`;
    el._V = V;
  }
  el.innerHTML = `
    <div class="tasks-head" data-a="th">
      <h2>${esc(title)}</h2><span class="cnt num">${done}/${total}</span>
      <span class="sp"></span>
      <button class="reset" data-a="full">${ic('full')}${S.tasksFull ? '원래 크기' : '크게 보기'}</button>
      <button class="reset" data-a="reset">${ic('reset')}${ph.kind === 'end' ? '오늘 과제 현황 초기화' : '이 과제 현황 초기화'}</button>
      ${S.tasksFull ? '' : '<svg class="i chev"><use href="#i-chev"/></svg>'}
    </div>
    <div class="prog" style="${S.cfg.tasksClosed && !S.tasksFull ? '' : 'display:none'}"><i style="width:${total ? done / total * 100 : 0}%"></i></div>
    <div class="tasks-body"><div>${body}</div></div>`;
  el.querySelector('[data-a=th]').onclick = (e) => {
    if (e.target.closest('button') || S.tasksFull) return;
    S.cfg.tasksClosed = !S.cfg.tasksClosed; el.classList.toggle('closed', S.cfg.tasksClosed);
    el.querySelector('.prog').style.display = S.cfg.tasksClosed ? '' : 'none'; saveCfg();
  };
  el.querySelector('[data-a=full]').onclick = (e) => { e.stopPropagation(); setTasksFull(!S.tasksFull); };
  el.querySelector('[data-a=reset]').onclick = async (e) => {
    e.stopPropagation();
    if (!(await confirmBox('과제 현황을 초기화할까요?', '모든 학생의 체크가 처음으로 돌아가요.', '초기화'))) return;
    names.forEach((n, k) => { if (!n) return; let m = markOf(k); periods.forEach(([, pi]) => { m = withReset(m, pi); }); setMark(k, m); });
    drawTasks(true);
  };
  if (useGrid) {
    el.querySelectorAll('.ck').forEach((b) => {
      b.onclick = () => {
        const k = +b.dataset.k, pi = +b.dataset.pi, ti = +b.dataset.ti, p = T[pi], m = markOf(k);
        if (isPick(p)) setMark(k, withToggle(m, pi, ti));
        else setMark(k, withPos(m, pi, isChecked(p, m, pi, ti) ? ti : ti + 1));
        fx('move', !isChecked(p, m, pi, ti)); drawTasks(true);
      };
    });
  } else {
    el.querySelectorAll('.tag').forEach((t) => {
      let timer, long = false;
      t.onpointerdown = () => { long = false; timer = setTimeout(() => { long = true; move(+t.dataset.k, -1); }, 550); };
      t.onpointerup = () => { clearTimeout(timer); if (!long) move(+t.dataset.k, 1); };
      t.onpointerleave = () => clearTimeout(timer);
    });
  }
  if (before) flip(before);
  const all = total && done === total;
  if (animate && all && !lastDoneAll) { confetti(); fx('celebrate'); }
  lastDoneAll = !!all;
}
function move(k, dir) {
  const V = $('#tasks')._V; if (!V || !(dir > 0 ? V.fwd(k) : V.back(k))) return;
  fx('move', dir > 0); drawTasks(true);
}
function setTasksFull(on) {
  S.tasksFull = on;
  document.body.classList.toggle('tasks-full', on);
  if (on && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
  if (!on && document.fullscreenElement && !wbIsFull()) document.exitFullscreen().catch(() => {});
  drawTasks();
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.tasksFull) setTasksFull(false); });
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && S.tasksFull) setTasksFull(false); });

/* ---------- 시간 흐름 ---------- */
function tick() {
  drawClock();
  if (S.day && ymd(now()) !== S.dateKey) { loadToday().then(applyAll); return; }
  if (!S.day) return;
  const prev = S.phase;
  const live = getPhase(table(), nowSec()), liveKey = `${live.kind}:${live.cur ?? live.next ?? ''}`;
  // 다시 보던 교시는 시간대가 바뀌면(종이 울리면) 저절로 지금 시간으로 돌아옴
  if (S.pin != null && (!table()[S.pin] || (S.pinLive && S.pinLive !== liveKey))) { S.pin = null; S.pinLive = ''; toast('시간이 바뀌어서 지금 시간 화면으로 돌아왔어요'); }
  S.phase = S.pin != null ? { kind: 'class', cur: S.pin, pinned: true } : live;
  const key = `${S.phase.kind}:${S.phase.cur ?? S.phase.next ?? ''}:${S.pin ?? ''}`;
  if (key !== S.phaseKey) {
    const first = !S.phaseKey;
    S.phaseKey = key;
    const tp = table()[S.phase.cur ?? S.phase.next];
    if (!first && S.cfg.sound.on && S.cfg.sound.auto && !S.jumping && !S.phase.pinned && !prev.pinned) {
      if (S.phase.kind === 'class' && isLunch(tp)) FX.breakStart();      // 점심시간 시작: 쉬는 시간 소리
      else if (S.phase.kind === 'class' && !isMorning(tp)) FX.classStart(); // 아침 시간이 시작될 때는 종을 울리지 않음 (등교 시간)
      else if (S.phase.kind === 'soon' && !isSpecial(tp)) FX.soon();
      else if (S.phase.kind === 'break' && prev.kind === 'class') FX.breakStart();
    }
    // 오늘 수업이 끝나면 꽃가루 (시간 이동으로 미리 볼 때도 보여 줌, 소리는 실제 시간일 때만)
    if (S.ticked && S.phase.kind === 'end' && prev.kind && prev.kind !== 'end' && !prev.pinned) { confetti(); if (soundOn() && !S.jumping) FX.celebrate(); }
    drawStage(); drawTasks(); drawTT();
  } else {
    if (S.phase.kind === 'break') tickBreak();
    if (S.wbOn) { const l = document.querySelector('[data-r=wbl]'); if (l) l.textContent = mmss(S.phase.remain); }
    const sl = document.querySelector('#stage [data-r=spl]'); if (sl) sl.textContent = mmss(S.phase.remain);
  }
  S.ticked = true;
  if (S.phase.kind !== prev.kind || (S.phase.cur ?? -1) !== (prev.cur ?? -1)) drawDbg();
  if (!$('#dbg').hidden) { const n = $('#dbg [data-r=now]'); if (n) n.textContent = nowLabel(); }
}

function applyAll() {
  setVolume(S.cfg.sound.volume);
  applyTheme(); applyBg(); drawBellSel(); setLight(S.cfg.light.state, false); drawAcct(); drawBar();
  S.phaseKey = ''; tick();
}

/* ---------- 위젯 바 ---------- */
function drawBar() {
  const s = $('.w[data-w=sound]'); s.innerHTML = `${ic(soundOn() ? 'sound' : 'mute')}<span>소리 ${soundOn() ? '켬' : '끔'}</span>`;
  const w = $('.w[data-w=wake]'); w.classList.toggle('wake-on', !!S.cfg.wakeLock); w.querySelector('span').textContent = S.cfg.wakeLock ? '화면 켜둠' : '화면 켜두기';
  $('#wbar').classList.toggle('mini', !!S.cfg.barMini);
  $('#foldBar').style.transform = S.cfg.barMini ? 'rotate(180deg)' : '';
  $$('.w[data-w=tasks]').forEach((b) => b.classList.toggle('on', S.cfg.showTasks));
  const n = unreadCount(); const mb = $('.w[data-w=msg]');
  mb.querySelector('.badge').textContent = n; mb.querySelector('.badge').hidden = !n;
}
const actions = {
  bg: openBg, pick: openPick, noise: openNoise, light: openLight, timer: openTimer,
  tasks: () => { S.cfg.showTasks = !S.cfg.showTasks; saveCfg(); drawTasks(); drawBar(); if (S.cfg.showTasks && !tasksVisible()) toast('과제 현황은 수업 중과 모든 수업이 끝난 뒤에 보여요'); },
  students: openStudents, msg: openMessages,
  set: () => openSettings('table'),
  sound: () => { S.cfg.sound.on = !S.cfg.sound.on; saveCfg(); drawBar(); },
  wake: () => { S.cfg.wakeLock = !S.cfg.wakeLock; saveCfg(); drawBar(); wake(); },
  full: () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else document.documentElement.requestFullscreen().catch(() => toast('이 브라우저는 전체 화면을 지원하지 않아요')); wake(); },
};

/* 화면 꺼짐 방지 */
let lock = null;
async function wake() {
  try {
    if (S.cfg.wakeLock && 'wakeLock' in navigator && document.visibilityState === 'visible' && !lock) {
      lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; });
    } else if (!S.cfg.wakeLock && lock) { await lock.release(); lock = null; }
  } catch (e) { /* 지원 안 함 / 배터리 절약 */ }
}

/* ---------- 시간 이동 (확인용) ---------- */
function nowLabel() { const d = now(); return `${d.getMonth() + 1}/${d.getDate()} ${d.toTimeString().slice(0, 8)}${S.offset ? ' (이동한 시간)' : ''}`; }
function drawDbg() {
  const el = $('#dbg'); if (el.hidden) return;
  const J = jumpGroups(table()), hm = `${String(now().getHours()).padStart(2, '0')}:${String(now().getMinutes()).padStart(2, '0')}`;
  el.innerHTML = `<button class="x" data-a="x">✕</button><h4>시간 이동 <em>확인용</em></h4>
    <div class="now" data-r="now">${nowLabel()}</div>
    <div class="shift"><button class="o" data-s="-86400">-1일</button><button class="o" data-s="86400">+1일</button></div>
    <div class="shift"><button class="o" data-s="-600">-10분</button><button class="o" data-s="-60">-1분</button><button class="o" data-s="60">+1분</button><button class="o" data-s="600">+10분</button></div>
    <div class="shift go-time"><input type="time" data-r="tm" value="${hm}" aria-label="이동할 시각"><button class="o" data-a="gotm">이 시각으로</button></div>
    <div class="lab">시간표의 모든 시각으로 바로 가기</div>
    <div class="jgroups">${J.groups.map((g) => `<div class="jg"><div class="jn"><b>${esc(g.name)}</b><span>${esc(g.sub)} · ${esc(g.time)}</span></div>
      <div class="ji">${g.items.map(([l, sec]) => `<button class="o" data-j="${sec}">${l}</button>`).join('')}</div></div>`).join('') || '<span class="lab">오늘 시간표가 없어요</span>'}
      ${J.extra.length ? `<div class="ji">${J.extra.map(([l, sec]) => `<button class="o" data-j="${sec}">${l}</button>`).join('')}</div>` : ''}</div>
    <div class="lab">쉬는 시간 타이머 모양</div>
    <div class="g" style="grid-template-columns:1fr 1fr 1fr">${[['hour', '모래시계'], ['pie', '부채꼴'], ['num', '숫자만']].map(([k, n]) => `<button class="o ${S.cfg.timerType === k ? 'sel' : ''}" data-t="${k}">${n}</button>`).join('')}</div>
    <button class="o" data-a="real" style="width:100%">실제 시간으로 돌아가기</button>`;
  el.querySelector('[data-a=x]').onclick = () => { el.hidden = true; };
  const jump = (fn) => { S.jumping = true; S.pin = null; S.pinLive = ''; fn(); S.phaseKey = ''; tick(); S.jumping = false; drawDbg(); };
  el.querySelectorAll('[data-s]').forEach((b) => { b.onclick = () => jump(() => { S.offset += +b.dataset.s; }); });
  el.querySelectorAll('[data-j]').forEach((b) => { b.onclick = () => jump(() => { S.offset += +b.dataset.j - nowSec(); }); });
  el.querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => { S.cfg.timerType = b.dataset.t; saveCfg(); drawStage(); drawDbg(); }; });
  el.querySelector('[data-a=real]').onclick = () => jump(() => { S.offset = 0; });
  el.querySelector('[data-a=gotm]').onclick = () => { const v = el.querySelector('[data-r=tm]').value; if (!v) return; const [hh, mi] = v.split(':').map(Number); jump(() => { S.offset += hh * 3600 + mi * 60 - nowSec(); }); };
}

/* ---------- 같은 계정 여러 화면 연동 (TV ↔ 휴대폰) ---------- */
const DEV = Math.random().toString(36).slice(2, 10); // 이 화면의 이름표
const LIVE = { lastCfg: '', started: Date.now(), put: new Map(), del: new Set(), wbList: [] };
/** 키 순서와 상관없이 같은 내용이면 같은 글자 */
function stable(o) {
  if (Array.isArray(o)) return '[' + o.map(stable).join(',') + ']';
  if (o && typeof o === 'object') return '{' + Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => JSON.stringify(k) + ':' + stable(o[k])).join(',') + '}';
  return JSON.stringify(o);
}
function ringNow(i) {
  const b = $('#bellBtn'); b.classList.remove('ring'); void b.offsetWidth; b.classList.add('ring');
  ringBell(i ?? S.cfg.sound.bell, S.cfg.sound.custom); // 소리 끔 상태에서도 울림
}
/** 큰 화면(휴대폰이 아닌 화면)의 판서 비율을 알려 줌: 휴대폰에 'TV 화면 끝' 선 */
let lastAr = 0;
function publishRatio() {
  if (guest() || isPhone()) return;
  const ar = myRatio(); if (!ar || Math.abs(ar - lastAr) < 0.02) return;
  lastAr = ar; store.setLive(S.user.uid, { scr: { ar: Math.round(ar * 1000) / 1000, at: Date.now() } }).catch(() => {});
}
addEventListener('resize', () => { clearTimeout(publishRatio.t); publishRatio.t = setTimeout(publishRatio, 800); });

function startLive() {
  const uid = S.user.uid;
  // 1) 설정 (시간표·명단·신호등·소리…): 다른 화면에서 바꾸면 여기도 바뀜
  store.watchConfig(uid, (c) => {
    if (!c || store.isPending('config')) return;
    const st = stable(c); if (st === LIVE.lastCfg || st === stable(S.cfg)) { LIVE.lastCfg = st; return; }
    LIVE.lastCfg = st;
    S.cfg = normalizeConfig(c);
    if (S.day && !S.day.custom) S.day.table = clone(S.cfg.weekTables[now().getDay()] || []);
    applyAll(); drawTasks();
  }, () => {});
  // 2) 집중 종 · 판서 켜기 · 타이머 · 큰 화면 비율
  let seen = {};
  store.watchLive(uid, (d) => {
    if (!d) return;
    const fresh = (k) => d[k] && d[k].at !== seen[k] && d[k].dev !== DEV && (seen[k] = d[k].at, true);
    if (d.bell && fresh('bell') && Date.now() - d.bell.at < 15000 && d.bell.at > LIVE.started - 1000) ringNow(d.bell.i);
    if (d.wb && fresh('wb')) { setWbOn(!!d.wb.on, false); if (d.wb.on && d.wb.full && !isPhone()) requestAnimationFrame(() => setWbFull(true)); }
    if (d.timer && d.timer.dev !== DEV && d.timer.v !== seen.timer) { seen.timer = d.timer.v; if (d.timer.v > LIVE.started - 1000 || d.timer.running) applyRemoteTimer(d.timer); }
    if (d.scr) setTvRatio(d.scr.ar);
    if (d.pin && fresh('pin') && d.pin.date === S.dateKey && Date.now() - d.pin.at < 10 * 60 * 1000) { if (d.pin.pi == null) { if (S.pin != null) pinTo(null, false); } else if (S.pin !== d.pin.pi) pinTo(d.pin.pi, false); }
  }, () => {});
  // 3) 판서 선·글자
  setWbSync({
    put: (item) => { const v = Date.now(); item.v = v; item.dev = DEV; LIVE.put.set(item.id, v); store.putWb(uid, item).catch(() => LIVE.put.delete(item.id)); },
    del: (id) => { LIVE.del.add(id); LIVE.put.delete(id); store.delWb(uid, id).catch(() => {}); },
    clear: () => { LIVE.wbList.forEach((x) => LIVE.del.add(x.id)); LIVE.put.clear(); store.clearWb(uid).catch(() => {}); },
  });
  store.watchWb(uid, (rows) => {
    const ids = new Set(rows.map((r) => r.id));
    [...LIVE.del].forEach((id) => { if (!ids.has(id)) LIVE.del.delete(id); });
    rows.forEach((r) => { const v = LIVE.put.get(r.id); if (v && (r.v || 0) >= v) LIVE.put.delete(r.id); });
    LIVE.wbList = rows.filter((r) => !LIVE.del.has(r.id));
    applyRemote(LIVE.wbList, new Set(LIVE.put.keys()));
  }, () => {});
  // 어제까지의 판서는 지움 (판서는 그날만 연동용으로 잠깐 저장)
  const today0 = new Date(now()); today0.setHours(0, 0, 0, 0);
  store.clearWb(uid, today0.getTime()).catch(() => {});
  // 학급 코드에 명단 이름(지문) 맞추기
  syncNames();
}

/* ---------- 시작 ---------- */
function readCache() { try { return JSON.parse(localStorage.getItem('cb:cache') || 'null'); } catch (e) { return null; } }

/** user: 허용된 선생님 계정, null이면 게스트 모드 */
export async function startBoard(user) {
  document.body.dataset.view = 'board';
  S.user = user;
  if (user) {
    let cfg = null;
    try { cfg = await store.loadConfig(user.uid); } catch (e) { const c = readCache(); cfg = c && c.uid === user.uid ? c.cfg : null; }
    const first = !cfg;
    S.cfg = normalizeConfig(cfg);
    if (first) { saveCfg(); toast('처음 로그인했어요. 예시 시간표로 시작해요. 위젯 바의 \'설정\'에서 바꿔 주세요', 4500); }
    if (S.cfg.bg.kind === 'photo') { try { S.bgImage = await store.loadBgImage(user.uid); } catch (e) { S.bgImage = null; } }
    store.purgeBefore(user.uid, semesterStart(now())).catch(() => {});
  } else {
    S.cfg = sampleConfig();
    try { localStorage.removeItem('cb:cache'); } catch (e) { /* 무시 */ }
  }
  // 위젯·설정·학생 창 연결
  setWinStore((k) => S.cfg.wins[k], (k, v) => { S.cfg.wins[k] = v; if (!guest()) saveCfg(); });
  initWidgets({
    cfg: () => S.cfg, save: () => { if (!guest()) saveCfg(); }, soundOn, roster, setLight,
    timerSync: (t) => { if (!guest()) store.setLive(S.user.uid, { timer: { ...t, dev: DEV } }).catch(() => {}); },
    bgImage: () => S.bgImage,
    setBgImage: (d) => { S.bgImage = d; if (!guest()) store.saveBgImage(S.user.uid, d); },
  });
  initSettings({
    cfg: () => S.cfg, day: () => S.day, todayWd: () => now().getDay(), guest,
    isAdmin: () => !!S.user && store.isAdminEmail(S.user.email),
    loadAllow: store.loadAllow, saveAllow: store.saveAllow, listRequests: store.listRequests,
    approveRequest: store.approveRequest, denyRequest: store.denyRequest,
    saveCfg, saveDay, applyAll, rosterChanged: syncNames,
    resetAll: async () => {
      if (!guest()) { try { await store.deleteConfig(S.user.uid); } catch (e) { /* 무시 */ } }
      const keep = S.cfg.classCode;
      S.cfg = sampleConfig(); S.cfg.classCode = keep; S.bgImage = null;
      ['bg', 'pick', 'noise', 'light', 'timer'].forEach(closeWin);
      saveCfg();
      S.day.table = clone(S.cfg.weekTables[now().getDay()] || []); S.day.custom = false; saveDay();
      applyAll();
    },
  });
  initClassroom({
    user: () => S.user, cfg: () => S.cfg, saveCfg, roster, soundOn,
    onChange: () => { drawBar(); drawTasks(); },
  });
  // 판서를 크게 볼 때도 판서 위쪽 막대에서 위젯을 바로 열 수 있게
  setWbWidgets([['clock', '타이머', openTimer], ['dice', '이름 뽑기', openPick], ['mic', '소음', openNoise], ['light', '신호등', openLight]]);
  if (user) {
    onSeats((seats) => { S.seats = seats; drawTasks(); });
    onMsgs(() => drawBar());
  }

  $$('#wbar .w[data-w]').forEach((b) => { b.onclick = () => actions[b.dataset.w](); });
  $('#foldBar').onclick = () => { S.cfg.barMini = !S.cfg.barMini; saveCfg(); drawBar(); };
  // 휴대폰: 위젯 바는 자주 쓰는 4개 + '더보기'
  $('#moreBar').onclick = () => { const o = $('#wbar').classList.toggle('open'); $('#moreBar span').textContent = o ? '접기' : '더보기'; };
  $$('#wbar .w[data-w]').forEach((b) => b.addEventListener('click', () => { if (isPhone() && b.dataset.w !== 'sound' && b.dataset.w !== 'wake') { $('#wbar').classList.remove('open'); $('#moreBar span').textContent = '더보기'; } }));
  $('#bellBtn').onclick = () => {
    ringNow();
    if (!guest()) store.setLive(S.user.uid, { bell: { at: Date.now(), i: S.cfg.sound.bell, dev: DEV } }).catch(() => {}); // 다른 화면(TV)도 울림
  };
  $('#bellSel').onchange = () => { S.cfg.sound.bell = +$('#bellSel').value; saveCfg(); };
  $('#timeMoveBtn').onclick = () => { const el = $('#dbg'); el.hidden = !el.hidden; drawDbg(); };
  // 브라우저는 첫 클릭 전에는 소리를 막아서, 첫 클릭 때 소리 장치와 화면 켜두기를 준비
  document.addEventListener('pointerdown', () => { unlockAudio(); wake(); }, { once: true });
  document.addEventListener('visibilitychange', wake);

  drawClock();
  await loadToday();
  applyAll();
  setInterval(tick, 1000);
  if (user) startLive();
  if (!user) toast('게스트 모드예요. 모든 기능을 써 볼 수 있지만 저장은 되지 않아요', 4000);
}
