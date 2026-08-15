# CaixaFácil

Aplicação organizada como um monorepo npm, com frontend e backend independentes.

## Estrutura

```text
.
├── .claude/
├── .github/workflows/
├── backend/
│   ├── prisma/
│   │   ├── migrations/0001_init/migration.sql
│   │   ├── schema.prisma
│   │   └── seed.js
│   ├── src/
│   │   ├── account/
│   │   ├── auth/
│   │   ├── business/
│   │   └── scripts/
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── docs/
│   ├── AUDITORIA.md
│   └── RELATORIO_CENTRAL_DE_AJUDA.md
├── frontend/
│   ├── public/
│   ├── src/
│   ├── .env.example
│   ├── package.json
│   └── vite.config.ts
├── package.json
└── package-lock.json
```

## Instalação

Uma única instalação na raiz prepara os dois workspaces:

```bash
npm install
```

Copie os exemplos de ambiente e preencha os segredos:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

O backend usa Neon Postgres. A URL pooled deve ficar em `DATABASE_URL`; uma
`DATABASE_URL_UNPOOLED` pode ser informada apenas para operações de schema.

## Desenvolvimento

```bash
npm run dev
```

Esse comando inicia os dois workspaces, com logs identificados e coloridos:

- `[FRONTEND]`: Vite em `http://localhost:5173`;
- `[BACKEND]`: API em `http://localhost:3000`.

Também é possível iniciar somente um lado com `npm run dev:frontend` ou
`npm run dev:backend`.

## Banco e Prisma

O modelo declarativo fica em `backend/prisma/schema.prisma`. A migration SQL
preserva recursos específicos do Postgres usados pelo projeto, como RLS,
triggers, views, índices parciais e extensões.

```bash
npm run db:schema
npm run db:seed
```

A seed é não destrutiva por padrão. Para recriar os dados de demonstração no
banco configurado, use explicitamente:

```bash
npm run db:seed -- --reset
```

Esse modo remove dados do banco apontado por `DATABASE_URL`; use somente em
desenvolvimento.

As operações autenticadas usam `withTenantTransaction` em
`backend/src/db.ts`, mantendo o tenant dentro da transação e garantindo as
políticas de RLS no pool do Neon.

## Validação

```bash
npm run lint
npm test
npm run build
npm run prisma:validate --workspace backend
```

Não há configuração de Docker local. O banco é remoto e gerenciado pelo fluxo
Prisma + Neon.
