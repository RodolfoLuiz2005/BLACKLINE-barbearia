# BLACKLINE Barber - Sistema de Agendamentos

Site publico, painel administrativo e API Express para a BLACKLINE Barber.

## O que mudou

- A pagina publica nao exibe mais link direto para o painel admin.
- A fonte unica de dados dos agendamentos agora e o backend Express com JSON local.
- O admin usa login via API e token assinado. A senha nao fica no frontend.
- Horarios ocupados sao bloqueados por data, horario e profissional, ignorando apenas agendamentos cancelados.
- Clientes podem consultar, cancelar e reagendar usando WhatsApp + codigo do agendamento.
- Servicos, profissionais, galeria, redes sociais, mapa, Google e planos mensais sao configuraveis pelo admin.
- WhatsApp de confirmacao e lembrete usa link com mensagem pronta.

## Variaveis de ambiente

Copie `.env.example` e configure:

```bash
PORT=3001
DB_PATH=/app/data/agendamentos.json
ADMIN_PASSWORD=sua-senha-forte
TOKEN_SECRET=um-segredo-longo-e-aleatorio
```

Em desenvolvimento, se nada for configurado, a senha padrao e `blackline2026`. Troque isso antes de publicar.

## Rodar com Docker

```bash
docker compose up -d
```

Site: `http://localhost:8080`

API: `http://localhost:3001`

Admin: `http://localhost:8080/admin.html`

## Rodar localmente

```bash
cd backend
npm install
npm start
```

Teste a API antes de abrir o site:

```text
http://localhost:3001/health
```

Depois abra `frontend/index.html` com Live Server, por exemplo:

```text
http://127.0.0.1:5501/frontend/index.html
```

Quando o frontend estiver em `localhost`, `127.0.0.1` ou aberto via arquivo, ele chama a API em `http://localhost:3001`. Em producao, a URL fica relativa ao mesmo dominio.

Importante: para carregar servicos, profissionais, horarios e salvar agendamentos, mantenha o backend rodando antes de abrir ou recarregar o site no Live Server.

## API publica

| Metodo | Rota | Uso |
| --- | --- | --- |
| GET | `/health` | Status da API |
| GET | `/api/public-data` | Servicos ativos, profissionais ativos, galeria e configuracoes |
| GET | `/api/servicos` | Servicos ativos |
| GET | `/api/profissionais` | Profissionais ativos |
| GET | `/api/planos` | Planos mensais ativos |
| GET | `/api/galeria` | Imagens ativas da galeria |
| GET | `/api/configuracoes` | Redes sociais, endereco, mapa, WhatsApp e Google |
| GET | `/api/horarios-disponiveis?data=YYYY-MM-DD` | Slots livres |
| GET | `/api/agendamentos` | Listar agendamentos |
| POST | `/api/agendamentos` | Criar agendamento |
| PATCH | `/api/agendamentos/:id` | Atualizar status do agendamento |
| DELETE | `/api/agendamentos/:id` | Excluir agendamento |
| POST | `/api/agendamentos/consultar` | Consultar por telefone + codigo |
| PATCH | `/api/agendamentos/:id/cancelar` | Cancelar por telefone + codigo |
| PATCH | `/api/agendamentos/:id/reagendar` | Reagendar com nova validacao de disponibilidade |

## API admin

Todas as rotas abaixo exigem `Authorization: Bearer <token>`, exceto login.

| Metodo | Rota | Uso |
| --- | --- | --- |
| POST | `/api/admin/login` | Login admin |
| GET | `/api/admin/agendamentos` | Listar agendamentos |
| PATCH | `/api/admin/agendamentos/:id` | Alterar status ou marcar lembrete |
| DELETE | `/api/admin/agendamentos/:id` | Remover agendamento |
| GET/POST/PATCH/DELETE | `/api/admin/servicos` | CRUD de servicos |
| GET/POST/PATCH/DELETE | `/api/admin/profissionais` | CRUD de barbeiros |
| GET/POST/PATCH/DELETE | `/api/admin/galeria` | CRUD de imagens por URL |
| GET/PATCH | `/api/admin/configuracoes` | Redes, mapa, Google e planos |

## WhatsApp e Google

O sistema prepara mensagens para abrir no WhatsApp. Envio automatico real antes do horario exige integracao externa, como WhatsApp Business Cloud API, Z-API, Twilio, Evolution API ou servico similar.

A secao Google usa link configuravel. O projeto nao inventa avaliacoes reais nem usa fotos aleatorias como depoimentos.

## Dados

Os dados ficam em JSON no caminho de `DB_PATH`. A estrutura inclui:

- `agendamentos`
- `servicos`
- `profissionais`
- `galeria`
- `configuracoes`

No Docker, o volume `blackline-agendamentos` mantem o arquivo mesmo apos reiniciar os containers.
