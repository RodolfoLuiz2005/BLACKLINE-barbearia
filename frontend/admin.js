import { BLACKLINE_CONFIG } from './blackline-config.js';

const { business, services, barbers, storageKeys } = BLACKLINE_CONFIG;
const STATUS = {
  pendente: { label: 'Pendente', className: 'pending' },
  confirmado: { label: 'Confirmado', className: 'confirmed' },
  em_atendimento: { label: 'Em atendimento', className: 'serving' },
  concluido: { label: 'Concluido', className: 'done' },
  cancelado: { label: 'Cancelado', className: 'canceled' }
};

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
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return value || '';
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
  return `Ola, ${appointment.name}! Aqui e a ${business.name}.\n\nAgendamento: ${appointment.code}\nServico: ${appointment.serviceName}\nBarbeiro: ${appointment.barberName}\nData: ${formatDate(appointment.date)}\nHorario: ${appointment.time}\nStatus: ${STATUS[appointment.status].label}`;
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

function actionButtons(item) {
  const id = escapeHtml(item.id);
  const parts = [];
  if (item.status === 'pendente') parts.push(`<button data-action="status" data-id="${id}" data-status="confirmado">Confirmar</button>`);
  if (['pendente', 'confirmado'].includes(item.status)) parts.push(`<button data-action="status" data-id="${id}" data-status="em_atendimento">Iniciar</button>`);
  if (item.status !== 'concluido' && item.status !== 'cancelado') parts.push(`<button data-action="status" data-id="${id}" data-status="concluido">Concluir</button>`);
  if (item.status !== 'cancelado' && item.status !== 'concluido') parts.push(`<button data-action="cancel" data-id="${id}">Cancelar</button>`);
  parts.push(`<a href="${whatsappLink(item.phone, buildClientMessage(item))}" target="_blank" rel="noopener">WhatsApp</a>`);
  return parts.join('');
}

function renderTable() {
  const rows = filteredAppointments();
  const tbody = byId('appointments-body');
  const empty = byId('empty-state');
  const table = byId('table-wrap');
  tbody.innerHTML = rows.map(item => {
    const status = STATUS[item.status];
    return `
      <tr>
        <td data-label="Codigo"><strong>${escapeHtml(item.code)}</strong></td>
        <td data-label="Cliente">${escapeHtml(item.name)}</td>
        <td data-label="WhatsApp">${escapeHtml(formatPhone(item.phone))}</td>
        <td data-label="Servico">${escapeHtml(item.serviceName)}</td>
        <td data-label="Barbeiro">${escapeHtml(item.barberName)}</td>
        <td data-label="Data">${escapeHtml(formatDate(item.date))}</td>
        <td data-label="Horario">${escapeHtml(item.time)}</td>
        <td data-label="Duracao">${item.durationMinutes ? `${item.durationMinutes} min` : '-'}</td>
        <td data-label="Valor">${money(item.price)}</td>
        <td data-label="Status"><span class="status ${status.className}">${status.label}</span></td>
        <td data-label="Acoes"><div class="actions">${actionButtons(item)}</div></td>
      </tr>
    `;
  }).join('');
  empty.hidden = rows.length > 0;
  table.hidden = rows.length === 0;
  renderMetrics();
}

function updateStatus(id, status) {
  const rows = loadAppointments();
  const index = rows.findIndex(item => item.id === id);
  if (index === -1) return;
  rows[index].status = status;
  rows[index].updatedAt = new Date().toISOString();
  saveAppointments(rows);
  renderTable();
  toast(`Status atualizado para ${STATUS[status].label}.`);
}

function cancelAppointment(id) {
  if (!confirm('Cancelar este agendamento?')) return;
  updateStatus(id, 'cancelado');
}

function attachEvents() {
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

attachEvents();
renderTable();
