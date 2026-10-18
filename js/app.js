// 우리 반 교실 보드: 화면 전체를 움직이는 중심 코드
import { $, $$, ic, esc, toast, confetti, setWinStore, closeWin } from './ui.js';
import { WEEKDAYS, sampleConfig, normalizeConfig, clone, ymd, semesterStart, getPhase, jumpTargets, mmss } from './data.js';
import { BELLS, ringBell, FX, setVolume, unlockAudio } from './sound.js';
import * as store from './store.js';
import { getWB, fitWB, setWbFull, wbIsFull } from './whiteboard.js';
import { initWidgets, applyBg, openBg, openPick, openNoise, openLight } from './widgets.js';
import { initSettings, openSettings } from './settings.js';
import { openHistory } from './history.js';

/* ---------- 상태 ---------- */
const S = {
  user: null,          // 로그인한 선생님 (Firebase)
  authKnown: false,    // 로그인 여부 확인 끝
  fbFailed: false,     // Firebase를 못 불러옴 (학교망 차단 등)
  cfg: sampleConfig(), // 설정 (시간표·명단·소리·배경…)
  day: null,           // 오늘 기록 { table, progress, roster, custom }
  dateKey: null,
  bgImage: null,
  offset: 0,           // 시간 이동(확인용) 초
  phaseKey: '',
  phase: { kind: 'none' },
  wbOn: false,
  saveState: 'ok',
  guestWarned: false,
};
const guest = () => !S.user;
const now = () => new Date(Date.now() + S.offset * 1000);
const nowSec = () => { const d = now(); return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(); };
const table = () => (S.day ? S.day.table : []) || [];
const roster = () => S.cfg.roster || [];
const soundOn = () => !!S.cfg.sound.on;
const fx = (name, ...a) => { if (soundOn()) FX[name](...a); };

/* ---------- 저장 ---------- */
function warnGuest() { if (!S.guestWarned) { S.guestWarned = true; toast('게스트 모드라서 바꾼 내용은 저장되지 않아요. 저장하려면 오른쪽 위에서 로그인해 주세요'); } }
function saveCfg() {
  if (guest()) { warnGuest(); return; }
  try { localStorage.setItem('cb:cache', JSON.stringify({ uid: S.user.uid, cfg: S.cfg })); } catch (e) { /* 저장 공간 막힘 */ }
  store.saveConfig(S.user.uid, S.cfg);
}
function saveDay() {
  if (guest() || !S.day) { if (guest()) warnGuest(); return; }
  if (!S.day.table.length) return; // 수업 없는 날은 기록하지 않음
  S.day.roster = [...roster()];
  store.saveDay(S.user.uid, S.dateKey, S.day);
}
store.onStatus((st) => { S.saveState = st; drawAcct(); });

/* ---------- 오늘 기록 불러오기 ---------- */
async function loadToday() {
  const d = now(); const key = ymd(d); const wd = d.getDay();
  S.dateKey = key;
  let day = null;
  if (!guest()) { try { day = await store.loadDay(S.user.uid, key); } catch (e) { /* 오프라인: 아래에서 새로 만듦 */ } }
  if (!day) day = { table: clone(S.cfg.weekTables[wd] || []), progress: {}, custom: false };
  day.progress = day.progress || {};
  S.day = day;
  S.phaseKey = '';
  if (!guest() && day.table.length) saveDay(); // 오늘 시간표를 그날 기록으로 남김
}

