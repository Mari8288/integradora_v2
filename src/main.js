import './index.css';
import {
  onAuth,
  logoutUser,
  listenLecturasOnce,
  listenLecturasStream
} from "./firebase.js";

/* =========================
   CRUD Comentarios (localStorage)
========================= */
(function(){
  const KEY = "tn_comments";
  const form = document.getElementById("comment-form");
  const textarea = document.getElementById("comment-text");
  const list = document.getElementById("comments-container");

  // NUEVO: obtener usuario actual (si hay sesión)
  function currentUser(){
    return window.tnCurrentUser || null;
  }

  function loadComments(){
    try{
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    }catch{ return []; }
  }
  function saveComments(arr){
    localStorage.setItem(KEY, JSON.stringify(arr));
  }
  function uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); }

  function escapeHtml(str=""){
    return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function formatTime(dateMs){
    try{
      return new Intl.DateTimeFormat('es-MX', {
        year:'numeric', month:'short', day:'2-digit',
        hour:'2-digit', minute:'2-digit'
      }).format(new Date(dateMs));
    }catch{ return new Date(dateMs).toLocaleString(); }
  }

  function renderAll(){
    const data = loadComments();
    list.innerHTML = "";
    if(!data.length){
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "Aún no hay comentarios. ¡Sé el primero en opinar!";
      list.appendChild(li);
      return;
    }
    data
      .sort((a,b)=> b.createdAt - a.createdAt)
      .forEach(renderOne);
  }

  // 🔻 SOLO BORRAR (sin editar)
  function renderOne(c){
    const li = document.createElement("li");
    li.className = "comment-item";
    li.dataset.id = c.id;

    li.innerHTML = `
      <div class="comment-header">
        <span class="author">${escapeHtml(c.authorName || "Usuario")}</span>
        <span class="time">${formatTime(c.createdAt)}</span>
      </div>
      <div class="comment-text">${escapeHtml(c.text)}</div>
      <div class="actions">
        <button class="action-btn action-danger btn-delete">Borrar</button>
      </div>
    `;

    li.querySelector(".btn-delete").addEventListener("click", async () => {
      const user = currentUser();

      // Solo el autor puede borrar su comentario si tiene authorUid
      if (c.authorUid && (!user || c.authorUid !== user.uid)) {
        alert("Solo la persona que escribió este comentario puede eliminarlo.");
        return;
      }

      const ok = await confirm("¿Eliminar este comentario de forma permanente?");
      if(!ok) return;
      const data = loadComments().filter(x => x.id !== c.id);
      saveComments(data);
      renderAll();
    });

    list.appendChild(li);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = textarea.value.trim();
    if(!text) return;

    const data = loadComments();
    const user = currentUser();

    const item = {
      id: uid(),
      text,
      createdAt: Date.now(),
      editedAt: null,
      // NUEVO: datos del autor
      authorName: user?.name || "Usuario",
      authorUid: user?.uid || null
    };

    data.push(item);
    saveComments(data);

    textarea.value = "";
    renderAll();
  });

  renderAll();
})();

/* =========================
   Confirm y Alert personalizados
========================= */
function customConfirm(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "custom-confirm";

    const box = document.createElement("div");
    box.className = "custom-confirm-box";
    box.innerHTML = `
      <p>${message}</p>
      <div class="confirm-buttons">
        <button class="confirm-btn confirm-yes">Aceptar</button>
        <button class="confirm-btn confirm-no">Cancelar</button>
      </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    box.querySelector(".confirm-yes").addEventListener("click", () => {
      document.body.removeChild(overlay);
      resolve(true);
    });
    box.querySelector(".confirm-no").addEventListener("click", () => {
      document.body.removeChild(overlay);
      resolve(false);
    });
  });
}
// usar nuestro confirm en toda la página
window.confirm = customConfirm;

function customAlert(message) {
  const overlay = document.createElement("div");
  overlay.className = "custom-alert";

  const box = document.createElement("div");
  box.className = "custom-alert-box";
  box.innerHTML = `
    <p>${message}</p>
    <button class="custom-alert-btn">Aceptar</button>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  box.querySelector(".custom-alert-btn").addEventListener("click", () => {
    document.body.removeChild(overlay);
  });
}
// alert en toda la página
window.alert = customAlert;

/* =========================
   Mostrar usuario en badge
========================= */
const badge = document.getElementById("userBadge");

// NUEVO: usuario global para comentarios
window.tnCurrentUser = null;

onAuth((user)=>{
  if(!badge) return;
  if(user){
    const name = (user.displayName && user.displayName.trim()) ||
                (user.email ? user.email.split("@")[0] : "Usuario");
    badge.textContent = name;
    badge.style.display = "inline-block";

    // guardar para usar en comentarios
    window.tnCurrentUser = {
      uid: user.uid,
      name
    };
  }else{
    badge.style.display = "none";
    window.tnCurrentUser = null;
  }
});

/* =========================
   Logout (Firebase) simple
========================= */
const logoutBtn = document.getElementById('logoutBtn');
logoutBtn?.addEventListener('click', async ()=>{
  try {
    await logoutUser();
    alert("Sesión cerrada correctamente");
    window.location.href = "login.html";
  } catch(err){
    console.error(err);
    alert("Error al cerrar sesión");
  }
});

