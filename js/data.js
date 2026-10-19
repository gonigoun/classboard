// 예시 데이터, 날짜·시간 계산

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const SUBJECTS = {
  국어: { items: ['국어 교과서', '국어 활동', '공책'], tasks: ['국어 활동 22쪽', '받아쓰기 공책'] },
  수학: { items: ['수학 교과서', '수학 익힘', '자', '색연필'], tasks: ['익힘 34쪽', '교과서 52쪽 3번', '오답 공책 정리'] },
  사회: { items: ['사회 교과서', '사회과 부도'], tasks: ['지도 색칠하기'] },
  과학: { items: ['과학 교과서', '실험 관찰', '돋보기'], tasks: ['실험 관찰 18쪽', '관찰 그림', '결과 쓰기', '모둠 발표 준비', '정리 퀴즈'] },
};
const TIMES = [['09:00', '09:40'], ['09:50', '10:30'], ['10:40', '11:20'], ['12:10', '12:50']];
const ORDER = { 1: ['국어', '수학', '사회', '과학'], 2: ['수학', '국어', '과학', '사회'], 3: ['사회', '과학', '국어', '수학'], 4: ['과학', '사회', '수학', '국어'], 5: ['국어', '과학', '수학', '사회'] };

export const SAMPLE_ROSTER = ['김하늘', '이서준', '박도윤', '최지우', '정예린', '강민준', '조하은', '윤시우', '장서연', '임주원'];

/** 1교시 전 아침 시간 (과제·판서를 쓸 수 있는 칸) */
export function morningPeriod(start = '08:40', end = '09:00', tasks = []) {
  return { name: '아침 시간', morning: true, start, end, subject: '아침 활동', items: [], tasks };
}
export const isMorning = (p) => !!(p && p.morning);
/** 점심시간 칸 (아침 시간처럼 과제·판서를 쓸 수 있음) */
export function lunchPeriod(start = '12:10', end = '13:00', tasks = []) {
  return { name: '점심시간', lunch: true, start, end, subject: '점심 활동', items: [], tasks };
}
export const isLunch = (p) => !!(p && p.lunch);
/** 교시가 아닌 칸 (아침 시간·점심시간) */
export const isSpecial = (p) => isMorning(p) || isLunch(p);

export function samplePeriods(weekday) {
  const order = ORDER[weekday] || ORDER[1];
  return [morningPeriod('08:40', '09:00', ['아침 독서', '알림장 쓰기']), ...order.map((sub, i) => ({
    name: `${i + 1}교시`, start: TIMES[i][0], end: TIMES[i][1], subject: sub,
    items: [...SUBJECTS[sub].items], tasks: [...SUBJECTS[sub].tasks],
  }))];
}

export function sampleConfig() {
  const weekTables = {};
  for (let d = 1; d <= 5; d++) weekTables[d] = samplePeriods(d);
  return {
    version: 2,
    weekTables,
    roster: [...SAMPLE_ROSTER],
    sound: { bell: 0, volume: 0.8, on: true, auto: true, custom: [] },
    timerType: 'pie',
    showTasks: true,
    tasksClosed: false,
    bg: { kind: 'pattern', value: 'grid', color: '#DCE8FB', dim: 0 },
    light: { state: 'g', link: false, yellow: 45, red: 70 },
    wins: {},
    wakeLock: true,
    barMini: false,
  };
}

