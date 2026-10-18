// 시작점: 로그인 상태와 주소(#/…)를 보고 알맞은 화면을 보여 줘요.
//  #/        시작 화면 (소개 + 시작하기)
//  #/role    역할 고르기 (선생님 / 학생 / 게스트)
//  #/request 선생님 권한 요청
//  #/board   선생님 보드 (허용된 선생님) · 게스트 모드
//  #/student 학생 화면
import * as store from './store.js';
import { $, $$, toast, esc } from './ui.js';

const route = () => (location.hash.replace(/^#/, '').split('?')[0] || '/');
const params = new URLSearchParams(location.search);
export function go(r) { location.hash = '#' + r; location.reload(); }

let user = null, firstAuth = true, ready = false;
const show = (v) => { document.body.dataset.view = v; };

async function isTeacher() { try { return await store.checkTeacher(user); } catch (e) { return false; } }
const hasStudent = () => { try { return !!JSON.parse(localStorage.getItem('cb:stu') || 'null'); } catch (e) { return false; } };

async function login(intent) {
  try { localStorage.setItem('cb:intent', intent); } catch (e) { /* 무시 */ }
  try { await store.login(); } catch (e) { toast('로그인하지 못했어요: ' + store.errText(e)); }
}

/** 시작하기: 로그인돼 있으면 역할에 맞는 화면, 아니면 역할 고르기 */
async function start() {
  if (!user) return go('/role');
  if (await isTeacher()) return go('/board');
  if (hasStudent()) return go('/student');
  return go('/role');
}

async function routeTo() {
  // 학생용 주소(?code=…)로 들어오면 학생 화면으로
  if (params.get('code') && route() === '/') { location.hash = '#/student'; }
  // 로그인 창을 다녀온 뒤: 고른 역할대로 이동
  let intent = null; try { intent = localStorage.getItem('cb:intent'); localStorage.removeItem('cb:intent'); } catch (e) { /* 무시 */ }
  if (user && intent === 'teacher') return go((await isTeacher()) ? '/board' : '/request');
  if (user && intent === 'student') return go('/student');

  const r = route();
  if (r === '/role') return showRole();
  if (r === '/request') return showRequest();
  if (r === '/student') {
    if (!user) { show('role'); return showRole('student'); }
    show('student'); const m = await import('./student.js'); return m.startStudent(user, params.get('code'));
  }
  if (r === '/board') {
    const guestOnly = location.hash.includes('guest');
    const teacher = !guestOnly && user && (await isTeacher());
    if (user && !teacher && !guestOnly) return go('/request');
    show('board'); const m = await import('./board.js'); return m.startBoard(teacher ? user : null);
  }
  return showLanding();
}

/* ---------- 시작 화면 ---------- */
function showLanding() {
  show('landing');
  $('#landing [data-a=start]').onclick = start;
}

/* ---------- 역할 고르기 ---------- */
function showRole(pre) {
  show('role');
  $('#role [data-r=who]').innerHTML = user ? `${esc(user.email)} 계정으로 로그인돼 있어요. <button class="linkbtn" data-a="out">다른 계정으로</button>` : 'Google 계정으로 로그인해요. 게스트는 로그인 없이 둘러봐요.';
  const out = $('#role [data-a=out]'); if (out) out.onclick = () => store.logout();
  $('#role [data-a=home]').onclick = () => go('/');
  $$('#role [data-role]').forEach((b) => {
    b.classList.toggle('pre', b.dataset.role === pre);
    b.onclick = async () => {
      const role = b.dataset.role;
      if (role === 'guest') return go('/board?guest');
      if (!user) return login(role);
      if (role === 'teacher') return go((await isTeacher()) ? '/board' : '/request');
      return go('/student');
    };
  });
}

/* ---------- 선생님 권한 요청 ---------- */
async function showRequest() {
  show('request');
  const box = $('#request [data-r=req]');
  if (!user) { box.innerHTML = '<p>먼저 로그인해 주세요.</p>'; return go('/role'); }
  if (await isTeacher()) {
    box.innerHTML = `<h2>승인됐어요!</h2><p class="hint">${esc(user.email)} 계정으로 선생님 보드를 쓸 수 있어요.</p><button class="cta" data-a="go">보드 열기</button>`;
    box.querySelector('[data-a=go]').onclick = () => go('/board');
    return;
  }
  const req = await store.myRequest(user.uid);
  const head = `<button class="back" data-a="home">← 처음으로</button>`;
  if (req) {
    box.innerHTML = `${head}<h2>승인을 기다리고 있어요</h2>
      <p class="hint">${esc(req.name)} 선생님(${esc(req.email)})의 요청이 관리 선생님께 전달됐어요. 승인되면 이 화면에서 '다시 확인'을 누르세요.</p>
      <div class="row"><button class="cta" data-a="re">다시 확인</button><button class="btn ghost" data-a="guest">게스트로 둘러보기</button><button class="btn ghost" data-a="out">로그아웃</button></div>`;
  } else {
    box.innerHTML = `${head}<h2>선생님 권한 요청</h2>
      <p class="hint">${esc(user.email)} 계정은 아직 선생님 보드를 쓸 수 없어요. 요청을 보내면 관리 선생님이 확인하고 승인해요.</p>
      <form class="reqform" data-r="f">
        <label>이름<input type="text" data-r="name" required maxlength="30" value="${esc(user.name || '')}"></label>
        <label>학교 (선택)<input type="text" data-r="school" maxlength="40" placeholder="○○초등학교"></label>
        <label>하고 싶은 말 (선택)<input type="text" data-r="note" maxlength="100" placeholder="예: 5학년 3반 담임이에요"></label>
        <div class="row"><button class="cta">요청 보내기</button><button type="button" class="btn ghost" data-a="guest">게스트로 둘러보기</button><button type="button" class="btn ghost" data-a="out">다른 계정으로</button></div>
      </form>`;
    box.querySelector('[data-r=f]').onsubmit = async (e) => {
      e.preventDefault();
      const v = (r) => box.querySelector(`[data-r=${r}]`).value.trim();
      try { await store.requestTeacher(user, { name: v('name'), school: v('school'), note: v('note') }); toast('요청을 보냈어요'); showRequest(); }
      catch (er) { toast('요청을 보내지 못했어요: ' + store.errText(er)); }
    };
  }
  box.querySelector('[data-a=home]').onclick = () => go('/');
  const re = box.querySelector('[data-a=re]'); if (re) re.onclick = () => showRequest();
  box.querySelector('[data-a=guest]').onclick = () => go('/board?guest');
  box.querySelector('[data-a=out]').onclick = () => store.logout();
}

/* ---------- 시작 ---------- */
store.init((u) => {
  if (!firstAuth) { location.reload(); return; } // 로그인·로그아웃하면 처음부터 다시
  firstAuth = false; user = u; ready = true;
  routeTo();
}).catch(() => {
  // Firebase를 못 불러와도(학교망 차단 등) 시작 화면과 게스트 모드는 쓸 수 있어요
  firstAuth = false; ready = true;
  toast('로그인 서비스를 불러오지 못했어요. 게스트 모드로만 쓸 수 있어요', 4500);
  const r = route();
  if (r === '/board') { show('board'); import('./board.js').then((m) => m.startBoard(null)); } else showLanding();
  $$('#role [data-role]').forEach((b) => { b.onclick = () => go('/board?guest'); });
});
