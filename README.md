# BLACKLINE Barber — Sistema de Agendamentos

Sistema completo com frontend e API REST para gerenciamento de agendamentos.

## 🚀 Início Rápido

### Pré-requisitos
- Docker e Docker Compose instalados

### Rodar com Docker
```bash
docker compose up -d
```

O site estará disponível em: **http://localhost:8080**

A API estará em: **http://localhost:3001**

## 📁 Estrutura

```
blackline/
├── docker-compose.yml      # Orquestração dos containers
├── .env.example            # Variáveis de ambiente
├── .gitignore              # Arquivos ignorados no Git
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── server.js           # API Express + SQLite
└── frontend/
    ├── Dockerfile
    ├── index.html
    ├── admin.html
    ├── style.css
    ├── script.js
    └── nginx.conf
```

## 🔌 API — Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /health | Status da API |
| GET | /api/agendamentos | Listar todos agendamentos |
| GET | /api/agendamentos?data=YYYY-MM-DD | Filtrar por data |
| GET | /api/agendamentos/:id | Buscar agendamento |
| POST | /api/agendamentos | Criar agendamento |
| PATCH | /api/agendamentos/:id | Atualizar status |
| DELETE | /api/agendamentos/:id | Remover agendamento |
| GET | /api/horarios-disponiveis?data=YYYY-MM-DD | Horários livres |

### Exemplo — Criar agendamento
```bash
curl -X POST http://localhost:3001/api/agendamentos \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "João Silva",
    "telefone": "81999999999",
    "servico": "Combo Executivo",
    "data": "2026-06-10",
    "horario": "10:00",
    "observacoes": "Degradê + barba desenhada"
  }'
```

### Status disponíveis
- `pendente` (padrão)
- `confirmado`
- `cancelado`
- `concluido`

## 💾 Dados

Os agendamentos são salvos em SQLite no volume Docker `blackline-agendamentos`.
Os dados persistem mesmo após `docker compose down`.

Para remover os dados:
```bash
docker compose down -v
```

## 🛑 Parar o sistema
```bash
docker compose down
```

## 🔥 Desenvolvimento

O projeto suporta hot reload. Edite os arquivos e as mudanças são sincronizadas automaticamente:
- Backend: edite `backend/server.js`
- Frontend: edite arquivos em `frontend/`
