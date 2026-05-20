const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'agendamentos.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Database setup
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS agendamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    telefone TEXT NOT NULL,
    servico TEXT NOT NULL,
    data TEXT NOT NULL,
    horario TEXT NOT NULL,
    observacoes TEXT DEFAULT '',
    status TEXT DEFAULT 'pendente',
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

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
    let query = 'SELECT * FROM agendamentos';
    const params = [];
    const conditions = [];

    if (data) {
      conditions.push('data = ?');
      params.push(data);
    }
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY data ASC, horario ASC';

    const rows = db.prepare(query).all(...params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('ERRO:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single agendamento
app.get('/api/agendamentos/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM agendamentos WHERE id = ?').get(req.params.id);
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
    const conflict = db.prepare(
      'SELECT id FROM agendamentos WHERE data = ? AND horario = ? AND status != ?'
    ).get(data, horario, 'cancelado');

    if (conflict) {
      return res.status(409).json({
        success: false,
        error: 'Horário já reservado. Escolha outro horário.'
      });
    }

    const result = db.prepare(`
      INSERT INTO agendamentos (nome, telefone, servico, data, horario, observacoes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(nome, telefone.replace(/\D/g, ''), servico, data, horario, observacoes || '');

    const created = db.prepare('SELECT * FROM agendamentos WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: created });
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

    const result = db.prepare(
      'UPDATE agendamentos SET status = ? WHERE id = ?'
    ).run(status, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Agendamento não encontrado' });
    }

    const updated = db.prepare('SELECT * FROM agendamentos WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('ERRO:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE agendamento
app.delete('/api/agendamentos/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM agendamentos WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Agendamento não encontrado' });
    }
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

    const ocupados = db.prepare(
      "SELECT horario FROM agendamentos WHERE data = ? AND status != 'cancelado'"
    ).all(data).map(r => r.horario);

    const disponiveis = todos.filter(h => !ocupados.includes(h));
    res.json({ success: true, data: disponiveis });
  } catch (err) {
    console.error('ERRO:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🔥 BLACKLINE API rodando na porta ${PORT}`);
});
