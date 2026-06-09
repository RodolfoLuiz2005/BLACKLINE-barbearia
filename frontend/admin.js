import { getBlacklineAuth, getBlacklineDb } from './firebase-config.js';

const AGENDAMENTOS_COLLECTION = 'agendamentos';
const SERVICOS_COLLECTION = 'servicos';
const PROFISSIONAIS_COLLECTION = 'profissionais';
const PLANOS_COLLECTION = 'planos';
const GALERIA_COLLECTION = 'galeria';
const CONFIG_COLLECTION = 'configuracoes';
const FIRESTORE_MODULE_URL = 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
const AUTH_MODULE_URL = 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
const ADMIN_UID = 'VaHoF4WF6tWsCImK03tz9HljO6x2';
let firestoreApi;
let authApi;

const STATUS = {
  pendente: { label: 'Pendente', cls: 's-pendente' },
  confirmado: { label: 'Confirmado', cls: 's-confirmado' },
  concluido: { label: 'Concluido', cls: 's-concluido' },
  cancelado: { label: 'Cancelado', cls: 's-cancelado' }
};

const state = {
  user: null,
  view: 'agenda',
  agendamentos: [],
  servicos: [],
  profissionais: [],
  galeria: [],
  config: {}
};

async function getFirestoreApi() {
  if (!firestoreApi) firestoreApi = await import(FIRESTORE_MODULE_URL);
  return firestoreApi;
}

async function getAuthApi() {
  if (!authApi) authApi = await import(AUTH_MODULE_URL);
  return authApi;
}

function isAdminAuthenticated() {
  return Boolean(state.user && state.user.uid === ADMIN_UID);
}

function requireAdminSession() {
  if (!isAdminAuthenticated()) {
    throw new Error('Acesso administrativo bloqueado. Faca login novamente.');
  }
}

async function getAdminAuthDiagnostics() {
  let authUser = null;
  let authError = null;

  try {
    const auth = await getBlacklineAuth();
    authUser = auth.currentUser || null;
  } catch (err) {
    authError = {
      code: err?.code || null,
      message: err?.message || String(err)
    };
  }

  const effectiveUser = state.user || authUser;
  const effectiveUid = effectiveUser?.uid || null;

  return {
    uidUsuarioLogado: effectiveUid,
    stateUserExiste: Boolean(state.user),
    stateUserUid: state.user?.uid || null,
    authCurrentUserExiste: Boolean(authUser),
    authCurrentUserUid: authUser?.uid || null,
    adminUidEsperado: ADMIN_UID,
    uidIgualAoAdminUid: effectiveUid === ADMIN_UID,
    authError
  };
}

async function validateAdminBeforeSeed() {
  const diagnostics = await getAdminAuthDiagnostics();

  if (diagnostics.authCurrentUserExiste && !state.user) {
    const auth = await getBlacklineAuth();
    state.user = auth.currentUser || null;
  }

  if (!diagnostics.uidUsuarioLogado) {
    console.error('Seed bloqueado: nenhum usuario logado.', diagnostics);
    alert('Seed bloqueado: faca login no painel ADM antes de executar o seed.');
    return false;
  }

  if (!diagnostics.uidIgualAoAdminUid) {
    console.error('Seed bloqueado: usuario logado nao e o admin autorizado.', diagnostics);
    alert('Seed bloqueado: este usuario nao tem permissao de admin.');
    return false;
  }

  return true;
}

function docToAgendamento(snapshot) {
  return normalizeAgendamento({ id: snapshot.id, ...snapshot.data() });
}

function docToData(snapshot) {
  return { id: snapshot.id, ...snapshot.data() };
}

async function listarAgendamentosFirestore() {
  requireAdminSession();
  const db = await getBlacklineDb();
  const { collection, getDocs } = await getFirestoreApi();
  const snap = await getDocs(collection(db, AGENDAMENTOS_COLLECTION));
  const agendamentos = snap.docs
    .map(docToAgendamento)
    .sort((a, b) => `${b.data || ''} ${b.horario || ''}`.localeCompare(`${a.data || ''} ${a.horario || ''}`));
  return agendamentos;
}

async function atualizarAgendamentoFirestore(id, payload) {
  requireAdminSession();
  const db = await getBlacklineDb();
  const { doc, getDoc, serverTimestamp, updateDoc } = await getFirestoreApi();
  const ref = doc(db, AGENDAMENTOS_COLLECTION, String(id));
  await updateDoc(ref, { ...payload, atualizadoEm: serverTimestamp() });
  const updated = await getDoc(ref);
  return docToAgendamento(updated);
}

async function excluirAgendamentoFirestore(id) {
  requireAdminSession();
  const db = await getBlacklineDb();
  const { deleteDoc, doc } = await getFirestoreApi();
  await deleteDoc(doc(db, AGENDAMENTOS_COLLECTION, String(id)));
}

async function listarColecaoFirestore(collectionName) {
  requireAdminSession();
  const db = await getBlacklineDb();
  const { collection, getDocs } = await getFirestoreApi();
  const snap = await getDocs(collection(db, collectionName));
  return snap.docs.map(docToData);
}

async function salvarDocumentoFirestore(collectionName, id, payload) {
  requireAdminSession();
  const db = await getBlacklineDb();
  const { collection, doc, getDoc, serverTimestamp, setDoc } = await getFirestoreApi();

  if (id) {
    const ref = doc(db, collectionName, id);
    const current = await getDoc(ref);
    const basePayload = {
      ...payload,
      atualizadoEm: serverTimestamp(),
      ...(current.exists() ? {} : { criadoEm: serverTimestamp() })
    };
    await setDoc(ref, basePayload, { merge: true });
    const snap = await getDoc(ref);
    return docToData(snap);
  }

  const ref = doc(collection(db, collectionName));
  await setDoc(ref, { ...payload, criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp() });
  const snap = await getDoc(ref);
  return docToData(snap);
}

