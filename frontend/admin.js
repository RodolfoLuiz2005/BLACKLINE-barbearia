import { BLACKLINE_CONFIG } from './blackline-config.js';

const { business, services, barbers, storageKeys } = BLACKLINE_CONFIG;
const STATUS = {
  pendente: { label: 'Pendente', className: 'pending' },
  confirmado: { label: 'Confirmado', className: 'confirmed' },
  em_atendimento: { label: 'Em atendimento', className: 'serving' },
  concluido: { label: 'Concluído', className: 'done' },
  cancelado: { label: 'Cancelado', className: 'canceled' }
};
const ADMIN_SESSION_KEY = 'blackline:admin:session';
const ADMIN_PIN_HASH = '158a323a7ba44870f23d96f1516dd70aa48e9a72db4ebb026b0a89e212a208ab';
const FUTURE_ADMIN_ROLES = ['admin', 'barbeiro', 'recepção'];
let adminEventsBound = false;

// Autenticação provisória para ambiente sem backend. Em produção, substitua por autenticação real no servidor (Supabase, Firebase Auth ou API própria) e regras de autorização no backend.
async function hashText(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function isAdminAuthenticated() { return sessionStorage.getItem(ADMIN_SESSION_KEY) === 'ok'; }
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
async function handleAdminLogin(event) {
  event.preventDefault();
  const pin = byId('admin-pin').value.trim();
  if (!pin) {
    showAdminLogin('Informe o PIN administrativo.');
    return;
  }
  if (await hashText(pin) !== ADMIN_PIN_HASH) {
    showAdminLogin('PIN inválido.');
    return;
  }
  sessionStorage.setItem(ADMIN_SESSION_KEY, 'ok');
  showAdminPanel();
  attachEvents();
  renderTable();
  toast('Acesso liberado.');
}
function logoutAdmin() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  byId('admin-pin').value = '';
  showAdminLogin();
}

function byId(id) { return document.getElementById(id); }
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
function onlyDigits(value) { return String(value || '').replace(/\D/g, ''); }
function money(value) { return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatPhone(value) {
  const digits = onlyDigits(value);
  if (digits.length === 11) return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 7) + '-' + digits.slice(7);
  return value || '';
}
function maskPhone(value) {
  const digits = onlyDigits(value);
  if (digits.length < 4) return '••••';
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

function loadAppointments() {
  try { return JSON.parse(localStorage.getItem(storageKeys.appointments) || '[]'); }
  catch { return []; }
}
function saveAppointments(rows) { localStorage.setItem(storageKeys.appointments, JSON.stringify(rows)); }
function getService(id) { return services.find(item => item.id === id); }
function getBarber(id) { return barbers.find(item => item.id === id); }

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
  return `Olá, ${appointment.name}! Aqui é a ${business.name}.\n\nAgendamento: ${appointment.code}\nServiço: ${appointment.serviceName}\nBarbeiro: ${appointment.barberName}\nData: ${formatDate(appointment.date)}\nHorário: ${appointment.time}\nStatus: ${STATUS[appointment.status].label}`;
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
      ['Código', item.code, true],
      ['Cliente', item.name],
      ['WhatsApp', maskPhone(item.phone)],
      ['Serviço', item.serviceName],
      ['Barbeiro', item.barberName],
      ['Data', formatDate(item.date)],
      ['Horário', item.time],
      ['Duração', item.durationMinutes ? item.durationMinutes + ' min' : '-'],
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
    actionsCell.dataset.label = 'Ações';
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

function updateStatus(id, status) {
  const rows = loadAppointments();
  const index = rows.findIndex(item => item.id === id);
  if (index === -1) return;
  const previousHistory = Array.isArray(rows[index].history) ? rows[index].history : [];
  rows[index].status = status;
  rows[index].history = [...previousHistory, historyEntry('admin_status_changed', { status })];
  rows[index].updatedAt = new Date().toISOString();
  saveAppointments(rows);
  renderTable();
  toast('Status atualizado para ' + STATUS[status].label + '.');
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
  byId('refresh-list').addEventListener('click', () => { renderTable(); toast('Painel atualizado.'); });
  byId('appointments-body').addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const { action, id, status } = target.dataset;
    if (action === 'status') updateStatus(id, status);
    if (action === 'cancel') cancelAppointment(id);
  });
}

byId('admin-login-form').addEventListener('submit', handleAdminLogin);
byId('admin-logout').addEventListener('click', logoutAdmin);
if (isAdminAuthenticated()) {
  showAdminPanel();
  attachEvents();
  renderTable();
} else {
  showAdminLogin();
}
