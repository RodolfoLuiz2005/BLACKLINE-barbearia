const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'agendamentos.json');

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const defaultSchedule = {
  1: { ativo: true, inicio: '08:00', fim: '18:00', intervalo: 30 },
  2: { ativo: true, inicio: '08:00', fim: '18:00', intervalo: 30 },
  3: { ativo: true, inicio: '08:00', fim: '18:00', intervalo: 30 },
  4: { ativo: true, inicio: '08:00', fim: '18:00', intervalo: 30 },
  5: { ativo: true, inicio: '08:00', fim: '18:00', intervalo: 30 },
  6: { ativo: true, inicio: '08:00', fim: '12:00', intervalo: 30 },
  0: { ativo: false, inicio: '08:00', fim: '12:00', intervalo: 30 }
};

const defaultDb = {
  agendamentos: [],
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
      foto: 'https://images.unsplash.com/photo-1589992896844-9b720813d1cb?q=80&w=800&auto=format&fit=crop',
      especialidade: 'Fades e cortes modernos',
      ativo: true,
      horarios: defaultSchedule
    },
    {
      id: 'diego-lima',
      nome: 'Diego Lima',
      foto: 'https://images.unsplash.com/photo-1595959183082-7b570b7e08e2?q=80&w=800&auto=format&fit=crop',
      especialidade: 'Barba premium e navalha',
      ativo: true,
      horarios: defaultSchedule
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
  configuracoes: {
    instagram: '#',
    facebook: '#',
    tiktok: '#',
    whatsapp: '',
    endereco: 'Endereco comercial a configurar',
    mapaEmbed: 'about:blank',
    googleReviewsUrl: '#',
    googleRating: 'Configure no painel',
    horarioTexto: 'Segunda a Sabado - 08h as 18h (Sabado ate 12h)',
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
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeDefaults(db) {
  const base = clone(defaultDb);
  if (Array.isArray(db)) {
    base.agendamentos = db;
    return base;
  }
  return {
    ...base,
    ...db,
    agendamentos: Array.isArray(db.agendamentos) ? db.agendamentos : base.agendamentos,
    servicos: Array.isArray(db.servicos) ? db.servicos : base.servicos,
    profissionais: Array.isArray(db.profissionais) ? db.profissionais : base.profissionais,
    galeria: Array.isArray(db.galeria) ? db.galeria : base.galeria,
    configuracoes: { ...base.configuracoes, ...(db.configuracoes || {}) }
  };
}

let db = clone(defaultDb);
if (fs.existsSync(DB_PATH)) {
  try {
    db = mergeDefaults(JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')));
  } catch (err) {
    console.error('Erro ao ler banco JSON:', err);
  }
} else {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function saveDb() {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || crypto.randomBytes(4).toString('hex');
}

function createId(prefix, seed) {
  const slug = slugify(seed);
  const exists = new Set([
    ...db.servicos.map(item => item.id),
    ...db.profissionais.map(item => item.id),
    ...db.galeria.map(item => item.id),
    ...db.agendamentos.map(item => String(item.id))
  ]);
  let id = prefix ? `${prefix}-${slug}` : slug;
  let count = 2;
  while (exists.has(id)) id = `${prefix ? `${prefix}-${slug}` : slug}-${count++}`;
  return id;
}

function makeCode() {
  return `BL${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function requireAdmin(req, res, next) {
  return res.status(410).json({
    success: false,
    error: 'Admin legado desativado. Use Firebase Authentication e Firestore Rules.'
  });
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function hasFullName(value) {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
  return parts.length >= 2 && parts.every(part => part.length >= 2);
}

function findServico(idOrName) {
  return db.servicos.find(s => s.id === idOrName || s.nome === idOrName);
}

function findProfissional(id) {
  return db.profissionais.find(p => p.id === id);
}

function minutes(time) {
  const [h, m] = String(time || '00:00').split(':').map(Number);
  return h * 60 + m;
}

function timeFromMinutes(total) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function slotsFor(profissional, data) {
  if (!profissional || !data) return [];
  const date = new Date(`${data}T12:00:00`);
  if (Number.isNaN(date.getTime())) return [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const cfg = (profissional.horarios || defaultSchedule)[day];
  if (!cfg || !cfg.ativo || date < today) return [];

  const start = minutes(cfg.inicio);
  const end = minutes(cfg.fim);
  const step = Number(cfg.intervalo) || 30;
  const slots = [];
  for (let t = start; t < end; t += step) slots.push(timeFromMinutes(t));
  return slots;
}

function slotsForDate(data) {
  return slotsFor({ ativo: true, horarios: defaultSchedule }, data);
}

function isSlotTaken({ data, horario, profissionalId, ignoreId }) {
  return db.agendamentos.some(a =>
    a.id !== ignoreId &&
    a.data === data &&
    a.horario === horario &&
    (!profissionalId || a.profissionalId === profissionalId) &&
    a.status !== 'cancelado'
  );
}

function availableSlots(data, profissionalId) {
  if (!profissionalId) {
    return slotsForDate(data).filter(horario => !isSlotTaken({ data, horario }));
  }
  const profissional = findProfissional(profissionalId);
  if (!profissional || !profissional.ativo) return [];
  return slotsFor(profissional, data).filter(horario => !isSlotTaken({ data, horario, profissionalId }));
}

function publicAppointment(agendamento) {
  const profissional = findProfissional(agendamento.profissionalId);
  const servico = findServico(agendamento.servicoId) || findServico(agendamento.servico);
  return {
    ...agendamento,
    profissionalNome: agendamento.profissionalNome || profissional?.nome || '',
    servico: agendamento.servico || servico?.nome || ''
  };
}

function listedAppointment(agendamento) {
  const ag = publicAppointment(agendamento);
  return {
    id: ag.id,
    nome: ag.nome,
    servico: ag.servico,
    profissionalId: ag.profissionalId,
    profissionalNome: ag.profissionalNome,
    data: ag.data,
    horario: ag.horario,
    status: ag.status,
    criado_em: ag.criado_em
  };
}

function assertAppointmentPayload(body, res) {
  const nome = String(body.nome || '').trim();
  const telefone = normalizePhone(body.telefone);
  const servicoInput = String(body.servicoId || body.servico || '').trim();
  const servico = findServico(servicoInput);
  const profissional = findProfissional(body.profissionalId) || db.profissionais.find(p => p.ativo);
  const data = String(body.data || '').trim();
  const horario = String(body.horario || '').trim();
  const observacoes = String(body.observacoes || '').trim();

  if (!hasFullName(nome) || telefone.length !== 11 || !servico || !profissional || !data || !horario) {
    res.status(400).json({ success: false, error: 'Preencha nome e sobrenome, WhatsApp com DDD, servico, profissional, data e horario.' });
    return null;
  }
  if (!servico.ativo) {
    res.status(400).json({ success: false, error: 'Servico indisponivel para agendamento.' });
    return null;
  }
  if (!profissional.ativo) {
    res.status(400).json({ success: false, error: 'Profissional indisponivel para agendamento.' });
    return null;
  }
  if (!slotsFor(profissional, data).includes(horario)) {
    res.status(400).json({ success: false, error: 'Horario fora da agenda do profissional.' });
    return null;
  }
  return { nome, telefone, servico, profissional, data, horario, observacoes };
}

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '1mb' }));
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ success: false, error: 'JSON invalido na requisicao.' });
  }
  next(err);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', storage: 'json', timestamp: new Date().toISOString() });
});

app.get('/api/public-data', (req, res) => {
  res.json({
    success: true,
    data: {
      servicos: db.servicos.filter(s => s.ativo),
      profissionais: db.profissionais.filter(p => p.ativo),
      galeria: db.galeria.filter(g => g.ativo),
      configuracoes: db.configuracoes
    }
  });
});

app.get('/api/servicos', (req, res) => {
  res.json({ success: true, data: db.servicos.filter(s => s.ativo) });
});

app.get('/api/profissionais', (req, res) => {
  res.json({ success: true, data: db.profissionais.filter(p => p.ativo) });
});

app.get('/api/galeria', (req, res) => {
  res.json({ success: true, data: db.galeria.filter(g => g.ativo) });
});

app.get('/api/planos', (req, res) => {
  const planos = Array.isArray(db.configuracoes.planos) ? db.configuracoes.planos : [];
  res.json({ success: true, data: planos.filter(plano => plano.ativo !== false) });
});

app.get('/api/configuracoes', (req, res) => {
  res.json({ success: true, data: db.configuracoes });
});

function legacyAppointmentsDisabled(req, res) {
  return res.status(410).json({
    success: false,
    error: 'API publica legada de agendamentos desativada. Use o fluxo seguro com Firebase/Firestore.'
  });
}

app.use('/api/agendamentos', legacyAppointmentsDisabled);
app.get('/api/horarios-disponiveis', (req, res) => {
  const { data } = req.query;
  let { profissionalId } = req.query;
  if (!data) return res.status(400).json({ success: false, error: 'Data e obrigatoria.' });
  res.json({ success: true, data: availableSlots(data, profissionalId) });
});

app.get('/api/agendamentos', (req, res) => {
  const { data, status, profissionalId } = req.query;
  let results = db.agendamentos.map(publicAppointment);
  if (data) results = results.filter(a => a.data === data);
  if (status) results = results.filter(a => a.status === status);
  if (profissionalId) results = results.filter(a => a.profissionalId === profissionalId);
  results.sort((a, b) => {
    const dataA = String(a.data || '');
    const dataB = String(b.data || '');
    const horarioA = String(a.horario || '');
    const horarioB = String(b.horario || '');
    return dataA === dataB ? horarioA.localeCompare(horarioB) : dataA.localeCompare(dataB);
  });
  res.json({ success: true, data: results });
});

app.post('/api/agendamentos', (req, res) => {
  const payload = assertAppointmentPayload(req.body, res);
  if (!payload) return;
  if (isSlotTaken({ data: payload.data, horario: payload.horario })) {
    return res.status(409).json({ success: false, error: 'Horário já reservado. Escolha outro horário.' });
  }

  const agendamento = {
    id: crypto.randomUUID(),
    codigo: makeCode(),
    nome: payload.nome,
    telefone: payload.telefone,
    servicoId: payload.servico.id,
    servico: payload.servico.nome,
    profissionalId: payload.profissional.id,
    profissionalNome: payload.profissional.nome,
    data: payload.data,
    horario: payload.horario,
    observacoes: payload.observacoes,
    status: 'pendente',
    lembreteEnviado: false,
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString()
  };

  db.agendamentos.push(agendamento);
  saveDb();
  res.status(201).json({ success: true, data: publicAppointment(agendamento) });
});

app.patch('/api/agendamentos/:id', (req, res) => {
  const agendamento = db.agendamentos.find(a => a.id === req.params.id);
  if (!agendamento) return res.status(404).json({ success: false, error: 'Agendamento nao encontrado.' });
  const allowedStatus = ['pendente', 'confirmado', 'cancelado', 'concluido'];
  if (req.body.status) {
    if (!allowedStatus.includes(req.body.status)) return res.status(400).json({ success: false, error: 'Status invalido.' });
    agendamento.status = req.body.status;
  }
  if (typeof req.body.lembreteEnviado === 'boolean') agendamento.lembreteEnviado = req.body.lembreteEnviado;
  agendamento.atualizado_em = new Date().toISOString();
  saveDb();
  res.json({ success: true, data: publicAppointment(agendamento) });
});

app.delete('/api/agendamentos/:id', (req, res) => {
  const index = db.agendamentos.findIndex(a => a.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Agendamento nao encontrado.' });
  db.agendamentos.splice(index, 1);
  saveDb();
  res.json({ success: true, message: 'Agendamento removido.' });
});

app.post('/api/agendamentos/consultar', (req, res) => {
  const telefone = normalizePhone(req.body.telefone);
  const codigo = String(req.body.codigo || '').trim().toUpperCase();
  const agendamento = db.agendamentos.find(a => a.telefone === telefone && String(a.codigo || '').toUpperCase() === codigo);
  if (!agendamento) return res.status(404).json({ success: false, error: 'Agendamento nao encontrado.' });
  res.json({ success: true, data: publicAppointment(agendamento) });
});

app.patch('/api/agendamentos/:id/cancelar', (req, res) => {
  const telefone = normalizePhone(req.body.telefone);
  const codigo = String(req.body.codigo || '').trim().toUpperCase();
  const agendamento = db.agendamentos.find(a => a.id === req.params.id && a.telefone === telefone && String(a.codigo || '').toUpperCase() === codigo);
  if (!agendamento) return res.status(404).json({ success: false, error: 'Agendamento nao encontrado.' });
  agendamento.status = 'cancelado';
  agendamento.atualizado_em = new Date().toISOString();
  saveDb();
  res.json({ success: true, data: publicAppointment(agendamento) });
});

app.patch('/api/agendamentos/:id/reagendar', (req, res) => {
  const telefone = normalizePhone(req.body.telefone);
  const codigo = String(req.body.codigo || '').trim().toUpperCase();
  const agendamento = db.agendamentos.find(a => a.id === req.params.id && a.telefone === telefone && String(a.codigo || '').toUpperCase() === codigo);
  if (!agendamento) return res.status(404).json({ success: false, error: 'Agendamento nao encontrado.' });

  const profissional = findProfissional(req.body.profissionalId || agendamento.profissionalId);
  const data = String(req.body.data || '').trim();
  const horario = String(req.body.horario || '').trim();
  if (!profissional || !data || !horario || !slotsFor(profissional, data).includes(horario)) {
    return res.status(400).json({ success: false, error: 'Escolha profissional, data e horario validos.' });
  }
  if (isSlotTaken({ data, horario, profissionalId: profissional.id, ignoreId: agendamento.id })) {
    return res.status(409).json({ success: false, error: 'Horário já reservado. Escolha outro horário.' });
  }

  agendamento.data = data;
  agendamento.horario = horario;
  agendamento.profissionalId = profissional.id;
  agendamento.profissionalNome = profissional.nome;
  agendamento.status = 'pendente';
  agendamento.atualizado_em = new Date().toISOString();
  saveDb();
  res.json({ success: true, data: publicAppointment(agendamento) });
});

app.post('/api/admin/login', (req, res) => {
  res.status(410).json({
    success: false,
    error: 'Login admin legado desativado. Use Firebase Authentication no painel ADM.'
  });
});

app.get('/api/admin/me', requireAdmin, (req, res) => {
  res.json({ success: true, data: { role: 'admin' } });
});

app.get('/api/admin/agendamentos', requireAdmin, (req, res) => {
  const { data, status, profissionalId } = req.query;
  let results = db.agendamentos.map(publicAppointment);
  if (data) results = results.filter(a => a.data === data);
  if (status) results = results.filter(a => a.status === status);
  if (profissionalId) results = results.filter(a => a.profissionalId === profissionalId);
  results.sort((a, b) => {
    const dataA = String(a.data || '');
    const dataB = String(b.data || '');
    const horarioA = String(a.horario || '');
    const horarioB = String(b.horario || '');
    return dataA === dataB ? horarioA.localeCompare(horarioB) : dataA.localeCompare(dataB);
  });
  res.json({ success: true, data: results });
});

app.patch('/api/admin/agendamentos/:id', requireAdmin, (req, res) => {
  const agendamento = db.agendamentos.find(a => a.id === req.params.id);
  if (!agendamento) return res.status(404).json({ success: false, error: 'Agendamento nao encontrado.' });
  const allowedStatus = ['pendente', 'confirmado', 'cancelado', 'concluido'];
  if (req.body.status) {
    if (!allowedStatus.includes(req.body.status)) return res.status(400).json({ success: false, error: 'Status invalido.' });
    agendamento.status = req.body.status;
  }
  if (typeof req.body.lembreteEnviado === 'boolean') agendamento.lembreteEnviado = req.body.lembreteEnviado;
  agendamento.atualizado_em = new Date().toISOString();
  saveDb();
  res.json({ success: true, data: publicAppointment(agendamento) });
});

app.delete('/api/admin/agendamentos/:id', requireAdmin, (req, res) => {
  const index = db.agendamentos.findIndex(a => a.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Agendamento nao encontrado.' });
  db.agendamentos.splice(index, 1);
  saveDb();
  res.json({ success: true, message: 'Agendamento removido.' });
});

function makeCrud(collectionName, requiredFields) {
  app.get(`/api/admin/${collectionName}`, requireAdmin, (req, res) => {
    res.json({ success: true, data: db[collectionName] });
  });

  app.post(`/api/admin/${collectionName}`, requireAdmin, (req, res) => {
    const missing = requiredFields.find(field => !String(req.body[field] || '').trim());
    if (missing) return res.status(400).json({ success: false, error: `Campo obrigatorio: ${missing}.` });
    const item = { ...req.body, id: createId('', req.body.nome || req.body.titulo) };
    if (typeof item.ativo !== 'boolean') item.ativo = true;
    if (collectionName === 'profissionais' && !item.horarios) item.horarios = clone(defaultSchedule);
    db[collectionName].push(item);
    saveDb();
    res.status(201).json({ success: true, data: item });
  });

  app.patch(`/api/admin/${collectionName}/:id`, requireAdmin, (req, res) => {
    const index = db[collectionName].findIndex(item => item.id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, error: 'Registro nao encontrado.' });
    db[collectionName][index] = { ...db[collectionName][index], ...req.body, id: req.params.id };
    saveDb();
    res.json({ success: true, data: db[collectionName][index] });
  });

  app.delete(`/api/admin/${collectionName}/:id`, requireAdmin, (req, res) => {
    const index = db[collectionName].findIndex(item => item.id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, error: 'Registro nao encontrado.' });
    db[collectionName].splice(index, 1);
    saveDb();
    res.json({ success: true, message: 'Registro removido.' });
  });
}

makeCrud('servicos', ['nome', 'preco', 'duracao']);
makeCrud('profissionais', ['nome', 'especialidade']);
makeCrud('galeria', ['titulo', 'url']);

app.get('/api/admin/configuracoes', requireAdmin, (req, res) => {
  res.json({ success: true, data: db.configuracoes });
});

app.patch('/api/admin/configuracoes', requireAdmin, (req, res) => {
  db.configuracoes = { ...db.configuracoes, ...req.body };
  saveDb();
  res.json({ success: true, data: db.configuracoes });
});

app.listen(PORT, () => {
  console.log(`BLACKLINE API rodando na porta ${PORT} (JSON Storage)`);
});
