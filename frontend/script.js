import { getBlacklineDb } from './firebase-config.js';

const PUBLIC_CONFIG = {
  whatsapp: '5581999999999',
  instagram: 'https://www.instagram.com/blacklinebarber',
  facebook: 'https://www.facebook.com/blacklinebarber',
  tiktok: 'https://www.tiktok.com/@blacklinebarber',
  endereco: 'Av. Boa Viagem, Recife - PE',
  horarioTexto: 'Segunda a Sabado - 08h as 18h',
  mapaEmbed: 'https://www.google.com/maps?q=Av.%20Boa%20Viagem%2C%20Recife%20-%20PE&output=embed',
  googleReviewsUrl: 'https://www.google.com/search?q=BLACKLINE+Barber+Recife+avaliacoes',
  googleRating: 'Configure a nota'
};

const state = {
  servicos: [],
  profissionais: [],
  galeria: [],
  planos: [],
  config: {},
  apiOffline: false,
  servicosStatus: 'loading',
  servicosError: '',
  servicoSelecionado: '',
  profissionalSelecionado: '',
  horarioSelecionado: null,
  manageAgendamento: null,
  manageHorario: null,
  cal: { ano: null, mes: null, dataISO: null }
};

const FALLBACK_DATA = {
  servicos: [
    {
      id: 'corte-premium',
      nome: 'Corte Premium',
      descricao: 'Cortes modernos, fade, social e acabamento preciso.',
      preco: 45,
      duracao: 45,
      categoria: 'Cabelo',
      ativo: true,
      icone: 'tesoura',
      opcoes: ['Degrade', 'Low Fade', 'Mid Fade', 'High Fade', 'Buzz Cut', 'Social Classico']
    },
    {
      id: 'barba-completa',
      nome: 'Barba Completa',
      descricao: 'Design de barba, toalha quente e acabamento navalhado.',
      preco: 35,
      duracao: 35,
      categoria: 'Barba',
      ativo: true,
      icone: 'barba',
      opcoes: ['Barba Desenhada', 'Toalha Quente', 'Hidratacao']
    },
    {
      id: 'combo-executivo',
      nome: 'Combo Executivo',
      descricao: 'Corte, barba e experiencia VIP em uma sessao completa.',
      preco: 75,
      duracao: 70,
      categoria: 'Combo',
      ativo: true,
      icone: 'combo',
      opcoes: ['Low Fade + Barba', 'Degrade + Barba', 'Acabamento Navalhado', 'Bebida Premium']
    }
  ],
  profissionais: [
    {
      id: 'bruno-santos',
      nome: 'Bruno Santos',
      especialidade: 'Fades e cortes modernos',
      ativo: true
    },
    {
      id: 'diego-lima',
      nome: 'Diego Lima',
      especialidade: 'Barba premium e navalha',
      ativo: true
    }
  ],
  galeria: [
    {
      id: 'fade-clean',
      titulo: 'Fade limpo',
      url: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?q=80&w=900&auto=format&fit=crop',
      ativo: true
    },
    {
      id: 'barba-premium',
      titulo: 'Barba alinhada',
      url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=900&auto=format&fit=crop',
      ativo: true
    },
    {
      id: 'corte-classico',
      titulo: 'Classico moderno',
      url: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?q=80&w=900&auto=format&fit=crop',
      ativo: true
    }
  ],
  planos: [
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
    },
    {
      id: 'executivo',
      nome: 'Executivo',
      preco: 199,
      beneficios: ['Cortes ilimitados com regra mensal', '2 barbas completas', 'Experiencia VIP', 'Horario prioritario'],
      ativo: true
    }
  ]
};

const MESES = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS_SEMANA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
const AGENDAMENTOS_COLLECTION = 'agendamentos';
const SERVICOS_COLLECTION = 'servicos';
const PROFISSIONAIS_COLLECTION = 'profissionais';
const PLANOS_COLLECTION = 'planos';
const GALERIA_COLLECTION = 'galeria';
const CONFIG_COLLECTION = 'configuracoes';
const FIRESTORE_MODULE_URL = 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
let firestoreApi;

function isLocalDebugEnv() {
  return ['localhost', '127.0.0.1', ''].includes(window.location.hostname);
}

const DEFAULT_SCHEDULE = {
  1: { ativo: true, inicio: '08:00', fim: '18:00', intervalo: 30 },
  2: { ativo: true, inicio: '08:00', fim: '18:00', intervalo: 30 },
  3: { ativo: true, inicio: '08:00', fim: '18:00', intervalo: 30 },
  4: { ativo: true, inicio: '08:00', fim: '18:00', intervalo: 30 },
  5: { ativo: true, inicio: '08:00', fim: '18:00', intervalo: 30 },
  6: { ativo: true, inicio: '08:00', fim: '12:00', intervalo: 30 },
  0: { ativo: false, inicio: '08:00', fim: '12:00', intervalo: 30 }
};

async function getFirestoreApi() {
  if (!firestoreApi) firestoreApi = await import(FIRESTORE_MODULE_URL);
  return firestoreApi;
}

function logDevError(message, error) {
  if (isLocalDebugEnv()) console.error(message, error);
}

function firestoreUserMessage(error, fallback = 'Nao foi possivel carregar os dados agora.') {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();

  if (code.includes('permission-denied') || message.includes('permission-denied')) {
    return 'Erro de permissao ao acessar os dados. Avise a barbearia para revisar as regras do Firebase.';
  }

  if (code.includes('unavailable') || message.includes('unavailable') || message.includes('network')) {
    return 'Erro de conexao com o Firebase. Verifique sua internet e tente novamente.';
  }

  return fallback;
}

