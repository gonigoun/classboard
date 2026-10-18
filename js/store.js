// 로그인과 저장 (Firebase: Google 로그인 + Firestore 서울 서버)
// 웹 설정값은 공개돼도 괜찮은 값이에요. 기록 보호는 Firestore 보안 규칙이 맡아요.

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDXTFUYZ8L61g-IAFWo9cXS8KrYj6JOpfU',
  authDomain: 'classboard-cd47a.firebaseapp.com',
  projectId: 'classboard-cd47a',
  storageBucket: 'classboard-cd47a.firebasestorage.app',
  messagingSenderId: '710808401801',
  appId: '1:710808401801:web:750c01906102fc1ddf5358',
};
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';

let A = null, F = null, auth = null, db = null;
let ready = null;
let statusCb = () => {};
let pending = 0;
const timers = {};

export function onStatus(cb) { statusCb = cb; }
function setStatus() {
  if (!navigator.onLine) statusCb('off');
  else statusCb(pending > 0 ? 'ing' : 'ok');
}
window.addEventListener('online', setStatus);
window.addEventListener('offline', setStatus);

/** Firebase 불러오기. 실패해도(학교망 차단 등) 게스트 모드로 계속 쓸 수 있음 */
export function initFirebase(onUser) {
  if (ready) return ready;
  ready = (async () => {
    const [{ initializeApp }, a, f] = await Promise.all([
      import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-auth.js`), import(`${SDK}/firebase-firestore.js`),
    ]);
    A = a; F = f;
    const app = initializeApp(FIREBASE_CONFIG);
    auth = A.getAuth(app);
    try {
      db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
    } catch (e) {
      db = F.getFirestore(app); // 오프라인 보관을 못 쓰는 브라우저
    }
    A.onAuthStateChanged(auth, (u) => onUser(u));
    return true;
  })();
  return ready;
}

const ERR = {
  'auth/unauthorized-domain': '이 주소가 Firebase 승인된 도메인에 없어요',
  'auth/popup-blocked': '로그인 창(팝업)이 막혔어요. 주소창 오른쪽에서 팝업을 허용해 주세요',
  'auth/popup-closed-by-user': '로그인 창을 닫았어요',
  'auth/cancelled-popup-request': '로그인 창을 닫았어요',
  'auth/network-request-failed': '인터넷 연결을 확인해 주세요',
  'permission-denied': '저장 권한이 없어요. 다시 로그인해 주세요',
};
export const errText = (e) => ERR[e && e.code] || '잠시 뒤 다시 시도해 주세요';

export async function login() {
  await ready;
  return A.signInWithPopup(auth, new A.GoogleAuthProvider());
}
export async function logout() {
  await ready;
  return A.signOut(auth);
}

const ref = (uid, ...path) => F.doc(db, 'boards', uid, ...path);

export async function loadConfig(uid) {
  const s = await F.getDoc(ref(uid, 'config', 'main'));
  return s.exists() ? s.data() : null;
}
export async function loadDay(uid, date) {
  const s = await F.getDoc(ref(uid, 'days', date));
  return s.exists() ? s.data() : null;
}
export async function loadBgImage(uid) {
  const s = await F.getDoc(ref(uid, 'config', 'bgimage'));
  return s.exists() ? s.data().data : null;
}

const waiting = new Map(); // 항목별 최신 저장 번호
/** 같은 항목을 연달아 바꾸면 1.2초 모았다가 마지막 것만 저장 */
function write(key, fn) {
  clearTimeout(timers[key]);
  const ver = (waiting.get(key) || 0) + 1;
  waiting.set(key, ver);
  pending = waiting.size; setStatus();
  timers[key] = setTimeout(async () => {
    let failed = false;
    try { await fn(); } catch (e) { console.warn('저장 실패', e); failed = true; }
    if (waiting.get(key) === ver) waiting.delete(key);
    pending = waiting.size;
    if (failed) statusCb('err'); else setStatus();
  }, 1200);
}

export function saveConfig(uid, cfg) {
  write('config', () => F.setDoc(ref(uid, 'config', 'main'), JSON.parse(JSON.stringify(cfg))));
}
export function saveDay(uid, date, day) {
  write('day:' + date, () => F.setDoc(ref(uid, 'days', date), { ...JSON.parse(JSON.stringify(day)), updatedAt: F.serverTimestamp() }));
}
export function saveBgImage(uid, data) {
  write('bgimage', () => (data ? F.setDoc(ref(uid, 'config', 'bgimage'), { data }) : F.deleteDoc(ref(uid, 'config', 'bgimage'))));
}

/** 이번 학기 기록 목록 */
export async function listDays(uid, fromDate) {
  const q = F.query(F.collection(db, 'boards', uid, 'days'), F.where(F.documentId(), '>=', fromDate));
  const s = await F.getDocs(q);
  return s.docs.map((d) => ({ date: d.id, ...d.data() }));
}

/** 지난 학기 기록 지우기 (한 학기만 보관) */
export async function purgeBefore(uid, fromDate) {
  const q = F.query(F.collection(db, 'boards', uid, 'days'), F.where(F.documentId(), '<', fromDate), F.limit(200));
  const s = await F.getDocs(q);
  if (s.empty) return 0;
  const b = F.writeBatch(db);
  s.docs.forEach((d) => b.delete(d.ref));
  await b.commit();
  return s.size;
}

/** 모든 설정 초기화: 설정 문서와 배경 사진 지우기 (기록은 남김) */
export async function deleteConfig(uid) {
  await F.deleteDoc(ref(uid, 'config', 'main'));
  await F.deleteDoc(ref(uid, 'config', 'bgimage'));
}
