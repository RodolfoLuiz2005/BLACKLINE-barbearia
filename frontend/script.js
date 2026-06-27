import { BLACKLINE_CONFIG } from './blackline-config.js';

const { business, assets, services, barbers, schedule, storageKeys } = BLACKLINE_CONFIG;
const statusLabels = {
  pendente: 'Pendente',
  confirmado: 'Confirmado',
  em_atendimento: 'Em atendimento',
  concluido: 'Concluido',
  cancelado: 'Cancelado'
};

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
  const year = new Date().getFullYear();
  const count = loadAppointments().filter(item => String(item.code || '').includes(`BLK-${year}-`)).length + 1;
  return `BLK-${year}-${String(count).padStart(3, '0')}`;
}

function minutesFromTime(value) {
  const [hours, minutes] = String(value || '00:00').split(':').map(Number);
  return (hours * 60) + (minutes || 0);
}

function timeFromMinutes(value) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
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

function availableTimes(dateValue, barberId) {
  if (!isDateOpen(dateValue, barberId)) return [];

  const taken = new Set(loadAppointments()
    .filter(item => item.date === dateValue && item.barberId === barberId && item.status !== 'cancelado')
    .map(item => item.time));
  const slots = [];
  for (let time = minutesFromTime(schedule.start); time < minutesFromTime(schedule.end); time += schedule.intervalMinutes) {
    const label = timeFromMinutes(time);
    if (!taken.has(label)) slots.push(label);
  }
  return slots;
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

function renderSelects() {
  byId('booking-service').innerHTML = '<option value="">Escolha o servico</option>' + services
    .map(service => `<option value="${escapeHtml(service.id)}">${escapeHtml(service.name)} - ${money(service.price)}</option>`)
    .join('');
  byId('booking-barber').innerHTML = '<option value="">Escolha o barbeiro</option>' + barbers
    .map(barber => `<option value="${escapeHtml(barber.id)}">${escapeHtml(barber.name)} - ${escapeHtml(barber.specialty)}</option>`)
    .join('');
}

function setMinDate() {
  const today = new Date();
  byId('booking-date').min = today.toISOString().slice(0, 10);
}

function updateTimes() {
  const date = byId('booking-date').value;
  const barberId = byId('booking-barber').value;
  const select = byId('booking-time');
  const slots = availableTimes(date, barberId);
  select.innerHTML = '<option value="">Escolha o horario</option>' + slots.map(time => `<option value="${time}">${time}</option>`).join('');
  if (date && barberId && !slots.length) {
    select.innerHTML = '<option value="">Sem horarios disponiveis</option>';
  }
}

function scrollToBooking() {
  byId('agendamento').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function selectService(id) {
  byId('booking-service').value = id;
  scrollToBooking();
  updateSteps();
}

function selectBarber(id) {
  byId('booking-barber').value = id;
  updateTimes();
  scrollToBooking();
  updateSteps();
}

function updateSteps() {
  const steps = [...document.querySelectorAll('.booking-steps span')];
  const filled = [
    byId('booking-service').value,
    byId('booking-barber').value,
    byId('booking-date').value,
    byId('booking-time').value,
    byId('client-name').value.trim() && byId('client-phone').value.trim()
  ];
  let current = filled.findIndex(item => !item);
  if (current === -1) current = 4;
  steps.forEach((step, index) => step.classList.toggle('active', index <= current));
}

function validateBooking(payload) {
  const errors = [];
  if (payload.name.trim().split(/\s+/).filter(Boolean).length < 2) errors.push('Informe nome e sobrenome.');
  if (onlyDigits(payload.phone).length !== 11) errors.push('Informe um WhatsApp valido com DDD.');
  if (!payload.serviceId) errors.push('Escolha um servico.');
  if (!payload.barberId) errors.push('Escolha um barbeiro.');
  if (!payload.date || !isDateOpen(payload.date, payload.barberId)) errors.push('Escolha uma data disponivel.');
  if (!payload.time) errors.push('Escolha um horario.');
  return errors;
}

function buildWhatsappMessage(appointment) {
  return `Ola, quero agendar um horario na ${business.name}.\n\nNome: ${appointment.name}\nServico: ${appointment.serviceName}\nBarbeiro: ${appointment.barberName}\nData: ${formatDate(appointment.date)}\nHorario: ${appointment.time}\nObservacao: ${appointment.note || 'Sem observacao'}\nCodigo: ${appointment.code}`;
}

function renderSuccess(appointment) {
  byId('success-title').textContent = `${appointment.code} criado com sucesso`;
  byId('success-details').innerHTML = `
    <p><span>Cliente</span><strong>${escapeHtml(appointment.name)}</strong></p>
    <p><span>Servico</span><strong>${escapeHtml(appointment.serviceName)}</strong></p>
    <p><span>Barbeiro</span><strong>${escapeHtml(appointment.barberName)}</strong></p>
    <p><span>Data</span><strong>${escapeHtml(formatDate(appointment.date))} as ${escapeHtml(appointment.time)}</strong></p>
    <p><span>Status</span><strong>${statusLabels[appointment.status]}</strong></p>
  `;
  byId('success-whatsapp').href = whatsappLink(business.whatsapp, buildWhatsappMessage(appointment));
  byId('success-card').hidden = false;
  byId('success-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  const alreadyTaken = loadAppointments().some(item => item.date === payload.date && item.time === payload.time && item.barberId === payload.barberId && item.status !== 'cancelado');
  if (alreadyTaken) {
    feedback.textContent = 'Este horario acabou de ser reservado. Escolha outro horario.';
    feedback.className = 'form-feedback error';
    updateTimes();
    return;
  }

  const rows = loadAppointments();
  rows.push(payload);
  saveAppointments(rows);
  feedback.textContent = 'Agendamento enviado para o painel ADM.';
  feedback.className = 'form-feedback ok';
  event.target.reset();
  updateTimes();
  updateSteps();
  renderSuccess(payload);
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
  ['booking-service', 'booking-barber', 'booking-date', 'booking-time', 'client-name', 'client-phone'].forEach(id => {
    byId(id).addEventListener('input', updateSteps);
    byId(id).addEventListener('change', updateSteps);
  });
  byId('booking-barber').addEventListener('change', updateTimes);
  byId('booking-date').addEventListener('change', updateTimes);
  byId('client-phone').addEventListener('input', event => {
    let value = onlyDigits(event.target.value).slice(0, 11);
    if (value.length > 6) value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    else if (value.length > 2) value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    else if (value) value = `(${value}`;
    event.target.value = value;
  });
  byId('booking-form').addEventListener('submit', submitBooking);
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
  renderSelects();
  renderBusiness();
  setMinDate();
  updateTimes();
  attachEvents();
  initReveal();
}

init();
