import './login.css';
import { onAuth, registerUser, loginUser, logoutUser } from "./firebase.js";

const welcomeSection  = document.getElementById('welcome');
const loginSection    = document.getElementById('login');
const registerSection = document.getElementById('register');
const regForm         = document.getElementById("registerForm");
const regMsg          = document.getElementById("registerMessage");
const loginMsg        = document.getElementById("loginMessage");

// Ir del welcome al login
document.getElementById('btn-entrar').onclick = () => {
  welcomeSection.style.display = 'none';
  loginSection.style.display = 'flex';
};

// Cambiar entre login y registro
document.getElementById('showRegister').onclick = (e) => {
  e.preventDefault();
  loginSection.style.display = 'none';
  registerSection.style.display = 'flex';
  loginMsg.textContent = "";
};

document.getElementById('showLogin').onclick = (e) => {
  e.preventDefault();
  registerSection.style.display = 'none';
  loginSection.style.display = 'flex';
  regMsg.textContent = "";
};

// Bandera para no redirigir mientras se registra
let isRegistering = false;

// Errores de Firebase
function mapAuthError(err) {
  const code = err?.code || "";
  console.error("Firebase auth error:", code, err.message);
  switch (code) {
    case "auth/invalid-email":          return "Correo inválido.";
    case "auth/missing-password":       return "Ingresa la contraseña.";
    case "auth/user-not-found":         return "No existe una cuenta con este correo.";
    case "auth/wrong-password":         return "Contraseña incorrecta.";
    case "auth/email-already-in-use":   return "Este correo ya está registrado.";
    case "auth/too-many-requests":
      return "Demasiados intentos fallidos. Espera unos minutos o prueba con otra cuenta.";
    default:
      return err.message || "Error de autenticación.";
  }
}

// Si ya hay sesión -> ir al Index
onAuth(user => {
  if (user && !isRegistering) {
    location.href = "index.html";   // nombre del dashboard en Vite
  }
});

// LOGIN
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  loginMsg.textContent = "";
  loginMsg.style.color = "#ff4d4d";

  const email = document.getElementById("loginEmail").value.trim();
  const pass  = document.getElementById("loginPassword").value;

  try {
    await loginUser(email, pass);
    loginMsg.style.color = "#4ef037";
    loginMsg.textContent = "✅ Bienvenido, redirigiendo…";
    setTimeout(() => location.href = "index.html", 800);
  } catch (err) {
    loginMsg.textContent = "❌ " + mapAuthError(err);
  }
});

// REGISTRO
regForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name     = document.getElementById("regNombre").value.trim();
  const email    = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;

  regMsg.textContent = "";
  isRegistering = true;

  try {
    const bcrypt = (window.dcodeIO?.bcrypt) || window.bcrypt;
    if (!bcrypt) throw new Error("No se pudo cargar bcryptjs.");

    const passwordHash = bcrypt.hashSync(password, 10);
    await registerUser({ name, email, password, passwordHash });

    regMsg.style.color = "#4ef037";
    regMsg.textContent = "✅ Registro exitoso. Redirigiendo al login...";
    regForm.reset();
    await logoutUser();

    setTimeout(() => {
      registerSection.style.display = "none";
      loginSection.style.display = "flex";
      regMsg.textContent = "";
      isRegistering = false;
    }, 1200);
  } catch (err) {
    isRegistering = false;
    regMsg.style.color = "#ff4d4d";
    regMsg.textContent = "❌ " + mapAuthError(err);
  }
});