function publicBlockedMessage(error, fallback) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  if (code.includes('permission-denied') || message.includes('permission-denied')) return fallback;
  return error?.message || fallback;
}

function normalizeCollectionRows(rows) {
  return Array.isArray(rows) ? rows.filter(Boolean) : [];
}

function sortByOrderAndName(rows) {
  return normalizeCollectionRows(rows).sort((a, b) => {
    const ordemA = Number.isFinite(Number(a.ordem)) ? Number(a.ordem) : 9999;
    const ordemB = Number.isFinite(Number(b.ordem)) ? Number(b.ordem) : 9999;
    if (ordemA !== ordemB) return ordemA - ordemB;
    return String(a.nome || a.titulo || '').localeCompare(String(b.nome || b.titulo || ''), 'pt-BR');
  });
}

async function safeLoadCollection(collectionName, fallback = []) {
  try {
    return { ok: true, data: await listarColecaoFirestore(collectionName), error: null };
  } catch (error) {
    logDevError(`Erro ao carregar colecao ${collectionName} no Firestore:`, error);
    return { ok: false, data: fallback, error };
  }
}

function getSlotId(data, horario, profissionalId) {
  return `${data}_${String(horario || '').replace(':', '-')}_${profissionalId}`;
}

function docToAgendamento(snapshot) {
  return { id: snapshot.id, ...snapshot.data() };
}

function docToData(snapshot) {
  return { id: snapshot.id, ...snapshot.data() };
}

function normalizeStatus(status) {
  return status || 'pendente';
}

function timeToMinutes(value) {
  const [h, m] = String(value || '').split(':').map(Number);
  return (h * 60) + (m || 0);
}

