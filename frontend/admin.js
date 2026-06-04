const API_BASE_URL = location.hostname === '127.0.0.1' || location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : '';
const TOKEN_KEY = 'bl_admin_token';

const STATUS = {
  pendente: { label: 'Pendente', cls: 's-pendente' },
  confirmado: { label: 'Confirmado', cls: 's-confirmado' },
  concluido: { label: 'Concluido', cls: 's-concluido' },
  cancelado: { label: 'Cancelado', cls: 's-cancelado' }
};

const state = {
  token: sessionStorage.getItem(TOKEN_KEY) || '',
  view: 'agenda',
  agendamentos: [],
  servicos: [],
  profissionais: [],
  galeria: [],
  config: {}
};

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
  const id = String(ag.id ?? '');
  const nome = String(ag.nome ?? '');
  const telefone = String(ag.telefone ?? '');
  const servico = String(ag.servico ?? '');
  const data = String(ag.data ?? '');
  const horario = String(ag.horario ?? '');
  const status = STATUS[ag.status] ? ag.status : 'pendente';
  const profissionalId = String(ag.profissionalId ?? '');
  const profissionalNome = String(ag.profissionalNome ?? '');
  const codigo = String(ag.codigo || id.slice(0, 6) || '-');
  const observacoes = String(ag.observacoes ?? '');
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

async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    ...(options.headers || {})
  };
  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.success === false) {
    if (res.status === 401) forceLogout();
    throw new Error(payload.error || 'Erro de conexao.');
  }
  return payload.data ?? payload;
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
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

async function tentarLogin() {
  const senhaInput = document.getElementById('login-senha');
  const erro = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  const senha = senhaInput.value;
  if (!senha) {
    erro.textContent = 'Informe a senha.';
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Verificando...';
  erro.textContent = '';
  try {
    const result = await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ senha })
    });
    state.token = result.token;
    sessionStorage.setItem(TOKEN_KEY, state.token);
    document.getElementById('login-overlay').style.display = 'none';
    await carregarTudo();
  } catch (err) {
    erro.textContent = err.message;
    senhaInput.value = '';
    senhaInput.focus();
  } finally {
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
}

function forceLogout() {
  state.token = '';
  sessionStorage.removeItem(TOKEN_KEY);
  document.getElementById('login-overlay').style.display = 'flex';
}

function sair() {
  forceLogout();
  location.reload();
}

async function init() {
  document.getElementById('login-senha')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') tentarLogin();
  });
  if (!state.token) return;
  try {
    await api('/api/admin/me');
    document.getElementById('login-overlay').style.display = 'none';
    await carregarTudo();
    setInterval(() => {
      if (state.view === 'agenda' && state.token) carregarAgendamentos();
    }, 30000);
  } catch {
    forceLogout();
  }
}

async function carregarTudo() {
  const btn = document.querySelector('.btn-refresh');
  if (btn) btn.disabled = true;
  try {
    const [agendamentos, servicos, profissionais, galeria, config] = await Promise.all([
      api('/api/agendamentos'),
      api('/api/admin/servicos'),
      api('/api/admin/profissionais'),
      api('/api/admin/galeria'),
      api('/api/admin/configuracoes')
    ]);
    state.agendamentos = agendamentos || [];
    state.servicos = servicos || [];
    state.profissionais = profissionais || [];
    state.galeria = galeria || [];
    state.config = config || {};
    renderAll();
  } catch (err) {
    setEstado('erro', err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function carregarAgendamentos() {
  state.agendamentos = await api('/api/agendamentos');
  atualizarStats();
  aplicarFiltros();
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
  select.innerHTML = '<option value="">Todos</option>' + state.profissionais
    .map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.nome)}</option>`)
    .join('');
}

function atualizarStats() {
  document.getElementById('stat-total').textContent = state.agendamentos.length;
  ['pendente', 'confirmado', 'concluido', 'cancelado'].forEach(s => {
    const el = document.getElementById(`stat-${s}`);
    if (el) el.textContent = state.agendamentos.filter(a => a.status === s).length;
  });
}

function aplicarFiltros() {
  const status = document.getElementById('filtro-status').value;
  const data = document.getElementById('filtro-data').value;
  const profissionalId = document.getElementById('filtro-profissional').value;
  const busca = document.getElementById('filtro-busca').value.toLowerCase().trim();
  const lista = state.agendamentos.filter(raw => {
    const ag = normalizeAgendamento(raw);
    if (status && ag.status !== status) return false;
    if (data && ag.data !== data) return false;
    if (profissionalId && ag.profissionalId !== profissionalId) return false;
    if (busca) {
      const haystack = `${ag.nome || ''} ${ag.telefone || ''} ${ag.codigo || ''}`.toLowerCase();
      if (!haystack.includes(busca)) return false;
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
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="cell-id">${escapeHtml(ag.codigo || String(ag.id).slice(0, 6))}</span></td>
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
    const updated = await api(`/api/agendamentos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    const idx = state.agendamentos.findIndex(a => String(a.id ?? '') === String(id));
    if (idx !== -1) state.agendamentos[idx] = updated;
    atualizarStats();
    aplicarFiltros();
    fecharDetalheBtn();
  } catch (err) {
    alert(err.message);
  }
}