function prog(pi) {
  const n = roster().length;
  const a = S.day.progress[pi] = S.day.progress[pi] || [];
  while (a.length < n) a.push(0);
  return a;
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
    if (ph.kind === 'class' && ph.cur === i) c = 'now';
    else if (toS(p.end) <= t) c = 'past';
    else if ((ph.kind === 'break' || ph.kind === 'soon' || ph.kind === 'morning') && ph.next === i) c = 'next';
    return `<div class="p ${c}"><small>${esc(p.name)} · ${esc(p.start)}</small><b>${esc(p.subject || p.name)}</b></div>`;
  }).join('') || '<span class="hint">오늘은 시간표가 없어요</span>';
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
  $('#guestbar').hidden = !(S.authKnown && guest());
  if (!S.authKnown) { a.innerHTML = '<span class="save ing"><span class="d"></span>확인 중…</span>'; return; }
  if (guest()) {
    a.innerHTML = `<span class="save guest"><span class="d"></span>게스트 모드</span><button class="loginbtn" data-a="login">선생님 로그인</button>`;
    a.querySelector('[data-a=login]').onclick = doLogin;
    return;
  }
  const st = S.fbFailed ? 'off' : S.saveState;
  const label = { ok: '저장됨', ing: '저장 중…', off: '인터넷 끊김 · 이 노트북에 보관 중', err: '저장 실패 · 다시 시도 중' }[st];
  const name = (S.user.displayName || S.user.email || '선생님').trim();
  a.innerHTML = `<span class="save ${st}"><span class="d"></span>${label}</span><button class="avatar" data-a="av" title="${esc(name)}">${esc(name[0])}</button>`;
  a.querySelector('[data-a=av]').onclick = (e) => {
    e.stopPropagation();
    const av = e.currentTarget, m = av.querySelector('.menu'); if (m) { m.remove(); return; }
    av.insertAdjacentHTML('beforeend', `<div class="menu"><div>Google 계정 · ${esc(S.user.email || '')}</div>
      <button data-m="set">${ic('gear')} 설정 (시간표·명단·소리)</button><button data-m="hist">${ic('history')} 지난 기록 보기</button><button data-m="out">${ic('logout')} 로그아웃</button></div>`);
    av.querySelector('[data-m=set]').onclick = (ev) => { ev.stopPropagation(); av.querySelector('.menu').remove(); openSettings('table'); };
    av.querySelector('[data-m=hist]').onclick = (ev) => { ev.stopPropagation(); av.querySelector('.menu').remove(); openHistory(() => store.listDays(S.user.uid, semesterStart(now()))); };
    av.querySelector('[data-m=out]').onclick = async (ev) => { ev.stopPropagation(); await store.logout(); toast('로그아웃했어요. 이 노트북에는 예시 화면만 보여요'); };
  };
}
document.addEventListener('click', () => { const m = $('.menu'); if (m) m.remove(); });

async function doLogin() {
  if (S.fbFailed) { toast('로그인 서비스(Firebase)를 불러오지 못했어요. 인터넷이나 학교망 차단을 확인해 주세요'); return; }
  try { await store.login(); } catch (e) { toast('로그인하지 못했어요: ' + store.errText(e)); }
}

async function onUser(u) {
  S.authKnown = true;
  if (u) {
    S.user = u;
    let cfg = null;
    try { cfg = await store.loadConfig(u.uid); } catch (e) { /* 오프라인 */ }
    if (!cfg) {
      const cache = readCache();
      cfg = cache && cache.uid === u.uid ? cache.cfg : null;
    }
    const first = !cfg;
    S.cfg = normalizeConfig(cfg);
    if (first) { saveCfg(); toast('처음 로그인했어요. 예시 시간표로 시작해요. 아바타 → 설정에서 바꿔 주세요', 4000); }
    else saveCacheOnly();
    if (S.cfg.bg.kind === 'photo') { try { S.bgImage = await store.loadBgImage(u.uid); } catch (e) { S.bgImage = null; } }
    store.purgeBefore(u.uid, semesterStart(now())).catch(() => {});
  } else {
    S.user = null; S.cfg = sampleConfig(); S.bgImage = null; S.guestWarned = false;
    try { localStorage.removeItem('cb:cache'); } catch (e) { /* 무시 */ }
  }
  await loadToday();
  applyAll();
}
function readCache() { try { return JSON.parse(localStorage.getItem('cb:cache') || 'null'); } catch (e) { return null; } }
function saveCacheOnly() { try { localStorage.setItem('cb:cache', JSON.stringify({ uid: S.user.uid, cfg: S.cfg })); } catch (e) { /* 무시 */ } }

/* ---------- 가운데 수업 화면 ---------- */
const chips = (p) => `<div class="chips">${(p.items || []).map((b) => `<span class="chip">${esc(b)}</span>`).join('')}</div>`;