async function excluirDocumentoFirestore(collectionName, id) {
  requireAdminSession();
  const db = await getBlacklineDb();
  const { deleteDoc, doc } = await getFirestoreApi();
  await deleteDoc(doc(db, collectionName, id));
}

async function carregarConfigFirestore() {
  requireAdminSession();
  const db = await getBlacklineDb();
  const { doc, getDoc } = await getFirestoreApi();
  const snap = await getDoc(doc(db, CONFIG_COLLECTION, 'barbearia'));
  return snap.exists() ? { id: snap.id, ...snap.data() } : {};
}

async function salvarConfigFirestore(payload) {
  requireAdminSession();
  const db = await getBlacklineDb();
  const { doc, getDoc, serverTimestamp, setDoc } = await getFirestoreApi();
  const ref = doc(db, CONFIG_COLLECTION, 'barbearia');
  await setDoc(ref, { ...payload, atualizadoEm: serverTimestamp() }, { merge: true });
  const snap = await getDoc(ref);
  return docToData(snap);
}

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const escapeHtml = escapeHTML;

function escapeJsString(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, ' ');
}

function normalizeAgendamento(ag = {}) {
  const id = String(ag.id || '');
  const nome = ag.nome || '';
  const telefone = ag.telefone || '';
  const servico = ag.servico || 'Serviço não informado';
  const data = ag.data || '';
  const horario = ag.horario || '';
  const status = STATUS[ag.status] ? ag.status : 'pendente';
  const profissionalId = ag.profissionalId || '';
  const profissionalNome = ag.profissionalNome || '';
  const shortId = String(ag.id || '').slice(0, 6);
  const codigo = String(ag.codigo || shortId || '-');
  const observacoes = ag.observacoes || '';
  return {
    ...ag,
    id,
    codigo,
    nome,
    telefone,
    servico,
    data,
    horario,
    status,
    profissionalId,
    profissionalNome,
    observacoes
  };
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function slug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `item-${Date.now()}`;
}

