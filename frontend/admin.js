/* ========================= */
/* PROTEÇÃO DE ACESSO ADMIN  */
/* ========================= */

// Troque a senha abaixo pela senha que quiser usar
const ADMIN_PASSWORD = 'blackline2025';
const SESSION_KEY    = 'bl_admin_auth';

function verificarAcesso() {
  const autenticado = sessionStorage.getItem(SESSION_KEY) === 'ok';
  if (autenticado) {
    document.getElementById('login-overlay').style.display = 'none';
  }
}

function tentarLogin() {
  const senha = document.getElementById('login-senha').value;
  const erro  = document.getElementById('login-error');
  if (senha === ADMIN_PASSWORD) {
    sessionStorage.setItem(SESSION_KEY, 'ok');
    document.getElementById('login-overlay').style.display = 'none';
    erro.textContent = '';
    carregarAgendamentos();
  } else {
    erro.textContent = 'Senha incorreta. Tente novamente.';
    document.getElementById('login-senha').value = '';
    document.getElementById('login-senha').focus();
  }
}

function sair() {
  sessionStorage.removeItem(SESSION_KEY);
  location.reload();
}

window.tentarLogin = tentarLogin;
window.sair        = sair;

/* ========================= */
/* CONFIG FIREBASE           */
/* ========================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC_Z2RH2xQ6PLpcZ3o7PTib44jFZFnxets",
  authDomain: "blackline-2c83c.firebaseapp.com",
  projectId: "blackline-2c83c",
  storageBucket: "blackline-2c83c.firebasestorage.app",
  messagingSenderId: "1088625509451",
  appId: "1:1088625509451:web:2a4f894d87c1537015b9ce"
};

const app = initializeApp(firebaseConfig);
const firestoreDb = getFirestore(app);

const STATUS = {
  pendente:   { label:'Pendente',   icon:'🕐', cls:'s-pendente'   },
  confirmado: { label:'Confirmado', icon:'✅', cls:'s-confirmado' },
  concluido:  { label:'Concluído',  icon:'🏆', cls:'s-concluido'  },
  cancelado:  { label:'Cancelado',  icon:'❌', cls:'s-cancelado'  },
};

const SERVICO = {
  'Corte Premium':   { icon:'✂️', cls:'badge-corte'  },
  'Barba Completa':  { icon:'🧔', cls:'badge-barba'  },
  'Combo Executivo': { icon:'🔥', cls:'badge-combo'  },
};

let todos = [];

/* ========================= */
/* INIT                      */
/* ========================= */

document.addEventListener("DOMContentLoaded", () => {
  const autenticado = sessionStorage.getItem(SESSION_KEY) === 'ok';
  if (autenticado) {
    document.getElementById('login-overlay').style.display = 'none';
    carregarAgendamentos();
    setInterval(carregarAgendamentos, 30000);
  }
});

/* ========================= */
/* LOAD                      */
/* ========================= */

async function carregarAgendamentos() {
  const btn = document.querySelector('.btn-refresh');
  if (btn) { btn.disabled = true; }

  try {
    const q = query(collection(firestoreDb, "agendamentos"), orderBy("data", "asc"));
    const querySnapshot = await getDocs(q);
    todos = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      todos.push({ id: docSnap.id, ...data });
    });

    // Ordenar por data e horario
    todos.sort((a, b) => {
      if (a.data === b.data) return (a.horario || '').localeCompare(b.horario || '');
      return a.data.localeCompare(b.data);
    });

    atualizarStats();
    aplicarFiltros();
  } catch(err) {
    console.error('Erro ao carregar:', err);
    setEstado('erro', 'Não foi possível conectar ao Firebase. Verifique a configuração.');
  } finally {
    if (btn) { btn.disabled = false; }
  }
}

/* ========================= */
/* STATS                     */
/* ========================= */

function atualizarStats() {
  document.getElementById('stat-total').textContent = todos.length;
  ['pendente','confirmado','concluido','cancelado'].forEach(s => {
    const el = document.getElementById(`stat-${s}`);
    if (el) el.textContent = todos.filter(a => a.status === s).length;
  });
}

