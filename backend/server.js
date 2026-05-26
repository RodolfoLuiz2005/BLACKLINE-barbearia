const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'agendamentos.json');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Inicializar banco de dados JSON
let db = [];
if (fs.existsSync(DB_PATH)) {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    db = JSON.parse(data);
  } catch (err) {
    console.error('Erro ao ler o banco de dados:', err);
    db = [];
  }
} else {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function saveDb() {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// CORS — permite qualquer origem (necessário para dev local também)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Log de todas as requisições para facilitar debug
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, req.body || '');
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET all agendamentos
app.get('/api/agendamentos', (req, res) => {
  try {
    const { data, status } = req.query;
    let results = [...db];

    if (data) {
      results = results.filter(a => a.data === data);
    }
    if (status) {
      results = results.filter(a => a.status === status);
    }

    // Sort by data ASC, horario ASC
    results.sort((a, b) => {
      if (a.data === b.data) {
        return a.horario.localeCompare(b.horario);
      }
      return a.data.localeCompare(b.data);
    });

    res.json({ success: true, data: results });
  } catch (err) {
    console.error('ERRO:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single agendamento
app.get('/api/agendamentos/:id', (req, res) => {
  try {
    const row = db.find(a => a.id === parseInt(req.params.id));
    if (!row) return res.status(404).json({ success: false, error: 'Agendamento não encontrado' });
    res.json({ success: true, data: row });
  } catch (err) {
    console.error('ERRO:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST criar agendamento
app.post('/api/agendamentos', (req, res) => {
  try {
    const { nome, telefone, servico, data, horario, observacoes } = req.body;

    if (!nome || !telefone || !servico || !data || !horario) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: nome, telefone, servico, data, horario'
      });
    }

    // Check for conflicting time slot
    const conflict = db.find(
      a => a.data === data && a.horario === horario && a.status !== 'cancelado'
    );

    if (conflict) {
      return res.status(409).json({
        success: false,
        error: 'Horário já reservado. Escolha outro horário.'
      });
    }

    const nextId = db.length > 0 ? Math.max(...db.map(a => a.id)) + 1 : 1;
    
    const novoAgendamento = {
      id: nextId,
      nome,
      telefone: telefone.replace(/\D/g, ''),
      servico,
      data,
      horario,
      observacoes: observacoes || '',
      status: 'pendente',
      criado_em: new Date().toISOString()
    };

    db.push(novoAgendamento);
    saveDb();

    res.status(201).json({ success: true, data: novoAgendamento });
  } catch (err) {
    console.error('ERRO:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH atualizar status
app.patch('/api/agendamentos/:id', (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['pendente', 'confirmado', 'cancelado', 'concluido'];

    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, error: 'Status inválido' });
    }

    const index = db.findIndex(a => a.id === parseInt(req.params.id));
    
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Agendamento não encontrado' });
    }

    db[index].status = status;
    saveDb();

    res.json({ success: true, data: db[index] });
  } catch (err) {
    console.error('ERRO:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE agendamento
app.delete('/api/agendamentos/:id', (req, res) => {
  try {
    const index = db.findIndex(a => a.id === parseInt(req.params.id));
    
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Agendamento não encontrado' });
    }

    db.splice(index, 1);
    saveDb();

    res.json({ success: true, message: 'Agendamento removido' });
  } catch (err) {
    console.error('ERRO:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET horários disponíveis para uma data
app.get('/api/horarios-disponiveis', (req, res) => {
  try {
    const { data } = req.query;
    if (!data) return res.status(400).json({ success: false, error: 'Data obrigatória' });

    const date = new Date(data + 'T00:00:00');
    const dow = date.getDay();
    if (dow === 0) return res.json({ success: true, data: [] });
    const isSabado = dow === 6;
    const fimH = isSabado ? 12 : 18;

    const todos = [];
    for (let h = 8; h < fimH; h++) {
      todos.push(`${String(h).padStart(2, '0')}:00`);
      todos.push(`${String(h).padStart(2, '0')}:30`);
    }

    const ocupados = db
      .filter(a => a.data === data && a.status !== 'cancelado')
      .map(a => a.horario);

    const disponiveis = todos.filter(h => !ocupados.includes(h));
    res.json({ success: true, data: disponiveis });
  } catch (err) {
    console.error('ERRO:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🔥 BLACKLINE API rodando na porta ${PORT} (JSON Storage)`);
});
