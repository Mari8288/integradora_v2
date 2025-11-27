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
  collection,
  doc,
  setDoc,
  serverTimestamp,
  orderBy,
  query,
  limit,
  limitToLast,
  getDocs,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
  return {
      id: res.user.uid,          
      name:res.user.displayName 
  };
}

export function logoutUser() {
  return signOut(auth);
}

/* 📡 RTDB: Lecturas para la gráfica de Index.html */

// Cargar últimos N registros una sola vez
// Lote inicial desde Firestore
// path = ruta de la colección de lecturas (por ejemplo: "usuarios/UID/dispositivos/DEVICE/lecturas")
// limitCount = cuántos puntos máximo quieres traer
// cb = callback que recibe un array ordenado ascendente por tiempo
export async function listenLecturasOnce(path, limitCount, cb) {
  try {
    const lecturasCol = collection(db, path);

    // Asumo que cada documento tiene un campo "timestamp" (number o Timestamp)
    // Traemos las últimas N lecturas, ordenadas desc, y luego las invertimos.
    const qLecturas = query(
      lecturasCol,
      orderBy("timestamp", "desc"),
      limit(limitCount)
    );

    const snap = await getDocs(qLecturas);

    // Los documentos vienen desc (la más nueva primero), los invertimos a asc para la gráfica
    const data = snap.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .reverse(); // ahora van de la más vieja a la más nueva

    cb(data);
  } catch (err) {
    console.error("Error en listenLecturasOnce (Firestore):", err);
    cb([]); // Para que tu código no reviente
  }
}



// Escuchar nuevas lecturas
// Escuchar nuevas lecturas en tiempo real desde Firestore
// cb(ts, lectura) -> lo mismo que usabas antes
export function listenLecturasStream(path, cb) {
  const lecturasCol = collection(db, path);

  // Escuchamos siempre la última lectura según "timestamp"
  const qLecturas = query(
    lecturasCol,
    orderBy("timestamp", "asc"),
    limitToLast(1)
  );

  // onSnapshot = equivalente a "stream" en Firestore
  const unsubscribe = onSnapshot(qLecturas, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const doc = change.doc;
        const data = doc.data();

        // Aquí puedes usar el propio timestamp del documento
        const ts = data.timestamp || null; // o doc.createTime, según cómo lo manejes

        cb(doc.id, data);
      }
    });
  }, (error) => {
    console.error("Error en listenLecturasStream (Firestore):", error);
  });

  // Devuelves la función para dejar de escuchar si la necesitas
  return unsubscribe;
}
