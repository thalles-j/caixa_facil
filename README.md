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

Cada uma das três contas de demonstração recebe um catálogo com 30 itens,
clientes, fiados em diferentes situações, despesas fixas, movimentações e mais
de 15 fechamentos. Também são criados dados históricos de janeiro a abril para
testar filtros, paginação e relatórios. As credenciais são:

- `thalles@gmail.com` / `Teste123@`;
- `gustavo@gmail.com` / `Teste123@`;
- `marco@gmail.com` / `Teste123@`.

As operações autenticadas usam `withTenantTransaction` em
`backend/src/db.ts`, mantendo o tenant dentro da transação e garantindo as
políticas de RLS no pool do Neon.

## Recuperação de conta

Na tela de login, escolha **Esqueci minha senha** e informe o e-mail da conta.
O link gerado é válido por 30 minutos e só pode ser usado uma vez. Ao concluir
a troca, as sessões persistentes anteriores são revogadas.

Em desenvolvimento, a própria API devolve o token e a tela avança diretamente
para a definição da nova senha. Em produção, o endpoint já cria e protege o
token, mas o envio da URL por e-mail precisa ser conectado a um provedor no
bloco indicado em `backend/src/auth/routes.ts`. Nunca habilite a devolução do
token de desenvolvimento com `NODE_ENV=production`.

Antes de publicar esta versão, aplique o schema para criar os campos de
revogação de sessão:

```bash
npm run db:schema
```

## Validação

```bash
npm run lint
npm test
npm run build
npm run prisma:validate --workspace backend
```

Não há configuração de Docker local. O banco é remoto e gerenciado pelo fluxo
Prisma + Neon.
