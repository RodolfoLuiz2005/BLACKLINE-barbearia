/* ========================= */
/* CONFIG                    */
/* ========================= */

// Usa caminho relativo — o Nginx faz proxy de /api/* para o backend
// Isso funciona em qualquer ambiente: localhost, IP, domínio, Docker
const API_URL = '';

/* ========================= */
/* REVEAL + HEADER           */
/* ========================= */

const reveals = document.querySelectorAll('.reveal');
window.addEventListener('scroll', () => {
  reveals.forEach(r => {
    if (r.getBoundingClientRect().top < window.innerHeight - 100) r.classList.add('active');
  });
  const header = document.querySelector('header');
  if (header) header.style.background = window.scrollY > 30 ? 'rgba(5,5,5,.92)' : 'rgba(5,5,5,.55)';
});
window.dispatchEvent(new Event('scroll'));

/* ========================= */
/* SERVICE CARDS             */
/* ========================= */

document.querySelectorAll('.service-card').forEach(card => {
  const btn = card.querySelector('.service-btn');
  btn.addEventListener('click', () => {
    card.classList.toggle('active');
    btn.innerHTML = card.classList.contains('active') ? 'Fechar opções' : 'Ver opções';
  });
});

/* ========================= */
/* CUSTOM SELECT             */
/* ========================= */

let servicoSelecionado = '';

function toggleSelect() {
  const wrap = document.getElementById('select-servico-wrap');
  const dropdown = document.getElementById('select-dropdown');
  const isOpen = wrap.classList.contains('open');
  wrap.classList.toggle('open', !isOpen);
  dropdown.style.display = isOpen ? 'none' : 'block';
}

function escolherServico(el) {
  const valor = el.dataset.value;
  const nome = el.querySelector('.select-opt-nome').textContent;
  const icone = el.querySelector('.select-opt-icon') ? el.querySelector('.select-opt-icon').textContent : '';
  const preco = el.querySelector('.select-opt-preco') ? el.querySelector('.select-opt-preco').textContent : '';

  servicoSelecionado = valor;
  document.getElementById('inp-servico').value = valor;

  const label = document.getElementById('select-label');
  if (valor) {
    label.innerHTML = `<span class="sel-chosen-icon">${icone}</span><span class="sel-chosen-nome">${nome}</span><span class="sel-chosen-preco">${preco}</span>`;
  } else {
    label.textContent = 'Selecione um serviço...';
  }

  // Marcar selecionado
  document.querySelectorAll('.select-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');

  // Fechar dropdown
  document.getElementById('select-servico-wrap').classList.remove('open');
  document.getElementById('select-dropdown').style.display = 'none';
}

// Fechar select ao clicar fora
document.addEventListener('click', (e) => {
  const wrap = document.getElementById('select-servico-wrap');
  if (wrap && !wrap.contains(e.target)) {
    wrap.classList.remove('open');
    const dd = document.getElementById('select-dropdown');
    if (dd) dd.style.display = 'none';
  }
});

// Pré-selecionar serviço por valor
function preSelectServico(valor) {
  if (!valor) return;
  const opt = document.querySelector(`.select-option[data-value="${valor}"]`);
  if (opt) escolherServico(opt);
}

/* ========================= */
/* CALENDÁRIO                */
/* ========================= */

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_SEMANA_CURTO = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

let calState = { ano: null, mes: null, dataISO: null };

function initCalendario() {
  const hoje = new Date();
  calState.ano = hoje.getFullYear();
  calState.mes = hoje.getMonth();
  calState.dataISO = null;
  renderCalendario();
}

function isDiaDisponivel(date) {
  if (date.getDay() === 0) return false;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  return date >= hoje;
}

