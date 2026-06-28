import { collection, doc, getDoc, getDocs, orderBy, query, runTransaction } from 'firebase/firestore';
import { getBlacklineDb } from './firebase-config.js';

const APPOINTMENTS_COLLECTION = 'agendamentos';
const CLIENT_LOOKUPS_COLLECTION = 'consultasAgendamento';
const SLOT_OCCUPANCY_COLLECTION = 'ocupacaoHorarios';
const BLOCKING_STATUSES = new Set(['pendente', 'confirmado', 'em_atendimento']);

function timestampNow() {
  return new Date().toISOString();
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase();
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

function makeFirebaseError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function sha256Hex(value) {
  if (!crypto?.subtle) {
    throw makeFirebaseError('crypto-unavailable', 'Navegador sem suporte a Web Crypto para consulta segura.');
  }
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function clientLookupId(phone, code) {
  return sha256Hex('blackline:v1:' + onlyDigits(phone) + ':' + normalizeCode(code));
}

export function makeAppointmentSlotId(barberId, date, time) {
  return [String(barberId || '').trim(), String(date || '').trim(), String(time || '').trim()].join('_');
}

export function makeAppointmentSlotIds(appointment, intervalMinutes = 30) {
  const duration = Number(appointment.durationMinutes || appointment.duracaoMinutos || intervalMinutes);
  const slotsNeeded = Math.max(1, Math.ceil(duration / intervalMinutes));
  const start = minutesFromTime(appointment.time || appointment.horario);
  return Array.from({ length: slotsNeeded }, (_, index) => makeAppointmentSlotId(
    appointment.barberId || appointment.profissionalId,
    appointment.date || appointment.data,
    timeFromMinutes(start + (index * intervalMinutes))
  ));
}

function buildSlotPayload(appointment, slotId) {
  const [, , time] = slotId.split('_');
  return {
    agendamentoId: appointment.id,
    profissionalId: appointment.profissionalId,
    data: appointment.data,
    horario: time || appointment.horario,
    status: appointment.status,
    criadoEm: appointment.criadoEm,
    atualizadoEm: appointment.atualizadoEm
  };
}

export function appointmentToFirestore(appointment) {
  const now = timestampNow();
  const code = normalizeCode(appointment.code || appointment.codigo);
  const phone = onlyDigits(appointment.phone || appointment.telefone);
  const id = appointment.id || appointment.appointmentId || code || crypto.randomUUID?.() || String(Date.now());
  const duration = Number(appointment.durationMinutes || appointment.duracaoMinutos || 30);
  const price = Number(appointment.price || appointment.preco || 0);

  return {
    id,
    codigo: code,
    consultaId: appointment.lookupId || appointment.consultaId || '',
    nome: appointment.name || appointment.nome || '',
    telefone: phone,
    servico: appointment.serviceName || appointment.servico || '',
    servicoId: appointment.serviceId || appointment.servicoId || '',
    profissionalId: appointment.barberId || appointment.profissionalId || '',
    profissionalNome: appointment.barberName || appointment.profissionalNome || '',
    data: appointment.date || appointment.data || '',
    horario: appointment.time || appointment.horario || '',
    duracaoMinutos: duration,
    preco: price,
    observacoes: appointment.note || appointment.observacoes || '',
    status: appointment.status || 'pendente',
    slotIds: Array.isArray(appointment.slotIds) ? appointment.slotIds : [],
    criadoEm: appointment.createdAt || appointment.criadoEm || now,
    atualizadoEm: appointment.updatedAt || appointment.atualizadoEm || now
  };
}

export function appointmentFromFirestore(snapshot) {
  const data = snapshot.data ? snapshot.data() : snapshot;
  return {
    id: data.id || snapshot.id || data.codigo,
    code: data.codigo || snapshot.id || '',
    lookupId: data.consultaId || '',
    name: data.nome || '',
    phone: data.telefone || '',
    serviceId: data.servicoId || '',
    serviceName: data.servico || '',
    barberId: data.profissionalId || '',
    barberName: data.profissionalNome || '',
    date: data.data || '',
    time: data.horario || '',
    durationMinutes: Number(data.duracaoMinutos || 0),
    price: Number(data.preco || 0),
    note: data.observacoes || '',
    status: data.status || 'pendente',
    slotIds: Array.isArray(data.slotIds) ? data.slotIds : [],
    createdAt: data.criadoEm || '',
    updatedAt: data.atualizadoEm || ''
  };
}

function appointmentPatchToFirestore(patch) {
  const mapped = {};
  if ('status' in patch) mapped.status = patch.status;
  if ('barberId' in patch) mapped.profissionalId = patch.barberId;
  if ('barberName' in patch) mapped.profissionalNome = patch.barberName;
  if ('date' in patch) mapped.data = patch.date;
  if ('time' in patch) mapped.horario = patch.time;
  if ('durationMinutes' in patch) mapped.duracaoMinutos = Number(patch.durationMinutes || 0);
  if ('price' in patch) mapped.preco = Number(patch.price || 0);
  if ('note' in patch) mapped.observacoes = patch.note;
  if ('slotIds' in patch) mapped.slotIds = Array.isArray(patch.slotIds) ? patch.slotIds : [];
  mapped.atualizadoEm = timestampNow();
  return mapped;
}

function isBlockingStatus(status) {
  return BLOCKING_STATUSES.has(status || 'pendente');
}

async function prepareAppointmentData(appointment) {
  const code = normalizeCode(appointment.code || appointment.codigo);
  const phone = onlyDigits(appointment.phone || appointment.telefone);
  const lookupId = appointment.lookupId || appointment.consultaId || await clientLookupId(phone, code);
  const data = appointmentToFirestore({ ...appointment, code, phone, lookupId });
  data.consultaId = lookupId;
  data.slotIds = Array.isArray(appointment.slotIds) ? appointment.slotIds : data.slotIds;
  if (isBlockingStatus(data.status) && data.slotIds.length === 0) {
    data.slotIds = makeAppointmentSlotIds(data, 30);
  }
  return data;
}

export async function createFirebaseAppointment(appointment) {
  const db = getBlacklineDb();
  const data = await prepareAppointmentData(appointment);
  const appointmentRef = doc(db, APPOINTMENTS_COLLECTION, data.id);
  const lookupRef = doc(db, CLIENT_LOOKUPS_COLLECTION, data.consultaId);
  const slotRefs = data.slotIds.map(slotId => doc(db, SLOT_OCCUPANCY_COLLECTION, slotId));

  await runTransaction(db, async transaction => {
    const lookupSnap = await transaction.get(lookupRef);
    if (lookupSnap.exists()) throw makeFirebaseError('lookup-conflict', 'Codigo ja vinculado a este WhatsApp. Gere outro codigo.');

    const slotSnaps = await Promise.all(slotRefs.map(slotRef => transaction.get(slotRef)));
    if (slotSnaps.some(slotSnap => slotSnap.exists() && isBlockingStatus(slotSnap.data()?.status))) {
      throw makeFirebaseError('slot-taken', 'Horario ja reservado. Escolha outro horario.');
    }

    transaction.set(appointmentRef, data);
    transaction.set(lookupRef, data);
    data.slotIds.forEach((slotId, index) => {
      transaction.set(slotRefs[index], buildSlotPayload(data, slotId));
    });
  });

  return appointmentFromFirestore({ id: data.id, data: () => data });
}

export async function loadFirebaseOccupiedSlots(slotIds) {
  const db = getBlacklineDb();
  const entries = await Promise.all(slotIds.map(async slotId => {
    const snapshot = await getDoc(doc(db, SLOT_OCCUPANCY_COLLECTION, slotId));
    if (!snapshot.exists()) return null;
    const data = snapshot.data();
    return [slotId, {
      id: slotId,
      appointmentId: data.agendamentoId || '',
      barberId: data.profissionalId || '',
      date: data.data || '',
      time: data.horario || slotId.split('_').pop() || '',
      status: data.status || 'pendente'
    }];
  }));
  return new Map(entries.filter(Boolean));
}

export async function loadFirebaseAppointments() {
  const db = getBlacklineDb();
  const baseCollection = collection(db, APPOINTMENTS_COLLECTION);
  let snapshot;
  try {
    snapshot = await getDocs(query(baseCollection, orderBy('data'), orderBy('horario')));
  } catch (err) {
    snapshot = await getDocs(baseCollection);
  }
  return snapshot.docs.map(appointmentFromFirestore);
}

export async function getFirebaseAppointmentByClient(phone, code) {
  const lookupId = await clientLookupId(phone, code);
  const db = getBlacklineDb();
  const snapshot = await getDoc(doc(db, CLIENT_LOOKUPS_COLLECTION, lookupId));
  if (!snapshot.exists()) return null;
  const appointment = appointmentFromFirestore(snapshot);
  if (onlyDigits(appointment.phone) !== onlyDigits(phone) || normalizeCode(appointment.code) !== normalizeCode(code)) {
    return null;
  }
  return appointment;
}

export async function updateFirebaseAppointment(appointmentOrId, patch) {
  const db = getBlacklineDb();
  const baseAppointment = typeof appointmentOrId === 'object' ? appointmentOrId : { id: appointmentOrId };
  const nextPatch = { ...patch };
  const nextStatus = nextPatch.status || baseAppointment.status || 'pendente';
  if (!isBlockingStatus(nextStatus)) nextPatch.slotIds = [];

  const fullData = await prepareAppointmentData({ ...baseAppointment, ...nextPatch });
  const appointmentRef = doc(db, APPOINTMENTS_COLLECTION, fullData.id);
  const lookupRef = doc(db, CLIENT_LOOKUPS_COLLECTION, fullData.consultaId);
  const oldSlotIds = Array.isArray(baseAppointment.slotIds) ? baseAppointment.slotIds : [];

  await runTransaction(db, async transaction => {
    transaction.set(appointmentRef, fullData);
    transaction.set(lookupRef, fullData);
    if (!isBlockingStatus(fullData.status)) {
      oldSlotIds.forEach(slotId => transaction.delete(doc(db, SLOT_OCCUPANCY_COLLECTION, slotId)));
    }
  });

  return appointmentFromFirestore({ id: fullData.id, data: () => fullData });
}

export async function cancelFirebaseAppointment(appointment, phone, code) {
  const lookupId = await clientLookupId(phone, code);
  const db = getBlacklineDb();
  const lookupRef = doc(db, CLIENT_LOOKUPS_COLLECTION, lookupId);

  let updated;
  await runTransaction(db, async transaction => {
    const lookupSnap = await transaction.get(lookupRef);
    if (!lookupSnap.exists()) throw makeFirebaseError('not-found', 'Agendamento nao encontrado.');
    const current = appointmentFromFirestore(lookupSnap);
    if (onlyDigits(current.phone) !== onlyDigits(phone) || normalizeCode(current.code) !== normalizeCode(code)) {
      throw makeFirebaseError('not-found', 'Agendamento nao encontrado.');
    }
    if (!['pendente', 'confirmado'].includes(current.status || 'pendente')) {
      throw makeFirebaseError('not-mutable', 'Este agendamento nao permite cancelamento pelo site.');
    }

    const data = await prepareAppointmentData({ ...current, status: 'cancelado', slotIds: [], updatedAt: timestampNow() });
    const appointmentRef = doc(db, APPOINTMENTS_COLLECTION, data.id);
    transaction.set(appointmentRef, data);
    transaction.set(lookupRef, data);
    current.slotIds.forEach(slotId => transaction.delete(doc(db, SLOT_OCCUPANCY_COLLECTION, slotId)));
    updated = appointmentFromFirestore({ id: data.id, data: () => data });
  });

  return updated;
}

export async function rescheduleFirebaseAppointment(appointment, phone, code, nextAppointment) {
  const lookupId = await clientLookupId(phone, code);
  const db = getBlacklineDb();
  const lookupRef = doc(db, CLIENT_LOOKUPS_COLLECTION, lookupId);

  let updated;
  await runTransaction(db, async transaction => {
    const lookupSnap = await transaction.get(lookupRef);
    if (!lookupSnap.exists()) throw makeFirebaseError('not-found', 'Agendamento nao encontrado.');
    const current = appointmentFromFirestore(lookupSnap);
    if (current.id !== appointment.id || onlyDigits(current.phone) !== onlyDigits(phone) || normalizeCode(current.code) !== normalizeCode(code)) {
      throw makeFirebaseError('not-found', 'Agendamento nao encontrado.');
    }
    if (!['pendente', 'confirmado'].includes(current.status || 'pendente')) {
      throw makeFirebaseError('not-mutable', 'Este agendamento nao permite reagendamento pelo site.');
    }

    const data = await prepareAppointmentData({ ...current, ...nextAppointment, status: 'pendente', updatedAt: timestampNow() });
    const oldSlots = new Set(current.slotIds || []);
    const nextSlots = new Set(data.slotIds || []);
    const slotsToCreate = data.slotIds.filter(slotId => !oldSlots.has(slotId));
    const slotsToDelete = current.slotIds.filter(slotId => !nextSlots.has(slotId));
    const slotRefsToCreate = slotsToCreate.map(slotId => doc(db, SLOT_OCCUPANCY_COLLECTION, slotId));
    const slotSnaps = await Promise.all(slotRefsToCreate.map(slotRef => transaction.get(slotRef)));

    if (slotSnaps.some(slotSnap => slotSnap.exists() && isBlockingStatus(slotSnap.data()?.status))) {
      throw makeFirebaseError('slot-taken', 'Horario ja reservado. Escolha outro horario.');
    }

    const appointmentRef = doc(db, APPOINTMENTS_COLLECTION, data.id);
    transaction.set(appointmentRef, data);
    transaction.set(lookupRef, data);
    slotsToDelete.forEach(slotId => transaction.delete(doc(db, SLOT_OCCUPANCY_COLLECTION, slotId)));
    slotsToCreate.forEach((slotId, index) => {
      transaction.set(slotRefsToCreate[index], buildSlotPayload(data, slotId));
    });
    updated = appointmentFromFirestore({ id: data.id, data: () => data });
  });

  return updated;
}

export function isSlotTakenError(error) {
  return error?.code === 'slot-taken' || String(error?.message || '').toLowerCase().includes('horario ja reservado');
}

export function isPermissionError(error) {
  return error?.code === 'permission-denied' || String(error?.message || '').toLowerCase().includes('permission');
}
