# BLACKLINE Barber - Sistema de Agendamentos

Site publico e painel administrativo para a BLACKLINE Barber, com Firestore como banco principal do frontend.

## O que mudou

- A pagina publica nao exibe mais link direto para o painel admin.
- A fonte unica de dados dos agendamentos agora e o Firebase/Firestore na colecao `agendamentos`.
- O admin usa login local de teste no frontend. Para producao, use Firebase Auth ou uma camada segura propria.
- Horarios ocupados sao bloqueados por data, horario e profissional, ignorando apenas agendamentos cancelados.
- Clientes podem consultar, cancelar e reagendar usando WhatsApp + codigo do agendamento.
- Servicos, profissionais, galeria, redes sociais, mapa, Google e planos mensais sao carregados e salvos no Firestore.
- WhatsApp de confirmacao e lembrete usa link com mensagem pronta.

## Backend legado

O backend Express ainda existe no projeto, mas o fluxo atual do frontend nao usa backend para agendamentos, servicos, profissionais, planos, galeria ou configuracoes.

## Variaveis de ambiente do backend legado

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

Importante: os agendamentos do site publico e do painel ADM usam Firebase/Firestore, nao a API do backend. O projeto Firebase configurado e `blackline-93c09`, em `frontend/firebase-config.js`.

## Firebase / Firestore

### Criar e configurar o projeto

1. Crie ou abra o projeto Firebase `blackline-93c09`.
2. Ative o Firestore Database no modo de teste durante a homologacao.
3. Copie a configuracao Web do app Firebase.
4. Cole os valores em `frontend/firebase-config.js`.
5. Abra o site via Live Server, por exemplo `http://127.0.0.1:5501/frontend/index.html`.

### Colecoes usadas

Os dados do frontend usam estas colecoes:

```text
agendamentos
servicos
profissionais
planos
galeria
configuracoes/barbearia
```

Campos principais:

- `agendamentos`: `nome`, `telefone`, `servico`, `servicoId`, `profissionalId`, `profissionalNome`, `data`, `horario`, `observacoes`, `status`, `criadoEm`, `atualizadoEm`
- `servicos`: `nome`, `descricao`, `preco`, `duracao`, `categoria`, `ativo`, `criadoEm`, `atualizadoEm`
- `profissionais`: `nome`, `especialidade`, `foto`, `ativo`, `horariosAtendimento`, `criadoEm`, `atualizadoEm`
- `configuracoes/barbearia`: `nome`, `telefone`, `whatsapp`, `instagram`, `endereco`, `googleMapsUrl`, `googleReviewUrl`, `horarioFuncionamento`
- `galeria`: `titulo`, `imagemUrl`, `categoria`, `ativo`, `criadoEm`
- `planos`: `nome`, `preco`, `beneficios`, `ativo`, `criadoEm`

### Regras temporarias para teste

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, create, update, delete: if true;
    }
  }
}
```

Essas regras sao apenas para teste local/homologacao. Nao use em producao, porque qualquer pessoa com acesso ao projeto web poderia ler, alterar ou excluir dados.

### Seed manual

Depois de fazer login no ADM, abra o console do navegador e execute manualmente:

```js
seedFirebaseBlackline()
```

Essa funcao cadastra dados iniciais em `servicos`, `profissionais`, `planos`, `galeria` e `configuracoes/barbearia`. Ela nao roda automaticamente ao abrir o site.

### Debug temporario

Na pagina publica, a funcao `testeFirestore()` fica disponivel no console do navegador apenas para validar a conexao local com o Firestore. Ela cria um agendamento de teste em `agendamentos` e lista a quantidade total de documentos. Nao use essa funcao como fluxo de producao.

### Teste cliente -> Firestore -> ADM

1. Abra `frontend/index.html`.
2. Crie um agendamento.
3. Verifique no Firebase Console se o documento apareceu em `agendamentos`.
4. Abra `frontend/admin.html`.
5. Faca login.
6. Confira se o agendamento aparece.
7. Altere o status para confirmado, cancelado e concluido.
8. Confira no Firebase Console se o status mudou.
9. Exclua pelo ADM e confira se o documento saiu do Firestore.
10. Tente agendar o mesmo profissional, data e horario duas vezes; a segunda tentativa deve bloquear.

## API publica

As rotas abaixo continuam documentadas para o backend legado, mas o fluxo atual de agendamentos no frontend usa Firebase/Firestore diretamente.

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