function formatPhone(value) {
  const tel = onlyDigits(value);
  if (tel.length === 11) return `(${tel.slice(0, 2)}) ${tel.slice(2, 7)}-${tel.slice(7)}`;
  if (tel.length === 10) return `(${tel.slice(0, 2)}) ${tel.slice(2, 6)}-${tel.slice(6)}`;
  return value || '';
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function whatsappLink(phone, message) {
  return `https://wa.me/${onlyDigits(phone)}?text=${encodeURIComponent(message)}`;
}

function shopPhone() {
  return onlyDigits(state.config.whatsapp || '5581999999999');
}

function getSlotId(data, horario, profissionalId) {
  return `${data}_${String(horario || '').replace(':', '-')}_${profissionalId}`;
}

function makeCode(prefix = 'BL') {
  return `${prefix}${Date.now().toString(36).slice(-4).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

function normalizeGaleriaItem(item = {}) {
  return {
    ...item,
    url: item.url || item.imagemUrl || ''
  };
}

function normalizeConfig(config = {}) {
  return {
    ...config,
    mapaEmbed: config.mapaEmbed || config.googleMapsUrl || '',
    googleReviewsUrl: config.googleReviewsUrl || config.googleReviewUrl || '',
    horarioTexto: config.horarioTexto || config.horarioFuncionamento || ''
  };
}

function authErrorMessage(error) {
  const code = String(error?.code || '');
  if (code.includes('auth/invalid-credential') || code.includes('auth/wrong-password') || code.includes('auth/user-not-found')) {
    return 'Email ou senha invalidos.';
  }
  if (code.includes('auth/too-many-requests')) {
    return 'Muitas tentativas de login. Aguarde um pouco e tente novamente.';
  }
  if (code.includes('auth/network-request-failed')) {
    return 'Erro de conexao com o Firebase Auth.';
  }
  if (code.includes('auth/operation-not-allowed')) {
    return 'Login por email/senha ainda nao esta ativado no Firebase Auth.';
  }
  return error?.message || 'Nao foi possivel fazer login.';
}

function setLoginError(message = '') {
  const erro = document.getElementById('login-error');
  if (erro) erro.textContent = message;
}

function showLogin(message = '') {
  state.user = null;
  document.body.classList.remove('admin-authenticated');
  document.getElementById('login-overlay').style.display = 'flex';
  setLoginError(message);
}

function showAdminPanel() {
  document.body.classList.add('admin-authenticated');
  document.getElementById('login-overlay').style.display = 'none';
  setLoginError('');
}

async function tentarLogin() {
  const emailInput = document.getElementById('login-email');
  const senhaInput = document.getElementById('login-senha');
  const erro = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  const email = emailInput.value.trim();
  const senha = senhaInput.value;
  if (!email || !senha) {
    erro.textContent = 'Informe email e senha.';
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Verificando...';
  erro.textContent = '';
  try {
    const auth = await getBlacklineAuth();
    const { signInWithEmailAndPassword } = await getAuthApi();
    await signInWithEmailAndPassword(auth, email, senha);
  } catch (err) {
    erro.textContent = authErrorMessage(err);
    senhaInput.value = '';
    senhaInput.focus();
  } finally {
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
}

function forceLogout() {
  showLogin();
}

async function sair() {
  const auth = await getBlacklineAuth();
  const { signOut } = await getAuthApi();
  await signOut(auth);
  forceLogout();
}

async function init() {
  const emailInput = document.getElementById('login-email');
  document.getElementById('login-senha')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') tentarLogin();
  });
  emailInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') tentarLogin();
  });

  const auth = await getBlacklineAuth();
  const { onAuthStateChanged } = await getAuthApi();
  onAuthStateChanged(auth, async user => {
    if (!user) {
      showLogin();
      return;
    }

    if (user.uid !== ADMIN_UID) {
      await sair();
      showLogin('Usuario autenticado, mas sem permissao para este painel.');
      return;
    }

    state.user = user;
    try {
      showAdminPanel();
      await carregarTudo();
    } catch (err) {
      console.error('Erro ao inicializar painel ADM:', err);
      forceLogout();
    }
  });

  setInterval(() => {
    if (state.view === 'agenda' && isAdminAuthenticated()) carregarAgendamentos();
  }, 30000);
}

async function carregarTudo() {
  const btn = document.querySelector('.btn-refresh');
  if (btn) btn.disabled = true;
  try {
    const agendamentos = await listarAgendamentosFirestore();
    state.agendamentos = agendamentos || [];
    await carregarDadosLegados();
    renderAll();
  } catch (err) {
    console.error('Erro completo ao carregar agendamentos no Firestore:', err);
    setEstado('erro', 'Nao foi possivel carregar os agendamentos. Verifique a configuracao e as permissoes do Firestore.');
    atualizarStats();
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function carregarAgendamentos() {
  try {
    state.agendamentos = await listarAgendamentosFirestore();
    atualizarStats();
    aplicarFiltros();
  } catch (err) {
    console.error('Erro completo ao atualizar agendamentos no Firestore:', err);
    setEstado('erro', 'Nao foi possivel atualizar os agendamentos agora.');
  }
}

async function carregarDadosLegados() {
  try {
    const [servicos, profissionais, galeria, planos, config] = await Promise.all([
      listarColecaoFirestore(SERVICOS_COLLECTION),
      listarColecaoFirestore(PROFISSIONAIS_COLLECTION),
      listarColecaoFirestore(GALERIA_COLLECTION),
      listarColecaoFirestore(PLANOS_COLLECTION),
      carregarConfigFirestore()
    ]);
    state.servicos = servicos || [];
    state.profissionais = profissionais || [];
    state.galeria = (galeria || []).map(normalizeGaleriaItem);
    state.config = normalizeConfig({ ...(config || {}), planos: planos || [] });
  } catch (err) {
    console.error('Dados administrativos nao carregados do Firestore:', err);
    state.servicos = state.servicos || [];
    state.profissionais = state.profissionais || [];
    state.galeria = state.galeria || [];
    state.config = state.config || {};
  }
}

function renderAll() {
  renderProfissionalFilter();
  atualizarStats();
  aplicarFiltros();
  renderServicosList();
  renderProfList();
  renderGalList();
  fillConfigForm();
}

function trocarView(view) {
  state.view = view;
  document.querySelectorAll('.admin-view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');
  document.querySelectorAll('.sidebar-link').forEach(link => link.classList.toggle('active', link.dataset.view === view));
  const titles = {
    agenda: ['Agendamentos', 'Gerencie horarios e status por profissional.'],
    servicos: ['Servicos', 'Adicione, edite, remova ou desative servicos.'],
    profissionais: ['Profissionais', 'Configure barbeiros, agenda e disponibilidade.'],
    galeria: ['Galeria', 'Cadastre imagens por URL enquanto upload nao estiver configurado.'],
    config: ['Configuracoes', 'Redes sociais, mapa, Google e planos mensais.']
  };
  document.getElementById('page-title').textContent = titles[view][0];
  document.getElementById('page-sub').textContent = titles[view][1];
}

function renderProfissionalFilter() {
  const select = document.getElementById('filtro-profissional');
  if (!select) return;

  const profissionais = new Map();
  state.profissionais.forEach(p => {
    if (p.id) profissionais.set(String(p.id), p.nome || p.id);
  });
  state.agendamentos.forEach(raw => {
    const ag = normalizeAgendamento(raw);
    if (ag.profissionalId && !profissionais.has(String(ag.profissionalId))) {
      profissionais.set(String(ag.profissionalId), ag.profissionalNome || ag.profissionalId);
    }
  });

  select.innerHTML = '<option value="">Todos</option>' + [...profissionais.entries()]
    .map(([id, nome]) => `<option value="${escapeHtml(id)}">${escapeHtml(nome)}</option>`)
    .join('');
}

function atualizarStats() {
  document.getElementById('stat-total').textContent = state.agendamentos.length;
  ['pendente', 'confirmado', 'concluido', 'cancelado'].forEach(s => {
    const el = document.getElementById(`stat-${s}`);
    if (el) el.textContent = state.agendamentos.filter(a => normalizeAgendamento(a).status === s).length;
  });
}

function aplicarFiltros() {
  const status = document.getElementById('filtro-status').value;
  const data = document.getElementById('filtro-data').value;
  const profissionalId = document.getElementById('filtro-profissional').value;
  const busca = document.getElementById('filtro-busca').value.toLowerCase().trim();
  const buscaDigits = onlyDigits(busca);
  const lista = state.agendamentos.filter(raw => {
    const ag = normalizeAgendamento(raw);
    if (status && ag.status !== status) return false;
    if (data && ag.data !== data) return false;
    if (profissionalId && ag.profissionalId !== profissionalId) return false;
    if (busca) {
      const n = (ag.nome || '').toLowerCase();
      const t = (ag.telefone || '');
      const haystack = `${n} ${t} ${ag.codigo || ''}`.toLowerCase();
      const telefoneDigits = onlyDigits(t);
      if (!haystack.includes(busca) && (!buscaDigits || !telefoneDigits.includes(buscaDigits))) return false;
    }
    return true;
  });
  renderTabela(lista);
}

function limparFiltros() {
  document.getElementById('filtro-status').value = '';
  document.getElementById('filtro-data').value = '';
  document.getElementById('filtro-profissional').value = '';
  document.getElementById('filtro-busca').value = '';
  aplicarFiltros();
}

function setEstado(tipo, msg) {
  document.getElementById('table-loading').style.display = 'none';
  document.getElementById('table-empty').style.display = tipo !== 'tabela' ? 'flex' : 'none';
  document.getElementById('table-scroll').style.display = tipo === 'tabela' ? 'block' : 'none';
  if (tipo !== 'tabela') document.getElementById('empty-msg').textContent = msg || '';
}

function renderTabela(lista) {
  if (lista.length === 0) {
    setEstado('vazio', state.agendamentos.length === 0 ? 'Nenhum agendamento cadastrado ainda.' : 'Nenhum resultado para os filtros aplicados.');
    return;
  }
  setEstado('tabela');
  const tbody = document.getElementById('ag-tbody');
  tbody.innerHTML = '';
  lista.forEach(raw => {
    const ag = normalizeAgendamento(raw);
    const sta = STATUS[ag.status] || STATUS.pendente;
    const tel = onlyDigits(ag.telefone);
    const idForJs = escapeJsString(ag.id);
    const date = ag.data ? new Date(`${ag.data}T12:00:00`) : null;
    const validDate = date && !Number.isNaN(date.getTime());
    const diaF = validDate ? date.toLocaleDateString('pt-BR') : '-';
    const semF = validDate ? date.toLocaleDateString('pt-BR', { weekday: 'long' }) : '';
    const shortId = String(ag.id || '').slice(0, 6);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="cell-id">${escapeHtml(ag.codigo || shortId)}</span></td>
      <td><div class="cell-nome">${escapeHtml(ag.nome)}</div></td>
      <td class="cell-tel"><a href="${whatsappLink(tel, `Ola, ${ag.nome || 'cliente'}! Aqui e a BLACKLINE Barber.`)}" target="_blank" rel="noopener">${escapeHtml(formatPhone(tel))}</a></td>
      <td><span class="badge-servico badge-corte">${escapeHtml(ag.servico)}</span></td>
      <td>${escapeHtml(ag.profissionalNome || '')}</td>
      <td><div class="cell-dia">${escapeHtml(diaF)}</div><div class="cell-sem">${escapeHtml(semF)}</div></td>
      <td><span class="pill-hora">${escapeHtml(ag.horario)}</span></td>
      <td><span class="badge-status ${sta.cls}">${sta.label}</span></td>
      <td>
        <div class="acoes">
          <button class="btn-ver" onclick="abrirDetalhe('${idForJs}')">Ver</button>
          <button class="btn-del" onclick="deletar('${idForJs}')" title="Remover">x</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function abrirDetalhe(id) {
  const ag = normalizeAgendamento(state.agendamentos.find(a => String(a.id ?? '') === String(id)));
  if (!ag.id) return;
  const sta = STATUS[ag.status] || STATUS.pendente;
  const idForJs = escapeJsString(ag.id);
  const cliente = ag.nome || 'cliente';
  const confirmMsg = `Ola, ${cliente}! Seu agendamento na BLACKLINE esta confirmado:\nServico: ${ag.servico}\nProfissional: ${ag.profissionalNome}\nData: ${formatDate(ag.data)}\nHorario: ${ag.horario}\nEndereco: ${state.config.endereco || ''}\nCodigo: ${ag.codigo}`;
  const reminderMsg = `Ola, ${cliente}! Lembrete do seu horario na BLACKLINE:\nServico: ${ag.servico}\nProfissional: ${ag.profissionalNome}\nData: ${formatDate(ag.data)}\nHorario: ${ag.horario}\nEndereco: ${state.config.endereco || ''}`;
  document.getElementById('detail-content').innerHTML = `
    <div class="drow"><span class="dkey">Codigo</span><span class="dval">${escapeHtml(ag.codigo || '')}</span></div>
    <div class="drow"><span class="dkey">Nome</span><span class="dval">${escapeHtml(ag.nome)}</span></div>
    <div class="drow"><span class="dkey">WhatsApp</span><span class="dval">${escapeHtml(formatPhone(ag.telefone))}</span></div>
    <div class="drow"><span class="dkey">Servico</span><span class="dval">${escapeHtml(ag.servico)}</span></div>
    <div class="drow"><span class="dkey">Profissional</span><span class="dval">${escapeHtml(ag.profissionalNome)}</span></div>
    <div class="drow"><span class="dkey">Data</span><span class="dval">${escapeHtml(formatDate(ag.data))}</span></div>
    <div class="drow"><span class="dkey">Horario</span><span class="dval">${escapeHtml(ag.horario)}</span></div>
    <div class="drow"><span class="dkey">Status</span><span class="dval"><span class="badge-status ${sta.cls}">${sta.label}</span></span></div>
    <div class="drow"><span class="dkey">Lembrete</span><span class="dval">${ag.lembreteEnviado ? 'Marcado como enviado' : 'Pendente'}</span></div>
    ${ag.observacoes ? `<div class="dobs">${escapeHtml(ag.observacoes)}</div>` : ''}
  `;
  const statusButtons = Object.keys(STATUS).filter(s => s !== ag.status).map(s => {
    return `<button class="btn-status btn-status-${s}" onclick="atualizarStatus('${idForJs}','${s}')">${STATUS[s].label}</button>`;
  }).join('');
  document.getElementById('detail-actions').innerHTML = `
    <a class="btn-status" href="${whatsappLink(ag.telefone, confirmMsg)}" target="_blank" rel="noopener">Confirmar no WhatsApp</a>
    <a class="btn-status" href="${whatsappLink(ag.telefone, reminderMsg)}" target="_blank" rel="noopener" onclick="marcarLembrete('${idForJs}')">Enviar lembrete</a>
    ${statusButtons}
  `;
  document.getElementById('detailOverlay').classList.add('open');
}

function fecharDetalhe(e) {
  if (e.target.id === 'detailOverlay') fecharDetalheBtn();
}

function fecharDetalheBtn() {
  document.getElementById('detailOverlay').classList.remove('open');
}

async function atualizarStatus(id, status) {
  try {
    const updated = await atualizarAgendamentoFirestore(id, { status });
    const idx = state.agendamentos.findIndex(a => String(a.id ?? '') === String(id));
    if (idx !== -1) state.agendamentos[idx] = updated;
    atualizarStats();
    aplicarFiltros();
    fecharDetalheBtn();
  } catch (err) {
    console.error('Erro ao atualizar status no Firestore:', err);
    alert('Nao foi possivel atualizar o status agora.');
  }
}

async function marcarLembrete(id) {
  try {
    const updated = await atualizarAgendamentoFirestore(id, { lembreteEnviado: true });
    const idx = state.agendamentos.findIndex(a => String(a.id ?? '') === String(id));
    if (idx !== -1) state.agendamentos[idx] = updated;
  } catch (err) {
    console.error('Erro ao marcar lembrete no Firestore:', err);
    // O WhatsApp ainda abre; a marcacao visual pode ser refeita depois.
  }
}

async function deletar(id) {
  const ag = normalizeAgendamento(state.agendamentos.find(a => String(a.id ?? '') === String(id)));
  if (!ag.id || !confirm(`Remover agendamento de ${ag.nome || 'cliente sem nome'}?`)) return;
  try {
    await excluirAgendamentoFirestore(id);
    state.agendamentos = state.agendamentos.filter(a => String(a.id ?? '') !== String(id));
    atualizarStats();
    aplicarFiltros();
  } catch (err) {
    console.error('Erro ao excluir agendamento no Firestore:', err);
    alert('Nao foi possivel excluir o agendamento agora.');
  }
}

function renderServicosList() {
  const box = document.getElementById('servicos-list');
  box.innerHTML = state.servicos.map(s => `
    <article class="admin-item">
      <div>
        <h3>${escapeHtml(s.nome)} <span class="${s.ativo ? 'item-on' : 'item-off'}">${s.ativo ? 'ativo' : 'inativo'}</span></h3>
        <p>${escapeHtml(s.descricao || '')}</p>
        <small>${money(s.preco)} - ${Number(s.duracao || 0)} min - ${escapeHtml(s.categoria || '')}</small>
      </div>
      <div class="item-actions">
        <button onclick="editarServico('${s.id}')">Editar</button>
        <button onclick="removerRegistro('servicos','${s.id}')">Remover</button>
      </div>
    </article>
  `).join('');
}

function editarServico(id) {
  const s = state.servicos.find(item => item.id === id);
  if (!s) return;
  document.getElementById('servico-form-title').textContent = 'Editar servico';
  document.getElementById('servico-id').value = s.id;
  document.getElementById('servico-nome').value = s.nome || '';
  document.getElementById('servico-descricao').value = s.descricao || '';
  document.getElementById('servico-preco').value = s.preco || 0;
  document.getElementById('servico-duracao').value = s.duracao || 30;
  document.getElementById('servico-categoria').value = s.categoria || '';
  document.getElementById('servico-opcoes').value = (s.opcoes || []).join('\n');
  document.getElementById('servico-ativo').checked = s.ativo !== false;
}

function resetServicoForm() {
  document.getElementById('servico-form-title').textContent = 'Novo servico';
  ['servico-id', 'servico-nome', 'servico-descricao', 'servico-preco', 'servico-duracao', 'servico-categoria', 'servico-opcoes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('servico-ativo').checked = true;
}

async function salvarServico(event) {
  event.preventDefault();
  const id = document.getElementById('servico-id').value;
  const payload = {
    nome: document.getElementById('servico-nome').value.trim(),
    descricao: document.getElementById('servico-descricao').value.trim(),
    preco: Number(document.getElementById('servico-preco').value),
    duracao: Number(document.getElementById('servico-duracao').value),
    categoria: document.getElementById('servico-categoria').value.trim(),
    ativo: document.getElementById('servico-ativo').checked,
    opcoes: document.getElementById('servico-opcoes').value.split('\n').map(v => v.trim()).filter(Boolean)
  };
  await saveCollectionItem('servicos', id, payload);
  resetServicoForm();
}

function defaultHorarios() {
  return {
    1: { ativo: true, inicio: '08:00', fim: '18:00', intervalo: 30 },
    2: { ativo: true, inicio: '08:00', fim: '18:00', intervalo: 30 },
    3: { ativo: true, inicio: '08:00', fim: '18:00', intervalo: 30 },
    4: { ativo: true, inicio: '08:00', fim: '18:00', intervalo: 30 },
    5: { ativo: true, inicio: '08:00', fim: '18:00', intervalo: 30 },
    6: { ativo: true, inicio: '08:00', fim: '12:00', intervalo: 30 },
    0: { ativo: false, inicio: '08:00', fim: '12:00', intervalo: 30 }
  };
}

function renderProfList() {
  const box = document.getElementById('prof-list');
  box.innerHTML = state.profissionais.map(p => `
    <article class="admin-item">
      <img src="${escapeHtml(p.foto || '')}" alt="">
      <div>
        <h3>${escapeHtml(p.nome)} <span class="${p.ativo ? 'item-on' : 'item-off'}">${p.ativo ? 'ativo' : 'inativo'}</span></h3>
        <p>${escapeHtml(p.especialidade || '')}</p>
      </div>
      <div class="item-actions">
        <button onclick="editarProf('${p.id}')">Editar</button>
        <button onclick="removerRegistro('profissionais','${p.id}')">Remover</button>
      </div>
    </article>
  `).join('');
}

function editarProf(id) {
  const p = state.profissionais.find(item => item.id === id);
  if (!p) return;
  document.getElementById('prof-form-title').textContent = 'Editar profissional';
  document.getElementById('prof-id').value = p.id;
  document.getElementById('prof-nome').value = p.nome || '';
  document.getElementById('prof-foto').value = p.foto || '';
  document.getElementById('prof-especialidade').value = p.especialidade || '';
  document.getElementById('prof-horarios').value = JSON.stringify(p.horariosAtendimento || p.horarios || defaultHorarios(), null, 2);
  document.getElementById('prof-ativo').checked = p.ativo !== false;
}

function resetProfForm() {
  document.getElementById('prof-form-title').textContent = 'Novo profissional';
  ['prof-id', 'prof-nome', 'prof-foto', 'prof-especialidade'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('prof-horarios').value = JSON.stringify(defaultHorarios(), null, 2);
  document.getElementById('prof-ativo').checked = true;
}

async function salvarProfissional(event) {
  event.preventDefault();
  const id = document.getElementById('prof-id').value;
  let horarios;
  try {
    horarios = JSON.parse(document.getElementById('prof-horarios').value || '{}');
  } catch {
    alert('Agenda semanal precisa ser um JSON valido.');
    return;
  }
  const payload = {
    nome: document.getElementById('prof-nome').value.trim(),
    foto: document.getElementById('prof-foto').value.trim(),
    especialidade: document.getElementById('prof-especialidade').value.trim(),
    horariosAtendimento: horarios,
    ativo: document.getElementById('prof-ativo').checked
  };
  await saveCollectionItem('profissionais', id, payload);
  resetProfForm();
}

function renderGalList() {
  const box = document.getElementById('gal-list');
  box.innerHTML = state.galeria.map(g => `
    <article class="admin-item">
      <img src="${escapeHtml(g.url)}" alt="">
      <div>
        <h3>${escapeHtml(g.titulo)} <span class="${g.ativo ? 'item-on' : 'item-off'}">${g.ativo ? 'ativa' : 'inativa'}</span></h3>
        <p>${escapeHtml(g.url)}</p>
      </div>
      <div class="item-actions">
        <button onclick="editarGal('${g.id}')">Editar</button>
        <button onclick="removerRegistro('galeria','${g.id}')">Remover</button>
      </div>
    </article>
  `).join('');
}

function editarGal(id) {
  const g = state.galeria.find(item => item.id === id);
  if (!g) return;
  document.getElementById('gal-form-title').textContent = 'Editar imagem';
  document.getElementById('gal-id').value = g.id;
  document.getElementById('gal-titulo').value = g.titulo || '';
  document.getElementById('gal-url').value = g.url || '';
  document.getElementById('gal-ativo').checked = g.ativo !== false;
}

function resetGalForm() {
  document.getElementById('gal-form-title').textContent = 'Nova imagem';
  ['gal-id', 'gal-titulo', 'gal-url'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('gal-ativo').checked = true;
}

async function salvarGaleria(event) {
  event.preventDefault();
  const id = document.getElementById('gal-id').value;
  const payload = {
    titulo: document.getElementById('gal-titulo').value.trim(),
    imagemUrl: document.getElementById('gal-url').value.trim(),
    ativo: document.getElementById('gal-ativo').checked
  };
  await saveCollectionItem('galeria', id, payload);
  resetGalForm();
}

async function saveCollectionItem(collection, id, payload) {
  try {
    const item = await salvarDocumentoFirestore(collection, id, payload);
    const normalizedItem = collection === GALERIA_COLLECTION ? normalizeGaleriaItem(item) : item;
    if (id) {
      const index = state[collection].findIndex(row => row.id === id);
      if (index !== -1) state[collection][index] = normalizedItem;
    } else {
      state[collection].push(normalizedItem);
    }
    renderAll();
  } catch (err) {
    console.error(`Erro ao salvar ${collection} no Firestore:`, err);
    alert(err.message);
  }
}

async function removerRegistro(collection, id) {
  if (!confirm('Remover este registro?')) return;
  try {
    await excluirDocumentoFirestore(collection, id);
    state[collection] = state[collection].filter(item => item.id !== id);
    renderAll();
  } catch (err) {
    console.error(`Erro ao remover ${collection} no Firestore:`, err);
    alert(err.message);
  }
}

function fillConfigForm() {
  const cfg = state.config;
  document.getElementById('cfg-instagram').value = cfg.instagram || '';
  document.getElementById('cfg-facebook').value = cfg.facebook || '';
  document.getElementById('cfg-tiktok').value = cfg.tiktok || '';
  document.getElementById('cfg-whatsapp').value = cfg.whatsapp || '';
  document.getElementById('cfg-endereco').value = cfg.endereco || '';
  document.getElementById('cfg-mapa').value = cfg.mapaEmbed || '';
  document.getElementById('cfg-google-url').value = cfg.googleReviewsUrl || '';
  document.getElementById('cfg-google-rating').value = cfg.googleRating || '';
  document.getElementById('cfg-horario').value = cfg.horarioTexto || '';
  document.getElementById('cfg-planos').value = JSON.stringify(cfg.planos || [], null, 2);
}

async function salvarConfig(event) {
  event.preventDefault();
  let planos;
  try {
    planos = JSON.parse(document.getElementById('cfg-planos').value || '[]');
  } catch {
    alert('Planos precisam estar em JSON valido.');
    return;
  }
  const payload = {
    nome: 'BLACKLINE Barber',
    telefone: onlyDigits(document.getElementById('cfg-whatsapp').value),
    instagram: document.getElementById('cfg-instagram').value.trim(),
    facebook: document.getElementById('cfg-facebook').value.trim(),
    tiktok: document.getElementById('cfg-tiktok').value.trim(),
    whatsapp: onlyDigits(document.getElementById('cfg-whatsapp').value),
    endereco: document.getElementById('cfg-endereco').value.trim(),
    googleMapsUrl: document.getElementById('cfg-mapa').value.trim(),
    googleReviewUrl: document.getElementById('cfg-google-url').value.trim(),
    googleRating: document.getElementById('cfg-google-rating').value.trim(),
    horarioFuncionamento: document.getElementById('cfg-horario').value.trim()
  };
  try {
    state.config = normalizeConfig({ ...(await salvarConfigFirestore(payload)), planos });
    await Promise.all(planos.map(plano => salvarDocumentoFirestore(PLANOS_COLLECTION, plano.id || slug(plano.nome), {
      nome: plano.nome || '',
      preco: Number(plano.preco || 0),
      beneficios: Array.isArray(plano.beneficios) ? plano.beneficios : [],
      ativo: plano.ativo !== false
    })));
    alert('Configuracoes salvas.');
  } catch (err) {
    console.error('Erro ao salvar configuracoes no Firestore:', err);
    alert(err.message);
  }
}

async function seedFirebaseBlackline() {
  if (!(await validateAdminBeforeSeed())) return;
  if (!confirm('Cadastrar dados iniciais no Firestore? Esta acao nao roda automaticamente.')) return;

  const servicos = [
    {
      id: 'corte-masculino',
      nome: 'Corte Masculino',
      descricao: 'Corte masculino com consultoria de estilo e acabamento na navalha.',
      preco: 45,
      duracao: 45,
      categoria: 'Cabelo',
      ativo: true,
      ordem: 1
    },
    {
      id: 'barba-premium',
      nome: 'Barba Premium',
      descricao: 'Barba modelada com toalha quente, produtos premium e acabamento preciso.',
      preco: 40,
      duracao: 35,
      categoria: 'Barba',
      ativo: true,
      ordem: 2
    },
    {
      id: 'corte-barba',
      nome: 'Corte + Barba',
      descricao: 'Combo completo com corte, barba e finalizacao BLACKLINE.',
      preco: 75,
      duracao: 70,
      categoria: 'Combo',
      ativo: true,
      ordem: 3
    },
    {
      id: 'sobrancelha',
      nome: 'Sobrancelha',
      descricao: 'Design e limpeza de sobrancelha com acabamento natural.',
      preco: 20,
      duracao: 20,
      categoria: 'Acabamento',
      ativo: true,
      ordem: 4
    },
    {
      id: 'pigmentacao',
      nome: 'Pigmentacao',
      descricao: 'Pigmentacao capilar ou de barba para realce e preenchimento.',
      preco: 60,
      duracao: 45,
      categoria: 'Tratamento',
      ativo: true,
      ordem: 5
    }
  ];

  const profissionais = [
    {
      id: 'bruno-santos',
      nome: 'Bruno Santos',
      especialidade: 'Fades e cortes modernos',
      foto: 'https://images.unsplash.com/photo-1589992896844-9b720813d1cb?q=80&w=800&auto=format&fit=crop',
      ativo: true,
      horariosAtendimento: defaultHorarios()
    },
    {
      id: 'diego-lima',
      nome: 'Diego Lima',
      especialidade: 'Barba premium e navalha',
      foto: 'https://images.unsplash.com/photo-1595959183082-7b570b7e08e2?q=80&w=800&auto=format&fit=crop',
      ativo: true,
      horariosAtendimento: defaultHorarios()
    },
    {
      id: 'rafael-costa',
      nome: 'Rafael Costa',
      especialidade: 'Cortes classicos e pigmentacao',
      foto: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?q=80&w=800&auto=format&fit=crop',
      ativo: true,
      horariosAtendimento: defaultHorarios()
    }
  ];

  const galeria = [
    {
      id: 'fade-clean',
      titulo: 'Fade limpo',
      imagemUrl: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?q=80&w=900&auto=format&fit=crop',
      categoria: 'Cabelo',
      ativo: true
    },
    {
      id: 'barba-premium',
      titulo: 'Barba alinhada',
      imagemUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=900&auto=format&fit=crop',
      categoria: 'Barba',
      ativo: true
    }
  ];

  const planos = [
    {
      id: 'essencial',
      nome: 'Essencial',
      preco: 89,
      beneficios: ['2 cortes por mes', 'Acabamento incluso', 'Agendamento preferencial'],
      ativo: true
    },
    {
      id: 'premium',
      nome: 'Premium',
      preco: 139,
      beneficios: ['3 cortes por mes', '1 barba completa', 'Toalha quente', 'Prioridade no WhatsApp'],
      ativo: true
    }
  ];

  const config = {
    nome: 'BLACKLINE Barber',
    telefone: '5581999999999',
    whatsapp: '5581999999999',
    instagram: 'https://www.instagram.com/blacklinebarber',
    endereco: 'Av. Boa Viagem, Recife - PE',
    googleMapsUrl: 'https://www.google.com/maps?q=Av.%20Boa%20Viagem%2C%20Recife%20-%20PE&output=embed',
    googleReviewUrl: 'https://www.google.com/search?q=BLACKLINE+Barber+Recife+avaliacoes',
    horarioFuncionamento: 'Segunda a Sabado - 08h as 18h'
  };

  try {
    await Promise.all([
      ...servicos.map(item => salvarDocumentoFirestore(SERVICOS_COLLECTION, item.id, item)),
      ...profissionais.map(item => salvarDocumentoFirestore(PROFISSIONAIS_COLLECTION, item.id, item)),
      ...galeria.map(item => salvarDocumentoFirestore(GALERIA_COLLECTION, item.id, item)),
      ...planos.map(item => salvarDocumentoFirestore(PLANOS_COLLECTION, item.id, item)),
      salvarConfigFirestore(config)
    ]);
    alert('Seed inicial criada no Firestore.');
    await carregarTudo();
  } catch (err) {
    const diagnostics = await getAdminAuthDiagnostics();
    console.error('Erro ao executar seed do Firestore:', {
      errorCode: err?.code || null,
      errorMessage: err?.message || String(err),
      uidUsuarioLogado: diagnostics.uidUsuarioLogado,
      stateUserExiste: diagnostics.stateUserExiste,
      stateUserUid: diagnostics.stateUserUid,
      authCurrentUserExiste: diagnostics.authCurrentUserExiste,
      authCurrentUserUid: diagnostics.authCurrentUserUid,
      adminUidEsperado: diagnostics.adminUidEsperado,
      uidIgualAoAdminUid: diagnostics.uidIgualAoAdminUid,
      authError: diagnostics.authError,
      erroOriginal: err
    });
    alert('Nao foi possivel executar o seed. Veja o console.');
  }
}

async function seedAgendamentosTesteBlackline() {
  if (!confirm('Criar 10 agendamentos simulados no Firestore? Use apenas em homologacao.')) return;
  requireAdminSession();

  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + 1);
  while (baseDate.getDay() === 0) baseDate.setDate(baseDate.getDate() + 1);

  const profissionais = state.profissionais.length ? state.profissionais : [
    { id: 'bruno-santos', nome: 'Bruno Santos' },
    { id: 'diego-lima', nome: 'Diego Lima' },
    { id: 'rafael-costa', nome: 'Rafael Costa' }
  ];
  const servicos = state.servicos.length ? state.servicos : [
    { id: 'corte-masculino', nome: 'Corte Masculino' },
    { id: 'barba-premium', nome: 'Barba Premium' },
    { id: 'corte-barba', nome: 'Corte + Barba' }
  ];
  const horarios = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00'];
  const nomes = ['Andre Silva', 'Carlos Souza', 'Marcos Lima', 'Joao Pereira', 'Felipe Rocha', 'Lucas Mendes', 'Rafael Alves', 'Bruno Costa', 'Diego Ramos', 'Paulo Santos'];

  try {
    const payloads = nomes.map((nome, index) => {
      const dataObj = new Date(baseDate);
      dataObj.setDate(baseDate.getDate() + Math.floor(index / 3));
      if (dataObj.getDay() === 0) dataObj.setDate(dataObj.getDate() + 1);
      const data = dataObj.toISOString().slice(0, 10);
      const profissional = profissionais[index % profissionais.length];
      const servico = servicos[index % servicos.length];
      const horario = horarios[index];
      const id = getSlotId(data, horario, profissional.id);
      return {
        id,
        nome,
        telefone: `8199${String(9000000 + index).padStart(7, '0')}`,
        servicoId: servico.id,
        servico: servico.nome,
        profissionalId: profissional.id,
        profissionalNome: profissional.nome,
        data,
        horario,
        observacoes: 'Agendamento simulado para homologacao.',
        status: index % 4 === 0 ? 'confirmado' : 'pendente',
        codigo: makeCode('T')
      };
    });

    await Promise.all(payloads.map(({ id, ...payload }) => salvarDocumentoFirestore(AGENDAMENTOS_COLLECTION, id, payload)));
    alert('10 agendamentos simulados foram criados.');
    await carregarTudo();
  } catch (err) {
    console.error('Erro ao criar agendamentos simulados:', err);
    alert('Nao foi possivel criar os agendamentos simulados. Veja o console.');
  }
}

async function testarDuplicidadeAgendamentoBlackline() {
  requireAdminSession();

  const db = await getBlacklineDb();
  const { doc, runTransaction, serverTimestamp } = await getFirestoreApi();
  const profissional = state.profissionais.find(p => p.ativo !== false) || { id: 'bruno-santos', nome: 'Bruno Santos' };
  const servico = state.servicos.find(s => s.ativo !== false) || { id: 'corte-masculino', nome: 'Corte Masculino' };
  const dataObj = new Date();
  dataObj.setDate(dataObj.getDate() + 2);
  while (dataObj.getDay() === 0) dataObj.setDate(dataObj.getDate() + 1);
  const data = dataObj.toISOString().slice(0, 10);
  const horario = '16:00';
  const id = getSlotId(data, horario, profissional.id);
  const ref = doc(db, AGENDAMENTOS_COLLECTION, id);

  async function reservar(nome) {
    return runTransaction(db, async transaction => {
      const current = await transaction.get(ref);
      if (current.exists() && current.data().status !== 'cancelado') {
        throw new Error('Duplicidade bloqueada: horario ja reservado.');
      }
      transaction.set(ref, {
        nome,
        telefone: '81999999999',
        servicoId: servico.id,
        servico: servico.nome,
        profissionalId: profissional.id,
        profissionalNome: profissional.nome,
        data,
        horario,
        observacoes: 'Teste de duplicidade por transacao.',
        status: 'pendente',
        codigo: makeCode('D'),
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
      });
    });
  }

  await reservar('Teste Duplicidade Um');
  try {
    await reservar('Teste Duplicidade Dois');
    alert('Falha no teste: a duplicidade nao foi bloqueada.');
    return false;
  } catch (err) {
    alert(err.message);
    await carregarTudo();
    return true;
  }
}

document.addEventListener('DOMContentLoaded', init);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') fecharDetalheBtn();
});

window.tentarLogin = tentarLogin;
window.sair = sair;
window.carregarTudo = carregarTudo;
window.carregarAgendamentos = carregarAgendamentos;
window.trocarView = trocarView;
window.aplicarFiltros = aplicarFiltros;
window.limparFiltros = limparFiltros;
window.abrirDetalhe = abrirDetalhe;
window.fecharDetalhe = fecharDetalhe;
window.fecharDetalheBtn = fecharDetalheBtn;
window.atualizarStatus = atualizarStatus;
window.marcarLembrete = marcarLembrete;
window.deletar = deletar;
window.salvarServico = salvarServico;
window.editarServico = editarServico;
window.resetServicoForm = resetServicoForm;
window.salvarProfissional = salvarProfissional;
window.editarProf = editarProf;
window.resetProfForm = resetProfForm;
window.salvarGaleria = salvarGaleria;
window.editarGal = editarGal;
window.resetGalForm = resetGalForm;
window.removerRegistro = removerRegistro;
window.salvarConfig = salvarConfig;
window.seedFirebaseBlackline = seedFirebaseBlackline;
window.seedAgendamentosTesteBlackline = seedAgendamentosTesteBlackline;
window.testarDuplicidadeAgendamentoBlackline = testarDuplicidadeAgendamentoBlackline;
