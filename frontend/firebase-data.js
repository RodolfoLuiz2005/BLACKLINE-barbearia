import { collection, doc, getDocs, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { getBlacklineDb } from './firebase-config.js';

const APPOINTMENTS_COLLECTION = 'agendamentos';

function timestampNow() {
  return new Date().toISOString();
}

export function appointmentToFirestore(appointment) {
  const now = timestampNow();
  return {
    id: appointment.id || appointment.code,
    codigo: appointment.code || appointment.codigo || '',
    nome: appointment.name || appointment.nome || '',
    telefone: appointment.phone || appointment.telefone || '',
    servico: appointment.serviceName || appointment.servico || '',
    servicoId: appointment.serviceId || appointment.servicoId || '',
    profissionalId: appointment.barberId || appointment.profissionalId || '',
    profissionalNome: appointment.barberName || appointment.profissionalNome || '',
    data: appointment.date || appointment.data || '',
    horario: appointment.time || appointment.horario || '',
    observacoes: appointment.note || appointment.observacoes || '',
    status: appointment.status || 'pendente',
    criadoEm: appointment.createdAt || appointment.criadoEm || now,
    atualizadoEm: appointment.updatedAt || appointment.atualizadoEm || now
  };
}

export function appointmentFromFirestore(snapshot) {
  const data = snapshot.data ? snapshot.data() : snapshot;
  return {
    id: data.id || snapshot.id || data.codigo,
    code: data.codigo || snapshot.id || '',
    name: data.nome || '',
    phone: data.telefone || '',
    serviceId: data.servicoId || '',
    serviceName: data.servico || '',
    barberId: data.profissionalId || '',
    barberName: data.profissionalNome || '',
    date: data.data || '',
    time: data.horario || '',
    note: data.observacoes || '',
    status: data.status || 'pendente',
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
  if ('note' in patch) mapped.observacoes = patch.note;
  mapped.atualizadoEm = timestampNow();
  return mapped;
}

export async function createFirebaseAppointment(appointment) {
  const db = getBlacklineDb();
  const data = appointmentToFirestore(appointment);
  const documentId = data.codigo || data.id;
  await setDoc(doc(db, APPOINTMENTS_COLLECTION, documentId), data);
  return appointmentFromFirestore({ id: documentId, data: () => data });
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

export async function updateFirebaseAppointment(id, patch) {
  const db = getBlacklineDb();
  await updateDoc(doc(db, APPOINTMENTS_COLLECTION, id), appointmentPatchToFirestore(patch));
}