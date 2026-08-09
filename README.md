# Meu Negocio no Bolso

## Banco PostgreSQL

O schema completo fica em [`server/sql/schema.sql`](server/sql/schema.sql) e e
aplicado automaticamente pela API na inicializacao. Ele inclui vendas e itens,
catalogo, clientes, despesas recorrentes, sessoes de caixa, fiado, relatorios,
indices compostos e Row Level Security por `user_id`.

Configure `DATABASE_URL` a partir de `server/.env.example`. No painel do Neon,
copie a URL pooled para essa variavel e mantenha `sslmode=require`. A variavel
`DATABASE_URL_UNPOOLED` e opcional; quando ausente, o comando de schema usa a
propria conexao pooled.

Antes de iniciar a aplicacao pela primeira vez, aplique o schema:

```bash
cd server
npm run db:schema
cd ..
npm run dev
```

O `npm run dev` da raiz inicia API e front-end juntos, informa as URLs no
terminal e encerra os dois processos com um unico `Ctrl+C`. Para executar apenas
um servico, use `npm run dev:web` ou `npm run dev:api`. As mensagens recebem os
prefixos `[FRONT]` e `[BACK]`; as portas `5173` e `3000` sao estritas, então uma
segunda execucao mostra qual processo ja esta ativo em vez de escolher outra
porta silenciosamente.

Por padrao, o Vite encaminha `/api` para `http://localhost:3000`, a mesma porta
definida no exemplo de `server/.env`.

Em producao, execute `npm run db:schema:prod` como etapa de release depois do
build. A API nao executa DDL automaticamente em producao, evitando que varias
instancias concorrentes disputem locks de schema no Neon.

### Dados de demonstracao

Com `DATABASE_URL` configurada, a seed cria duas contas com produtos, servicos,
clientes, despesas, sessoes de caixa e vendas a vista/fiado:

```bash
cd server
npm run seed
```

- `thalles@gmail.com` / `123456`
- `gustavo@gmail.com` / `123456`
- `marco@gmail.com` / `123456`

A seed e nao destrutiva: cria e popula somente contas ausentes. Se um dos
e-mails ja existir, seus dados e sua senha sao preservados. A senha curta existe
apenas para demonstracao e deve ser trocada fora do ambiente de desenvolvimento.

Para reiniciar integralmente o banco configurado e recriar os dados de
demonstracao com o schema atual, use o modo explicito `--reset`:

```bash
cd server
npm run seed -- --reset
```

Esse comando remove todas as contas e dados de negocio do banco apontado por
`DATABASE_URL`; use apenas em desenvolvimento.

Toda rota autenticada que consulta dados de negocio deve usar
`withTenantTransaction(userId, callback)` de `server/src/db.ts`. O helper define
`app.current_user_id` somente durante a transacao, requisito para que as policies
de RLS permitam acesso e para que uma conexao reutilizada pelo pool nao carregue
o tenant da requisicao anterior.

Venda `fiado` e registrada em `sales` + `credit_sales`, sem entrada em
`transactions`. Cada recebimento (inclusive parcial) e uma transaction com
`source = 'pagamento_fiado'`; um trigger atualiza a divida. Assim `daily_balance`
contabiliza somente dinheiro efetivamente recebido.

No Neon, a connection string usa a role proprietaria apenas para autenticar e
aplicar schema. Cada operacao de negocio executa `SET LOCAL ROLE
mnb_app_runtime`, uma role `NOBYPASSRLS`, garantindo que as policies sejam
aplicadas mesmo quando `neondb_owner` possui `BYPASSRLS`.