function timerVis(ph) {
  const f = Math.max(0, Math.min(1, ph.remain / ph.total));
  const tt = S.cfg.timerType;
  if (tt === 'num') return `<div class="bignum num" data-r="tv">${mmss(ph.remain)}</div>`;
  if (tt === 'pie') {
    const a = f * 2 * Math.PI, r = 90, x = 100 + r * Math.sin(a), y = 100 - r * Math.cos(a), big = f > 0.5 ? 1 : 0;
    const path = f >= 0.999 ? '<circle cx="100" cy="100" r="90" fill="#FF5A4A"/>' : f <= 0.001 ? '' : `<path d="M100 100 L100 10 A90 90 0 ${big} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z" fill="#FF5A4A"/>`;
    let ticks = ''; for (let i = 0; i < 12; i++) { const t = i / 12 * 2 * Math.PI; ticks += `<line x1="${100 + 96 * Math.sin(t)}" y1="${100 - 96 * Math.cos(t)}" x2="${100 + 86 * Math.sin(t)}" y2="${100 - 86 * Math.cos(t)}" stroke="#1E2433" stroke-width="3" stroke-linecap="round"/>`; }
    return `<svg viewBox="0 0 200 200" data-r="tv"><circle cx="100" cy="100" r="98" fill="#fff" stroke="#1E2433" stroke-width="4"/>${path}${ticks}<circle cx="100" cy="100" r="7" fill="#1E2433"/></svg>`;
  }
  const top = 70 * f, bot = 70 * (1 - f);
  return `<svg viewBox="0 0 200 200" data-r="tv"><defs><clipPath id="glass"><path d="M55 25 H145 C145 70 108 88 104 100 C108 112 145 130 145 175 H55 C55 130 92 112 96 100 C92 88 55 70 55 25Z"/></clipPath></defs>
    <g clip-path="url(#glass)"><rect x="40" y="${98 - top}" width="120" height="${top}" fill="#FFB020"/><rect x="40" y="${175 - bot}" width="120" height="${bot}" fill="#FFB020"/>${f > 0 ? '<rect x="98.5" y="98" width="3" height="77" fill="#FFB020"/>' : ''}</g>
    <path d="M55 25 H145 C145 70 108 88 104 100 C108 112 145 130 145 175 H55 C55 130 92 112 96 100 C92 88 55 70 55 25Z" fill="none" stroke="#1E2433" stroke-width="5" stroke-linejoin="round"/>
    <rect x="44" y="14" width="112" height="12" rx="6" fill="#FF6B4A"/><rect x="44" y="174" width="112" height="12" rx="6" fill="#FF6B4A"/></svg>`;
}

