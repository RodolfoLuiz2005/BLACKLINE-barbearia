# BLACKLINE Barber - Sistema de Agendamentos

Site publico e painel administrativo para a BLACKLINE Barber. O frontend usa Firebase/Firestore como fonte principal de dados.

## Rodar localmente

Abra a pasta `frontend` por um servidor estatico, por exemplo com Live Server:

```text
http://127.0.0.1:5501/frontend/index.html
http://127.0.0.1:5501/frontend/admin.html
```

O backend Express em `backend/` e legado para armazenamento JSON e nao e usado pelo fluxo Firebase atual.

## Firebase

O projeto configurado em `frontend/firebase-config.js` e `blackline-93c09`.

Ative no console do Firebase:

- Firestore Database.
- Firebase Authentication com provedor Email/Senha.
- Um usuario admin para acessar `admin.html`.
- UID admin configurado em `frontend/admin.js` e `firestore.rules`: `VaHoF4WF6tWsCImK03tz9HljO6x2`.

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
