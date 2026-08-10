# CaixaFácil

Aplicação de gestão de caixa organizada como um monorepo npm: React/Vite no
frontend e uma API Express/PostgreSQL no backend.

## Requisitos

- Node.js 22.12 ou superior
- Um banco PostgreSQL no Neon

## Instalação

Na raiz do projeto, um único comando instala as dependências da raiz e dos dois
workspaces:

```bash
npm install
```

Crie os arquivos locais de ambiente a partir dos exemplos:

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

Preencha `backend/.env` com a connection string pooled do Neon e gere segredos
JWT diferentes. Em desenvolvimento, `VITE_API_URL=/api` usa o proxy do Vite.

## Banco de dados

O modelo declarativo está em
[`backend/prisma/schema.prisma`](backend/prisma/schema.prisma). A migração inicial
preserva as regras PostgreSQL específicas do projeto, incluindo RLS por usuário,
triggers de integridade, views de relatório e a função atômica de fechamento de
caixa.

Valide e aplique as migrações no Neon:

```bash
npm run prisma:validate
npm run prisma:deploy
```

Para criar dados de demonstração:

```bash
npm run seed
```

A seed é não destrutiva e ignora contas que já existem. O modo abaixo apaga os
dados do banco configurado antes de recriá-los; use somente em desenvolvimento:

```bash
npm run seed:reset
```

Contas de demonstração (senha `123456`):

- `thalles@gmail.com`
- `gustavo@gmail.com`
- `marco@gmail.com`

## Desenvolvimento

Inicie frontend e backend juntos:

```bash
npm run dev
```

Os processos aparecem como `[FRONTEND]` em ciano e `[BACKEND]` em magenta. O
frontend só é iniciado depois que o health check da API responde, evitando erros
de proxy durante a subida. Para executar apenas um deles:

```bash
npm run dev:frontend
npm run dev:backend
```

Endereços padrão:

- Frontend: `http://localhost:5173`
- API: `http://localhost:3000`
- Health check: `http://localhost:3000/api/health`

## Qualidade e build

Os comandos da raiz percorrem os workspaces automaticamente:

```bash
npm run lint
npm test
npm run build
```

Em produção, execute `npm run prisma:deploy` antes de iniciar a API com
`npm run start --workspace backend`.

## Estrutura

```text
.
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   └── seed.js
│   └── src/
│       ├── config/
│       ├── routes/
│       └── services/
├── frontend/
│   ├── public/
│   └── src/
│       ├── components/
│       ├── context/
│       ├── lib/
│       └── pages/
└── package.json
```

Toda consulta autenticada do backend deve usar
`withTenantTransaction(userId, callback)`, em `backend/src/config/database.ts`.
O helper define o tenant somente durante a transação e troca para a role
`mnb_app_runtime`, garantindo a aplicação das policies de RLS no Neon.
