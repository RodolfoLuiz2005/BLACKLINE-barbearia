import { BLACKLINE_CONFIG } from './blackline-config.js';
import { createFirebaseAppointment, loadFirebaseAppointments } from './firebase-data.js';

const { business, assets, services, barbers, sampleTestimonials, schedule, storageKeys } = BLACKLINE_CONFIG;
const statusLabels = {
  pendente: 'Pendente',
  confirmado: 'Confirmado',
  em_atendimento: 'Em atendimento',
  concluido: 'Concluído',
  cancelado: 'Cancelado'
};
const BOOKING_BLOCKING_STATUSES = new Set(['pendente', 'confirmado', 'em_atendimento']);
const CLIENT_MUTABLE_STATUSES = new Set(['pendente', 'confirmado']);
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MANAGE_ATTEMPT_KEY = 'blackline:manage-attempts';
const MANAGE_MAX_ATTEMPTS = 5;
const MANAGE_LOCK_MS = 5 * 60 * 1000;
const NAME_MAX_LENGTH = 80;
const NOTE_MAX_LENGTH = 300;
const GENERIC_MANAGE_ERROR = 'Não foi possível consultar o agendamento. Confira os dados e tente novamente.';

let managedAppointmentId = '';
let managedAccessToken = '';
let currentStep = 0;
const BOOKING_STEP_COUNT = 6;
const TIME_PERIODS = [
  { label: 'Manhã', slots: ['09:00', '09:30', '10:00', '10:30', '11:00'] },
  { label: 'Tarde', slots: ['14:00', '14:30', '15:00', '15:30', '16:00'] },
  { label: 'Noite', slots: ['17:00', '17:30', '18:00', '18:30', '19:00'] }
];
const BOOKABLE_TIME_SLOTS = TIME_PERIODS.flatMap(period => period.slots);
let calendarCursor = new Date();
calendarCursor.setDate(1);
calendarCursor.setHours(12, 0, 0, 0);
const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAYS_LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function byId(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase();
}

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPhone(value) {
  const digits = onlyDigits(value);
  if (digits.length === 13 && digits.startsWith('55')) {
    const local = digits.slice(2);
    return `+55 (${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return value || '';
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('pt-BR');
}

function whatsappLink(phone, message) {
  const cleanPhone = onlyDigits(phone);
  if (!cleanPhone) return '#';
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
function isValidBrazilianWhatsapp(value) {
  const digits = onlyDigits(value);
  if (digits.length !== 11) return false;
  if (!/^[1-9]{2}9\d{8}$/.test(digits)) return false;
  return !/^(\d)\1+$/.test(digits);
}
function sanitizeTextField(value, maxLength) {
  return String(value || '').replace(/[<>]/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}
function sanitizeNoteField(value) {
  return String(value || '').replace(/[<>]/g, '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim().slice(0, NOTE_MAX_LENGTH);
}
function maskPhone(value) {
  const digits = onlyDigits(value);
  if (digits.length < 4) return '••••';
  return `(**) *****-${digits.slice(-4)}`;
}

let appointmentsCache = [];

function loadAppointments() {
  return appointmentsCache;
}

function saveAppointments(rows) {
  appointmentsCache = Array.isArray(rows) ? rows : [];
  localStorage.setItem(storageKeys.appointments, JSON.stringify(appointmentsCache));
}

function loadLocalAppointmentsFallback() {
  try {
    return JSON.parse(localStorage.getItem(storageKeys.appointments) || '[]');
  } catch {
    return [];
  }
}

async function refreshAppointmentsFromFirebase() {
  try {
    saveAppointments(await loadFirebaseAppointments());
  } catch (err) {
    saveAppointments(loadLocalAppointmentsFallback());
    console.warn('Nao foi possivel carregar agendamentos do Firestore; usando cache local.', err);
  }
}

function randomCodeSuffix(length = 6) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}
function nextCode() {
  const existing = new Set(loadAppointments().map(item => normalizeCode(item.code)));
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const code = `BLK-${randomCodeSuffix()}`;
    if (!existing.has(code)) return code;
  }
  throw new Error('Não foi possível gerar um código seguro. Tente novamente.');
}

function minutesFromTime(value) {
  const [hours, minutes] = String(value || '00:00').split(':').map(Number);
  return (hours * 60) + (minutes || 0);
}

function timeFromMinutes(value) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
}

function isPastSlot(dateValue, timeValue) {
  const slotDate = new Date(dateValue + 'T' + timeValue + ':00');
  return slotDate.getTime() < Date.now();
}

function localIsoDate(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function startOfLocalDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function getBarberAvailability(barberId) {
  const barber = barbers.find(item => item.id === barberId);
  return {
    availableWeekDays: barber?.availableWeekDays || schedule.openDays,
    unavailableDates: barber?.unavailableDates || []
  };
}

function isDateOpen(dateValue, barberId = '') {
  if (!dateValue || !barberId) return false;
  const date = new Date(dateValue + 'T12:00:00');
  if (Number.isNaN(date.getTime()) || startOfLocalDay(date) < startOfLocalDay()) return false;

  const availability = getBarberAvailability(barberId);
  const day = date.getDay();
  if (!schedule.openDays.includes(day)) return false;
  if (!availability.availableWeekDays.includes(day)) return false;
  if (availability.unavailableDates.includes(dateValue)) return false;
  return true;
}

function getSelectedService() {
  return services.find(item => item.id === byId('booking-service')?.value) || null;
}

function calculateServiceSlots(service = getSelectedService()) {
  const duration = Number(service?.durationMinutes || schedule.intervalMinutes);
  return Math.max(1, Math.ceil(duration / schedule.intervalMinutes));
}

function getScheduleSlots(dateValue, barberId) {
  if (!barberId || !isDateOpen(dateValue, barberId)) return [];
  return [...BOOKABLE_TIME_SLOTS];
}

function getBookedSlots(dateValue, barberId, ignoreId = '') {
  const booked = new Set();
  loadAppointments()
    .filter(item => item.id !== ignoreId && item.date === dateValue && item.barberId === barberId && BOOKING_BLOCKING_STATUSES.has(item.status || 'pendente'))
    .forEach(item => {
      const service = services.find(serviceItem => serviceItem.id === item.serviceId);
      const slotsCount = calculateServiceSlots(service || { durationMinutes: item.durationMinutes || schedule.intervalMinutes });
      let start = minutesFromTime(item.time);
      for (let index = 0; index < slotsCount; index += 1) {
        booked.add(timeFromMinutes(start + (index * schedule.intervalMinutes)));
      }
    });
  return booked;
}

function occupiedTimes(dateValue, barberId, ignoreId = '') {
  return getBookedSlots(dateValue, barberId, ignoreId);
}

function isSlotAvailable(dateValue, barberId, timeValue, service = getSelectedService(), ignoreId = '') {
  if (!service || !barberId || !isDateOpen(dateValue, barberId) || isPastSlot(dateValue, timeValue)) return false;
  const slots = getScheduleSlots(dateValue, barberId);
  const slotsNeeded = calculateServiceSlots(service);
  const start = minutesFromTime(timeValue);
  if (!slots.includes(timeValue) || start + (slotsNeeded * schedule.intervalMinutes) > minutesFromTime(schedule.end)) return false;

  const booked = getBookedSlots(dateValue, barberId, ignoreId);
  for (let index = 0; index < slotsNeeded; index += 1) {
    if (booked.has(timeFromMinutes(start + (index * schedule.intervalMinutes)))) return false;
  }
  return true;
}

function availableTimes(dateValue, barberId, ignoreId = '', serviceOverride = null) {
  const service = serviceOverride || getSelectedService();
  return getScheduleSlots(dateValue, barberId).filter(time => isSlotAvailable(dateValue, barberId, time, service, ignoreId));
}

function getNextAvailableDays(daysCount = 7) {
  const serviceId = byId('booking-service')?.value || '';
  const barberId = byId('booking-barber')?.value || '';
  return Array.from({ length: daysCount }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    date.setHours(12, 0, 0, 0);
    const iso = localIsoDate(date);
    const unlocked = Boolean(serviceId && barberId);
    const open = unlocked && isDateOpen(iso, barberId);
    const slots = open ? availableTimes(iso, barberId) : [];
    return {
      iso,
      dayNumber: date.getDate(),
      weekdayShort: index === 0 ? 'Hoje' : WEEKDAYS_SHORT[date.getDay()],
      weekdayLong: WEEKDAYS_LONG[date.getDay()],
      monthShort: MONTHS_SHORT[date.getMonth()],
      monthLong: MONTHS_LONG[date.getMonth()],
      available: open && slots.length > 0,
      availabilityText: open && slots.length > 0 ? slots.length + ' livres' : 'Sem horários'
    };
  });
}

function getAvailableDays(daysCount = 7) {
  return getNextAvailableDays(daysCount);
}

function longDateLabel(dateValue) {
  if (!dateValue) return '';
  const date = new Date(dateValue + 'T12:00:00');
  if (Number.isNaN(date.getTime())) return '';
  return WEEKDAYS_LONG[date.getDay()] + ', ' + date.getDate() + ' de ' + MONTHS_LONG[date.getMonth()];
}

function periodFor(time) {
  return TIME_PERIODS.find(period => period.slots.includes(time))?.label || 'Noite';
}

function getTimeSlotsByDay(dateValue, barberId, ignoreId = '') {
  const service = getSelectedService();
  const booked = getBookedSlots(dateValue, barberId, ignoreId);
  return getScheduleSlots(dateValue, barberId).map(time => {
    const bookedByExisting = booked.has(time);
    const available = isSlotAvailable(dateValue, barberId, time, service, ignoreId);
    return {
      time,
      period: periodFor(time),
      available,
      status: available ? 'Disponível' : bookedByExisting ? 'Ocupado' : 'Indisponível'
    };
  });
}

function groupedSlots(dateValue, barberId) {
  return getTimeSlotsByDay(dateValue, barberId).reduce((groups, slot) => {
    if (!groups[slot.period]) groups[slot.period] = [];
    groups[slot.period].push(slot);
    return groups;
  }, {});
}

function getAppointment(id) {
  return loadAppointments().find(item => item.id === id);
}

function setAppointment(id, patch, history = null) {
  const rows = loadAppointments();
  const index = rows.findIndex(item => item.id === id);
  if (index === -1) return null;
  const previousHistory = Array.isArray(rows[index].history) ? rows[index].history : [];
  rows[index] = { ...rows[index], ...patch, history: history ? [...previousHistory, history] : previousHistory, updatedAt: new Date().toISOString() };
  saveAppointments(rows);
  return rows[index];
}
function historyEntry(type, details = {}) { return { type, at: new Date().toISOString(), ...details }; }
function manageTokenFor(appointment) { return appointment ? [appointment.id, normalizeCode(appointment.code), onlyDigits(appointment.phone)].join(':') : ''; }
function canManageAppointment(appointment) { return Boolean(appointment && managedAppointmentId === appointment.id && managedAccessToken === manageTokenFor(appointment)); }
function canClientModify(appointment) { return canManageAppointment(appointment) && CLIENT_MUTABLE_STATUSES.has(appointment.status || 'pendente'); }
function getManageAttemptState() {
  try {
    const state = JSON.parse(sessionStorage.getItem(MANAGE_ATTEMPT_KEY) || '{}');
    if (Number(state.lockUntil || 0) <= Date.now()) return { count: Number(state.count || 0), lockUntil: 0 };
    return { count: Number(state.count || 0), lockUntil: Number(state.lockUntil || 0) };
  } catch { return { count: 0, lockUntil: 0 }; }
}
function setManageAttemptState(state) { sessionStorage.setItem(MANAGE_ATTEMPT_KEY, JSON.stringify(state)); }
function clearManageAttempts() { sessionStorage.removeItem(MANAGE_ATTEMPT_KEY); }
function registerManageFailure() {
  const state = getManageAttemptState();
  const nextCount = state.count + 1;
  const nextState = nextCount >= MANAGE_MAX_ATTEMPTS ? { count: nextCount, lockUntil: Date.now() + MANAGE_LOCK_MS } : { count: nextCount, lockUntil: 0 };
  setManageAttemptState(nextState);
  return nextState;
}

function setHeroMedia() {
  const video = byId('hero-video');
  const source = byId('hero-video-source');
  const fallback = byId('hero-fallback');
  source.src = assets.heroVideo;
  video.poster = assets.heroFallback;
  fallback.style.backgroundImage = `url('${assets.heroFallback}')`;
  video.load();
  video.addEventListener('error', () => document.body.classList.add('hero-video-failed'));
  source.addEventListener('error', () => document.body.classList.add('hero-video-failed'));
}

function renderServices() {
  byId('services-grid').innerHTML = services.map((service, index) => `
    <article class="service-card reveal" style="--delay:${index * 70}ms">
      <div class="card-topline">
        <span>${escapeHtml(service.duration)}</span>
        <strong>${money(service.price)}</strong>
      </div>
      <h3>${escapeHtml(service.name)}</h3>
      <p>${escapeHtml(service.description)}</p>
      <button class="ghost-button" type="button" data-service="${escapeHtml(service.id)}">Agendar este serviço</button>
    </article>
  `).join('');
}

function renderBarbers() {
  byId('barbers-grid').innerHTML = barbers.map((barber, index) => `
    <article class="barber-card reveal" style="--delay:${index * 90}ms">
      <img src="${escapeHtml(barber.photo || assets.barberFallback)}" alt="${escapeHtml(barber.name)}" loading="lazy" onerror="this.src='${escapeHtml(assets.barberFallback)}'" />
      <div>
        <h3>${escapeHtml(barber.name)}</h3>
        <p>${escapeHtml(barber.specialty)}</p>
        <span>${escapeHtml(barber.availableDays)}</span>
        <button class="ghost-button" type="button" data-barber="${escapeHtml(barber.id)}">Agendar com este barbeiro</button>
      </div>
    </article>
  `).join('');
}

function renderTestimonials() {
  byId('testimonials-grid').innerHTML = sampleTestimonials.map((item, index) => `
    <article class="testimonial-card reveal" style="--delay:${index * 90}ms">
      <div class="stars" aria-label="${item.rating} estrelas">${'*'.repeat(item.rating)}</div>
      <p>"${escapeHtml(item.text)}"</p>
      <strong>${escapeHtml(item.name)}</strong>
    </article>
  `).join('');
}

function serviceOptions(selected = '') {
  return '<option value="">Escolha o serviço</option>' + services
    .map(service => `<option value="${escapeHtml(service.id)}" ${service.id === selected ? 'selected' : ''}>${escapeHtml(service.name)} - ${money(service.price)}</option>`)
    .join('');
}

function barberOptions(selected = '') {
  return '<option value="">Escolha o barbeiro</option>' + barbers
    .map(barber => `<option value="${escapeHtml(barber.id)}" ${barber.id === selected ? 'selected' : ''}>${escapeHtml(barber.name)} - ${escapeHtml(barber.specialty)}</option>`)
    .join('');
}

function renderBookingServiceCards() {
  byId('booking-service-options').innerHTML = services.map(service => '<button class="booking-option service-option" type="button" data-booking-service="' + escapeHtml(service.id) + '">'
    + '<strong>' + escapeHtml(service.name) + '</strong>'
    + '<span>' + escapeHtml(service.duration) + ' &bull; ' + money(service.price) + '</span>'
    + '</button>').join('');
}

function renderBookingBarberCards() {
  byId('booking-barber-options').innerHTML = barbers.map(barber => '<button class="booking-option barber-option" type="button" data-booking-barber="' + escapeHtml(barber.id) + '">'
    + '<img src="' + escapeHtml(barber.photo || assets.barberFallback) + '" alt="' + escapeHtml(barber.name) + '" loading="lazy" onerror="this.src=\'' + escapeHtml(assets.barberFallback) + '\'">'
    + '<strong>' + escapeHtml(barber.name) + '</strong>'
    + '<p>' + escapeHtml(barber.specialty) + '</p>'
    + '</button>').join('');
}

function renderSelects() {
  byId('booking-service').innerHTML = serviceOptions();
  byId('booking-barber').innerHTML = barberOptions();
  byId('reschedule-barber').innerHTML = barberOptions();
  renderBookingServiceCards();
  renderBookingBarberCards();
}

function setMinDate() {
  const today = new Date().toISOString().slice(0, 10);
  byId('booking-date').min = today;
  byId('reschedule-date').min = today;
}

function fillTimeSelect(select, slots) {
  select.innerHTML = '<option value="">Escolha o horário</option>' + slots.map(time => `<option value="${time}">${time}</option>`).join('');
  if (!slots.length) select.innerHTML = '<option value="">Sem horários disponíveis</option>';
}

function clearSelectedDateTime() {
  byId('booking-date').value = '';
  byId('booking-time').value = '';
  byId('selected-day-label').textContent = byId('booking-service').value && byId('booking-barber').value
    ? 'Escolha uma data no calendário.'
    : 'Escolha serviço e barbeiro para liberar a data.';
  byId('selected-time-label').textContent = 'Selecione uma data para ver os horários.';
}

function hasAvailableTimes(dateValue, barberId) {
  return availableTimes(dateValue, barberId).length > 0;
}

function isDateAvailable(dateValue, barberId) {
  return Boolean(byId('booking-service').value && barberId && isDateOpen(dateValue, barberId) && hasAvailableTimes(dateValue, barberId));
}

function calendarMonthLabel(date) {
  return MONTHS_LONG[date.getMonth()] + ' de ' + date.getFullYear();
}

function setCalendarCursorFromDate(dateValue = '') {
  const base = dateValue ? new Date(dateValue + 'T12:00:00') : new Date();
  calendarCursor = new Date(base.getFullYear(), base.getMonth(), 1, 12, 0, 0, 0);
}

function renderMiniCalendar() {
  const calendar = byId('mini-calendar');
  const daysWrapper = byId('calendar-days');
  const serviceId = byId('booking-service').value;
  const barberId = byId('booking-barber').value;
  const selectedDate = byId('booking-date').value;
  const unlocked = Boolean(serviceId && barberId);

  byId('calendar-toggle').disabled = !unlocked;
  byId('calendar-month-label').textContent = calendarMonthLabel(calendarCursor);
  byId('calendar-prev').disabled = calendarCursor <= new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12, 0, 0, 0);

  if (!unlocked) {
    daysWrapper.innerHTML = '<p class="picker-empty calendar-empty">Escolha serviço e barbeiro.</p>';
    calendar.hidden = true;
    return;
  }
  calendar.hidden = false;

  const firstDay = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1, 12, 0, 0, 0);
  const lastDay = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 0, 12, 0, 0, 0);
  const todayIso = localIsoDate(new Date());
  const cells = [];

  for (let index = 0; index < firstDay.getDay(); index += 1) {
    cells.push('<span class="calendar-day-spacer" aria-hidden="true"></span>');
  }

  for (let dayNumber = 1; dayNumber <= lastDay.getDate(); dayNumber += 1) {
    const date = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), dayNumber, 12, 0, 0, 0);
    const iso = localIsoDate(date);
    const selected = iso === selectedDate;
    const today = iso === todayIso;
    const available = isDateAvailable(iso, barberId);
    const label = available ? 'Disponível' : 'Indisponível';
    cells.push('<button class="calendar-day ' + (selected ? 'is-selected ' : '') + (today ? 'is-today ' : '') + (!available ? 'is-disabled' : '') + '" type="button" data-calendar-date="' + escapeHtml(iso) + '" ' + (!available ? 'disabled' : '') + ' aria-label="' + escapeHtml(longDateLabel(iso) + ' - ' + label) + '">'
      + '<strong>' + dayNumber + '</strong>'
      + '<span>' + label + '</span>'
      + '</button>');
  }

  daysWrapper.innerHTML = cells.join('');
}

function openMiniCalendar() {
  if (!byId('booking-service').value || !byId('booking-barber').value) {
    showScheduleToast('Escolha um barbeiro antes de selecionar a data.', 'error');
    return;
  }
  setCalendarCursorFromDate(byId('booking-date').value);
  renderMiniCalendar();
  byId('mini-calendar').hidden = !byId('mini-calendar').hidden;
}

function closeMiniCalendar() {
  const calendar = byId('mini-calendar');
  if (calendar && !calendar.closest('.booking-slide')) calendar.hidden = true;
}

function selectDate(dateValue) {
  const barberId = byId('booking-barber').value;
  if (!isDateAvailable(dateValue, barberId)) {
    showScheduleToast('Esta data não possui horários livres.', 'error');
    return;
  }
  byId('booking-date').value = dateValue;
  byId('booking-time').value = '';
  byId('selected-day-label').textContent = longDateLabel(dateValue);
  byId('selected-time-label').textContent = 'Escolha um horário disponível.';
  closeMiniCalendar();
  renderMiniCalendar();
  renderTimeGroups();
  updateBookingVisibility();
  updateSteps();
  updateScheduleSummary();
  window.setTimeout(() => goToStep(3), 200);
}

function slotButtonMarkup(slot, dateValue, selectedDate, selectedTime) {
  const selected = selectedDate === dateValue && selectedTime === slot.time;
  return '<button class="schedule-slot ' + (selected ? 'is-selected ' : '') + '" type="button" data-date="' + escapeHtml(dateValue) + '" data-time="' + escapeHtml(slot.time) + '">'
    + '<strong>' + escapeHtml(slot.time) + '</strong>'
    + '</button>';
}

function renderAvailableTimes(dateValue, barberId, selectedTime) {
  const groups = groupedSlots(dateValue, barberId);
  const content = TIME_PERIODS.map(period => {
    const slots = (groups[period.label] || []).filter(slot => slot.available);
    if (!slots.length) return '';
    return '<section class="time-period"><h4>' + period.label + '</h4><div class="time-grid">'
      + slots.map(slot => slotButtonMarkup(slot, dateValue, dateValue, selectedTime)).join('')
      + '</div></section>';
  }).join('');

  return content || '<p class="picker-empty">Nenhum horário livre para esta data.</p>';
}
function renderTimeGroups() {
  const wrapper = byId('time-groups');
  const barberId = byId('booking-barber').value;
  const selectedDate = byId('booking-date').value;
  const selectedTime = byId('booking-time').value;

  if (!byId('booking-service').value || !barberId) {
    wrapper.innerHTML = '';
    return;
  }

  if (!selectedDate) {
    wrapper.innerHTML = '';
    return;
  }

  const barber = barbers.find(item => item.id === barberId);
  wrapper.innerHTML = '<div class="time-context"><strong>Horários disponíveis para ' + escapeHtml(barber?.name || 'o barbeiro') + '</strong><span>' + escapeHtml(longDateLabel(selectedDate)) + '</span></div>'
    + renderAvailableTimes(selectedDate, barberId, selectedTime);
}

function customerDataReady() {
  return sanitizeTextField(byId('client-name').value, NAME_MAX_LENGTH).split(/\s+/).filter(Boolean).length >= 2
    && isValidBrazilianWhatsapp(byId('client-phone').value);
}

function canAccessStep(step) {
  if (step <= 0) return true;
  if (step === 1) return Boolean(byId('booking-service').value);
  if (step === 2) return Boolean(byId('booking-service').value && byId('booking-barber').value);
  if (step === 3) return Boolean(byId('booking-service').value && byId('booking-barber').value && byId('booking-date').value);
  if (step === 4) return Boolean(byId('booking-service').value && byId('booking-barber').value && byId('booking-date').value && byId('booking-time').value);
  if (step === 5) return canAccessStep(4) && customerDataReady();
  return false;
}

function updateSliderHeight() {
  const viewport = byId('booking-slider-viewport');
  const activeSlide = document.querySelector('[data-booking-step].is-active');
  if (!viewport || !activeSlide) return;
  viewport.style.height = activeSlide.offsetHeight + 'px';
}

function goToStep(step) {
  const target = Math.max(0, Math.min(BOOKING_STEP_COUNT - 1, step));
  if (!canAccessStep(target)) return;
  currentStep = target;
  const track = byId('booking-slider-track');
  if (track) track.style.setProperty('--booking-step', String(currentStep));
  document.querySelectorAll('[data-booking-step]').forEach(slide => {
    const active = Number(slide.dataset.bookingStep) === currentStep;
    slide.classList.toggle('is-active', active);
    slide.setAttribute('aria-hidden', active ? 'false' : 'true');
  });
  updateSteps();
  updateBookingVisibility();
  updateScheduleSummary();
  window.requestAnimationFrame(updateSliderHeight);
}

function nextStep() {
  goToStep(currentStep + 1);
}

function prevStep() {
  goToStep(currentStep - 1);
}

function updateBookingVisibility() {
  const serviceSelected = Boolean(byId('booking-service').value);
  const barberSelected = Boolean(byId('booking-barber').value);
  const dateSelected = Boolean(byId('booking-date').value);
  const timeSelected = Boolean(byId('booking-time').value);
  const clientReady = customerDataReady();

  byId('calendar-toggle').disabled = !(serviceSelected && barberSelected);
  byId('customer-continue').disabled = !clientReady;
  byId('booking-submit').disabled = !(timeSelected && clientReady);
}

function showScheduleToast(message, type = 'ok') {
  let toast = byId('schedule-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'schedule-toast';
    toast.className = 'schedule-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = 'schedule-toast show ' + type;
  clearTimeout(showScheduleToast.timer);
  showScheduleToast.timer = setTimeout(() => toast.classList.remove('show'), 2300);
}

function selectScheduleSlot(dateValue, time) {
  const barberId = byId('booking-barber').value;
  const service = getSelectedService();
  if (!isSlotAvailable(dateValue, barberId, time, service)) {
    showScheduleToast('Horário ocupado ou indisponível para este serviço.', 'error');
    return;
  }
  byId('booking-date').value = dateValue;
  byId('booking-time').value = time;
  byId('selected-day-label').textContent = longDateLabel(dateValue);
  byId('selected-time-label').textContent = 'Horário selecionado: ' + time;
  renderMiniCalendar();
  renderTimeGroups();
  updateBookingVisibility();
  updateSteps();
  updateScheduleSummary();
  showScheduleToast('Horário selecionado: ' + time);
  window.setTimeout(() => goToStep(4), 200);
}

function selectTime(time) {
  selectScheduleSlot(byId('booking-date').value, time);
}

function updateTimes() {
  const wrapper = byId('time-groups');
  const date = byId('booking-date').value;
  const barberId = byId('booking-barber').value;
  if (date && !isDateAvailable(date, barberId)) {
    clearSelectedDateTime();
  }
  wrapper.classList.add('is-recalculating');
  renderMiniCalendar();
  renderTimeGroups();
  updateBookingVisibility();
  updateScheduleSummary();
  window.setTimeout(() => wrapper.classList.remove('is-recalculating'), 180);
}

function updateRescheduleTimes() {
  const date = byId('reschedule-date').value;
  const barberId = byId('reschedule-barber').value;
  const select = byId('reschedule-time');
  if (!date || !barberId || !managedAppointmentId) {
    select.innerHTML = '<option value="">Escolha barbeiro e data primeiro</option>';
    return;
  }
  const appointment = getAppointment(managedAppointmentId);
  const service = services.find(item => item.id === appointment?.serviceId);
  fillTimeSelect(select, availableTimes(date, barberId, managedAppointmentId, service));
}

function scrollToBooking() {
  byId('agendamento').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateSelectedCards() {
  const serviceId = byId('booking-service').value;
  const barberId = byId('booking-barber').value;
  document.querySelectorAll('[data-service]').forEach(card => card.closest('.service-card')?.classList.toggle('is-selected', card.dataset.service === serviceId));
  document.querySelectorAll('[data-barber]').forEach(card => card.closest('.barber-card')?.classList.toggle('is-selected', card.dataset.barber === barberId));
  document.querySelectorAll('[data-booking-service]').forEach(card => card.classList.toggle('is-selected', card.dataset.bookingService === serviceId));
  document.querySelectorAll('[data-booking-barber]').forEach(card => card.classList.toggle('is-selected', card.dataset.bookingBarber === barberId));
}

function selectService(id) {
  const changed = byId('booking-service').value !== id;
  byId('booking-service').value = id;
  if (changed) clearSelectedDateTime();
  closeMiniCalendar();
  updateSelectedCards();
  updateTimes();
  scrollToBooking();
  updateSteps();
  window.setTimeout(() => goToStep(1), 200);
}

function selectBarber(id) {
  const changed = byId('booking-barber').value !== id;
  byId('booking-barber').value = id;
  if (changed) clearSelectedDateTime();
  closeMiniCalendar();
  updateSelectedCards();
  updateTimes();
  scrollToBooking();
  updateSteps();
  window.setTimeout(() => goToStep(2), 200);
}

function appendDetail(container, label, value) {
  const row = document.createElement('div');
  const dt = document.createElement('dt');
  const dd = document.createElement('dd');
  dt.textContent = label;
  dd.textContent = value || '-';
  row.append(dt, dd);
  container.appendChild(row);
}
function renderConfirmationSummary() {
  const fragment = document.createDocumentFragment();
  const title = document.createElement('span');
  title.textContent = 'Resumo do agendamento';
  fragment.appendChild(title);
  const service = services.find(item => item.id === byId('booking-service').value);
  const barber = barbers.find(item => item.id === byId('booking-barber').value);
  const date = byId('booking-date').value;
  const time = byId('booking-time').value;
  const name = sanitizeTextField(byId('client-name').value, NAME_MAX_LENGTH);
  const phone = onlyDigits(byId('client-phone').value);
  if (!service || !barber || !date || !time) {
    const text = document.createElement('p');
    text.textContent = 'Complete as etapas anteriores para revisar antes de confirmar.';
    fragment.appendChild(text);
    return fragment;
  }
  const list = document.createElement('dl');
  appendDetail(list, 'Serviço', service.name);
  appendDetail(list, 'Barbeiro', barber.name);
  appendDetail(list, 'Data', longDateLabel(date));
  appendDetail(list, 'Horário', time);
  appendDetail(list, 'Duração', service.duration);
  appendDetail(list, 'Valor', money(service.price));
  appendDetail(list, 'Cliente', name || '-');
  appendDetail(list, 'WhatsApp', phone ? maskPhone(phone) : '-');
  fragment.appendChild(list);
  return fragment;
}

function updateScheduleSummary() {
  const summary = byId('booking-summary');
  if (!summary) return;
  summary.replaceChildren(renderConfirmationSummary());
}

function updateSteps() {
  const steps = [...document.querySelectorAll('.booking-steps span')];
  const completed = [
    Boolean(byId('booking-service').value),
    Boolean(byId('booking-barber').value),
    Boolean(byId('booking-date').value),
    Boolean(byId('booking-time').value),
    customerDataReady(),
    customerDataReady() && Boolean(byId('booking-time').value)
  ];
  steps.forEach((step, index) => {
    step.classList.toggle('done', index < currentStep && completed[index]);
    step.classList.toggle('current', index === currentStep);
    step.classList.toggle('active', index <= currentStep);
  });
}

function validateBooking(payload) {
  const errors = [];
  if (payload.name.trim().split(/\s+/).filter(Boolean).length < 2) errors.push('Informe nome e sobrenome.');
  if (!isValidBrazilianWhatsapp(payload.phone)) errors.push('Informe um WhatsApp brasileiro válido com DDD.');
  if (!payload.serviceId) errors.push('Escolha um serviço.');
  if (!payload.barberId) errors.push('Escolha um barbeiro.');
  if (!payload.date || !isDateOpen(payload.date, payload.barberId)) errors.push('Escolha uma data disponível.');
  if (!payload.time) { errors.push('Escolha um horário.'); showScheduleToast('Escolha um horário livre na agenda.', 'error'); }
  return errors;
}

function buildWhatsappMessage(appointment) {
  return `Olá, quero confirmar meu agendamento na ${business.name}.\n\nNome: ${appointment.name}\nServiço: ${appointment.serviceName}\nBarbeiro: ${appointment.barberName}\nData: ${formatDate(appointment.date)}\nHorário: ${appointment.time}\nCódigo: ${appointment.code}`;
}

function renderSuccess(appointment) {
  byId('success-title').textContent = 'Agendamento confirmado';
  byId('success-code').textContent = 'Código: ' + appointment.code;
  renderAppointmentDetails(byId('success-details'), appointment);
  byId('success-whatsapp').href = whatsappLink(business.whatsapp, buildWhatsappMessage(appointment));
  byId('success-card').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeSuccessModal() {
  byId('success-card').hidden = true;
  document.body.style.overflow = '';
}

async function copySuccessCode() {
  const code = byId('success-code').textContent.replace('Código: ', '').trim();
  try {
    await navigator.clipboard.writeText(code);
    showScheduleToast('Código copiado.');
  } catch {
    showScheduleToast('Código: ' + code);
  }
}

function prepareManageFromSuccess() {
  const last = loadAppointments().slice(-1)[0];
  if (!last) return;
  byId('manage-phone').value = formatPhone(last.phone);
  byId('manage-code').value = last.code;
  closeSuccessModal();
}

function renderAppointmentDetails(container, appointment, options = {}) {
  container.replaceChildren();
  const details = [
    ['Código', appointment.code],
    ['Cliente', appointment.name],
    ['WhatsApp', options.maskPhone ? maskPhone(appointment.phone) : formatPhone(appointment.phone)],
    ['Serviço', appointment.serviceName],
    ['Barbeiro', appointment.barberName],
    ['Data', formatDate(appointment.date) + ' às ' + appointment.time],
    ['Duração', appointment.durationMinutes ? appointment.durationMinutes + ' min' : '-'],
    ['Valor', money(appointment.price)],
    ['Status', statusLabels[appointment.status] || appointment.status]
  ];
  if (appointment.note) details.push(['Observação', appointment.note]);
  details.forEach(([label, value]) => {
    const row = document.createElement('p');
    const span = document.createElement('span');
    const strong = document.createElement('strong');
    span.textContent = label;
    strong.textContent = value || '-';
    row.append(span, strong);
    container.appendChild(row);
  });
}

async function submitBooking(event) {
  event.preventDefault();
  const service = services.find(item => item.id === byId('booking-service').value);
  const barber = barbers.find(item => item.id === byId('booking-barber').value);
  const payload = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    code: nextCode(),
    name: sanitizeTextField(byId('client-name').value, NAME_MAX_LENGTH),
    phone: onlyDigits(byId('client-phone').value),
    serviceId: service?.id || '',
    serviceName: service?.name || '',
    barberId: barber?.id || '',
    barberName: barber?.name || '',
    date: byId('booking-date').value,
    time: byId('booking-time').value,
    durationMinutes: service?.durationMinutes || schedule.intervalMinutes,
    note: sanitizeNoteField(byId('booking-note').value),
    price: service?.price || 0,
    status: 'pendente',
    history: [historyEntry('created', { source: 'public_booking' })],
    createdAt: new Date().toISOString()
  };

  const errors = validateBooking(payload);
  const feedback = byId('form-feedback');
  if (errors.length) {
    feedback.textContent = errors.join(' ');
    feedback.className = 'form-feedback error';
    return;
  }

  if (!isSlotAvailable(payload.date, payload.barberId, payload.time, service)) {
    feedback.textContent = 'Este horário ficou ocupado ou não comporta a duração do serviço. Escolha outro horário.';
    feedback.className = 'form-feedback error';
    showScheduleToast('Escolha outro horário disponível.', 'error');
    updateTimes();
    return;
  }

  try {
    await createFirebaseAppointment(payload);
  } catch (err) {
    console.error('Falha ao registrar agendamento no Firebase.', err);
    feedback.textContent = 'Nao foi possivel registrar o agendamento agora. Tente novamente em alguns instantes.';
    feedback.className = 'form-feedback error';
    return;
  }

  const rows = loadAppointments();
  rows.push(payload);
  saveAppointments(rows);
  feedback.textContent = 'Agendamento registrado. Guarde seu codigo para consultar depois.';  feedback.className = 'form-feedback ok';
  event.target.reset();
  clearSelectedDateTime();
  closeMiniCalendar();
  updateSelectedCards();
  updateTimes();
  updateBookingVisibility();
  goToStep(0);
  renderSuccess(payload);
}

function renderManageResult(appointment) {
  managedAppointmentId = appointment.id;
  managedAccessToken = manageTokenFor(appointment);
  renderAppointmentDetails(byId('manage-details'), appointment, { maskPhone: true });
  byId('manage-result').hidden = false;
  byId('reschedule-form').hidden = true;
  byId('reschedule-feedback').textContent = '';
  byId('reschedule-barber').innerHTML = barberOptions(appointment.barberId);
  byId('reschedule-date').value = appointment.date;
  updateRescheduleTimes();
  const canChange = canClientModify(appointment);
  byId('manage-cancel').disabled = !canChange;
  byId('manage-reschedule-toggle').disabled = !canChange;
}

function submitManage(event) {
  event.preventDefault();
  const feedback = byId('manage-feedback');
  const state = getManageAttemptState();
  if (state.lockUntil && state.lockUntil > Date.now()) {
    const minutes = Math.ceil((state.lockUntil - Date.now()) / 60000);
    feedback.textContent = `Muitas tentativas incorretas. Tente novamente em cerca de ${minutes} minuto(s).`;
    feedback.className = 'form-feedback error';
    return;
  }
  const phone = onlyDigits(byId('manage-phone').value);
  const code = normalizeCode(byId('manage-code').value);
  const appointment = loadAppointments().find(item => item.phone === phone && normalizeCode(item.code) === code);
  if (!isValidBrazilianWhatsapp(phone) || !code || !appointment) {
    managedAppointmentId = '';
    managedAccessToken = '';
    byId('manage-result').hidden = true;
    const nextState = registerManageFailure();
    feedback.textContent = nextState.lockUntil ? 'Muitas tentativas incorretas. Tente novamente em alguns minutos.' : GENERIC_MANAGE_ERROR;
    feedback.className = 'form-feedback error';
    return;
  }
  clearManageAttempts();
  feedback.textContent = 'Agendamento encontrado.';
  feedback.className = 'form-feedback ok';
  renderManageResult(appointment);
}

function cancelManagedAppointment() {
  const appointment = getAppointment(managedAppointmentId);
  if (!canClientModify(appointment)) {
    byId('manage-feedback').textContent = 'Este agendamento não permite alteração.';
    byId('manage-feedback').className = 'form-feedback error';
    return;
  }
  if (!confirm('Cancelar este agendamento?')) return;
  const updated = setAppointment(managedAppointmentId, { status: 'cancelado' }, historyEntry('client_cancelled'));
  if (updated) renderManageResult(updated);
  byId('manage-feedback').textContent = 'Agendamento cancelado.';
  byId('manage-feedback').className = 'form-feedback ok';
}

function submitReschedule(event) {
  event.preventDefault();
  const appointment = getAppointment(managedAppointmentId);
  const feedback = byId('reschedule-feedback');
  if (!canClientModify(appointment)) {
    feedback.textContent = 'Este agendamento não permite alteração.';
    feedback.className = 'form-feedback error';
    return;
  }
  const barber = barbers.find(item => item.id === byId('reschedule-barber').value);
  const date = byId('reschedule-date').value;
  const time = byId('reschedule-time').value;
  if (!barber || !date || !time || !isDateOpen(date, barber.id)) {
    feedback.textContent = 'Escolha barbeiro, data e horário disponíveis.';
    feedback.className = 'form-feedback error';
    return;
  }
  const service = services.find(item => item.id === appointment.serviceId);
  if (!isSlotAvailable(date, barber.id, time, service, appointment.id)) {
    feedback.textContent = 'Este horário ficou ocupado ou não comporta a duração do serviço. Escolha outro horário.';
    feedback.className = 'form-feedback error';
    updateRescheduleTimes();
    return;
  }
  const updated = setAppointment(appointment.id, { barberId: barber.id, barberName: barber.name, date, time, status: 'pendente' }, historyEntry('client_rescheduled', {
    from: { barberId: appointment.barberId, date: appointment.date, time: appointment.time },
    to: { barberId: barber.id, date, time }
  }));
  feedback.textContent = 'Agendamento reagendado com sucesso.';
  feedback.className = 'form-feedback ok';
  renderManageResult(updated);
}

function renderBusiness() {
  byId('business-name').textContent = business.name;
  byId('business-address').textContent = business.address;
  byId('business-hours').textContent = business.hoursText;
  byId('business-phone').textContent = formatPhone(business.whatsapp);
  byId('business-instagram').textContent = business.instagram.replace('https://www.instagram.com/', '@').replace(/\/$/, '');
  byId('business-instagram').href = business.instagram;
  byId('business-map').src = business.mapEmbed;
  byId('floating-whatsapp').href = whatsappLink(business.whatsapp, `Olá, quero agendar um horário na ${business.name}.`);
  byId('google-reviews').href = business.googleReviewsUrl;
  byId('google-review').href = business.googleReviewsUrl;
}

function maskPhoneInput(event) {
  let value = onlyDigits(event.target.value).slice(0, 11);
  if (value.length > 6) value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
  else if (value.length > 2) value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
  else if (value) value = `(${value}`;
  event.target.value = value;
}

function attachEvents() {
  byId('menu-toggle').addEventListener('click', () => byId('site-nav').classList.toggle('open'));
  document.querySelectorAll('.site-nav a').forEach(link => link.addEventListener('click', () => byId('site-nav').classList.remove('open')));
  window.addEventListener('scroll', () => byId('site-header').classList.toggle('scrolled', window.scrollY > 24));
  window.addEventListener('resize', updateSliderHeight);
  document.addEventListener('click', event => {
    const serviceButton = event.target.closest('[data-service]');
    const barberButton = event.target.closest('[data-barber]');
    const bookingServiceButton = event.target.closest('[data-booking-service]');
    const bookingBarberButton = event.target.closest('[data-booking-barber]');
    if (serviceButton) selectService(serviceButton.dataset.service);
    if (barberButton) selectBarber(barberButton.dataset.barber);
    if (bookingServiceButton) selectService(bookingServiceButton.dataset.bookingService);
    if (bookingBarberButton) selectBarber(bookingBarberButton.dataset.bookingBarber);
  });
  byId('client-name').setAttribute('maxlength', String(NAME_MAX_LENGTH));
  byId('booking-note').setAttribute('maxlength', String(NOTE_MAX_LENGTH));
  byId('client-name').addEventListener('input', event => { event.target.value = sanitizeTextField(event.target.value, NAME_MAX_LENGTH); });
  byId('booking-note').addEventListener('input', event => { event.target.value = sanitizeNoteField(event.target.value); });
  ['booking-service', 'booking-barber', 'client-name', 'client-phone'].forEach(id => {
    byId(id).addEventListener('input', () => { updateSteps(); updateBookingVisibility(); updateScheduleSummary(); });
    byId(id).addEventListener('change', () => { updateSteps(); updateBookingVisibility(); updateScheduleSummary(); });
  });
  byId('booking-service').addEventListener('change', () => { clearSelectedDateTime(); closeMiniCalendar(); updateSelectedCards(); updateTimes(); updateSteps(); updateBookingVisibility(); });
  byId('booking-barber').addEventListener('change', () => { clearSelectedDateTime(); closeMiniCalendar(); updateSelectedCards(); updateTimes(); updateSteps(); updateBookingVisibility(); });
  byId('calendar-toggle').addEventListener('click', openMiniCalendar);
  byId('calendar-prev').addEventListener('click', () => {
    calendarCursor.setMonth(calendarCursor.getMonth() - 1);
    renderMiniCalendar();
  });
  byId('calendar-next').addEventListener('click', () => {
    calendarCursor.setMonth(calendarCursor.getMonth() + 1);
    renderMiniCalendar();
  });
  byId('calendar-days').addEventListener('click', event => {
    const day = event.target.closest('[data-calendar-date]');
    if (day && !day.disabled) selectDate(day.dataset.calendarDate);
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.mini-date-picker')) closeMiniCalendar();
  });
  byId('time-groups').addEventListener('click', event => { const slot = event.target.closest('[data-time]'); if (slot && !slot.disabled) selectScheduleSlot(slot.dataset.date, slot.dataset.time); });
  byId('client-phone').addEventListener('input', event => { maskPhoneInput(event); updateSteps(); updateBookingVisibility(); updateScheduleSummary(); });
  byId('manage-phone').addEventListener('input', maskPhoneInput);
  byId('manage-code').addEventListener('input', event => { event.target.value = normalizeCode(event.target.value); });
  document.querySelectorAll('[data-step-prev]').forEach(button => button.addEventListener('click', prevStep));
  byId('customer-continue').addEventListener('click', () => {
    if (!customerDataReady()) {
      showScheduleToast('Informe nome e WhatsApp para continuar.', 'error');
      return;
    }
    goToStep(5);
  });
  byId('booking-form').addEventListener('submit', submitBooking);
  byId('success-close').addEventListener('click', closeSuccessModal);
  byId('success-copy').addEventListener('click', copySuccessCode);
  byId('success-manage').addEventListener('click', prepareManageFromSuccess);
  byId('manage-form').addEventListener('submit', submitManage);
  byId('manage-cancel').addEventListener('click', cancelManagedAppointment);
  byId('manage-reschedule-toggle').addEventListener('click', () => {
    byId('reschedule-form').hidden = !byId('reschedule-form').hidden;
  });
  byId('reschedule-barber').addEventListener('change', updateRescheduleTimes);
  byId('reschedule-date').addEventListener('change', updateRescheduleTimes);
  byId('reschedule-form').addEventListener('submit', submitReschedule);
}

function initReveal() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(item => observer.observe(item));
}

async function init() {
  await refreshAppointmentsFromFirebase();
  setHeroMedia();
  renderServices();
  renderBarbers();
  renderTestimonials();
  renderSelects();
  renderBusiness();
  setMinDate();
  renderMiniCalendar();
  renderTimeGroups();
  updateScheduleSummary();
  updateTimes();
  updateBookingVisibility();
  goToStep(0);
  updateRescheduleTimes();
  attachEvents();
  initReveal();
}

init();