function drawStage() {
  const ph = S.phase, st = $('#stage'), T = table();
  document.body.classList.toggle('is-break', ph.kind === 'break');
  $('#app').className = 'mode-' + (ph.kind === 'morning' ? 'class' : ph.kind);
  if (ph.kind !== 'class' && S.wbOn) { S.wbOn = false; if (wbIsFull()) setWbFull(false); }
  let h = '';
  if (ph.kind === 'class') {
    const p = T[ph.cur];
    h = `<div class="band">${esc(p.name)}</div><button class="wb-toggle ${S.wbOn ? 'on' : ''}" data-a="wb">${ic('pen')}판서</button>`;
    if (!S.wbOn) h += `<div class="stage-body"><div class="lesson pop"><div class="subject">${esc(p.subject || p.name)}</div>${chips(p)}</div></div>`;
  } else if (ph.kind === 'soon') {
    const p = T[ph.next];
    h = `<div class="band soon">${ic('bell')}곧 ${esc(p.name)}</div><div class="stage-body"><div class="lesson pop"><div class="subject">${esc(p.subject || p.name)}</div>${chips(p)}</div></div>`;
  } else if (ph.kind === 'break') {
    const p = T[ph.next];
    h = `<div class="stage-body"><div class="brk pop"><div class="timer-vis">${timerVis(ph)}</div>
        <div class="brk-info"><div class="brk-title">${ph.lunch ? '점심시간' : '쉬는 시간'}</div>
          ${S.cfg.timerType === 'num' ? '' : `<div class="brk-time num" data-r="bt">${mmss(ph.remain)}</div>`}
          <div class="next"><h3>곧 ${esc(p.name)} ${esc(p.subject)}</h3>${chips(p)}</div></div></div></div>`;
  } else if (ph.kind === 'morning') {
    const p = T[ph.next];
    h = `<div class="stage-body"><div class="morning pop"><div class="hello">좋은 아침이에요!</div><div class="first">${esc(p.name)} ${esc(p.subject)}</div><div class="hint">${esc(p.start)} 시작</div>${chips(p)}</div></div>`;
  } else if (ph.kind === 'end') {
    h = `<div class="stage-body"><div class="done pop"><div class="stars">${ic('star')}${ic('star')}${ic('star')}</div><div class="t">오늘 수업 끝!</div></div></div>`;
  } else {
    h = `<div class="stage-body"><div class="none pop"><div class="t">오늘은 수업이 없어요</div>${guest() ? '' : '<p class="hint" style="text-align:center">시간표는 오른쪽 위 아바타 → 설정에서 바꿀 수 있어요</p>'}</div></div>`;
  }
  st.innerHTML = h;
  const wbb = st.querySelector('[data-a=wb]');
  if (wbb) {
    wbb.onclick = () => {
      S.wbOn = !S.wbOn;
      if (S.wbOn && !S.cfg.tasksClosed) { S.cfg.tasksClosed = true; drawTasks(); }
      if (!S.wbOn && wbIsFull()) setWbFull(false);
      drawStage();
    };
    if (S.wbOn) { const p = T[ph.cur]; st.appendChild(getWB(`<div class="subject">${esc(p.subject || p.name)}</div>${chips(p)}`)); requestAnimationFrame(fitWB); }
  }
}
function tickBreak() {
  const ph = S.phase; if (ph.kind !== 'break') return;
  const tv = $('#stage [data-r=tv]');
  if (tv) { if (S.cfg.timerType === 'num') tv.textContent = mmss(ph.remain); else tv.outerHTML = timerVis(ph); }
  const bt = $('#stage [data-r=bt]'); if (bt) bt.textContent = mmss(ph.remain);
}

