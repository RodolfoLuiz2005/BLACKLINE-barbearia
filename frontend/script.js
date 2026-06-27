import { BLACKLINE_CONFIG } from './blackline-config.js';

const { business, assets, services, barbers, sampleTestimonials, schedule, storageKeys } = BLACKLINE_CONFIG;
const statusLabels = {
  pendente: 'Pendente',
  confirmado: 'Confirmado',
  em_atendimento: 'Em atendimento',
  concluido: 'Concluido',
  cancelado: 'Cancelado'
};

let managedAppointmentId = '';
const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
const WEEKDAYS_LONG = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];
const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTHS_LONG = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

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
  return `https://wa.me/${onlyDigits(phone)}?text=${encodeURIComponent(message)}`;
}

function loadAppointments() {
  try {
    return JSON.parse(localStorage.getItem(storageKeys.appointments) || '[]');
  } catch {
    return [];
  }
}

function saveAppointments(rows) {
  localStorage.setItem(storageKeys.appointments, JSON.stringify(rows));
}

function nextCode() {
  const maxNumber = loadAppointments().reduce((max, item) => {
    const match = String(item.code || '').match(/^BLK-(\d{6})$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `BLK-${String(maxNumber + 1).padStart(6, '0')}`;
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

function isDateOpen(dateValue, barberId = '') {
  if (!dateValue) return false;
  const date = new Date(`${dateValue}T12:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (Number.isNaN(date.getTime()) || date < today) return false;

  const day = date.getDay();
  if (!schedule.openDays.includes(day)) return false;
  if (barberId === 'marcos-silva' && day === 1) return false;
  if (barberId === 'andre-costa' && [1, 2].includes(day)) return false;
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
  const slots = [];
  for (let time = minutesFromTime(schedule.start); time < minutesFromTime(schedule.end); time += schedule.intervalMinutes) {
    slots.push(timeFromMinutes(time));
  }
  return slots;
}

function getBookedSlots(dateValue, barberId, ignoreId = '') {
  const booked = new Set();
  loadAppointments()
    .filter(item => item.id !== ignoreId && item.date === dateValue && item.barberId === barberId && item.status !== 'cancelado')
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
  const startIndex = slots.indexOf(timeValue);
  const slotsNeeded = calculateServiceSlots(service);
  const lastRequiredIndex = startIndex + slotsNeeded - 1;
  if (startIndex === -1 || lastRequiredIndex >= slots.length) return false;

  const booked = getBookedSlots(dateValue, barberId, ignoreId);
  for (let index = startIndex; index <= lastRequiredIndex; index += 1) {
    if (booked.has(slots[index])) return false;
  }
  return true;
}

function availableTimes(dateValue, barberId, ignoreId = '') {
  const service = getSelectedService();
  return getScheduleSlots(dateValue, barberId).filter(time => isSlotAvailable(dateValue, barberId, time, service, ignoreId));
}

function getNextAvailableDays(daysCount = 7) {
  const serviceId = byId('booking-service')?.value || '';
  const barberId = byId('booking-barber')?.value || '';
  return Array.from({ length: daysCount }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    date.setHours(12, 0, 0, 0);
    const iso = date.toISOString().slice(0, 10);
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
      availabilityText: open && slots.length > 0 ? slots.length + ' livres' : 'Sem horarios'
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
  const minutes = minutesFromTime(time);
  if (minutes < 12 * 60) return 'Manha';
  if (minutes < 17 * 60) return 'Tarde';
  return 'Noite';
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
      status: available ? 'Disponivel' : bookedByExisting ? 'Ocupado' : 'Indisponivel'
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

function setAppointment(id, patch) {
  const rows = loadAppointments();
  const index = rows.findIndex(item => item.id === id);
  if (index === -1) return null;
  rows[index] = { ...rows[index], ...patch, updatedAt: new Date().toISOString() };
  saveAppointments(rows);
  return rows[index];
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
      <button class="ghost-button" type="button" data-service="${escapeHtml(service.id)}">Agendar este servico</button>
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
  return '<option value="">Escolha o servico</option>' + services
    .map(service => `<option value="${escapeHtml(service.id)}" ${service.id === selected ? 'selected' : ''}>${escapeHtml(service.name)} - ${money(service.price)}</option>`)
    .join('');
}

function barberOptions(selected = '') {
  return '<option value="">Escolha o barbeiro</option>' + barbers
    .map(barber => `<option value="${escapeHtml(barber.id)}" ${barber.id === selected ? 'selected' : ''}>${escapeHtml(barber.name)} - ${escapeHtml(barber.specialty)}</option>`)
    .join('');
}

function renderSelects() {
  byId('booking-service').innerHTML = serviceOptions();
  byId('booking-barber').innerHTML = barberOptions();
  byId('reschedule-barber').innerHTML = barberOptions();
}

function setMinDate() {
  const today = new Date().toISOString().slice(0, 10);
  byId('booking-date').min = today;
  byId('reschedule-date').min = today;
}

function fillTimeSelect(select, slots) {
  select.innerHTML = '<option value="">Escolha o horario</option>' + slots.map(time => `<option value="${time}">${time}</option>`).join('');
  if (!slots.length) select.innerHTML = '<option value="">Sem horarios disponiveis</option>';
}

function clearSelectedDateTime() {
  byId('booking-date').value = '';
  byId('booking-time').value = '';
  byId('selected-day-label').textContent = 'Escolha uma data disponivel';
  byId('selected-time-label').textContent = 'Selecione um dia para ver os horarios';
}

function renderDayStrip() {
  const strip = byId('day-strip');
  const serviceId = byId('booking-service').value;
  const barberId = byId('booking-barber').value;
  const selectedDate = byId('booking-date').value;
  const days = getNextAvailableDays();

  strip.innerHTML = days.map(day => {
    const selected = selectedDate === day.iso;
    const disabled = !serviceId || !barberId || !day.available;
    return '<button class="day-card ' + (selected ? 'is-selected ' : '') + (disabled ? 'is-disabled' : '') + '" type="button" data-date="' + escapeHtml(day.iso) + '" ' + (disabled ? 'disabled' : '') + '>'
      + '<span>' + escapeHtml(day.weekdayShort) + '</span>'
      + '<strong>' + escapeHtml(day.dayNumber) + '</strong>'
      + '<small>' + escapeHtml(day.monthShort) + '</small>'
      + '<em>' + escapeHtml(day.availabilityText) + '</em>'
      + '</button>';
  }).join('');

  if (!serviceId || !barberId) {
    byId('selected-day-label').textContent = 'Escolha servico e barbeiro para ver a agenda semanal';
  } else if (selectedDate) {
    byId('selected-day-label').textContent = 'Dia selecionado: ' + longDateLabel(selectedDate);
  } else {
    byId('selected-day-label').textContent = 'Escolha um dia disponivel na agenda';
  }
}

function selectDay(dateValue) {
  if (!dateValue || !isDateOpen(dateValue, byId('booking-barber').value)) return;
  byId('booking-date').value = dateValue;
  byId('booking-time').value = '';
  byId('selected-day-label').textContent = 'Dia selecionado: ' + longDateLabel(dateValue);
  byId('selected-time-label').textContent = 'Escolha um horario disponivel';
  renderDayStrip();
  renderTimeGroups();
  updateSteps();
  updateScheduleSummary();
}

function slotButtonMarkup(slot, dateValue, selectedDate, selectedTime, extraClass = '') {
  const selected = selectedDate === dateValue && selectedTime === slot.time;
  return '<button class="schedule-slot ' + extraClass + ' ' + (selected ? 'is-selected ' : '') + (!slot.available ? 'is-disabled' : '') + '" type="button" data-date="' + escapeHtml(dateValue) + '" data-time="' + escapeHtml(slot.time) + '" ' + (!slot.available ? 'disabled' : '') + '>'
    + '<strong>' + escapeHtml(slot.time) + '</strong>'
    + '<span>' + escapeHtml(slot.status) + '</span>'
    + '</button>';
}

function renderWeeklyCalendar(days, barberId, selectedDate, selectedTime) {
  const allTimes = Array.from(new Set(days.flatMap(day => getScheduleSlots(day.iso, barberId))));
  if (!allTimes.length) return '<p class="picker-empty">Nenhum horario disponivel para este barbeiro nesta semana.</p>';

  return '<div class="weekly-calendar" style="--day-count:' + days.length + '">'
    + '<div class="week-head time-axis">Horario</div>'
    + days.map(day => '<div class="week-head ' + (day.iso === selectedDate ? 'is-selected' : '') + '"><span>' + escapeHtml(day.weekdayShort) + '</span><strong>' + escapeHtml(day.dayNumber) + '</strong><small>' + escapeHtml(day.monthShort) + '</small><em>' + escapeHtml(day.availabilityText) + '</em></div>').join('')
    + allTimes.map(time => '<div class="week-time">' + escapeHtml(time) + '</div>'
      + days.map(day => {
        const slot = getTimeSlotsByDay(day.iso, barberId).find(item => item.time === time) || { time, available: false, status: 'Indisponivel' };
        return '<div class="week-cell">' + slotButtonMarkup(slot, day.iso, selectedDate, selectedTime, 'week-slot') + '</div>';
      }).join('')).join('')
    + '</div>';
}

function renderMobileDayAgenda(dateValue, barberId, selectedDate, selectedTime) {
  if (!dateValue) return '<div class="mobile-day-agenda"><p class="picker-empty">Escolha um dia acima para ver a agenda do dia.</p></div>';
  const groups = groupedSlots(dateValue, barberId);
  const periods = ['Manha', 'Tarde', 'Noite'];
  const content = periods.map(period => {
    const slots = groups[period] || [];
    if (!slots.length) return '';
    return '<section class="time-period"><h4>' + period + '</h4><div class="day-agenda-list">'
      + slots.map(slot => slotButtonMarkup(slot, dateValue, selectedDate, selectedTime, 'agenda-slot')).join('')
      + '</div></section>';
  }).join('');
  return '<div class="mobile-day-agenda">' + (content || '<p class="picker-empty">Nenhum horario disponivel para este barbeiro neste dia.</p>') + '</div>';
}

function renderTimeGroups() {
  const wrapper = byId('time-groups');
  const serviceId = byId('booking-service').value;
  const barberId = byId('booking-barber').value;
  const selectedDate = byId('booking-date').value;
  const selectedTime = byId('booking-time').value;

  if (!serviceId || !barberId) {
    wrapper.innerHTML = '<p class="picker-empty">Escolha servico e barbeiro para liberar a agenda.</p>';
    return;
  }

  const days = getNextAvailableDays();
  wrapper.innerHTML = renderWeeklyCalendar(days, barberId, selectedDate, selectedTime)
    + renderMobileDayAgenda(selectedDate, barberId, selectedDate, selectedTime);
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
    showScheduleToast('Horario ocupado ou indisponivel para este servico.', 'error');
    return;
  }
  byId('booking-date').value = dateValue;
  byId('booking-time').value = time;
  byId('selected-day-label').textContent = 'Dia selecionado: ' + longDateLabel(dateValue);
  byId('selected-time-label').textContent = 'Horario selecionado: ' + time;
  renderDayStrip();
  renderTimeGroups();
  updateSteps();
  updateScheduleSummary();
  showScheduleToast('Horario selecionado: ' + time);
}

function selectTime(time) {
  selectScheduleSlot(byId('booking-date').value, time);
}

function updateTimes() {
  const wrapper = byId('time-groups');
  const date = byId('booking-date').value;
  const barberId = byId('booking-barber').value;
  if (date && !isDateOpen(date, barberId)) {
    clearSelectedDateTime();
  }
  wrapper.classList.add('is-recalculating');
  renderDayStrip();
  renderTimeGroups();
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
  fillTimeSelect(select, availableTimes(date, barberId, managedAppointmentId));
}

function scrollToBooking() {
  byId('agendamento').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateSelectedCards() {
  const serviceId = byId('booking-service').value;
  const barberId = byId('booking-barber').value;
  document.querySelectorAll('[data-service]').forEach(card => card.closest('.service-card')?.classList.toggle('is-selected', card.dataset.service === serviceId));
  document.querySelectorAll('[data-barber]').forEach(card => card.closest('.barber-card')?.classList.toggle('is-selected', card.dataset.barber === barberId));
}

function selectService(id) {
  byId('booking-service').value = id;
  clearSelectedDateTime();
  updateSelectedCards();
  updateTimes();
  scrollToBooking();
  updateSteps();
}

function selectBarber(id) {
  byId('booking-barber').value = id;
  clearSelectedDateTime();
  updateSelectedCards();
  updateTimes();
  scrollToBooking();
  updateSteps();
}

function updateScheduleSummary() {
  const service = services.find(item => item.id === byId('booking-service').value);
  const barber = barbers.find(item => item.id === byId('booking-barber').value);
  const date = byId('booking-date').value;
  const time = byId('booking-time').value;
  const summary = byId('booking-summary');

  if (!service && !barber && !date && !time) {
    summary.innerHTML = '<span>Resumo do agendamento</span><p>Escolha servico, barbeiro, data e horario para revisar antes de confirmar.</p>';
    return;
  }

  summary.innerHTML = '<span>Resumo do agendamento</span><dl>'
    + '<div><dt>Servico</dt><dd>' + escapeHtml(service?.name || '-') + '</dd></div>'
    + '<div><dt>Barbeiro</dt><dd>' + escapeHtml(barber?.name || '-') + '</dd></div>'
    + '<div><dt>Data</dt><dd>' + escapeHtml(date ? longDateLabel(date) : '-') + '</dd></div>'
    + '<div><dt>Horario</dt><dd>' + escapeHtml(time || '-') + '</dd></div>'
    + '<div><dt>Valor</dt><dd>' + (service ? money(service.price) : '-') + '</dd></div>'
    + '</dl>';
}

function updateSteps() {
  const steps = [...document.querySelectorAll('.booking-steps span')];
  const filled = [
    byId('booking-service').value,
    byId('booking-barber').value,
    byId('booking-date').value && byId('booking-time').value,
    byId('client-name').value.trim() && byId('client-phone').value.trim()
  ];
  let current = filled.findIndex(item => !item);
  if (current === -1) current = steps.length - 1;
  steps.forEach((step, index) => {
    step.classList.toggle('done', index < current || (current === steps.length - 1 && filled[index]));
    step.classList.toggle('current', index === current);
    step.classList.toggle('active', index <= current);
  });
}

function validateBooking(payload) {
  const errors = [];
  if (payload.name.trim().split(/\s+/).filter(Boolean).length < 2) errors.push('Informe nome e sobrenome.');
  if (onlyDigits(payload.phone).length !== 11) errors.push('Informe um WhatsApp valido com DDD.');
  if (!payload.serviceId) errors.push('Escolha um servico.');
  if (!payload.barberId) errors.push('Escolha um barbeiro.');
  if (!payload.date || !isDateOpen(payload.date, payload.barberId)) errors.push('Escolha uma data disponivel.');
  if (!payload.time) {
    errors.push('Escolha um horario.');
    showScheduleToast('Escolha um horario livre na agenda.', 'error');
  }
  return errors;
}

function buildWhatsappMessage(appointment) {
  return `Ola, quero confirmar meu agendamento na ${business.name}.\n\nNome: ${appointment.name}\nServico: ${appointment.serviceName}\nBarbeiro: ${appointment.barberName}\nData: ${formatDate(appointment.date)}\nHorario: ${appointment.time}\nCodigo: ${appointment.code}`;
}

function renderSuccess(appointment) {
  byId('success-title').textContent = `${appointment.code} criado com sucesso`;
  byId('success-details').innerHTML = appointmentDetails(appointment);
  byId('success-whatsapp').href = whatsappLink(business.whatsapp, buildWhatsappMessage(appointment));
  byId('success-card').hidden = false;
  byId('success-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function appointmentDetails(appointment) {
  return `
    <p><span>Codigo</span><strong>${escapeHtml(appointment.code)}</strong></p>
    <p><span>Cliente</span><strong>${escapeHtml(appointment.name)}</strong></p>
    <p><span>WhatsApp</span><strong>${escapeHtml(formatPhone(appointment.phone))}</strong></p>
    <p><span>Servico</span><strong>${escapeHtml(appointment.serviceName)}</strong></p>
    <p><span>Barbeiro</span><strong>${escapeHtml(appointment.barberName)}</strong></p>
    <p><span>Data</span><strong>${escapeHtml(formatDate(appointment.date))} as ${escapeHtml(appointment.time)}</strong></p>
    <p><span>Valor</span><strong>${money(appointment.price)}</strong></p>
    <p><span>Status</span><strong>${escapeHtml(statusLabels[appointment.status] || appointment.status)}</strong></p>
    ${appointment.note ? `<p><span>Observacao</span><strong>${escapeHtml(appointment.note)}</strong></p>` : ''}
  `;
}

function submitBooking(event) {
  event.preventDefault();
  const service = services.find(item => item.id === byId('booking-service').value);
  const barber = barbers.find(item => item.id === byId('booking-barber').value);
  const payload = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    code: nextCode(),
    name: byId('client-name').value.trim(),
    phone: onlyDigits(byId('client-phone').value),
    serviceId: service?.id || '',
    serviceName: service?.name || '',
    barberId: barber?.id || '',
    barberName: barber?.name || '',
    date: byId('booking-date').value,
    time: byId('booking-time').value,
    durationMinutes: service?.durationMinutes || schedule.intervalMinutes,
    note: byId('booking-note').value.trim(),
    price: service?.price || 0,
    status: 'pendente',
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
    feedback.textContent = 'Este horario ficou ocupado ou nao comporta a duracao do servico. Escolha outro horario.';
    feedback.className = 'form-feedback error';
    showScheduleToast('Escolha outro horario disponivel.', 'error');
    updateTimes();
    return;
  }

  const rows = loadAppointments();
  rows.push(payload);
  saveAppointments(rows);
  feedback.textContent = 'Agendamento registrado. Guarde seu codigo para consultar depois.';
  feedback.className = 'form-feedback ok';
  event.target.reset();
  clearSelectedDateTime();
  updateSelectedCards();
  updateTimes();
  updateSteps();
  renderSuccess(payload);
}

function renderManageResult(appointment) {
  managedAppointmentId = appointment.id;
  byId('manage-details').innerHTML = appointmentDetails(appointment);
  byId('manage-result').hidden = false;
  byId('reschedule-form').hidden = true;
  byId('reschedule-feedback').textContent = '';
  byId('reschedule-barber').innerHTML = barberOptions(appointment.barberId);
  byId('reschedule-date').value = appointment.date;
  updateRescheduleTimes();
  byId('manage-cancel').disabled = appointment.status === 'cancelado' || appointment.status === 'concluido';
  byId('manage-reschedule-toggle').disabled = appointment.status === 'cancelado' || appointment.status === 'concluido';
}

function submitManage(event) {
  event.preventDefault();
  const phone = onlyDigits(byId('manage-phone').value);
  const code = normalizeCode(byId('manage-code').value);
  const appointment = loadAppointments().find(item => item.phone === phone && normalizeCode(item.code) === code);
  const feedback = byId('manage-feedback');

  if (!phone || onlyDigits(phone).length !== 11 || !code) {
    feedback.textContent = 'Informe WhatsApp com DDD e codigo do agendamento.';
    feedback.className = 'form-feedback error';
    return;
  }

  if (!appointment) {
    feedback.textContent = 'Agendamento nao encontrado. Confira o WhatsApp e o codigo.';
    feedback.className = 'form-feedback error';
    byId('manage-result').hidden = true;
    return;
  }

  feedback.textContent = 'Agendamento encontrado.';
  feedback.className = 'form-feedback ok';
  renderManageResult(appointment);
}

function cancelManagedAppointment() {
  if (!managedAppointmentId) return;
  if (!confirm('Cancelar este agendamento?')) return;
  const updated = setAppointment(managedAppointmentId, { status: 'cancelado' });
  if (updated) renderManageResult(updated);
  byId('manage-feedback').textContent = 'Agendamento cancelado.';
  byId('manage-feedback').className = 'form-feedback ok';
}

function submitReschedule(event) {
  event.preventDefault();
  const appointment = getAppointment(managedAppointmentId);
  if (!appointment) return;
  const barber = barbers.find(item => item.id === byId('reschedule-barber').value);
  const date = byId('reschedule-date').value;
  const time = byId('reschedule-time').value;
  const feedback = byId('reschedule-feedback');

  if (!barber || !date || !time || !isDateOpen(date, barber.id)) {
    feedback.textContent = 'Escolha barbeiro, data e horario disponiveis.';
    feedback.className = 'form-feedback error';
    return;
  }

  const alreadyTaken = loadAppointments().some(item => item.id !== appointment.id && item.date === date && item.time === time && item.barberId === barber.id && item.status !== 'cancelado');
  if (alreadyTaken) {
    feedback.textContent = 'Este horario acabou de ser reservado. Escolha outro horario.';
    feedback.className = 'form-feedback error';
    updateRescheduleTimes();
    return;
  }

  const updated = setAppointment(appointment.id, {
    barberId: barber.id,
    barberName: barber.name,
    date,
    time,
    status: 'pendente'
  });
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
  byId('floating-whatsapp').href = whatsappLink(business.whatsapp, `Ola, quero agendar um horario na ${business.name}.`);
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
  document.addEventListener('click', event => {
    const serviceButton = event.target.closest('[data-service]');
    const barberButton = event.target.closest('[data-barber]');
    if (serviceButton) selectService(serviceButton.dataset.service);
    if (barberButton) selectBarber(barberButton.dataset.barber);
  });
  ['booking-service', 'booking-barber', 'client-name', 'client-phone'].forEach(id => {
    byId(id).addEventListener('input', updateSteps);
    byId(id).addEventListener('change', updateSteps);
  });
  byId('booking-service').addEventListener('change', () => { clearSelectedDateTime(); updateSelectedCards(); updateTimes(); updateSteps(); });
  byId('booking-barber').addEventListener('change', () => { clearSelectedDateTime(); updateSelectedCards(); updateTimes(); updateSteps(); });
  byId('day-strip').addEventListener('click', event => { const day = event.target.closest('[data-date]'); if (day && !day.disabled) selectDay(day.dataset.date); });
  byId('time-groups').addEventListener('click', event => { const slot = event.target.closest('[data-time]'); if (slot && !slot.disabled) selectScheduleSlot(slot.dataset.date, slot.dataset.time); });
  byId('client-phone').addEventListener('input', maskPhoneInput);
  byId('manage-phone').addEventListener('input', maskPhoneInput);
  byId('manage-code').addEventListener('input', event => { event.target.value = normalizeCode(event.target.value); });
  byId('booking-form').addEventListener('submit', submitBooking);
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

function init() {
  setHeroMedia();
  renderServices();
  renderBarbers();
  renderTestimonials();
  renderSelects();
  renderBusiness();
  setMinDate();
  renderDayStrip();
  renderTimeGroups();
  updateScheduleSummary();
  updateTimes();
  updateRescheduleTimes();
  attachEvents();
  initReveal();
}

init();