/** 저장된 설정에 빠진 항목을 기본값으로 채움 (버전이 바뀌어도 안전하게) */
export function normalizeConfig(c) {
  const base = sampleConfig();
  if (!c || typeof c !== 'object') return base;
  const out = { ...base, ...c };
  out.sound = { ...base.sound, ...(c.sound || {}) };
  out.bg = { ...base.bg, ...(c.bg || {}) };
  out.light = { ...base.light, ...(c.light || {}) };
  out.wins = { ...(c.wins || {}) };
  out.weekTables = { ...base.weekTables, ...(c.weekTables || {}) };
  out.roster = Array.isArray(c.roster) ? c.roster : base.roster;
  // 2판: 요일 시간표 맨 앞에 '아침 시간' 칸을 한 번 넣어 줌 (지우면 다시 생기지 않음)
  if (!(c.version >= 2)) {
    for (let d = 1; d <= 5; d++) {
      const t = out.weekTables[d];
      if (!Array.isArray(t) || !t.length || t.some(isMorning)) continue;
      const first = [...t].sort((a, b) => toSec(a.start) - toSec(b.start))[0];
      const end = toSec(first.start) >= toSec('09:00') ? '09:00' : first.start;
      const st = toSec(end) - 20 * 60, hm = `${String(Math.floor(st / 3600)).padStart(2, '0')}:${String(Math.floor(st / 60) % 60).padStart(2, '0')}`;
      out.weekTables[d] = [morningPeriod(hm, end), ...t];
    }
    out.version = 2;
  }
  return out;
}

export const clone = (o) => JSON.parse(JSON.stringify(o));

export function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 이번 학기 시작일 (1학기 3/1~7/31, 2학기 8/1~다음 해 2월 말) */
export function semesterStart(d = new Date()) {
  const m = d.getMonth() + 1, y = d.getFullYear();
  if (m >= 3 && m <= 7) return `${y}-03-01`;
  if (m >= 8) return `${y}-08-01`;
  return `${y - 1}-08-01`;
}
export function semesterLabel(d = new Date()) {
  const m = d.getMonth() + 1;
  return m >= 3 && m <= 7 ? '1학기' : '2학기';
}

export const toSec = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) * 3600 + (m || 0) * 60; };
export const mmss = (s) => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0')}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

/**
 * 지금 화면 상태 계산
 * kind: none | morning | soon | class | break | end
 */
export function getPhase(table, nowSec) {
  const P = (table || []).filter((p) => p.start && p.end).map((p, i) => ({ ...p, i, s: toSec(p.start), e: toSec(p.end) }))
    .sort((a, b) => a.s - b.s);
  if (!P.length) return { kind: 'none' };
  for (const p of P) if (nowSec >= p.s && nowSec < p.e) return { kind: 'class', cur: p.i, remain: p.e - nowSec };
  if (nowSec < P[0].s) {
    const r = P[0].s - nowSec;
    return r <= 120 ? { kind: 'soon', next: P[0].i, remain: r } : { kind: 'morning', next: P[0].i, remain: r };
  }
  for (let k = 0; k < P.length - 1; k++) {
    if (nowSec >= P[k].e && nowSec < P[k + 1].s) {
      const remain = P[k + 1].s - nowSec, total = P[k + 1].s - P[k].e;
      if (remain <= 120) return { kind: 'soon', next: P[k + 1].i, remain, fromBreak: true };
      return { kind: 'break', next: P[k + 1].i, remain, total, lunch: total >= 30 * 60, prev: P[k].i };
    }
  }
  return { kind: 'end', last: P[P.length - 1].i };
}

/** 시간 이동(확인용): 칸마다 2분 전·시작·중간·끝나기 전·끝난 뒤 */
export function jumpGroups(table) {
  const P = (table || []).map((p, i) => ({ p, i, s: toSec(p.start), e: toSec(p.end) })).filter((x) => x.p.start && x.p.end).sort((a, b) => a.s - b.s);
  const groups = P.map(({ p, s: st, e }) => ({
    name: p.name, sub: p.subject || '', time: `${p.start}~${p.end}`,
    items: [['2분 전', st - 110], ['시작', st + 2], ['중간', Math.round((st + e) / 2)], ['끝나기 전', e - 15], ['끝난 뒤', e + 30]],
  }));
  const extra = P.length ? [['첫 칸 전 (등교)', P[0].s - 20 * 60], ['모든 수업 끝난 뒤', P[P.length - 1].e + 60]] : [];
  return { groups, extra };
}