/* ---------- 과제 정류장 ---------- */
function taskView() {
  const ph = S.phase, T = table();
  if (ph.kind === 'end') { // 오늘 과제를 모두 한 줄로
    const st = []; T.forEach((p, pi) => (p.tasks || []).forEach((t) => st.push({ label: t, p: p.name, pi })));
    const last = st.length;
    const posOf = (k) => { let off = 0; for (let pi = 0; pi < T.length; pi++) { const n = (T[pi].tasks || []).length; const v = prog(pi)[k]; if (v < n) return off + v; off += n; } return last; };
    return {
      day: true, title: '오늘 과제', stations: [...st, { label: '완료' }], last, posOf, resetLabel: '오늘 과제 현황 초기화',
      fwd(k) { for (let pi = 0; pi < T.length; pi++) { const n = (T[pi].tasks || []).length; if (prog(pi)[k] < n) { prog(pi)[k]++; return true; } } return false; },
      back(k) { const g = posOf(k); if (!g) return false; const t = g - 1; let off = 0; for (let pi = 0; pi < T.length; pi++) { const n = (T[pi].tasks || []).length; if (t < off + n) { prog(pi)[k] = t - off; return true; } off += n; } return false; },
      reset() { T.forEach((_, pi) => { S.day.progress[pi] = roster().map(() => 0); }); },
    };
  }
  const pi = ph.cur, p = T[pi], last = (p.tasks || []).length;
  return {
    title: `${p.name} 과제`, stations: [...(p.tasks || []).map((t) => ({ label: t })), { label: '완료' }], last, posOf: (k) => Math.min(prog(pi)[k], last), resetLabel: '이 과제 현황 초기화',
    fwd(k) { if (prog(pi)[k] < last) { prog(pi)[k]++; return true; } return false; },
    back(k) { if (prog(pi)[k] > 0) { prog(pi)[k]--; return true; } return false; },
    reset() { S.day.progress[pi] = roster().map(() => 0); },
  };
}
function tasksVisible() {
  const ph = S.phase;
  if (!S.cfg.showTasks || !S.day) return false;
  if (ph.kind === 'class') return (table()[ph.cur].tasks || []).length > 0;
  if (ph.kind === 'end') return table().some((p) => (p.tasks || []).length);
  return false;
}
function rects() { const m = {}; $$('#tasks .tag').forEach((t) => { m[t.dataset.k] = t.getBoundingClientRect(); }); return m; }
function flip(before) {
  $$('#tasks .tag').forEach((t) => {
    const b = before[t.dataset.k]; if (!b) return;
    const a = t.getBoundingClientRect(), dx = b.left - a.left, dy = b.top - a.top;
    if (dx || dy) t.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.34,1.3,.64,1)' });
  });
}
function drawTasks(animate) {
  const el = $('#tasks');
  $$('.w[data-w=tasks]').forEach((b) => b.classList.toggle('on', S.cfg.showTasks));
  if (!tasksVisible()) { el.style.display = 'none'; return; }
  el.style.display = '';
  const V = taskView(), last = V.last, names = roster(), P = names.map((_, k) => V.posOf(k));
  const done = P.filter((v) => v === last).length;
  const before = animate ? rects() : null;
  el.classList.toggle('closed', S.cfg.tasksClosed);
  el.innerHTML = `
    <div class="tasks-head" data-a="th">
      <h2>${esc(V.title)}</h2><span class="cnt num">${done}/${names.length}</span>
      <button class="reset" data-a="reset">${ic('reset')}${V.resetLabel}</button>
      <svg class="i chev"><use href="#i-chev"/></svg>
    </div>
    <div class="prog" style="${S.cfg.tasksClosed ? '' : 'display:none'}"><i style="width:${names.length ? done / names.length * 100 : 0}%"></i></div>
    <div class="tasks-body"><div><div class="track ${V.day ? 'day' : ''}">
      ${V.stations.map((s, i) => `<div class="st ${i === last ? 'fin' : ''} ${V.day && s.p && (i === 0 || V.stations[i - 1].pi !== s.pi) ? 'pstart' : ''}">
        <div class="mark">${i === last ? ic('flag') : i + 1}</div><div class="lbl">${s.p ? `<small class="pt">${esc(s.p)}</small>` : ''}${esc(s.label)}</div>
        <div class="tags">${names.map((n, k) => (P[k] === i ? `<span class="tag" data-k="${k}"><small>${k + 1}</small>${esc(n)}</span>` : '')).join('')}</div>
      </div>`).join('')}
    </div></div></div>`;
  el.querySelector('[data-a=th]').onclick = (e) => {
    if (e.target.closest('[data-a=reset]')) return;
    S.cfg.tasksClosed = !S.cfg.tasksClosed; el.classList.toggle('closed', S.cfg.tasksClosed);
    el.querySelector('.prog').style.display = S.cfg.tasksClosed ? '' : 'none'; saveCfg();
  };
  el.querySelector('[data-a=reset]').onclick = async (e) => {
    e.stopPropagation();
    const { confirmBox } = await import('./ui.js');
    if (!(await confirmBox(V.resetLabel + '할까요?', '이름표가 모두 첫 정류장으로 돌아가요.', '초기화'))) return;
    V.reset(); saveDay(); drawTasks(true);
  };
  el.querySelectorAll('.tag').forEach((t) => {
    let timer, long = false;
    t.onpointerdown = () => { long = false; timer = setTimeout(() => { long = true; move(+t.dataset.k, -1); }, 550); };
    t.onpointerup = () => { clearTimeout(timer); if (!long) move(+t.dataset.k, 1); };
    t.onpointerleave = () => clearTimeout(timer);
  });
  if (before) flip(before);
  if (animate && names.length && done === names.length) { confetti(); fx('celebrate'); }
}
function move(k, dir) {
  const V = taskView(); if (!(dir > 0 ? V.fwd(k) : V.back(k))) return;
  fx('move', dir > 0); drawTasks(true); saveDay();
}

/* ---------- 시간 흐름 ---------- */
function tick() {
  drawClock();
  if (S.day && ymd(now()) !== S.dateKey) { loadToday().then(applyAll); return; }
  if (!S.day) return;
  const prev = S.phase;
  S.phase = getPhase(table(), nowSec());
  const key = `${S.phase.kind}:${S.phase.cur ?? S.phase.next ?? ''}`;
  if (key !== S.phaseKey) {
    const first = !S.phaseKey;
    S.phaseKey = key;
    if (!first && S.cfg.sound.on && S.cfg.sound.auto && !S.jumping) {
      if (S.phase.kind === 'class') FX.classStart();
      else if (S.phase.kind === 'soon') FX.soon();
      else if (S.phase.kind === 'break' && prev.kind === 'class') FX.breakStart();
    }
    drawStage(); drawTasks(); drawTT();
  } else if (S.phase.kind === 'break') tickBreak();
  if (S.phase.kind !== prev.kind || (S.phase.cur ?? -1) !== (prev.cur ?? -1)) drawDbg();
  if (!$('#dbg').hidden) { const n = $('#dbg [data-r=now]'); if (n) n.textContent = nowLabel(); }
}