/* ========================= */
/* FILTROS                   */
/* ========================= */

function aplicarFiltros() {
  const status = document.getElementById('filtro-status').value;
  const data   = document.getElementById('filtro-data').value;
  const busca  = document.getElementById('filtro-busca').value.toLowerCase().trim();

  const lista = todos.filter(ag => {
    if (status && ag.status !== status) return false;
    if (data   && ag.data   !== data)   return false;
    if (busca) {
      const n = ag.nome.toLowerCase();
      const t = ag.telefone;
      if (!n.includes(busca) && !t.includes(busca)) return false;
    }
    return true;
  });

  renderTabela(lista);
}

function limparFiltros() {
  document.getElementById('filtro-status').value = '';
  document.getElementById('filtro-data').value   = '';
  document.getElementById('filtro-busca').value  = '';
  aplicarFiltros();
}

/* ========================= */
/* RENDER                    */
/* ========================= */

function setEstado(tipo, msg) {
  document.getElementById('table-loading').style.display = 'none';
  document.getElementById('table-empty').style.display   = tipo !== 'tabela' ? 'flex' : 'none';
  document.getElementById('table-scroll').style.display  = tipo === 'tabela' ? 'block' : 'none';
  if (tipo !== 'tabela') {
    document.getElementById('empty-msg').textContent = msg || '';
  }
}

