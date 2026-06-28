import { BLACKLINE_CONFIG } from './blackline-config.js';
import { GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { getBlacklineAuth } from './firebase-config.js';
import { loadFirebaseAppointments, updateFirebaseAppointment } from './firebase-data.js';

const { business, services, barbers } = BLACKLINE_CONFIG;
const STATUS = {
  pendente: { label: 'Pendente', className: 'pending' },
  confirmado: { label: 'Confirmado', className: 'confirmed' },
  em_atendimento: { label: 'Em atendimento', className: 'serving' },
  concluido: { label: 'Concluido', className: 'done' },
  cancelado: { label: 'Cancelado', className: 'canceled' }
};

let adminEventsBound = false;
let appointmentsCache = [];

function byId(id) { return document.getElementById(id); }
function onlyDigits(value) { return String(value || '').replace(/\D/g, ''); }
function money(value) { return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatPhone(value) {
  const digits = onlyDigits(value);
  if (digits.length === 11) return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 7) + '-' + digits.slice(7);
  return value || '';
}
function maskPhone(value) {
  const digits = onlyDigits(value);
  if (digits.length < 4) return '****';
  return '(**) *****-' + digits.slice(-4);
}
function historyEntry(type, details = {}) {
  return { type, at: new Date().toISOString(), ...details };
}
function formatDate(value) {
  if (!value) return '-';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('pt-BR');
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function whatsappLink(phone, message) { return `https://wa.me/${onlyDigits(phone)}?text=${encodeURIComponent(message)}`; }
function getService(id) { return services.find(item => item.id === id); }
function getBarber(id) { return barbers.find(item => item.id === id); }

function loadAppointments() {
  return appointmentsCache;
}

function saveAppointments(rows) {
  appointmentsCache = Array.isArray(rows) ? rows : [];
}

function normalizeAppointment(item) {
  const service = getService(item.serviceId);
  const barber = getBarber(item.barberId);
  return {
    ...item,
    code: item.code || '-',
    serviceName: item.serviceName || service?.name || '-',
    barberName: item.barberName || barber?.name || '-',
    price: Number(item.price || service?.price || 0),
    durationMinutes: Number(item.durationMinutes || service?.durationMinutes || 0),
    status: STATUS[item.status] ? item.status : 'pendente'
  };
}

function toast(message, type = 'ok') {
  const el = byId('toast');
  el.textContent = message;
  el.className = `toast show ${type}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
}

function buildClientMessage(appointment) {
  return `Ola, ${appointment.name}! Aqui e a ${business.name}.\n\nAgendamento: ${appointment.code}\nServico: ${appointment.serviceName}\nBarbeiro: ${appointment.barberName}\nData: ${formatDate(appointment.date)}\nHorario: ${appointment.time}\nStatus: ${STATUS[appointment.status].label}`;
}

function showAdminLogin(message = '') {
  byId('admin-login').hidden = false;
  byId('admin-shell').hidden = true;
  byId('admin-main').hidden = true;
  byId('admin-login-feedback').textContent = message;
  byId('admin-login-feedback').className = message ? 'form-feedback error' : 'form-feedback';
}

function showAdminPanel() {
  byId('admin-login').hidden = true;
  byId('admin-shell').hidden = false;
  byId('admin-main').hidden = false;
}

function friendlyAuthError(error) {
  const code = error?.code || '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'E-mail ou senha invalidos.';
  if (code.includes('popup-closed-by-user')) return 'Login com Google cancelado.';
  if (code.includes('unauthorized-domain')) return 'Dominio nao autorizado no Firebase Authentication.';
  if (code.includes('operation-not-allowed')) return 'Provedor de login nao habilitado no Firebase Authentication.';
  return 'Nao foi possivel autenticar. Verifique a conta e tente novamente.';
}

async function refreshAppointments() {
  try {
    saveAppointments(await loadFirebaseAppointments());
    renderTable();
  } catch (err) {
    console.error('Erro ao carregar agendamentos do Firestore.', err);
    toast('Nao foi possivel carregar a agenda.', 'error');
  }
}

async function handleAdminLogin(event) {
  event.preventDefault();
  const email = byId('admin-email').value.trim();
  const password = byId('admin-password').value;
  if (!email || !password) {
    showAdminLogin('Informe e-mail e senha.');
    return;
  }
  try {
    const auth = getBlacklineAuth();
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    showAdminLogin(friendlyAuthError(err));
  }
}

async function handleGoogleLogin() {
  try {
    const auth = getBlacklineAuth();
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (err) {
    showAdminLogin(friendlyAuthError(err));
  }
}

async function logoutAdmin() {
  const auth = getBlacklineAuth();
  await signOut(auth);
}

function filteredAppointments() {
  const status = byId('filter-status').value;
  const date = byId('filter-date').value;
  const search = byId('filter-search').value.trim().toLowerCase();
  return loadAppointments().map(normalizeAppointment).filter(item => {
    if (status && item.status !== status) return false;
    if (date && item.date !== date) return false;
    if (search) {
      const haystack = `${item.name} ${item.code} ${item.barberName} ${item.serviceName} ${item.phone}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  }).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

function mostFrequent(rows, key) {
  const counts = new Map();
  rows.forEach(row => counts.set(row[key], (counts.get(row[key]) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
}

function renderMetrics() {
  const rows = loadAppointments().map(normalizeAppointment);
  const today = todayISO();
  const todayRows = rows.filter(row => row.date === today);
  const concludedToday = todayRows.filter(row => row.status === 'concluido');
  byId('metric-today').textContent = todayRows.length;
  byId('metric-revenue').textContent = money(concludedToday.reduce((sum, row) => sum + row.price, 0));
  byId('metric-clients').textContent = concludedToday.length;
  byId('metric-service').textContent = mostFrequent(rows.filter(row => row.status !== 'cancelado'), 'serviceName');
  byId('metric-barber').textContent = mostFrequent(rows.filter(row => row.status !== 'cancelado'), 'barberName');
}

function appendActionButton(container, item, label, dataset) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  Object.entries(dataset).forEach(([key, value]) => { button.dataset[key] = value; });
  button.dataset.id = item.id;
  container.appendChild(button);
}
function appendActions(container, item) {
  if (item.status === 'pendente') appendActionButton(container, item, 'Confirmar', { action: 'status', status: 'confirmado' });
  if (['pendente', 'confirmado'].includes(item.status)) appendActionButton(container, item, 'Iniciar', { action: 'status', status: 'em_atendimento' });
  if (item.status !== 'concluido' && item.status !== 'cancelado') appendActionButton(container, item, 'Concluir', { action: 'status', status: 'concluido' });
  if (item.status !== 'cancelado' && item.status !== 'concluido') appendActionButton(container, item, 'Cancelar', { action: 'cancel' });
  const link = document.createElement('a');
  link.href = whatsappLink(item.phone, buildClientMessage(item));
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = 'WhatsApp';
  container.appendChild(link);
}

function renderTable() {
  const rows = filteredAppointments();
  const tbody = byId('appointments-body');
  const empty = byId('empty-state');
  const table = byId('table-wrap');
  tbody.replaceChildren();
  rows.forEach(item => {
    const status = STATUS[item.status];
    const row = document.createElement('tr');
    const cells = [
      ['Codigo', item.code, true],
      ['Cliente', item.name],
      ['WhatsApp', maskPhone(item.phone)],
      ['Servico', item.serviceName],
      ['Barbeiro', item.barberName],
      ['Data', formatDate(item.date)],
      ['Horario', item.time],
      ['Duracao', item.durationMinutes ? item.durationMinutes + ' min' : '-'],
      ['Valor', money(item.price)]
    ];
    cells.forEach(([label, value, strong]) => {
      const cell = document.createElement('td');
      cell.dataset.label = label;
      if (strong) {
        const el = document.createElement('strong');
        el.textContent = value || '-';
        cell.appendChild(el);
      } else {
        cell.textContent = value || '-';
      }
      row.appendChild(cell);
    });
    const statusCell = document.createElement('td');
    statusCell.dataset.label = 'Status';
    const statusBadge = document.createElement('span');
    statusBadge.className = 'status ' + status.className;
    statusBadge.textContent = status.label;
    statusCell.appendChild(statusBadge);
    row.appendChild(statusCell);
    const actionsCell = document.createElement('td');
    actionsCell.dataset.label = 'Acoes';
    const actions = document.createElement('div');
    actions.className = 'actions';
    appendActions(actions, item);
    actionsCell.appendChild(actions);
    row.appendChild(actionsCell);
    tbody.appendChild(row);
  });
  empty.hidden = rows.length > 0;
  table.hidden = rows.length === 0;
  renderMetrics();
}

async function updateStatus(id, status) {
  const rows = loadAppointments();
  const index = rows.findIndex(item => item.id === id || item.code === id);
  if (index === -1) return;
  const previousHistory = Array.isArray(rows[index].history) ? rows[index].history : [];
  const patch = {
    status,
    history: [...previousHistory, historyEntry('admin_status_changed', { status })]
  };
  try {
    await updateFirebaseAppointment(rows[index].code || id, { status });
    rows[index] = { ...rows[index], ...patch, updatedAt: new Date().toISOString() };
    saveAppointments(rows);
    renderTable();
    toast('Status atualizado para ' + STATUS[status].label + '.');
  } catch (err) {
    console.error('Erro ao atualizar agendamento no Firestore.', err);
    toast('Nao foi possivel atualizar o status.', 'error');
  }
}

function cancelAppointment(id) {
  if (!confirm('Cancelar este agendamento?')) return;
  updateStatus(id, 'cancelado');
}

function attachEvents() {
  if (adminEventsBound) return;
  adminEventsBound = true;
  ['filter-status', 'filter-date', 'filter-search'].forEach(id => byId(id).addEventListener('input', renderTable));
  byId('clear-filters').addEventListener('click', () => {
    byId('filter-status').value = '';
    byId('filter-date').value = '';
    byId('filter-search').value = '';
    renderTable();
  });
  byId('refresh-list').addEventListener('click', () => { refreshAppointments(); toast('Painel atualizado.'); });
  byId('appointments-body').addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const { action, id, status } = target.dataset;
    if (action === 'status') updateStatus(id, status);
    if (action === 'cancel') cancelAppointment(id);
  });
}

async function initAuthState() {
  const auth = getBlacklineAuth();
  onAuthStateChanged(auth, user => {
    if (!user) {
      showAdminLogin();
      return;
    }
    showAdminPanel();
    attachEvents();
    refreshAppointments();
    toast('Acesso liberado.');
  });
}

byId('admin-login-form').addEventListener('submit', handleAdminLogin);
byId('admin-google-login').addEventListener('click', handleGoogleLogin);
byId('admin-logout').addEventListener('click', logoutAdmin);
showAdminLogin();
initAuthState().catch(err => {
  console.error('Erro ao iniciar Firebase Auth.', err);
  showAdminLogin('Firebase Authentication nao configurado.');
});