function applyAll() {
  setVolume(S.cfg.sound.volume);
  applyBg(); drawBellSel(); setLight(S.cfg.light.state, false); drawAcct(); drawBar();
  S.phaseKey = ''; tick();
}

/* ---------- 위젯 바 ---------- */
function drawBar() {
  const s = $('.w[data-w=sound]'); s.innerHTML = `${ic(soundOn() ? 'sound' : 'mute')}<span>소리 ${soundOn() ? '켬' : '끔'}</span>`;
  const w = $('.w[data-w=wake]'); w.classList.toggle('wake-on', !!S.cfg.wakeLock); w.querySelector('span').textContent = S.cfg.wakeLock ? '화면 켜둠' : '화면 켜두기';
  $('#wbar').classList.toggle('mini', !!S.cfg.barMini);
  $('#foldBar').style.transform = S.cfg.barMini ? 'rotate(180deg)' : '';
  $$('.w[data-w=tasks]').forEach((b) => b.classList.toggle('on', S.cfg.showTasks));
}
const actions = {
  bg: openBg, pick: openPick, noise: openNoise, light: openLight,
  tasks: () => { S.cfg.showTasks = !S.cfg.showTasks; saveCfg(); drawTasks(); drawBar(); if (S.cfg.showTasks && !tasksVisible()) toast('과제 정류장은 수업 중과 모든 수업이 끝난 뒤에 보여요'); },
  tt: () => { if (guest()) toast('게스트 모드에서는 바꾼 시간표가 저장되지 않아요'); openSettings('table'); },
  sound: () => { S.cfg.sound.on = !S.cfg.sound.on; saveCfg(); drawBar(); },
  wake: () => { S.cfg.wakeLock = !S.cfg.wakeLock; saveCfg(); drawBar(); wake(); },
  full: () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else document.documentElement.requestFullscreen().catch(() => toast('이 브라우저는 전체 화면을 지원하지 않아요')); wake(); },
};
$$('#wbar .w[data-w]').forEach((b) => { b.onclick = () => actions[b.dataset.w](); });
$('#foldBar').onclick = () => { S.cfg.barMini = !S.cfg.barMini; saveCfg(); drawBar(); };

/* 화면 꺼짐 방지 */
let lock = null;
async function wake() {
  try {
    if (S.cfg.wakeLock && 'wakeLock' in navigator && document.visibilityState === 'visible' && !lock) {
      lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; });
    } else if (!S.cfg.wakeLock && lock) { await lock.release(); lock = null; }
  } catch (e) { /* 지원 안 함 / 배터리 절약 */ }
}
document.addEventListener('visibilitychange', wake);

/* ---------- 집중 종 ---------- */
$('#bellBtn').onclick = () => {
  const b = $('#bellBtn'); b.classList.remove('ring'); void b.offsetWidth; b.classList.add('ring');
  ringBell(S.cfg.sound.bell, S.cfg.sound.custom); // 소리 끔 상태에서도 울림
};
$('#bellSel').onchange = () => { S.cfg.sound.bell = +$('#bellSel').value; saveCfg(); };
// 브라우저는 첫 클릭 전에는 소리를 막아서, 첫 클릭 때 소리 장치와 화면 켜두기를 준비
document.addEventListener('pointerdown', () => { unlockAudio(); wake(); }, { once: true });