function renderTabela(lista) {
  if (lista.length === 0) {
    setEstado('vazio', todos.length === 0
      ? 'Nenhum agendamento cadastrado ainda.'
      : 'Nenhum resultado para os filtros aplicados.');
    return;
  }

  setEstado('tabela');
  const tbody = document.getElementById('ag-tbody');
  tbody.innerHTML = '';

  lista.forEach(ag => {
    // Data
    const d    = new Date(ag.data + 'T12:00:00');
    const diaF = d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
    const semF = d.toLocaleDateString('pt-BR', { weekday:'long' });

    // Tel formatado
    const tel  = (ag.telefone || '').replace(/\D/g,'');
    const telF = tel.length === 11
      ? `(${tel.slice(0,2)}) ${tel.slice(2,7)}-${tel.slice(7)}`
      : tel.length === 10
      ? `(${tel.slice(0,2)}) ${tel.slice(2,6)}-${tel.slice(6)}`
      : ag.telefone;

    const sc  = SERVICO[ag.servico] || { icon:'📋', cls:'badge-corte' };
    const sta = STATUS[ag.status]   || STATUS.pendente;
    const shortId = ag.id.slice(0, 6);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="cell-id">#${shortId}</span></td>
      <td><div class="cell-nome">${ag.nome}</div></td>
      <td class="cell-tel">
        <a href="https://wa.me/55${tel}" target="_blank">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          ${telF}
        </a>
      </td>
      <td>
        <span class="badge-servico ${sc.cls}">${sc.icon} ${ag.servico}</span>
      </td>
      <td>
        <div class="cell-dia">${diaF}</div>
        <div class="cell-sem">${semF}</div>
      </td>
      <td><span class="pill-hora">⏰ ${ag.horario}</span></td>
      <td><span class="badge-status ${sta.cls}">${sta.icon} ${sta.label}</span></td>
      <td>
        <div class="acoes">
          <button class="btn-ver" onclick="abrirDetalhe('${ag.id}')">Ver detalhes</button>
          <button class="btn-del" onclick="deletar('${ag.id}')" title="Remover">🗑</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ========================= */
/* DETALHE                   */
/* ========================= */

let detalheId = null;

function abrirDetalhe(id) {
  const ag = todos.find(a => a.id === id);
  if (!ag) return;
  detalheId = id;

  const d    = new Date(ag.data + 'T12:00:00');
  const dataF = d.toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
  const sta  = STATUS[ag.status] || STATUS.pendente;
  const sc   = SERVICO[ag.servico] || { icon:'📋' };
  const tel  = (ag.telefone || '').replace(/\D/g,'');
  const telF = tel.length === 11
    ? `(${tel.slice(0,2)}) ${tel.slice(2,7)}-${tel.slice(7)}`
    : ag.telefone;
  
  let criadoEm = '—';
  if (ag.criado_em) {
    // Firebase Timestamp tem .toDate(), string normal usa new Date()
    const d2 = ag.criado_em.toDate ? ag.criado_em.toDate() : new Date(ag.criado_em);
    criadoEm = d2.toLocaleString('pt-BR');
  }

  const shortId = id.slice(0, 6);

  document.getElementById('detail-content').innerHTML = `
    <div class="drow"><span class="dkey">ID</span><span class="dval">#${shortId}</span></div>
    <div class="drow"><span class="dkey">Nome</span><span class="dval">${ag.nome}</span></div>
    <div class="drow">
      <span class="dkey">WhatsApp</span>
      <span class="dval"><a href="https://wa.me/55${tel}" target="_blank" style="color:#4ecdc4;text-decoration:none">${telF}</a></span>
    </div>
    <div class="drow"><span class="dkey">Serviço</span><span class="dval">${sc.icon} ${ag.servico}</span></div>
    <div class="drow"><span class="dkey">Data</span><span class="dval">${dataF}</span></div>
    <div class="drow"><span class="dkey">Horário</span><span class="dval">⏰ ${ag.horario}</span></div>
    <div class="drow">
      <span class="dkey">Status</span>
      <span class="dval"><span class="badge-status ${sta.cls}">${sta.icon} ${sta.label}</span></span>
    </div>
    <div class="drow"><span class="dkey">Criado em</span><span class="dval" style="font-size:.8rem;color:#777">${criadoEm}</span></div>
    ${ag.observacoes ? `<div class="dobs">💬 ${ag.observacoes}</div>` : ''}
  `;

  // Botões de status
  const outros = Object.keys(STATUS).filter(s => s !== ag.status);
  document.getElementById('detail-actions').innerHTML = outros.map(s => {
    const c = STATUS[s];
    return `<button class="btn-status btn-status-${s}" onclick="atualizarStatus('${id}','${s}')">${c.icon} ${c.label}</button>`;
  }).join('');

  document.getElementById('detailOverlay').classList.add('open');
}

function fecharDetalhe(e) {
  if (e.target.id === 'detailOverlay') fecharDetalheBtn();
}
function fecharDetalheBtn() {
  document.getElementById('detailOverlay').classList.remove('open');
  detalheId = null;
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharDetalheBtn(); });

/* ========================= */
/* ATUALIZAR STATUS          */
/* ========================= */

async function atualizarStatus(id, novoStatus) {
  try {
    const docRef = doc(firestoreDb, "agendamentos", id);
    await updateDoc(docRef, { status: novoStatus });

    const idx = todos.findIndex(a => a.id === id);
    if (idx !== -1) todos[idx].status = novoStatus;

    atualizarStats();
    aplicarFiltros();
    fecharDetalheBtn();
  } catch(err) {
    console.error('Erro ao atualizar:', err);
    alert('Erro ao atualizar: ' + err.message);
  }
}

/* ========================= */
/* DELETAR                   */
/* ========================= */

async function deletar(id) {
  const ag = todos.find(a => a.id === id);
  if (!ag) return;
  if (!confirm(`Remover agendamento de ${ag.nome} (${ag.data} às ${ag.horario})?`)) return;

  try {
    const docRef = doc(firestoreDb, "agendamentos", id);
    await deleteDoc(docRef);
    todos = todos.filter(a => a.id !== id);
    atualizarStats();
    aplicarFiltros();
  } catch(err) {
    console.error('Erro ao remover:', err);
    alert('Erro ao remover: ' + err.message);
  }
}

/* ========================= */
/* EXPORT PARA GLOBAL SCOPE  */
/* ========================= */
window.carregarAgendamentos = carregarAgendamentos;
window.aplicarFiltros = aplicarFiltros;
window.limparFiltros = limparFiltros;
window.abrirDetalhe = abrirDetalhe;
window.fecharDetalhe = fecharDetalhe;
window.fecharDetalheBtn = fecharDetalheBtn;
window.atualizarStatus = atualizarStatus;
window.deletar = deletar;
