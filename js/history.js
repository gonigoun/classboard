// 지난 기록: 날짜별 · 학생별 보기, 엑셀(CSV) 내려받기
import { ic, esc, toast } from './ui.js';
import { WEEKDAYS, semesterStart, semesterLabel, ymd } from './data.js';
import { doneCount, needOf } from './tasks.js';

let days = [], tab = 'day', sel = null, stu = 0, month = null, modal = null;

const wdOf = (d) => WEEKDAYS[new Date(d + 'T00:00').getDay()];
const pill = (a, n) => `<span class="pill ${a === n ? 'full' : a ? 'part' : 'none'}">${a}/${n}</span>`;
/** k번째 학생(0부터)의 그날 그 교시 [한 개수, 완료 기준] */
const doneOf = (day, pi, k) => {
  const p = day.table[pi] || {};
  let mark = (day.marks || []).find((m) => m.id === String(k + 1));
  if (!mark) mark = { p: { [pi]: ((day.progress || {})[pi] || [])[k] || 0 }, k: { [pi]: ((day.picks || {})[pi] || [])[k] || 0 } }; // 예전 기록
  return [Math.min(doneCount(p, mark, pi), needOf(p)), needOf(p)];
};
const withTasks = (day) => (day.table || []).map((p, i) => [p, i]).filter(([p]) => (p.tasks || []).length);

export async function openHistory(load) {
  if (modal) return;
  modal = document.createElement('div'); modal.className = 'modal';
  modal.innerHTML = '<div class="hist"><p class="hint">기록을 불러오는 중…</p></div>';
  document.body.appendChild(modal);
  modal.addEventListener('pointerdown', (e) => { if (e.target === modal) close(); });
  try { days = (await load()).filter((d) => withTasks(d).length).sort((a, b) => a.date.localeCompare(b.date)); }
  catch (e) { modal.querySelector('.hist').innerHTML = `<p>기록을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.</p><button class="btn ghost" data-a="x">닫기</button>`; modal.querySelector('[data-a=x]').onclick = close; return; }
  sel = days.length ? days[days.length - 1].date : null;
  month = (sel || ymd(new Date())).slice(0, 7);
  draw();
}
function close() { if (modal) { modal.remove(); modal = null; } }

function draw() {
  const h = modal.querySelector('.hist');
  let body;
  if (!days.length) body = '<p class="hint">아직 기록이 없어요. 수업이 있는 날 과제 정류장을 쓰면 날짜별로 쌓여요.</p>';
  else if (tab === 'day') body = dayView();
  else body = stuView();
  h.innerHTML = `<div class="hist-h"><h2>지난 기록</h2><div class="seg"><button data-t="day" class="${tab === 'day' ? 'sel' : ''}">날짜별</button><button data-t="stu" class="${tab === 'stu' ? 'sel' : ''}">학생별</button></div><button class="x" data-a="x">${ic('x')}</button></div>
    ${body}
    <div class="hist-f"><span>이번 학기(${semesterLabel()}) 기록을 보관하고, 학기가 바뀌면 지난 학기 기록은 지워져요.</span><button class="btn ghost" data-a="csv" ${days.length ? '' : 'disabled'}>${ic('down')} 엑셀로 내려받기</button></div>`;
  h.querySelector('[data-a=x]').onclick = close;
  h.querySelectorAll('.seg button').forEach((b) => { b.onclick = () => { tab = b.dataset.t; draw(); }; });
  h.querySelectorAll('[data-d]').forEach((b) => { b.onclick = () => { sel = b.dataset.d; draw(); }; });
  h.querySelectorAll('[data-m]').forEach((b) => { b.onclick = () => { month = b.dataset.m; draw(); }; });
  h.querySelectorAll('[data-k]').forEach((b) => { b.onclick = () => { stu = +b.dataset.k; draw(); }; });
  h.querySelector('[data-a=csv]').onclick = csv;
}

