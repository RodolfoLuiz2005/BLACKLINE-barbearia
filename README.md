# BLACKLINE Barber - Sistema de Agendamentos

Site publico e painel administrativo para a BLACKLINE Barber. O frontend usa Firebase/Firestore como fonte principal de dados.

## Rodar localmente

Instale as dependencias e rode o servidor do Vite:

```bash
npm install
npm run dev
```

O backend Express em `backend/` e legado para armazenamento JSON e nao e usado pelo fluxo Firebase atual.

## Firebase

O Firebase e configurado em `frontend/firebase-config.js` via variaveis de ambiente do Vite. Crie um arquivo `.env.local` a partir de `.env.example` e preencha os valores reais somente no ambiente local/deploy:

```text
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Variaveis `VITE_` ficam publicas no bundle final. A `apiKey` do Firebase no front-end nao e um segredo absoluto; a seguranca real depende de restricoes da chave no Google Cloud e das regras do Firebase. Nao coloque service account, private key, token secreto ou qualquer credencial sensivel em variaveis `VITE_`.

## Como configurar variaveis na Vercel

No painel da Vercel, abra o projeto e acesse `Settings` > `Environment Variables`. Cadastre as variaveis abaixo para os ambientes usados pelo deploy, sem commitar valores reais no repositorio:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

Depois de alterar variaveis, faca um novo deploy para o Vite embutir os valores publicos no bundle final.

Ative no console do Firebase:

- Firestore Database.
- Firebase Authentication com provedor Email/Senha.
- Um usuario admin para acessar `admin.html`.
- UID admin autorizado configurado em `firestore.rules`. Confirme que ele corresponde ao usuario admin real do Firebase Auth.

## Colecoes usadas

```text
servicos
profissionais
agendamentos
configuracoes
galeria
planos
```

`configuracoes` usa o documento `barbearia`.

Campos principais:

- `servicos`: `nome`, `descricao`, `preco`, `duracao`, `ativo`, `ordem`, `criadoEm`, `atualizadoEm`.
- `profissionais`: `nome`, `especialidade`, `foto`, `ativo`, `horariosAtendimento`, `criadoEm`, `atualizadoEm`.
- `agendamentos`: `codigo`, `nome`, `telefone`, `servico`, `servicoId`, `profissionalId`, `profissionalNome`, `data`, `horario`, `observacoes`, `status`, `criadoEm`, `atualizadoEm`.
- `configuracoes/barbearia`: `nome`, `telefone`, `whatsapp`, redes sociais, endereco, mapa, Google e horario.
- `galeria`: `titulo`, `imagemUrl`, `categoria`, `ativo`, `criadoEm`, `atualizadoEm`.
- `planos`: `nome`, `preco`, `beneficios`, `ativo`, `criadoEm`, `atualizadoEm`.

## Regras Firestore

Publique o arquivo `firestore.rules` pelo Firebase Console ou Firebase CLI.

As regras atuais protegem `agendamentos` para leitura, edicao e exclusao somente pelo UID admin autorizado. O cliente publico consegue criar agendamentos, mas nao consegue listar dados de clientes.

## Seed

Depois de entrar no ADM com Firebase Auth, abra o console do navegador e execute:

```js
seedFirebaseBlackline()
```

Isso cadastra dados iniciais em `servicos`, `profissionais`, `galeria`, `planos` e `configuracoes/barbearia`.

Para homologacao, tambem existem:

```js
seedAgendamentosTesteBlackline()
testarDuplicidadeAgendamentoBlackline()
```

Nao execute essas funcoes em producao.
