// 과제 계산 (선생님 보드·학생 화면·지난 기록이 함께 씀)
// 학생 한 명의 체크(mark) = { p: {교시: 몇 번째 정류장까지}, k: {교시: 고른 과제 비트} }
// 과제 방식: 'seq' 순서대로(정류장) / 'pick' 골라서(체크리스트, 완료 기준 n개)

export const tasksOf = (p) => (p && p.tasks) || [];
export const isPick = (p) => !!p && p.mode === 'pick';
export const needOf = (p) => (isPick(p) ? Math.max(1, Math.min(+p.need || tasksOf(p).length, tasksOf(p).length)) : tasksOf(p).length);
export const popcount = (m) => { let c = 0; m >>>= 0; while (m) { c += m & 1; m >>>= 1; } return c; };

export const posOf = (mark, pi) => +(((mark || {}).p || {})[pi] || 0);
export const maskOf = (mark, pi) => +(((mark || {}).k || {})[pi] || 0);

export function doneCount(p, mark, pi) {
  return isPick(p) ? popcount(maskOf(mark, pi)) : Math.min(posOf(mark, pi), tasksOf(p).length);
}
export function isDone(p, mark, pi) {
  if (!tasksOf(p).length) return true;
  return doneCount(p, mark, pi) >= needOf(p);
}
export function isChecked(p, mark, pi, ti) {
  return isPick(p) ? !!((maskOf(mark, pi) >>> ti) & 1) : posOf(mark, pi) > ti;
}

/** 체크 바꾸기 (새 mark를 돌려줌) */
export function withPos(mark, pi, v) { const m = clone(mark); m.p[pi] = Math.max(0, v); return m; }
export function withToggle(mark, pi, ti) { const m = clone(mark); m.k[pi] = (maskOf(m, pi) ^ (1 << ti)) >>> 0; return m; }
export function withReset(mark, pi) { const m = clone(mark); delete m.p[pi]; delete m.k[pi]; return m; }
function clone(mark) { return { p: { ...((mark || {}).p || {}) }, k: { ...((mark || {}).k || {}) } }; }

/** 학생 화면·선생님 보드에서 "지금 할 과제" (순서대로일 때) */
export function nextTask(p, mark, pi) {
  if (isPick(p)) return null;
  const pos = posOf(mark, pi); const t = tasksOf(p);
  return pos < t.length ? { i: pos, label: t[pos] } : null;
}