function monthShift(m, d) { const [y, mo] = m.split('-').map(Number); const t = new Date(y, mo - 1 + d, 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`; }

function dayView() {
  const [y, mo] = month.split('-').map(Number);
  const first = new Date(y, mo - 1, 1).getDay(), last = new Date(y, mo, 0).getDate();
  const has = new Set(days.map((d) => d.date));
  const prev = monthShift(month, -1), next = monthShift(month, 1);
  const canPrev = prev >= semesterStart().slice(0, 7), canNext = next <= ymd(new Date()).slice(0, 7);
  let cal = WEEKDAYS.map((x) => `<b>${x}</b>`).join('') + '<span></span>'.repeat(first);
  for (let d = 1; d <= last; d++) {
    const key = `${month}-${String(d).padStart(2, '0')}`;
    cal += `<button ${has.has(key) ? `data-d="${key}"` : 'disabled'} class="${has.has(key) ? 'has' : ''} ${key === sel ? 'sel' : ''}">${d}</button>`;
  }
  const day = days.find((d) => d.date === sel);
  let table = '<p class="hint">기록이 있는 날짜(초록 점)를 골라 주세요.</p>';
  if (day) {
    const ps = withTasks(day), names = day.roster || [];
    const rows = names.map((n, k) => {
      let a = 0, t = 0;
      const c = ps.map(([, pi]) => { const [x, nn] = doneOf(day, pi, k); a += x; t += nn; return `<td>${pill(x, nn)}</td>`; }).join('');
      return `<tr><td class="n">${k + 1} ${esc(n)}</td>${c}<td><b>${t ? Math.round(a / t * 100) : 0}%</b></td></tr>`;
    }).join('');
    table = `<p class="rec-title">${+sel.slice(5, 7)}월 ${+sel.slice(8)}일 (${wdOf(sel)}) 기록</p>
      <table class="rec"><tr><th style="text-align:left">학생</th>${ps.map(([p]) => `<th>${esc(p.name)} ${esc(p.subject)}</th>`).join('')}<th>완료율</th></tr>${rows}</table>`;
  }
  return `<div class="hist-grid"><div><div class="cal-h"><button ${canPrev ? `data-m="${prev}"` : 'disabled'}>‹</button>${y}년 ${mo}월<button ${canNext ? `data-m="${next}"` : 'disabled'}>›</button></div><div class="cal">${cal}</div></div><div>${table}</div></div>`;
}

function stuView() {
  const names = days[days.length - 1].roster || [];
  if (stu >= names.length) stu = 0;
  let A = 0, T = 0, full = 0;
  const rows = [...days].reverse().map((d) => {
    let a = 0, t = 0;
    const c = withTasks(d).map(([p, pi]) => { const [x, n] = doneOf(d, pi, stu); a += x; t += n; return `${esc(p.subject || p.name)} ${pill(x, n)}`; }).join(' ');
    A += a; T += t; if (t && a === t) full++;
    return `<tr><td class="n">${+d.date.slice(5, 7)}/${+d.date.slice(8)} (${wdOf(d.date)})</td><td style="text-align:left">${c}</td></tr>`;
  }).join('');
  return `<div class="hist-grid"><div class="studs">${names.map((n, k) => `<button class="${k === stu ? 'sel' : ''}" data-k="${k}">${k + 1} ${esc(n)}</button>`).join('')}</div>
    <div><p class="rec-title">${stu + 1}번 ${esc(names[stu] || '')}</p>
    <div class="rate"><div>과제 완료율<b class="num">${T ? Math.round(A / T * 100) : 0}%</b></div><div>모두 끝낸 날<b class="num">${full}/${days.length}일</b></div></div>
    <table class="rec"><tr><th style="text-align:left">날짜</th><th style="text-align:left">교시별 결과</th></tr>${rows}</table></div></div>`;
}

/** 엑셀에서 바로 열리는 CSV (한글 깨짐 방지 BOM 포함) */
function csv() {
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [['날짜', '요일', '번호', '이름', '교시', '과목', '한 과제 수', '전체 과제 수', '완료'].map(q).join(',')];
  days.forEach((d) => (d.roster || []).forEach((n, k) => withTasks(d).forEach(([p, pi]) => {
    const [x, t] = doneOf(d, pi, k);
    lines.push([d.date, wdOf(d.date), k + 1, n, p.name, p.subject, x, t, x === t ? 'O' : ''].map(q).join(','));
  })));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `교실보드_과제기록_${semesterLabel()}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  toast('엑셀 파일(CSV)을 내려받았어요');
}
