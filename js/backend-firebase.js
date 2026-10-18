// 실제 저장소: Firebase (Google 로그인 + Firestore 서울 서버)
// 웹 설정값은 공개돼도 괜찮은 값이에요. 기록 보호는 Firestore 보안 규칙(firestore.rules)이 맡아요.

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

export async function init(onUser) {
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
  A.onAuthStateChanged(auth, (u) => onUser(u ? { uid: u.uid, email: (u.email || '').toLowerCase(), name: u.displayName || '' } : null));
}

export const login = () => A.signInWithPopup(auth, new A.GoogleAuthProvider());
export const logout = () => A.signOut(auth);

const d = (p) => F.doc(db, ...p.split('/'));
const c = (p) => F.collection(db, ...p.split('/'));
const plain = (o) => JSON.parse(JSON.stringify(o));

export async function get(p) { const s = await F.getDoc(d(p)); return s.exists() ? s.data() : null; }
export const set = (p, data, merge = false) => F.setDoc(d(p), plain(data), { merge });
export const del = (p) => F.deleteDoc(d(p));

function q(col, where) {
  if (!where) return c(col);
  const [field, op, val] = where;
  return F.query(c(col), F.where(field === '__id__' ? F.documentId() : field, op, val));
}
export async function list(col, where) {
  const s = await F.getDocs(q(col, where));
  return s.docs.map((x) => ({ id: x.id, ...x.data() }));
}
export function watchDoc(p, cb, onErr) {
  return F.onSnapshot(d(p), (s) => cb(s.exists() ? s.data() : null), (e) => onErr && onErr(e));
}
export function watchCol(col, where, cb, onErr) {
  return F.onSnapshot(q(col, where), (s) => cb(s.docs.map((x) => ({ id: x.id, ...x.data() }))), (e) => onErr && onErr(e));
}
export async function batch(ops) {
  const b = F.writeBatch(db);
  ops.forEach((o) => (o.op === 'del' ? b.delete(d(o.path)) : b.set(d(o.path), plain(o.data), { merge: !!o.merge })));
  await b.commit();
}
