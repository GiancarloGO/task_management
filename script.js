// ─── Configuración ────────────────────────────────────────────────────────
const API = 'api.php';          // ruta relativa al archivo PHP

// ─── Estado global ────────────────────────────────────────────────────────
let allTasks     = [];          // caché de todas las tareas
let editingId    = null;        // ID de la tarea en edición (null = nueva)
let deleteId     = null;        // ID de la tarea a eliminar (modal)
let currentFilter = 'all';     // filtro activo

// ─── Helpers de UI ────────────────────────────────────────────────────────
const $  = id => document.getElementById(id);
const show = el => el.classList.remove('hidden');
const hide = el => el.classList.add('hidden');

function showNotification(msg, type = 'success') {
  // Notificación ligera en el header
  const n = document.createElement('div');
  n.textContent = msg;
  n.style.cssText = `
    position:fixed; top:1rem; right:1rem; z-index:200;
    background:${type === 'success' ? '#22c55e' : '#ef4444'};
    color:#fff; padding:.6rem 1.2rem; border-radius:8px;
    font-size:.88rem; font-weight:600; box-shadow:0 4px 12px rgba(0,0,0,.2);
    animation: fadeIn .3s ease;
  `;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 2500);
}

// ─── 1. READ — Cargar tareas ───────────────────────────────────────────────
async function loadTasks() {
  try {
    const res  = await fetch(API);
    allTasks   = await res.json();
    renderTasks();
  } catch {
    $('task-list').innerHTML = '<p class="empty-msg">⚠️ Error al conectar con el servidor.</p>';
  }
}

// ─── Renderizar lista según filtro ────────────────────────────────────────
function renderTasks() {
  const list = $('task-list');
  list.innerHTML = '';

  const filtered = allTasks.filter(t => {
    if (currentFilter === 'pending') return t.completed == 0;
    if (currentFilter === 'done')    return t.completed == 1;
    return true;
  });

  $('task-count').textContent = `${filtered.length} tarea(s)`;

  if (!filtered.length) {
    list.innerHTML = '<p class="empty-msg">No hay tareas en esta categoría.</p>';
    return;
  }

  filtered.forEach(t => list.appendChild(buildCard(t)));
}

// ─── Construir tarjeta HTML ───────────────────────────────────────────────
function buildCard(t) {
  const div = document.createElement('div');
  div.className = `task-card ${t.completed == 1 ? 'done' : ''}`;
  div.id = `card-${t.id}`;

  const date = new Date(t.created_at).toLocaleDateString('es-PE', {
    day:'2-digit', month:'short', year:'numeric'
  });

  div.innerHTML = `
    <input type="checkbox" class="task-check"
           ${t.completed == 1 ? 'checked' : ''}
           onchange="toggleComplete(${t.id}, this.checked)"
           title="Marcar como ${t.completed == 1 ? 'pendiente' : 'completada'}"/>
    <div class="task-body">
      <p class="task-title">${escHtml(t.title)}</p>
      ${t.description ? `<p class="task-desc">${escHtml(t.description)}</p>` : ''}
      <p class="task-date">📅 ${date}</p>
    </div>
    <div class="task-btns">
      <button class="btn-edit" onclick="startEdit(${t.id})">✏️ Editar</button>
      <button class="btn-del"  onclick="openModal(${t.id})">🗑️ Eliminar</button>
    </div>
  `;
  return div;
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── 2. CREATE / UPDATE — Guardar tarea ───────────────────────────────────
async function saveTask() {
  const title = $('task-title').value.trim();
  const desc  = $('task-desc').value.trim();

  if (!title) {
    $('task-title').focus();
    showNotification('⚠️ El título es obligatorio', 'error');
    return;
  }

  const body   = JSON.stringify({ title, description: desc });
  const method = editingId ? 'PUT' : 'POST';
  const url    = editingId ? `${API}?id=${editingId}` : API;

  try {
    const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    showNotification(editingId ? '✅ Tarea actualizada' : '✅ Tarea creada');
    cancelEdit();
    loadTasks();
  } catch (e) {
    showNotification('❌ ' + e.message, 'error');
  }
}

// ─── 3. Marcar completada / pendiente ─────────────────────────────────────
async function toggleComplete(id, completed) {
  try {
    await fetch(`${API}?id=${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed })
    });
    // Actualizar caché local sin recargar todo
    const t = allTasks.find(x => x.id == id);
    if (t) t.completed = completed ? 1 : 0;
    renderTasks();
  } catch {
    showNotification('❌ Error al actualizar', 'error');
  }
}

// ─── 4. DELETE — Eliminar tarea ───────────────────────────────────────────
function openModal(id) {
  deleteId = id;
  show($('modal-overlay'));
}
function closeModal() {
  deleteId = null;
  hide($('modal-overlay'));
}
async function confirmDelete() {
  try {
    await fetch(`${API}?id=${deleteId}`, { method: 'DELETE' });
    showNotification('🗑️ Tarea eliminada');
    allTasks = allTasks.filter(t => t.id != deleteId);
    renderTasks();
  } catch {
    showNotification('❌ Error al eliminar', 'error');
  }
  closeModal();
}

// ─── Edición ──────────────────────────────────────────────────────────────
function startEdit(id) {
  const t = allTasks.find(x => x.id == id);
  if (!t) return;

  editingId = id;
  $('task-title').value = t.title;
  $('task-desc').value  = t.description || '';
  $('form-title').textContent = '✏️ Editar Tarea';
  show($('btn-cancel'));
  $('task-title').focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
  editingId = null;
  $('task-title').value = '';
  $('task-desc').value  = '';
  $('form-title').textContent = 'Nueva Tarea';
  hide($('btn-cancel'));
}

// ─── Filtros ──────────────────────────────────────────────────────────────
function filterTasks(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTasks();
}

// ─── Cerrar modal con Escape ──────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ─── Iniciar app ──────────────────────────────────────────────────────────
loadTasks();