function minutesToTime(value) {
  const h = Math.floor(value / 60);
  const m = value % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function slotsForDate(data, profissionalId = '') {
  const date = new Date(`${data}T12:00:00`);
  if (Number.isNaN(date.getTime())) return [];

  const profissional = state.profissionais.find(p => p.id === profissionalId) || state.profissionais.find(p => p.ativo !== false);
  const schedule = profissional?.horariosAtendimento || profissional?.horarios || DEFAULT_SCHEDULE;
  const cfg = schedule[date.getDay()] || DEFAULT_SCHEDULE[date.getDay()];
  if (!cfg || cfg.ativo === false) return [];

  const inicio = timeToMinutes(cfg.inicio || '08:00');
  const fim = timeToMinutes(cfg.fim || '18:00');
  const intervalo = Number(cfg.intervalo || 30);
  const slots = [];
  for (let current = inicio; current < fim; current += intervalo) {
    slots.push(minutesToTime(current));
  }
  return slots;
}

async function buscarAgendamentosPorData(data) {
  const db = await getBlacklineDb();
  const { collection, getDocs, query, where } = await getFirestoreApi();
  try {
    const snap = await getDocs(query(collection(db, AGENDAMENTOS_COLLECTION), where('data', '==', data)));
    return snap.docs.map(docToAgendamento);
  } catch (error) {
    const code = String(error?.code || '').toLowerCase();
    if (code.includes('permission-denied')) return [];
    throw error;
  }
}

async function listarColecaoFirestore(collectionName) {
  const db = await getBlacklineDb();
  const { collection, getDocs } = await getFirestoreApi();
  const snap = await getDocs(collection(db, collectionName));
  return snap.docs.map(docToData);
}

async function carregarConfigFirestore() {
  const db = await getBlacklineDb();
  const { doc, getDoc } = await getFirestoreApi();
  const snap = await getDoc(doc(db, CONFIG_COLLECTION, 'barbearia'));
  return snap.exists() ? { id: snap.id, ...snap.data() } : {};
}

async function criarAgendamentoFirestore(payload) {
  const db = await getBlacklineDb();
  const { doc, serverTimestamp, setDoc } = await getFirestoreApi();
  const slotId = getSlotId(payload.data, payload.horario, payload.profissionalId);
  const ref = doc(db, AGENDAMENTOS_COLLECTION, slotId);
  const codigo = `BL${Date.now().toString(36).slice(-6).toUpperCase()}`;
  const agendamento = {
    ...payload,
    id: slotId,
    codigo,
    status: 'pendente',
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp()
  };

  await setDoc(ref, agendamento);
  return agendamento;
}

async function consultarAgendamentoFirestore(telefone, codigo) {
  const db = await getBlacklineDb();
  const { collection, getDocs, limit, query, where } = await getFirestoreApi();
  const telefoneDigits = onlyDigits(telefone);
  const codigoBusca = String(codigo || '').trim().toUpperCase();
  const snap = await getDocs(query(
    collection(db, AGENDAMENTOS_COLLECTION),
    where('telefone', '==', telefoneDigits),
    where('codigo', '==', codigoBusca),
    limit(1)
  ));
  const agendamento = snap.docs.map(docToAgendamento)[0];

  if (!agendamento) throw new Error('Agendamento nao encontrado.');
  return agendamento;
}

async function cancelarAgendamentoFirestore(id) {
  const db = await getBlacklineDb();
  const { doc, getDoc, serverTimestamp, updateDoc } = await getFirestoreApi();
  const ref = doc(db, AGENDAMENTOS_COLLECTION, String(id));
  await updateDoc(ref, { status: 'cancelado', atualizadoEm: serverTimestamp() });
  const snap = await getDoc(ref);
  return docToAgendamento(snap);
}

async function reagendarAgendamentoFirestore(agendamento, data, horario, profissionalId) {
  const db = await getBlacklineDb();
  const { doc, getDoc, runTransaction, serverTimestamp } = await getFirestoreApi();
  const novoSlotId = getSlotId(data, horario, profissionalId);
  const antigoRef = doc(db, AGENDAMENTOS_COLLECTION, String(agendamento.id));
  const novoRef = doc(db, AGENDAMENTOS_COLLECTION, novoSlotId);
  const profissionalNome = state.profissionais.find(p => p.id === profissionalId)?.nome || agendamento.profissionalNome || '';

  await runTransaction(db, async transaction => {
    const atual = await transaction.get(antigoRef);
    if (!atual.exists()) throw new Error('Agendamento nao encontrado.');

    if (novoSlotId !== String(agendamento.id)) {
      const reservado = await transaction.get(novoRef);
      if (reservado.exists() && normalizeStatus(reservado.data().status) !== 'cancelado') {
        const error = new Error('Este horario acabou de ser reservado. Escolha outro horario.');
        error.code = 'slot-taken';
        throw error;
      }
    }

    const atualizado = {
      ...atual.data(),
      id: novoSlotId,
      data,
      horario,
      profissionalId,
      profissionalNome,
      status: 'pendente',
      atualizadoEm: serverTimestamp()
    };

    transaction.set(novoRef, atualizado);
    if (novoSlotId !== String(agendamento.id)) {
      transaction.update(antigoRef, {
        status: 'cancelado',
        atualizadoEm: serverTimestamp()
      });
    }
  });

  const snap = await getDoc(novoRef);
  return docToAgendamento(snap);
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

function formatPhone(value) {
  const tel = onlyDigits(value);
  if (tel.length === 13 && tel.startsWith('55')) {
    const local = tel.slice(2);
    return `+55 (${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (tel.length === 12 && tel.startsWith('55')) {
    const local = tel.slice(2);
    return `+55 (${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
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
  const digits = onlyDigits(phone);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function getShopPhone() {
  return onlyDigits(state.config.whatsapp || PUBLIC_CONFIG.whatsapp);
}

function initReveal() {
  const run = () => {
    document.querySelectorAll('.reveal').forEach(r => {
      if (r.getBoundingClientRect().top < window.innerHeight - 100) r.classList.add('active');
    });
    const header = document.querySelector('header');
    if (header) header.style.background = window.scrollY > 30 ? 'rgba(5,5,5,.92)' : 'rgba(5,5,5,.55)';
  };
  window.addEventListener('scroll', run);
  run();
}

function renderServicos() {
  const grid = document.getElementById('services-grid');
  const dropdown = document.getElementById('select-dropdown');
  if (!grid || !dropdown) return;

  if (state.servicosStatus === 'error') {
    const phone = getShopPhone();
    const msg = 'Ola! Quero agendar na BLACKLINE, mas o site nao carregou os servicos agora.';
    grid.innerHTML = `
      <div class="section-loading error service-offline">
        <p>${escapeHtml(state.servicosError || 'Nao foi possivel carregar os servicos agora.')}</p>
        <a class="agendar-servico-btn" href="${whatsappLink(phone, msg)}" target="_blank" rel="noopener">Chamar no WhatsApp</a>
      </div>
    `;
    dropdown.innerHTML = '<div class="select-empty">Servicos indisponiveis no momento.</div>';
    initReveal();
    return;
  }

  if (!state.servicos.length) {
    grid.innerHTML = `
      <div class="section-loading">
        <p>Nenhum servico ativo cadastrado ainda. A barbearia precisa cadastrar os servicos no painel ADM.</p>
      </div>
    `;
    dropdown.innerHTML = '<div class="select-empty">Nenhum servico ativo cadastrado.</div>';
    initReveal();
    return;
  }

  grid.innerHTML = state.servicos.map(servico => `
    <div class="service-card reveal">
      <div class="service-header">
        <div class="service-icon">${serviceIcon(servico)}</div>
        <div>
          <h3>${escapeHtml(servico.nome)}</h3>
          <span class="service-sub">${escapeHtml(servico.descricao)}</span>
        </div>
      </div>
      <button class="service-btn" type="button">Ver opcoes</button>
      <div class="service-content">
        <div class="price-box">
          <span>${escapeHtml(servico.categoria || 'Servico')}</span>
          <h4>${money(servico.preco)}</h4>
          <small>${Number(servico.duracao || 30)} min estimados</small>
        </div>
        <div class="cuts-list">
          ${(servico.opcoes || []).map(op => `<div class="cut-item"><strong>${escapeHtml(op)}</strong><span>${escapeHtml(servico.descricao)}</span></div>`).join('')}
        </div>
        <button class="agendar-servico-btn" onclick="abrirModal('${escapeHtml(servico.id)}')">Agendar este servico</button>
      </div>
    </div>
  `).join('');

  dropdown.innerHTML = `
    <div class="select-option" data-value="" onclick="escolherServico(this)">
      <span class="select-opt-icon">--</span>
      <div><div class="select-opt-nome">Selecione...</div></div>
    </div>
    ${state.servicos.map(servico => `
      <div class="select-option" data-value="${escapeHtml(servico.id)}" onclick="escolherServico(this)">
        <span class="select-opt-icon">${serviceIcon(servico)}</span>
        <div>
          <div class="select-opt-nome">${escapeHtml(servico.nome)}</div>
          <div class="select-opt-desc">${escapeHtml(servico.descricao)}</div>
        </div>
        <span class="select-opt-preco">${money(servico.preco)}</span>
      </div>
    `).join('')}
  `;

  document.querySelectorAll('.service-card').forEach(card => {
    const btn = card.querySelector('.service-btn');
    btn.addEventListener('click', () => {
      card.classList.toggle('active');
      btn.textContent = card.classList.contains('active') ? 'Fechar opcoes' : 'Ver opcoes';
    });
  });

  initReveal();
}

function serviceIcon(servico) {
  const icon = String(servico.icone || '').toLowerCase();
  if (icon.includes('barba')) return 'BR';
  if (icon.includes('combo')) return 'VIP';
  return 'SC';
}

function renderProfissionais() {
  const ativos = state.profissionais.filter(p => p.ativo !== false);
  const options = ['<option value="">Selecione um profissional...</option>']
    .concat(ativos.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.nome)} - ${escapeHtml(p.especialidade)}</option>`))
    .join('');
  ['inp-profissional', 'manage-profissional'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = options;
    if (ativos.length === 1) el.value = ativos[0].id;
  });
}

function renderGaleria() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;
  grid.innerHTML = state.galeria.map(item => `
    <article class="gallery-card reveal">
      <img src="${escapeHtml(item.imagemUrl || item.url)}" alt="${escapeHtml(item.titulo)}">
      <div>${escapeHtml(item.titulo)}</div>
    </article>
  `).join('');
  initReveal();
}

function normalizeConfig(config = {}) {
  return {
    ...config,
    mapaEmbed: config.mapaEmbed || config.googleMapsUrl || '',
    googleReviewsUrl: config.googleReviewsUrl || config.googleReviewUrl || '',
    horarioTexto: config.horarioTexto || config.horarioFuncionamento || ''
  };
}

function renderPlanos() {
  const grid = document.getElementById('plans-grid');
  if (!grid) return;
  const planos = (state.planos.length ? state.planos : (state.config.planos || [])).filter(plano => plano.ativo !== false);
  grid.innerHTML = planos.map(plano => {
    const msg = `Ola! Quero saber mais sobre o plano ${plano.nome} do Clube do Corte da BLACKLINE.`;
    return `
      <article class="plan-card reveal">
        <span>Plano mensal</span>
        <h3>${escapeHtml(plano.nome)}</h3>
        <div class="plan-price">${money(plano.preco)}<small>/mes</small></div>
        <ul>${(plano.beneficios || []).map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
        <a class="agendar-servico-btn" href="${whatsappLink(getShopPhone(), msg)}" target="_blank" rel="noopener">Chamar no WhatsApp</a>
      </article>
    `;
  }).join('');
  initReveal();
}

function renderConfig() {
  const cfg = { ...PUBLIC_CONFIG, ...state.config };
  const phone = getShopPhone();
  setText('site-address', cfg.endereco);
  setText('site-hours', cfg.horarioTexto);
  setText('site-phone', formatPhone(phone));
  setHref('float-whats', `https://wa.me/${phone}`);
  setHref('social-instagram', cfg.instagram);
  setHref('social-facebook', cfg.facebook);
  setHref('social-tiktok', cfg.tiktok);
  setHref('google-review-link', cfg.googleReviewsUrl);
  setText('google-rating-text', cfg.googleRating ? `Nota Google: ${cfg.googleRating}` : 'Avaliacoes reais configuraveis pela barbearia.');
  const map = document.getElementById('site-map');
  if (map && cfg.mapaEmbed) map.src = cfg.mapaEmbed;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setHref(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  if (value) {
    el.href = value;
    el.removeAttribute('aria-disabled');
    el.style.display = '';
  } else {
    el.removeAttribute('href');
    el.setAttribute('aria-disabled', 'true');
    el.style.display = 'none';
  }
}

async function loadPublicData() {
  const [servicosResult, profissionaisResult, planosResult, galeriaResult, configResult] = await Promise.all([
    safeLoadCollection(SERVICOS_COLLECTION),
    safeLoadCollection(PROFISSIONAIS_COLLECTION, FALLBACK_DATA.profissionais),
    safeLoadCollection(PLANOS_COLLECTION, FALLBACK_DATA.planos),
    safeLoadCollection(GALERIA_COLLECTION, FALLBACK_DATA.galeria),
    carregarConfigFirestore()
      .then(data => ({ ok: true, data, error: null }))
      .catch(error => {
        logDevError('Erro ao carregar configuracoes no Firestore:', error);
        return { ok: false, data: {}, error };
      })
  ]);

  const servicosAtivos = sortByOrderAndName(servicosResult.data).filter(s => s.ativo !== false);
  const profissionaisAtivos = sortByOrderAndName(profissionaisResult.data).filter(p => p.ativo !== false);
  const planosAtivos = sortByOrderAndName(planosResult.data).filter(p => p.ativo !== false);
  const galeriaAtiva = sortByOrderAndName(galeriaResult.data).filter(g => g.ativo !== false);

  state.servicosStatus = servicosResult.ok ? 'ready' : 'error';
  state.servicosError = servicosResult.ok
    ? ''
    : firestoreUserMessage(servicosResult.error, 'Nao foi possivel carregar os servicos agora.');
  state.servicos = servicosResult.ok ? servicosAtivos : [];
  state.profissionais = profissionaisResult.ok && profissionaisAtivos.length ? profissionaisAtivos : FALLBACK_DATA.profissionais;
  state.planos = planosResult.ok && planosAtivos.length ? planosAtivos : FALLBACK_DATA.planos;
  state.galeria = galeriaResult.ok && galeriaAtiva.length ? galeriaAtiva : FALLBACK_DATA.galeria;
  state.config = normalizeConfig(configResult.data || {});
  state.apiOffline = !servicosResult.ok || !profissionaisResult.ok || !planosResult.ok || !galeriaResult.ok || !configResult.ok;

  renderConfig();
  renderServicos();
  renderProfissionais();
  renderGaleria();
  renderPlanos();
}

function toggleSelect() {
  const wrap = document.getElementById('select-servico-wrap');
  const dropdown = document.getElementById('select-dropdown');
  const isOpen = wrap.classList.contains('open');
  wrap.classList.toggle('open', !isOpen);
  dropdown.style.display = isOpen ? 'none' : 'block';
}

function escolherServico(el) {
  const valor = el.dataset.value;
  const servico = state.servicos.find(s => s.id === valor);
  state.servicoSelecionado = valor;
  document.getElementById('inp-servico').value = valor;
  const label = document.getElementById('select-label');
  if (servico) {
    label.innerHTML = `<span class="sel-chosen-icon">${serviceIcon(servico)}</span><span class="sel-chosen-nome">${escapeHtml(servico.nome)}</span><span class="sel-chosen-preco">${money(servico.preco)}</span>`;
  } else {
    label.textContent = 'Selecione um servico...';
  }
  document.querySelectorAll('.select-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  limparErro('select-servico-wrap');
  document.getElementById('select-servico-wrap').classList.remove('open');
  document.getElementById('select-dropdown').style.display = 'none';
}

document.addEventListener('click', (e) => {
  const wrap = document.getElementById('select-servico-wrap');
  if (wrap && !wrap.contains(e.target)) {
    wrap.classList.remove('open');
    const dd = document.getElementById('select-dropdown');
    if (dd) dd.style.display = 'none';
  }
});

function preSelectServico(id) {
  if (!id) return;
  const opt = document.querySelector(`.select-option[data-value="${CSS.escape(id)}"]`);
  if (opt) escolherServico(opt);
}

function marcarErro(id, mensagem) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('campo-erro');
  let span = el.parentElement.querySelector('.field-error');
  if (!span) {
    span = document.createElement('span');
    span.className = 'field-error';
    el.parentElement.appendChild(span);
  }
  span.textContent = mensagem;
}

function limparErro(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('campo-erro');
  const span = el.parentElement ? el.parentElement.querySelector('.field-error') : null;
  if (span) span.textContent = '';
}

function limparTodosErros() {
  document.querySelectorAll('.campo-erro').forEach(el => el.classList.remove('campo-erro'));
  document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
  setText('form-error', '');
}

function validarTelefone(tel) {
  const digits = tel.replace(/\D/g, '');
  return digits.length === 11;
}

function validarNome(nome) {
  const partes = nome.trim().split(/\s+/);
  return partes.length >= 2 && nome.trim().length >= 5;
}

function initCalendario() {
  const hoje = new Date();
  state.cal.ano = hoje.getFullYear();
  state.cal.mes = hoje.getMonth();
  state.cal.dataISO = null;
  renderCalendario();
}

function isDiaDisponivel(date) {
  if (date.getDay() === 0) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return date >= hoje;
}

function renderCalendario() {
  const el = document.getElementById('mini-calendario');
  if (!el) return;
  const { ano, mes } = state.cal;
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  const hoje = new Date();
  const podePrev = ano > hoje.getFullYear() || (ano === hoje.getFullYear() && mes > hoje.getMonth());

  let html = `
    <div class="cal-header">
      <button type="button" class="cal-nav ${!podePrev ? 'cal-nav-disabled' : ''}" data-cal-prev ${!podePrev ? 'disabled' : ''}>&#8249;</button>
      <span class="cal-titulo">${MESES[mes]} ${ano}</span>
      <button type="button" class="cal-nav" data-cal-next>&#8250;</button>
    </div>
    <div class="cal-grid">
  `;
  DIAS_SEMANA_CURTO.forEach(d => { html += `<div class="cal-dia-semana">${d}</div>`; });
  for (let i = 0; i < primeiroDia; i++) html += '<div class="cal-cell cal-vazio"></div>';
  for (let dia = 1; dia <= ultimoDia; dia++) {
    const date = new Date(ano, mes, dia);
    const disp = isDiaDisponivel(date);
    const iso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const sel = state.cal.dataISO === iso;
    let cls = 'cal-cell';
    if (!disp) cls += ' cal-indisponivel';
    else if (date.getDay() === 6) cls += ' cal-sabado';
    if (sel) cls += ' cal-selecionado';
    const attrs = disp
      ? `data-cal-day data-iso="${iso}" data-dia="${dia}" data-ano="${ano}" data-mes="${mes}"`
      : 'disabled aria-disabled="true"';
    html += `<button type="button" class="${cls}" ${attrs}>${dia}</button>`;
  }
  html += `</div>
    <div class="cal-legenda">
      <span class="cal-leg-item"><span class="cal-leg-dot cal-leg-livre"></span>Seg-Sex</span>
      <span class="cal-leg-item"><span class="cal-leg-dot cal-leg-sabado"></span>Sabado</span>
      <span class="cal-leg-item"><span class="cal-leg-dot cal-leg-bloqueado"></span>Indisponivel</span>
    </div>`;
  el.innerHTML = html;
  ativarEventosCalendario(el);
}

function ativarEventosCalendario(el) {
  el.querySelector('[data-cal-prev]')?.addEventListener('click', () => mudarMes(-1));
  el.querySelector('[data-cal-next]')?.addEventListener('click', () => mudarMes(1));
  el.querySelectorAll('[data-cal-day]').forEach(btn => {
    btn.addEventListener('click', () => {
      selecionarDia(
        btn.dataset.iso,
        Number(btn.dataset.dia),
        Number(btn.dataset.ano),
        Number(btn.dataset.mes)
      );
    });
  });
}

function mudarMes(delta) {
  state.cal.mes += delta;
  if (state.cal.mes < 0) { state.cal.mes = 11; state.cal.ano--; }
  if (state.cal.mes > 11) { state.cal.mes = 0; state.cal.ano++; }
  state.cal.dataISO = null;
  state.horarioSelecionado = null;
  setText('data-selecionada-label', 'Selecione uma data no calendario');
  const grid = document.getElementById('horarios-grid');
  if (grid) grid.innerHTML = '<p class="horarios-hint">Selecione uma data primeiro</p>';
  renderCalendario();
}

function selecionarDia(iso, dia, ano, mes) {
  state.cal.dataISO = iso;
  renderCalendario();
  const date = new Date(ano, mes, dia);
  const label = date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  setText('data-selecionada-label', label.charAt(0).toUpperCase() + label.slice(1));
  const cal = document.getElementById('mini-calendario');
  if (cal) {
    cal.classList.remove('campo-erro');
    const errSpan = cal.parentElement?.querySelector('.field-error');
    if (errSpan) errSpan.textContent = '';
  }
  carregarHorarios();
}

function abrirModal(servico = '') {
  document.getElementById('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('step-form').style.display = 'block';
  document.getElementById('step-sucesso').style.display = 'none';
  initCalendario();
  setTimeout(() => document.getElementById('inp-nome')?.focus(), 80);
  if (servico) setTimeout(() => preSelectServico(servico), 0);
}

function fecharModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.body.style.overflow = '';
  resetForm();
}

function fecharModalFora(e) {
  if (e.target.id === 'modalOverlay') fecharModal();
}

function resetForm() {
  ['inp-nome', 'inp-telefone', 'inp-obs'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  limparTodosErros();
  setText('data-selecionada-label', 'Selecione uma data no calendario');
  state.horarioSelecionado = null;
  state.servicoSelecionado = '';
  state.profissionalSelecionado = '';
  const serviceInput = document.getElementById('inp-servico');
  if (serviceInput) serviceInput.value = '';
  const profInput = document.getElementById('inp-profissional');
  if (profInput) profInput.value = '';
  const label = document.getElementById('select-label');
  if (label) label.textContent = 'Selecione um servico...';
  document.querySelectorAll('.select-option').forEach(o => o.classList.remove('selected'));
  document.getElementById('horarios-grid').innerHTML = '<p class="horarios-hint">Selecione uma data primeiro</p>';
  state.cal.dataISO = null;
}

function limparCamposAgendamentoAposSucesso() {
  ['inp-nome', 'inp-telefone', 'inp-obs'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const serviceInput = document.getElementById('inp-servico');
  if (serviceInput) serviceInput.value = '';
  const profInput = document.getElementById('inp-profissional');
  if (profInput) profInput.value = '';
  const label = document.getElementById('select-label');
  if (label) label.textContent = 'Selecione um servico...';
  document.querySelectorAll('.select-option').forEach(o => o.classList.remove('selected'));
  state.horarioSelecionado = null;
  state.servicoSelecionado = '';
  state.profissionalSelecionado = '';
}

async function carregarHorarios(dataSelecionada = state.cal.dataISO) {
  const grid = document.getElementById('horarios-grid');
  const data = dataSelecionada || state.cal.dataISO;
  const profissionalInput = document.getElementById('inp-profissional');
  const profissionalId = profissionalInput?.value || '';
  state.profissionalSelecionado = profissionalId;
  state.horarioSelecionado = null;

  if (!data) {
    grid.innerHTML = '<p class="horarios-hint">Selecione uma data primeiro</p>';
    return;
  }

  if (!profissionalId) {
    grid.innerHTML = '<p class="horarios-hint">Selecione um profissional primeiro</p>';
    return;
  }

  grid.innerHTML = '<p class="horario-loading">Carregando horários...</p>';
  try {
    const agendamentos = await buscarAgendamentosPorData(data);
    const ocupados = new Set(
      agendamentos
        .filter(ag => ag.profissionalId === profissionalId && normalizeStatus(ag.status) !== 'cancelado')
        .map(ag => ag.horario)
        .filter(Boolean)
    );
    const horarios = slotsForDate(data, profissionalId).filter(horario => !ocupados.has(horario));
    renderHorarios(grid, horarios, horario => { state.horarioSelecionado = horario; });
  } catch (err) {
    logDevError('Erro ao carregar horarios no Firestore:', err);
    renderHorariosError(grid, () => carregarHorarios(data));
  }
}

function renderHorarios(grid, horarios, onSelect) {
  if (!horarios.length) {
    grid.innerHTML = '<p class="horarios-hint">Nenhum horario disponivel nesta data.</p>';
    return;
  }
  grid.innerHTML = '';
  horarios.forEach(h => {
    const btn = document.createElement('button');
    btn.className = 'horario-slot';
    btn.textContent = h;
    btn.type = 'button';
    btn.onclick = () => {
      grid.querySelectorAll('.horario-slot').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      onSelect(h);
      grid.classList.remove('campo-erro');
      const errSpan = grid.parentElement?.querySelector('.field-error');
      if (errSpan) errSpan.textContent = '';
    };
    grid.appendChild(btn);
  });
}

function renderHorariosError(grid, onRetry) {
  grid.innerHTML = '';

  const text = document.createElement('p');
  text.className = 'horarios-hint horarios-error';
  text.textContent = 'Nao foi possivel carregar os horarios disponiveis. Tente novamente.';

  const actions = document.createElement('div');
  actions.className = 'horarios-actions';

  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'horario-action-btn';
  retry.textContent = 'Tentar novamente';
  retry.addEventListener('click', onRetry);

  const whatsapp = document.createElement('a');
  whatsapp.className = 'horario-action-btn horario-action-link';
  whatsapp.href = whatsappLink(getShopPhone(), 'Ola! Quero agendar na BLACKLINE, mas nao consegui carregar os horarios pelo site.');
  whatsapp.target = '_blank';
  whatsapp.rel = 'noopener';
  whatsapp.textContent = 'Agendar pelo WhatsApp';

  actions.appendChild(retry);
  actions.appendChild(whatsapp);
  grid.appendChild(text);
  grid.appendChild(actions);
}

function mostrarErro(msg) {
  setText('form-error', `Aviso: ${msg}`);
}

async function enviarAgendamento() {
  const nome = document.getElementById('inp-nome').value.trim();
  const telefone = onlyDigits(document.getElementById('inp-telefone').value);
  const servicoId = document.getElementById('inp-servico').value;
  const servico = state.servicos.find(s => s.id === servicoId)?.nome || servicoId;
  const profissionalId = document.getElementById('inp-profissional').value;
  const profissionalNome = state.profissionais.find(p => p.id === profissionalId)?.nome || '';
  const data = state.cal.dataISO;
  const observacoes = document.getElementById('inp-obs').value.trim();
  limparTodosErros();

  let temErro = false;
  if (!validarNome(nome)) { marcarErro('inp-nome', 'Informe nome e sobrenome.'); temErro = true; }
  if (!validarTelefone(telefone)) { marcarErro('inp-telefone', 'Informe um WhatsApp com 11 digitos, incluindo DDD.'); temErro = true; }
  if (!servicoId) { marcarErro('select-servico-wrap', 'Selecione um servico.'); temErro = true; }
  if (!profissionalId) { marcarErro('inp-profissional', 'Escolha o profissional.'); temErro = true; }
  if (!data) { marcarErro('mini-calendario', 'Selecione uma data.'); temErro = true; }
  if (!state.horarioSelecionado) { marcarErro('horarios-grid', data ? 'Selecione um horario disponivel.' : 'Selecione uma data primeiro.'); temErro = true; }
  if (temErro) return;

  const btn = document.getElementById('btn-agendar');
  const btnText = document.getElementById('btn-text');
  const btnLoader = document.getElementById('btn-loader');
  btn.disabled = true;
  btnText.style.display = 'none';
  btnLoader.style.display = 'inline';

  try {
    const ag = await criarAgendamentoFirestore({
      nome,
      telefone,
      servico,
      servicoId,
      profissionalId,
      profissionalNome,
      data,
      horario: state.horarioSelecionado,
      observacoes
    });
    renderSuccess(ag);
  } catch (err) {
    logDevError('Erro completo ao salvar agendamento no Firestore:', err);
    const code = String(err.code || '').toLowerCase();
    const mensagem = err.code === 'slot-taken'
      || code.includes('permission-denied')
      || String(err.message || '').includes('reservado')
      ? 'Este horario acabou de ser reservado. Escolha outro horario.'
      : firestoreUserMessage(err, 'Nao foi possivel concluir o agendamento agora. Tente novamente.');
    mostrarErro(mensagem);
    if (data) carregarHorarios(data);
  } finally {
    btn.disabled = false;
    btnText.style.display = 'inline';
    btnLoader.style.display = 'none';
  }
}

function renderSuccess(ag) {
  const msg = `Ola, BLACKLINE! Confirmo meu agendamento:\nNome: ${ag.nome}\nServico: ${ag.servico}\nProfissional: ${ag.profissionalNome}\nData: ${formatDate(ag.data)}\nHorario: ${ag.horario}\nEndereco: ${state.config.endereco || ''}\nCodigo: ${ag.codigo}`;
  document.getElementById('sucesso-texto').textContent = 'Guarde seu codigo para cancelar ou reagendar quando precisar.';
  document.getElementById('sucesso-detalhes').innerHTML = `
    <div class="detalhe"><span>Nome</span><span>${escapeHtml(ag.nome)}</span></div>
    <div class="detalhe"><span>Servico</span><span>${escapeHtml(ag.servico)}</span></div>
    <div class="detalhe"><span>Profissional</span><span>${escapeHtml(ag.profissionalNome)}</span></div>
    <div class="detalhe"><span>Data</span><span>${escapeHtml(formatDate(ag.data))}</span></div>
    <div class="detalhe"><span>Horario</span><span>${escapeHtml(ag.horario)}</span></div>
    <div class="detalhe"><span>Codigo</span><span>${escapeHtml(ag.codigo)}</span></div>
    <div class="detalhe"><span>Status</span><span>Pendente</span></div>
  `;
  document.getElementById('sucesso-whatsapp').href = whatsappLink(getShopPhone(), msg);
  document.getElementById('step-form').style.display = 'none';
  document.getElementById('step-sucesso').style.display = 'block';
  limparCamposAgendamentoAposSucesso();
}

function abrirGerenciar() {
  document.getElementById('manageOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function fecharGerenciar() {
  document.getElementById('manageOverlay').classList.remove('open');
  document.body.style.overflow = '';
  state.manageAgendamento = null;
  state.manageHorario = null;
  setText('manage-error', '');
  document.getElementById('manage-result').style.display = 'none';
  document.getElementById('reschedule-box').style.display = 'none';
}

function fecharGerenciarFora(e) {
  if (e.target.id === 'manageOverlay') fecharGerenciar();
}

async function consultarAgendamento() {
  setText('manage-error', '');
  const telefone = document.getElementById('manage-telefone').value;
  const codigo = document.getElementById('manage-codigo').value;
  try {
    const ag = await consultarAgendamentoFirestore(telefone, codigo);
    state.manageAgendamento = ag;
    state.manageHorario = null;
    renderManageResult(ag);
  } catch (err) {
    setText('manage-error', publicBlockedMessage(
      err,
      'Consulta publica desativada por seguranca. Chame a barbearia pelo WhatsApp.'
    ));
  }
}

function renderManageResult(ag) {
  const box = document.getElementById('manage-result');
  box.style.display = 'block';
  box.innerHTML = `
    <div class="sucesso-detalhes">
      <div class="detalhe"><span>Servico</span><span>${escapeHtml(ag.servico)}</span></div>
      <div class="detalhe"><span>Profissional</span><span>${escapeHtml(ag.profissionalNome)}</span></div>
      <div class="detalhe"><span>Data</span><span>${escapeHtml(formatDate(ag.data))}</span></div>
      <div class="detalhe"><span>Horario</span><span>${escapeHtml(ag.horario)}</span></div>
      <div class="detalhe"><span>Status</span><span>${escapeHtml(ag.status)}</span></div>
    </div>
    <div class="manage-actions">
      <button class="agendar-servico-btn" onclick="cancelarCliente()">Cancelar agendamento</button>
      <button class="agendar-servico-btn" onclick="abrirReagendamento()">Reagendar</button>
    </div>
  `;
}

async function cancelarCliente() {
  if (!state.manageAgendamento) return;
  if (!confirm('Cancelar este agendamento?')) return;
  try {
    const ag = await cancelarAgendamentoFirestore(state.manageAgendamento.id);
    state.manageAgendamento = ag;
    renderManageResult(ag);
    document.getElementById('reschedule-box').style.display = 'none';
  } catch (err) {
    setText('manage-error', publicBlockedMessage(
      err,
      'Cancelamento publico desativado por seguranca. Chame a barbearia pelo WhatsApp.'
    ));
  }
}

function abrirReagendamento() {
  if (!state.manageAgendamento) return;
  document.getElementById('reschedule-box').style.display = 'block';
  document.getElementById('manage-profissional').value = state.manageAgendamento.profissionalId;
  document.getElementById('manage-data').value = state.manageAgendamento.data;
  carregarHorariosGerenciar();
}

async function carregarHorariosGerenciar() {
  const grid = document.getElementById('manage-horarios');
  const data = document.getElementById('manage-data').value;
  const profissionalId = document.getElementById('manage-profissional').value;
  state.manageHorario = null;
  if (!data || !profissionalId) {
    grid.innerHTML = '<p class="horarios-hint">Selecione data e profissional.</p>';
    return;
  }
  grid.innerHTML = '<p class="horario-loading">Carregando horarios...</p>';
  try {
    const agendamentos = await buscarAgendamentosPorData(data);
    const ocupados = new Set(
      agendamentos
        .filter(ag => ag.profissionalId === profissionalId && String(ag.id) !== String(state.manageAgendamento?.id) && normalizeStatus(ag.status) !== 'cancelado')
        .map(ag => ag.horario)
        .filter(Boolean)
    );
    const horarios = slotsForDate(data, profissionalId).filter(horario => !ocupados.has(horario));
    renderHorarios(grid, horarios, horario => { state.manageHorario = horario; });
  } catch (err) {
    logDevError('Erro ao carregar horarios de reagendamento no Firestore:', err);
    renderHorariosError(grid, carregarHorariosGerenciar);
  }
}

async function reagendarCliente() {
  if (!state.manageAgendamento) return;
  const data = document.getElementById('manage-data').value;
  const profissionalId = document.getElementById('manage-profissional').value;
  if (!state.manageHorario) {
    setText('manage-error', 'Escolha um novo horario.');
    return;
  }
  try {
    const ag = await reagendarAgendamentoFirestore(state.manageAgendamento, data, state.manageHorario, profissionalId);
    state.manageAgendamento = ag;
    renderManageResult(ag);
    document.getElementById('reschedule-box').style.display = 'none';
  } catch (err) {
    setText('manage-error', publicBlockedMessage(
      err,
      'Reagendamento publico desativado por seguranca. Chame a barbearia pelo WhatsApp.'
    ));
  }
}

function attachMasks() {
  ['inp-telefone', 'manage-telefone'].forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener('input', e => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 11);
      if (v.length > 6) v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
      else if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
      else if (v.length > 0) v = `(${v}`;
      e.target.value = v;
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initReveal();
  attachMasks();
  loadPublicData();
  const prof = document.getElementById('inp-profissional');
  if (prof) prof.addEventListener('change', carregarHorarios);
  const manageProf = document.getElementById('manage-profissional');
  const manageData = document.getElementById('manage-data');
  if (manageProf) manageProf.addEventListener('change', carregarHorariosGerenciar);
  if (manageData) manageData.addEventListener('change', carregarHorariosGerenciar);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    fecharModal();
    fecharGerenciar();
  }
});

window.toggleSelect = toggleSelect;
window.escolherServico = escolherServico;
window.mudarMes = mudarMes;
window.selecionarDia = selecionarDia;
window.abrirModal = abrirModal;
window.fecharModal = fecharModal;
window.fecharModalFora = fecharModalFora;
window.enviarAgendamento = enviarAgendamento;
window.abrirGerenciar = abrirGerenciar;
window.fecharGerenciar = fecharGerenciar;
window.fecharGerenciarFora = fecharGerenciarFora;
window.consultarAgendamento = consultarAgendamento;
window.cancelarCliente = cancelarCliente;
window.abrirReagendamento = abrirReagendamento;
window.reagendarCliente = reagendarCliente;
