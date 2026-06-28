# BLACKLINE Barber - Sistema de Agendamentos

Site publico e painel administrativo para a BLACKLINE Barber. O frontend usa Firebase/Firestore como fonte principal de dados; `localStorage` e usado apenas como cache auxiliar dos ultimos agendamentos do proprio navegador.

## Rodar localmente

```bash
npm install
npm run dev
npm run build
```

O backend Express em `backend/` e legado para armazenamento JSON. Os endpoints publicos de agendamento foram desativados com HTTP 410; o fluxo seguro atual usa Firestore.

## Firebase

O Firebase e configurado em `frontend/firebase-config.js` via variaveis de ambiente do Vite. Crie `.env.local` a partir de `.env.example` e preencha os valores reais somente no ambiente local/deploy:

```text
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Variaveis `VITE_` ficam publicas no bundle final. A `apiKey` do Firebase no front-end nao e um segredo absoluto; restrinja a chave por dominio no Google Cloud Console e mantenha as regras do Firebase revisadas. Nunca coloque service account, private key, token secreto ou credencial sensivel em variaveis `VITE_`.

## Vercel

Cadastre as variaveis `VITE_FIREBASE_*` em `Settings` > `Environment Variables` na Vercel e faca novo deploy apos qualquer mudanca.

## Dados comerciais

Nome, WhatsApp, endereco, Instagram, links de reviews e mapa ficam centralizados em `frontend/blackline-config.js`. Como nao ha dados reais no repositorio, campos comerciais sensiveis ficam marcados como configuraveis.

## Colecoes Firestore

```text
agendamentos
consultasAgendamento
ocupacaoHorarios
servicos
profissionais
configuracoes
galeria
planos
```

- `agendamentos`: documento privado com PII do cliente. Leitura/listagem apenas para admin.
- `consultasAgendamento`: lookup por hash SHA-256 de WhatsApp + codigo. Permite `get` direto pelo cliente que conhece os dois dados, sem `list` publico.
- `ocupacaoHorarios`: documento minimo por slot (`profissionalId_data_horario`) para bloquear duplicidade sem expor PII.
- Colecoes de catalogo/configuracao: public-read e admin-write; nao armazene PII de clientes nelas.

## Publicar regras

Validar antes:

```bash
npx -y firebase-tools@latest deploy --only firestore:rules --dry-run --project blackline-93c09
```

Publicar quando estiver pronto:

```bash
npx -y firebase-tools@latest deploy --only firestore:rules --project blackline-93c09
```

As regras foram desenhadas para manter `agendamentos` privado, permitir criacao publica apenas em transacao com lookup e slots, bloquear update/delete publico direto e restringir o painel ao admin autorizado em `firestore.rules` e `frontend/blackline-config.js`.

## Admin

Ative no Firebase Authentication os provedores usados e configure o UID/e-mail admin em:

- `firestore.rules`
- `frontend/blackline-config.js`

Usuario autenticado sem permissao administrativa nao deve ver o painel nem carregar dados.