async function marcarLembrete(id) {
  try {
    const updated = await api(`/api/agendamentos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ lembreteEnviado: true })
    });
    const idx = state.agendamentos.findIndex(a => String(a.id ?? '') === String(id));
    if (idx !== -1) state.agendamentos[idx] = updated;
  } catch {
    // O WhatsApp ainda abre; a marcacao visual pode ser refeita depois.
  }
}

async function deletar(id) {
  const ag = normalizeAgendamento(state.agendamentos.find(a => String(a.id ?? '') === String(id)));
  if (!ag.id || !confirm(`Remover agendamento de ${ag.nome || 'cliente sem nome'}?`)) return;
  try {
    await api(`/api/agendamentos/${id}`, { method: 'DELETE' });
    state.agendamentos = state.agendamentos.filter(a => a.id !== id);
    atualizarStats();
    aplicarFiltros();
  } catch (err) {
    alert(err.message);
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
  document.getElementById('prof-horarios').value = JSON.stringify(p.horarios || defaultHorarios(), null, 2);
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
    horarios,
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
    url: document.getElementById('gal-url').value.trim(),
    ativo: document.getElementById('gal-ativo').checked
  };
  await saveCollectionItem('galeria', id, payload);
  resetGalForm();
}

async function saveCollectionItem(collection, id, payload) {
  try {
    const item = await api(`/api/admin/${collection}${id ? `/${id}` : ''}`, {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(payload)
    });
    if (id) {
      const index = state[collection].findIndex(row => row.id === id);
      if (index !== -1) state[collection][index] = item;
    } else {
      state[collection].push(item);
    }
    renderAll();
  } catch (err) {
    alert(err.message);
  }
}

async function removerRegistro(collection, id) {
  if (!confirm('Remover este registro?')) return;
  try {
    await api(`/api/admin/${collection}/${id}`, { method: 'DELETE' });
    state[collection] = state[collection].filter(item => item.id !== id);
    renderAll();
  } catch (err) {
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
    instagram: document.getElementById('cfg-instagram').value.trim(),
    facebook: document.getElementById('cfg-facebook').value.trim(),
    tiktok: document.getElementById('cfg-tiktok').value.trim(),
    whatsapp: onlyDigits(document.getElementById('cfg-whatsapp').value),
    endereco: document.getElementById('cfg-endereco').value.trim(),
    mapaEmbed: document.getElementById('cfg-mapa').value.trim(),
    googleReviewsUrl: document.getElementById('cfg-google-url').value.trim(),
    googleRating: document.getElementById('cfg-google-rating').value.trim(),
    horarioTexto: document.getElementById('cfg-horario').value.trim(),
    planos
  };
  try {
    state.config = await api('/api/admin/configuracoes', {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    alert('Configuracoes salvas.');
  } catch (err) {
    alert(err.message);
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