function renderCalendario() {
  const el = document.getElementById('mini-calendario');
  if (!el) return;
  const { ano, mes } = calState;
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const ultimoDia  = new Date(ano, mes + 1, 0).getDate();
  const hoje = new Date();
  const podePrev = ano > hoje.getFullYear() || (ano === hoje.getFullYear() && mes > hoje.getMonth());

  let html = `
    <div class="cal-header">
      <button class="cal-nav ${!podePrev ? 'cal-nav-disabled' : ''}" onclick="mudarMes(-1)" ${!podePrev ? 'disabled' : ''}>&#8249;</button>
      <span class="cal-titulo">${MESES[mes]} ${ano}</span>
      <button class="cal-nav" onclick="mudarMes(1)">&#8250;</button>
    </div>
    <div class="cal-grid">
  `;

  DIAS_SEMANA_CURTO.forEach(d => { html += `<div class="cal-dia-semana">${d}</div>`; });
  for (let i = 0; i < primeiroDia; i++) html += `<div class="cal-cell cal-vazio"></div>`;

  for (let dia = 1; dia <= ultimoDia; dia++) {
    const date = new Date(ano, mes, dia);
    const dow  = date.getDay();
    const disp = isDiaDisponivel(date);
    const iso  = `${ano}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    const sel  = calState.dataISO === iso;
    let cls    = 'cal-cell';
    if (!disp)       cls += ' cal-indisponivel';
    else if (dow===6) cls += ' cal-sabado';
    if (sel)         cls += ' cal-selecionado';
    const click = disp ? `onclick="selecionarDia('${iso}',${dia},${ano},${mes})"` : '';
    html += `<div class="${cls}" ${click}>${dia}</div>`;
  }

  html += `</div>
    <div class="cal-legenda">
      <span class="cal-leg-item"><span class="cal-leg-dot cal-leg-livre"></span>Seg–Sex 08h–18h</span>
      <span class="cal-leg-item"><span class="cal-leg-dot cal-leg-sabado"></span>Sáb até 12h</span>
      <span class="cal-leg-item"><span class="cal-leg-dot cal-leg-bloqueado"></span>Indisponível</span>
    </div>
  `;
  el.innerHTML = html;
}

function mudarMes(delta) {
  calState.mes += delta;
  if (calState.mes < 0)  { calState.mes = 11; calState.ano--; }
  if (calState.mes > 11) { calState.mes = 0;  calState.ano++; }
  renderCalendario();
}

function selecionarDia(iso, dia, ano, mes) {
  calState.dataISO = iso;
  renderCalendario();
  const date = new Date(ano, mes, dia);
  const lbl  = date.toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long' });
  const el   = document.getElementById('data-selecionada-label');
  if (el) el.textContent = lbl.charAt(0).toUpperCase() + lbl.slice(1);
  carregarHorarios(iso);
}

/* ========================= */
/* MODAL                     */
/* ========================= */

let horarioSelecionado = null;

function abrirModal(servico = '') {
  document.getElementById('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('step-form').style.display = 'block';
  document.getElementById('step-sucesso').style.display = 'none';
  initCalendario();
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
  ['inp-nome','inp-telefone','inp-obs'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('form-error').textContent = '';
  const lbl = document.getElementById('data-selecionada-label');
  if (lbl) lbl.textContent = 'Selecione uma data no calendário';
  horarioSelecionado = null;
  servicoSelecionado = '';
  document.getElementById('inp-servico').value = '';
  document.getElementById('select-label').textContent = 'Selecione um serviço...';
  document.querySelectorAll('.select-option').forEach(o => o.classList.remove('selected'));
  document.getElementById('horarios-grid').innerHTML = '<p class="horarios-hint">Selecione uma data primeiro</p>';
  calState.dataISO = null;
}

/* ========================= */
/* HORÁRIOS                  */
/* ========================= */

async function carregarHorarios(data) {
  const grid = document.getElementById('horarios-grid');
  grid.innerHTML = '<p class="horario-loading">Carregando horários...</p>';
  horarioSelecionado = null;

  const dow       = new Date(data + 'T12:00:00').getDay();
  const isSabado  = dow === 6;
  const fimHora   = isSabado ? 12 : 18;

  // Gera todos os slots do dia
  const todosSlotsLocais = [];
  for (let h = 8; h < fimHora; h++) {
    todosSlotsLocais.push(`${String(h).padStart(2,'0')}:00`);
    todosSlotsLocais.push(`${String(h).padStart(2,'0')}:30`);
  }

  let disponiveis = todosSlotsLocais;

  try {
    const res  = await fetch(`${API_URL}/api/horarios-disponiveis?data=${data}`);
    const json = await res.json();
    if (json.success) {
      // Intersecção: só slots dentro do horário do dia E não ocupados
      disponiveis = todosSlotsLocais.filter(h => json.data.includes(h));
    }
  } catch { /* usa todos locais como fallback */ }

  if (disponiveis.length === 0) {
    grid.innerHTML = '<p class="horarios-hint">Nenhum horário disponível nesta data.</p>';
    return;
  }

  grid.innerHTML = '';
  disponiveis.forEach(h => {
    const btn = document.createElement('button');
    btn.className = 'horario-slot';
    btn.textContent = h;
    btn.type = 'button';
    btn.onclick = () => {
      document.querySelectorAll('.horario-slot').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      horarioSelecionado = h;
    };
    grid.appendChild(btn);
  });
}

/* ========================= */
/* MÁSCARA TELEFONE          */
/* ========================= */

const telInput = document.getElementById('inp-telefone');
if (telInput) {
  telInput.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g,'').slice(0,11);
    if (v.length > 6) v = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
    else if (v.length > 2) v = `(${v.slice(0,2)}) ${v.slice(2)}`;
    else if (v.length > 0) v = `(${v}`;
    e.target.value = v;
  });
}

/* ========================= */
/* ENVIAR AGENDAMENTO        */
/* ========================= */

async function enviarAgendamento() {
  const nome     = document.getElementById('inp-nome').value.trim();
  const telefone = document.getElementById('inp-telefone').value.trim();
  const servico  = document.getElementById('inp-servico').value;
  const data     = calState.dataISO;
  const obs      = document.getElementById('inp-obs').value.trim();
  const errorEl  = document.getElementById('form-error');
  errorEl.textContent = '';

  if (!nome)               return mostrarErro('Por favor, informe seu nome.');
  if (!telefone)           return mostrarErro('Por favor, informe seu WhatsApp.');
  if (!servico)            return mostrarErro('Selecione um serviço.');
  if (!data)               return mostrarErro('Selecione uma data no calendário.');
  if (!horarioSelecionado) return mostrarErro('Selecione um horário disponível.');

  const btn       = document.getElementById('btn-agendar');
  const btnText   = document.getElementById('btn-text');
  const btnLoader = document.getElementById('btn-loader');
  btn.disabled = true;
  btnText.style.display  = 'none';
  btnLoader.style.display = 'inline';

  try {
    const res  = await fetch(`${API_URL}/api/agendamentos`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ nome, telefone: telefone.replace(/\D/g,''), servico, data, horario: horarioSelecionado, observacoes: obs })
    });
    const json = await res.json();

    if (!json.success) { mostrarErro(json.error || 'Erro ao agendar. Tente novamente.'); return; }

    const ag   = json.data;
    const dataF = new Date(ag.data + 'T12:00:00').toLocaleDateString('pt-BR', {
      weekday:'long', day:'2-digit', month:'long', year:'numeric'
    });

    document.getElementById('sucesso-texto').textContent = 'Agendamento registrado! Te esperamos na BLACKLINE.';
    document.getElementById('sucesso-detalhes').innerHTML = `
      <div class="detalhe"><span>Nome</span><span>${ag.nome}</span></div>
      <div class="detalhe"><span>Serviço</span><span>${ag.servico}</span></div>
      <div class="detalhe"><span>Data</span><span>${dataF}</span></div>
      <div class="detalhe"><span>Horário</span><span>${ag.horario}</span></div>
      <div class="detalhe"><span>Status</span><span>⏳ Pendente (aguardando confirmação)</span></div>
    `;
    document.getElementById('step-form').style.display   = 'none';
    document.getElementById('step-sucesso').style.display = 'block';

  } catch { mostrarErro('Erro de conexão. Tente novamente.'); }
  finally {
    btn.disabled = false;
    btnText.style.display   = 'inline';
    btnLoader.style.display = 'none';
  }
}

function mostrarErro(msg) {
  document.getElementById('form-error').textContent = '⚠️ ' + msg;
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharModal(); });