/* ---------- 시간 이동 (확인용) ---------- */
function nowLabel() { const d = now(); return `${d.getMonth() + 1}/${d.getDate()} ${d.toTimeString().slice(0, 8)}${S.offset ? ' (이동한 시간)' : ''}`; }
function drawDbg() {
  const el = $('#dbg'); if (el.hidden) return;
  const targets = jumpTargets(table());
  el.innerHTML = `<button class="x" data-a="x">✕</button><h4>시간 이동 <em>확인용</em></h4>
    <div class="now" data-r="now">${nowLabel()}</div>
    <div class="shift"><button class="o" data-s="-86400">-1일</button><button class="o" data-s="86400">+1일</button></div>
    <div class="shift"><button class="o" data-s="-600">-10분</button><button class="o" data-s="-60">-1분</button><button class="o" data-s="60">+1분</button><button class="o" data-s="600">+10분</button></div>
    <div class="lab">교시별로 바로 가기</div>
    <div class="jumps">${targets.map((t) => `<button class="o" data-j="${t.sec}">${esc(t.label)}</button>`).join('') || '<span class="lab">오늘 시간표가 없어요</span>'}</div>
    <div class="lab">쉬는 시간 타이머 모양</div>
    <div class="g" style="grid-template-columns:1fr 1fr 1fr">${[['hour', '모래시계'], ['pie', '부채꼴'], ['num', '큰 숫자']].map(([k, n]) => `<button class="o ${S.cfg.timerType === k ? 'sel' : ''}" data-t="${k}">${n}</button>`).join('')}</div>
    <button class="o" data-a="real" style="width:100%">실제 시간으로 돌아가기</button>`;
  el.querySelector('[data-a=x]').onclick = () => { el.hidden = true; };
  const jump = (fn) => { S.jumping = true; fn(); S.phaseKey = ''; tick(); S.jumping = false; drawDbg(); };
  el.querySelectorAll('[data-s]').forEach((b) => { b.onclick = () => jump(() => { S.offset += +b.dataset.s; }); });
  el.querySelectorAll('[data-j]').forEach((b) => { b.onclick = () => jump(() => { S.offset += +b.dataset.j - nowSec(); }); });
  el.querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => { S.cfg.timerType = b.dataset.t; saveCfg(); drawStage(); drawDbg(); }; });
  el.querySelector('[data-a=real]').onclick = () => jump(() => { S.offset = 0; });
}
$('#timeMoveBtn').onclick = () => { const el = $('#dbg'); el.hidden = !el.hidden; drawDbg(); };

/* ---------- 연결 ---------- */
setWinStore((k) => S.cfg.wins[k], (k, v) => { S.cfg.wins[k] = v; saveCfg(); });
initWidgets({
  cfg: () => S.cfg, save: saveCfg, soundOn, roster, setLight,
  bgImage: () => S.bgImage,
  setBgImage: (d) => { S.bgImage = d; if (!guest()) store.saveBgImage(S.user.uid, d); },
});
initSettings({
  cfg: () => S.cfg, day: () => S.day, todayWd: () => now().getDay(), guest,
  saveCfg, saveDay, applyAll,
  resetAll: async () => {
    if (!guest()) { try { await store.deleteConfig(S.user.uid); } catch (e) { /* 무시 */ } }
    S.cfg = sampleConfig(); S.bgImage = null;
    $$('.win').forEach(() => {}); ['bg', 'pick', 'noise', 'light'].forEach(closeWin);
    saveCfg();
    S.day.table = clone(S.cfg.weekTables[now().getDay()] || []); S.day.custom = false; saveDay();
    applyAll();
  },
});

/* ---------- 시작 ---------- */
drawClock(); drawAcct();
const cache = readCache();
if (cache && cache.cfg) S.cfg = normalizeConfig(cache.cfg); // 로그인 확인 전에 지난 설정으로 먼저 보여 줌
loadToday().then(() => { applyAll(); setInterval(tick, 1000); });
store.initFirebase(onUser).catch(() => {
  S.fbFailed = true;
  if (cache && cache.cfg) { S.authKnown = true; S.user = { uid: cache.uid, email: '', displayName: '선생님' }; }
  else { S.authKnown = true; S.cfg = sampleConfig(); }
  toast(S.user ? '로그인 서비스(Firebase)를 불러오지 못했어요. 지난번 설정으로 열었고, 바꾼 내용은 저장되지 않아요' : '로그인 서비스(Firebase)를 불러오지 못해 게스트 모드로 열었어요', 4500);
  loadToday().then(applyAll);
});