/* =========================
   Tabs (Inicio / Sobre / etc)
========================= */
window.openTab = function(tabName){
  document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById(tabName);
  if(sec) sec.classList.add('active');
};

/* =========================
   Gráfica en tiempo real (Chart.js + RTDB)
========================= */
const MAX_POINTS = 60;

// ID de dispositivo (puedes cambiarlo según tu lógica)
const DEVICE_ID = localStorage.getItem("tn_deviceId") || "DISPOSITIVO_001";

// Estructura A: lecturas por dispositivo
const PATH_BASE = `lecturas/${DEVICE_ID}`;
    
let sensorChart = null;

function createChart() {
  const canvas = document.getElementById("sensorChart");
  if (!canvas) {
    console.error("No se encontró el canvas con id sensorChart");
    return null;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.error("No se pudo obtener el contexto 2D del canvas");
    return null;
  }

  const labels = ["10:00", "10:05", "10:10", "10:15", "10:20", "10:25", "10:30", "10:35"];
  const humedadData = [45, 48, 50, 52, 55, 53, 51, 49];
  const temperaturaData = [22, 23, 24, 24.5, 25, 25.3, 25.1, 24.8];

  return  new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Humedad (%)",
          data: humedadData,
          borderColor: "#4ef037",
          backgroundColor: "rgba(78,240,55,0.2)",
          fill: true,
          tension: 0.25
        },
        {
          label: "Temperatura (°C)",
          data: temperaturaData,
          borderColor: "#ffd11a",
          backgroundColor: "rgba(255,209,26,0.2)",
          fill: true,
          tension: 0.25
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { color: "#cfcfcf" }
        }
      },
      scales: {
        x: {
          ticks: { color: "#aaa" },
          grid: { color: "rgba(255,255,255,0.06)" }
        },
        y: {
          ticks: { color: "#aaa" },
          grid: { color: "rgba(255,255,255,0.06)" }
        }
      }
    }
  });
};

function pushPoint(ts, lectura) {
  if (!sensorChart) return;

  const label = new Date(lectura.fecha).toLocaleTimeString("es-MX", { hour12: false });

  sensorChart.data.labels.push(label);
  if (sensorChart.data.labels.length > MAX_POINTS) {
    sensorChart.data.labels.shift();
  }

  const hum = lectura.hum ?? lectura.humedad ?? lectura.soilHum ?? lectura.humedadSuelo ?? null;
  sensorChart.data.datasets[0].data.push(hum);
  if (sensorChart.data.datasets[0].data.length > MAX_POINTS) {
    sensorChart.data.datasets[0].data.shift();
  }

  const temp = lectura.temp ?? lectura.temperatura ?? null;
  sensorChart.data.datasets[1].data.push(temp);
  if (sensorChart.data.datasets[1].data.length > MAX_POINTS) {
    sensorChart.data.datasets[1].data.shift();
  }

  sensorChart.update("none");
}

function redrawBatch(obj) {
  if (!sensorChart || !obj) return;

  sensorChart.data.labels = [];
  sensorChart.data.datasets.forEach(d => { d.data = []; });

  const pares = Object.entries(obj).sort((a, b) => Number(a[1].fecha) - Number(b[1].fecha));
  for (const [ts, lectura] of pares) {
    pushPoint(ts, lectura);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  sensorChart = createChart();
  if (!sensorChart) return;

  onAuth((user) => {
    if (!user) {
      console.warn("No autenticado; no se escuchan lecturas aún.");
      return;
    }

    const path =
      typeof PATH_BASE === "function"
        ? PATH_BASE(user.uid)   // Estructura B
        : PATH_BASE;            // Estructura A

    listenLecturasOnce("dispositivos/Terranova01/lecturas", MAX_POINTS, (batch) => {
      redrawBatch(batch);
      listenLecturasStream("dispositivos/Terranova01/lecturas", (ts, lectura) => {
        if(typeof lectura === "string") return;
        console.log("Lectura; ", lectura); 
        pushPoint(ts, lectura);
      });
    });
  });
});

/* =========================
   BLOQUE EXISTENTE: confirmación de cierre de sesión
========================= */
const btnConfirm = document.getElementById("logoutBtn");

// Intercepta el clic ANTES del listener original y lo cancela
btnConfirm?.addEventListener("click", async (e) => {
  e.preventDefault();
  e.stopImmediatePropagation();

  const ok = await confirm("¿Deseas cerrar sesión?");

  if (!ok) {
    try { window.showToast?.("Cierre de sesión cancelado.", "info"); } catch {}
    return;
  }

  try {
    await logoutUser();
    try { window.showToast?.("Sesión cerrada correctamente.", "success"); } catch {}
    setTimeout(() => { window.location.href = "login.html"; }, 600);
  } catch (err) {
    console.error(err);
    try { window.showToast?.("No se pudo cerrar sesión. Inténtalo de nuevo.", "error"); } catch {
      alert("No se pudo cerrar sesión. Inténtalo de nuevo.");
    }
  }
}, { capture: true });
