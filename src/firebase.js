// firebase.js (junto a Login.html e Index.html)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  setPersistence,
  indexedDBLocalPersistence,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getDatabase,
  ref,
  query,
  limitToLast,
  onValue,
  onChildAdded
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* 🔧 Configuración TerraNova */
const firebaseConfig = {
  apiKey: "AIzaSyAEQNaGohNG32f52DZPbgljT9Rz3w6O-bM",
  authDomain: "terranova-62f60.firebaseapp.com",
  databaseURL: "https://terranova-62f60-default-rtdb.firebaseio.com",
  projectId: "terranova-62f60",
  storageBucket: "terranova-62f60.firebasestorage.app",
  messagingSenderId: "288943541805",
  appId: "1:288943541805:web:f2915f0754789fd5bdb2a4"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);
const rtdb = getDatabase(app);

/* 🔐 Persistencia de sesión (sin romper el módulo) */
setPersistence(auth, indexedDBLocalPersistence).catch((err) => {
  console.warn("No se pudo aplicar persistencia IndexedDB:", err);
});

/* 👤 Observador de sesión */
export function onAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

/* 📝 Registro */
export async function registerUser({ name, email, password, passwordHash }) {
  // 1. Crear usuario en Auth con la contraseña normal
  const cred = await createUserWithEmailAndPassword(auth, email, password);

  // 2. Nombre visible
  try {
    await updateProfile(cred.user, { displayName: name });
  } catch (e) {
    console.warn("No se pudo actualizar displayName:", e);
  }

  // 3. Si no vino hash desde el formulario, lo generamos (solo se usa cuando llamas a registerUser)
  if (!passwordHash) {
    const bcrypt = (window.dcodeIO?.bcrypt) || window.bcrypt;
    if (!bcrypt) throw new Error("bcryptjs no cargado.");
    passwordHash = bcrypt.hashSync(password, 10);
  }

  // 4. Guardar en Firestore
  await setDoc(doc(db, "users", cred.user.uid), {
    uid: cred.user.uid,
    name,
    email,
    password: passwordHash,
    createdAt: serverTimestamp(),
  });

  return cred.user;
}

/* 🔑 Login / Logout */
export async function loginUser(email, password) {
  const res = await signInWithEmailAndPassword(auth, email, password);
  return res.user;
}

export function logoutUser() {
  return signOut(auth);
}

/* 📡 RTDB: Lecturas para la gráfica de Index.html */

// Cargar últimos N registros una sola vez
export function listenLecturasOnce(path, limit, cb) {
  const q = query(ref(rtdb, path), limitToLast(limit));
  onValue(
    q,
    (snap) => cb(snap.val() || {}),
    { onlyOnce: true }
  );
}

// Escuchar nuevas lecturas
export function listenLecturasStream(path, cb) {
  const q = query(ref(rtdb, path), limitToLast(1));
  return onChildAdded(q, (snap) => {
    cb(snap.key, snap.val());
  });
}
