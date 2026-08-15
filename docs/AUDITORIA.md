# Relatório de Auditoria do Projeto

## 1. Resumo executivo

O projeto é um app de gestão financeira/operacional para pequenos negócios (padaria, loja, salão, oficina), 100% client-side: React + localStorage, sem backend, sem banco, sem API. O código tem uma base razoável (TypeScript estrito, modelo de domínio coerente, boa separação `lib/context/pages`), e recebeu recentemente um redesign visual completo. Porém a auditoria encontrou **dois bugs de dados críticos no núcleo financeiro** (parsing de valores monetários e cálculo de "hoje"), **ausência total de edição/exclusão de lançamentos** (uma vez lançado, um erro de digitação é permanente), **zero testes, zero CI, script de lint quebrado**, e **nenhuma camada de autenticação real** (a tela de login é decorativa, por decisão de produto, mas o efeito prático é que qualquer pessoa com acesso ao navegador acessa tudo).

- **Nota geral do projeto: 5/10** — base de código organizada e um produto com proposta clara, mas com defeitos centrais não triviais.
- **Prontidão para produção: 2/10** — não deve ser usado hoje para controlar dinheiro real de um negócio.
- **Principais riscos**: (1) valores digitados com separador de milhar falham silenciosamente; (2) vendas registradas à noite (a partir de ~21h no horário de Brasília) são gravadas com a data do dia seguinte; (3) não existe forma de corrigir ou apagar uma venda/lançamento errado; (4) usar o app em duas abas do navegador pode apagar dados silenciosamente.
- **Próximos passos**: corrigir os dois bugs de data/dinheiro (baixo esforço, altíssimo impacto), adicionar CRUD completo de vendas/lançamentos/contas, escrever testes para as funções financeiras, e só depois pensar em produção real.

## 2. Entendimento do projeto

- **Objetivo**: ferramenta de "caixa de bolso" para microempreendedores brasileiros — registrar vendas (à vista/fiado), controlar catálogo/estoque, contas a pagar/receber e ver um painel diário/semanal.
- **Stack confirmada**: React 19, TypeScript 5.7 (`strict`), Vite 6, Tailwind CSS v4, React Router v7, `@phosphor-icons/react`. Sem backend, sem banco de dados, sem `.env`, sem chamadas de rede (`grep` por `fetch`/`axios`/`process.env` em `src` não retornou nenhuma ocorrência).
- **Persistência**: `localStorage`, chave única `mnb-data-v1` (`src/lib/storage.ts`).
- **Módulos principais**: `context/AppDataContext.tsx` (estado global + toda a lógica de cálculo financeiro), `pages/` (Landing, Login, Onboarding, Dashboard, Caixa, Catalogo, Financas, Configuracoes), `components/` (Layout, BottomNav, Modal, FabButton), `lib/` (format, storage, theme, categoryThemes).
- **Fluxos principais**: `Landing → Onboarding → Dashboard` (primeiro uso) ou `Login → Dashboard` (retorno); `Caixa` (registrar venda) → gera `Venda` e, se fiado, uma `Conta` a receber automaticamente; `Catalogo` (CRUD de produtos/serviços); `Financas` (contas a pagar/receber, dar baixa); `Configuracoes` (editar negócio, tema, despesas fixas, "zerar dados").

## 3. O que já está funcional

- Onboarding completo (4 passos) grava `CompanyConfig` corretamente e redireciona para o Dashboard — testado ponta a ponta nesta sessão.
- Registro de venda no Caixa (`src/pages/Caixa.tsx`, `finalizarVenda`) debita estoque (`Math.max(0, ...)`, nunca fica negativo) e, para forma `fiado`, cria automaticamente uma `Conta` a receber vinculada (`addVenda` em `AppDataContext.tsx`, campo `origemVendaId`) — regra de negócio real e coerente.
- CRUD completo de Produto/Serviço (`Catalogo.tsx` + `addProduto/atualizarProduto/removerProduto` no contexto).
- Contas a pagar/receber: criar e dar baixa (`marcarContaQuitada`) funcionam; alertas de "vencendo em breve" e "vencidas" são calculados corretamente em `AppDataContext.tsx` (`contasVencendoEmBreve`, `contasVencidas`, testado via `diffDias`).
- Painel (Dashboard) agrega saldo, vendas/despesas do período, lucro estimado e histórico de 7 dias — os `useMemo` estão corretos *assumindo* que a data de referência (`hoje`) esteja certa (ver Problema #2).
- Alternância de modo escuro persistida em `localStorage` (`mnb-theme`) e sincronizada entre header e Configurações via `useDarkMode` (`src/lib/theme.ts`).
- `tsc -b` e `npm run build` executam sem erro (verificado nesta sessão, build gera `dist/` com sucesso).
- Tratamento defensivo de `localStorage` indisponível (`try/catch` em `getInitialDark`/`applyDarkPreference`, `loadData`/`saveData`).

## 4. O que está faltando para ficar 100% funcional

- Corrigir o parser de valores monetários para aceitar o formato BR completo (milhar + decimal).
- Corrigir o cálculo de "hoje" para usar horário local, não UTC.
- CRUD de correção: editar/excluir uma `Venda`, um `LancamentoManual` ou uma `Conta` já criada.
- Feedback de erro visível nos formulários (hoje, uma validação falha e nada acontece na tela).
- Alguma forma de backup/exportação de dados antes de ações destrutivas.
- Testes automatizados cobrindo os cálculos financeiros.
- Lint funcional e um pipeline de CI mínimo.
- Um caminho de deploy definido (hoje não existe nenhum).
- Decisão de produto explícita sobre autenticação: manter como está por documentação clara na UI, ou implementar de verdade se o app for usado por mais de uma pessoa/dispositivo.

## 5. Problemas encontrados

### [CRÍTICO] Valores monetários com separador de milhar falham silenciosamente
- Status: Confirmado (reproduzido via execução direta)
- Área: frontend / lógica de negócio
- Evidência:
  - arquivo: `src/lib/format.ts`
  - função: `parseMoney(raw: string)` → `Number(raw.trim().replace(',', '.'))`
  - descrição: `.replace(',', '.')` troca apenas a primeira vírgula. Para "1.500,00" (formato BR com milhar), o resultado é a string `"1.500.00"`, que `Number()` converte em `NaN`. Testado: `parseMoney("1.500,00")` → `NaN`; `parseMoney("25,00")` → `25` (funciona só sem milhar).
  - Usado em todo campo de valor do app: `Caixa.tsx` (venda avulsa), `Dashboard.tsx` (novo lançamento), `Catalogo.tsx` (preço/custo), `Financas.tsx` (despesa/entrada), `Onboarding.tsx` e `Configuracoes.tsx` (despesa fixa, meta diária).
- Impacto: qualquer valor ≥ R$ 1.000,00 digitado no formato brasileiro padrão falha ao salvar.
- Consequência para o usuário/negócio: como todo call-site faz `if (!valor || valor <= 0) return;` e `Boolean(NaN)` é `false`, o app simplesmente não faz nada — sem mensagem de erro. O usuário acha que o botão está quebrado, tenta de novo, e uma venda/despesa real de valor alto nunca entra no sistema.
- Como corrigir: reescrever `parseMoney` para remover separadores de milhar antes de trocar o decimal (ex.: remover todo `.` seguido de 3 dígitos, ou usar `Intl.NumberFormat`/parse dedicado), e adicionar teste unitário cobrindo "1.500,00", "150,50", "150", "abc".
- Esforço estimado: Baixo.

### [CRÍTICO] "Hoje" é calculado em UTC, não no horário local
- Status: Confirmado (reproduzido via execução direta)
- Área: frontend / lógica de negócio
- Evidência:
  - arquivo: `src/lib/format.ts`
  - função: `todayISO()` → `new Date().toISOString().slice(0, 10)`
  - descrição: `toISOString()` sempre retorna a data em UTC. Testado: às 21h30 no horário de Brasília (UTC-3) de 03/08, `todayISO()` retorna `"2026-08-04"` — o dia seguinte. O próprio arquivo mostra que a equipe já conhecia essa classe de bug: `formatDate()`, na mesma arquivo, tem o comentário `// parse as local time — new Date(iso) treats a date-only string as UTC midnight, which shifts a day back...` e foi corrigida; `todayISO()` não recebeu a correção equivalente.
  - `hoje = todayISO()` é usado em quase toda a lógica de `AppDataContext.tsx` (`vendasHoje`, `despesasHoje`, `contasAPagarHoje`, `contasQuitadasHoje`, `resumoPeriodo`, base de `vendasUltimos7Dias`) e como valor padrão de campos de data em `Caixa.tsx`, `Dashboard.tsx`, `Financas.tsx`.
  - Contraste direto e visível: `src/components/Layout.tsx` mostra a data do cabeçalho via `Intl.DateTimeFormat('pt-BR', {...})` **sem** fuso explícito — ou seja, usa o horário local corretamente. Isso cria uma inconsistência que o próprio usuário pode perceber: o cabeçalho mostra "hoje" corretamente, mas a venda é gravada com a data de amanhã.
- Impacto: qualquer negócio que opere após ~21h (padaria, salão, oficina — o público-alvo do app) tem vendas do fim do dia lançadas no dia errado, distorcendo saldo, "vendas hoje", gráfico dos últimos 7 dias e vencimento de contas.
- Consequência para o usuário/negócio: fechamento de caixa incorreto, decisões erradas sobre desempenho diário.
- Como corrigir: construir a data local manualmente (`` `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` ``) em vez de `toISOString()`.
- Esforço estimado: Baixo.

### [ALTO] Não existe edição ou exclusão de vendas, lançamentos manuais ou contas
- Status: Confirmado
- Área: frontend / arquitetura de dados
- Evidência:
  - arquivo: `src/context/AppDataContext.tsx`, interface `AppDataContextValue`
  - descrição: as únicas operações expostas são `addVenda`, `addConta`, `marcarContaQuitada`, `addLancamentoManual`. Não existe `removerVenda`, `editarVenda`, `removerConta`, `editarConta` nem `removerLancamentoManual`. Apenas `Produto` tem CRUD completo (`addProduto/atualizarProduto/removerProduto`). Confirmado também na UI: `Financas.tsx` lista `lancamentosDaAba` e `contasDaAba` sem nenhum botão de editar/excluir (só "Dar Baixa"); `Dashboard.tsx` lista `movimentacoesHoje` apenas para leitura.
- Impacto: um erro de digitação em valor, descrição ou data (agravado pelos dois bugs acima) é permanente. A única saída é "Zerar Dados do App", que apaga tudo.
- Consequência para o usuário/negócio: em um app cujo propósito é controle financeiro confiável, a impossibilidade de corrigir um lançamento errado é um bloqueador de uso real, não um detalhe.
- Como corrigir: adicionar `removerVenda`/`removerLancamentoManual`/`removerConta`/`editarConta` no contexto e as respectivas ações na UI (Financas e Dashboard), com confirmação para exclusão.
- Esforço estimado: Médio.

### [ALTO] Risco de perda de dados entre abas do navegador
- Status: Confirmado (por leitura de código; reprodução manual em duas abas não foi executada nesta sessão)
- Área: frontend / arquitetura de estado
- Evidência:
  - arquivo: `src/context/AppDataContext.tsx`
  - trecho: `const [data, setData] = useState<AppData>(() => loadData());` (carrega uma vez, na montagem) e `useEffect(() => { saveData(data); }, [data]);` (grava a cada mudança). Não há `window.addEventListener('storage', ...)` em lugar nenhum do projeto.
  - descrição: se o app for aberto em duas abas/janelas, cada uma mantém sua própria cópia de `data` em memória, carregada apenas uma vez. Uma mudança feita na Aba A é salva no `localStorage`, mas a Aba B não é notificada; a próxima mudança feita na Aba B sobrescreve o `localStorage` com sua cópia desatualizada, apagando silenciosamente o que a Aba A havia salvo.
- Impacto: perda de dados sem qualquer aviso, em um cenário comum (usuário abre o app em nova aba/janela sem perceber que já estava aberto em outra).
- Consequência para o usuário/negócio: vendas/lançamentos somem sem explicação.
- Como corrigir: escutar o evento `storage` e recarregar `data` quando outra aba gravar, ou centralizar leitura/escrita evitando estado duplicado entre abas.
- Esforço estimado: Médio.

### [ALTO] Nenhuma autenticação ou autorização real
- Status: Confirmado
- Área: segurança / backend (inexistente)
- Evidência:
  - arquivo: `src/pages/Login.tsx`, função `entrar()`
  - descrição: `entrar()` faz `e.preventDefault(); navigate(onboardingConcluido ? '/' : '/onboarding');` — nenhum valor de e-mail/senha é lido, validado ou persistido. É explicitamente rotulado na própria tela como "Login de demonstração". Não existe sessão, token, cookie ou qualquer controle de acesso em nenhum lugar do código (`grep` por sessão/token/cookie não retornou nada).
- Impacto: qualquer pessoa com acesso ao navegador/dispositivo acessa e altera todos os dados do negócio; não há separação entre usuários nem multi-dispositivo.
- Consequência para o usuário/negócio: aceitável apenas enquanto o produto for um protótipo de uso pessoal single-device; inviável se mais de uma pessoa (dono + funcionário, por exemplo) precisar de acesso controlado.
- Como corrigir: decisão de produto primeiro — se o roadmap inclui multiusuário/backend, isso implica desenhar auth de verdade (ex.: e-mail+senha com backend, ou um serviço de auth gerenciado); se o app permanece single-device, deixar claro isso na documentação do produto.
- Esforço estimado: Alto (se decidir implementar auth real).

### [ALTO] Zero testes automatizados
- Status: Confirmado
- Área: testes
- Evidência: nenhum framework de teste nas dependências (`package.json`), nenhum arquivo `*.test.*`/`*.spec.*` encontrado em todo o repositório.
- Impacto: os dois bugs críticos acima (#1 e #2) são exatamente o tipo de regressão que um teste unitário simples de `parseMoney`/`todayISO` capturaria antes de chegar ao usuário.
- Consequência para o usuário/negócio: qualquer alteração futura em `AppDataContext.tsx` (o núcleo financeiro) pode quebrar cálculos sem que ninguém perceba até um usuário reportar.
- Como corrigir: introduzir Vitest, começar pelos módulos puros (`format.ts`) e pelas funções de agregação de `AppDataContext.tsx` (idealmente extraídas para funções puras testáveis fora do componente React).
- Esforço estimado: Médio.

### [ALTO] Sem backup/exportação; wipe de dados é irreversível
- Status: Confirmado
- Área: qualidade / dados
- Evidência: `src/pages/Configuracoes.tsx`, botão "Zerar Dados do App" → `if (confirm(...)) resetData();`; `resetData` em `AppDataContext.tsx` substitui `data` por `emptyData` sem qualquer cópia prévia. Não existe nenhuma função de exportar (JSON/CSV) em nenhum arquivo do projeto.
- Impacto: um clique + uma confirmação de navegador apagam permanentemente todo o histórico financeiro do negócio.
- Consequência para o usuário/negócio: perda total de dados sem possibilidade de recuperação.
- Como corrigir: adicionar exportação de dados (download JSON) e, idealmente, gerar automaticamente um backup antes de `resetData()`.
- Esforço estimado: Baixo (exportação) / Médio (se incluir importação).

### [MÉDIO] Script de lint quebrado
- Status: Confirmado (reproduzido via execução)
- Área: qualidade / build
- Evidência: `package.json` define `"lint": "eslint ."`; `eslint` não consta em `devDependencies`; não existe `eslint.config.*` no repositório. Executar `npm run lint` retorna `'eslint' não é reconhecido...`.
- Impacto: não há verificação estática de qualidade de código em nenhum momento do fluxo de desenvolvimento.
- Como corrigir: instalar `eslint` + config compatível com Flat Config (ESLint 9) e plugins de React/TS, ou remover o script se não for prioridade agora.
- Esforço estimado: Baixo.

### [MÉDIO] Nenhuma pipeline de CI
- Status: Confirmado
- Área: infra
- Evidência: ausência de `.github/workflows` (e de qualquer outro arquivo de CI) no repositório.
- Impacto: `tsc`/`build` só são verificados manualmente (como nesta sessão); um PR com erro de tipo pode ser mesclado sem detecção automática.
- Como corrigir: workflow simples de GitHub Actions rodando `npm ci && npm run build` em cada PR.
- Esforço estimado: Baixo.

### [MÉDIO] Ausência de Error Boundary
- Status: Confirmado
- Área: frontend / confiabilidade
- Evidência: nenhuma ocorrência de `componentDidCatch`/`ErrorBoundary` em `src`.
- Impacto: qualquer exceção não tratada em qualquer componente (por exemplo, dado corrompido escapando da validação de `loadData`) derruba a tela inteira sem UI de recuperação.
- Como corrigir: envolver `<App />` em um Error Boundary com uma tela de fallback.
- Esforço estimado: Baixo.

### [MÉDIO] Migração de esquema parcial e falha silenciosa ao carregar dados corrompidos
- Status: Confirmado
- Área: dados / confiabilidade
- Evidência: `src/lib/storage.ts`, `loadData()`. Só há tratamento de retrocompatibilidade para `produtos` (`type`/`quantidade`/`quantidadeMinima`); não há campo de versão de schema. O `try { ... } catch { return emptyData; }` envolve toda a função — se `parsed.produtos.map(...)` (ou qualquer parte do parse) lançar exceção por um formato inesperado, a função devolve `emptyData` silenciosamente, sem avisar o usuário que os dados originais ainda estão no `localStorage`, apenas não foram carregados.
- Impacto: um usuário pode abrir o app após uma atualização e ver "tudo zerado" sem entender que os dados tecnicamente ainda existem no armazenamento, apenas não foram lidos.
- Como corrigir: adicionar um campo de versão ao objeto salvo, migrações explícitas por versão, e diferenciar "sem dados" de "erro ao ler dados" na UI.
- Esforço estimado: Médio.

### [MÉDIO] Validação de formulário falha silenciosamente (sem feedback ao usuário)
- Status: Confirmado
- Área: frontend / UX
- Evidência: `src/pages/Catalogo.tsx`, `handleSubmit`: `if (!nome || precoVenda <= 0) return;` sem exibir nenhuma mensagem. Padrão se repete em `Financas.tsx` (`handleSubmit`, `handleEntradaSubmit`) e `Dashboard.tsx` (`handleSalvarLancamento`). O único mecanismo de feedback de erro no app inteiro é `alert()` (usado em 7 pontos, ex.: `Caixa.tsx` para estoque insuficiente).
- Impacto: usuário digita um preço inválido (ou um valor que colide com o bug #1) e o formulário "não faz nada" ao clicar Salvar, sem explicação.
- Como corrigir: estado de erro local por formulário, mensagem inline junto ao campo problemático.
- Esforço estimado: Médio (repetido em vários formulários).

### [MÉDIO] Nenhum caminho de deploy definido
- Status: Confirmado
- Área: infra / produção
- Evidência: ausência de `Dockerfile`, `vercel.json`, `netlify.toml`, workflow de deploy ou qualquer documentação de hospedagem no repositório.
- Impacto: "produção" hoje significaria rodar `vite build` manualmente e hospedar `dist/` em algum lugar não documentado — não repetível, não versionado.
- Como corrigir: escolher uma plataforma estática (Vercel/Netlify/GitHub Pages) e configurar o deploy automático a partir de `main`.
- Esforço estimado: Baixo.

### [BAIXO] Contexto de estado monolítico
- Status: Possível risco (estrutural, não medido com profiling)
- Área: arquitetura / performance
- Evidência: um único `AppDataContext` (`src/context/AppDataContext.tsx`) expõe `data` inteiro; todo componente que chama `useAppData()` (praticamente todas as páginas, `Layout`, `BottomNav`) re-renderiza a qualquer mutação, mesmo que não use aquele campo.
- Impacto: não medido nesta sessão; irrelevante no volume atual de dados, mas tende a piorar conforme o histórico de vendas cresce.
- Como corrigir: dividir o contexto (ex.: dados brutos vs. valores derivados) ou usar seletores.
- Esforço estimado: Médio.

### [BAIXO] Bundle único sem code-splitting
- Status: Confirmado (fato do build); impacto real não medido
- Área: performance
- Evidência: build de produção gera um único `dist/assets/index-*.js` de 462,87 kB (127,94 kB gzip) — logo abaixo do limite padrão de aviso do Vite (500 kB), então nenhum aviso é emitido. `src/App.tsx` importa todas as páginas de forma estática (sem `React.lazy`).
- Como corrigir: `React.lazy` + `Suspense` por rota.
- Esforço estimado: Baixo.

### [BAIXO] Fontes carregadas via `@import` bloqueante (introduzido no redesign desta sessão)
- Status: Confirmado
- Área: performance
- Evidência: `src/index.css`, linha 1 — `@import url('https://fonts.googleapis.com/css2?family=Fraunces...&family=Karla...&family=IBM+Plex+Mono...')`.
- Impacto: `@import` de fonte dentro do CSS é bloqueante e atrasa a resolução do restante da folha de estilos, comparado a usar `<link rel="preconnect">` + `<link rel="stylesheet">` em `index.html`.
- Como corrigir: mover para tags `<link>` no `index.html` com `preconnect` para `fonts.gstatic.com`.
- Esforço estimado: Baixo.

### [BAIXO] Duplicação do formulário de "despesa fixa"
- Status: Confirmado
- Área: arquitetura / manutenibilidade
- Evidência: os campos nome/valor/recorrência e o handler de adicionar despesa fixa existem quase idênticos em `src/pages/Onboarding.tsx` (passo 2) e `src/pages/Configuracoes.tsx`.
- Impacto: qualquer correção (ex.: o bug de layout que corrigimos nesta sessão) precisa ser replicada manualmente nos dois lugares.
- Como corrigir: extrair um componente `DespesaFixaForm` compartilhado.
- Esforço estimado: Baixo.

### [BAIXO] `uid()` não é um identificador robusto
- Status: Confirmado (característica, risco teórico)
- Área: arquitetura
- Evidência: `src/lib/storage.ts`, `uid()` → `Math.random().toString(36).slice(2, 10) + Date.now().toString(36)`.
- Impacto: risco de colisão extremamente baixo no volume de uso do app, mas não é um UUID nem criptograficamente seguro.
- Como corrigir: usar `crypto.randomUUID()` (disponível nos navegadores-alvo).
- Esforço estimado: Baixo.

### [BAIXO] Acessibilidade — campos sem `<label>` associado
- Status: Confirmado
- Área: frontend / UX
- Evidência: campos de despesa fixa em `Onboarding.tsx`/`Configuracoes.tsx` usam apenas `placeholder`, sem `<label htmlFor>`.
- Impacto: leitores de tela não anunciam o propósito do campo corretamente.
- Como corrigir: adicionar `<label>` visualmente oculto (`sr-only`) associado a cada input.
- Esforço estimado: Baixo.

### [BAIXO] README vazio e inconsistência de nome
- Status: Confirmado
- Área: documentação
- Evidência: `README.md` contém apenas `"# facilites_tech"`; `package.json` define `"name": "meu-negocio-no-bolso"`.
- Impacto: dificulta onboarding de qualquer pessoa nova no projeto.
- Como corrigir: escrever um README real (o quê, como rodar, stack) e alinhar o nome.
- Esforço estimado: Baixo.

## 6. Lacunas por categoria

**Funcionalidade**: sem edição/exclusão de vendas, lançamentos e contas; sem exportação/backup; validação silenciosa nos formulários.

**Arquitetura**: contexto monolítico; formulário de despesa fixa duplicado; `categoryThemes`/`RAMOS_ATUACAO` fixos no código (sem mecanismo de extensão).

**Qualidade**: sem Error Boundary; migração de schema incompleta com falha silenciosa; `alert()`/`confirm()` como único mecanismo de feedback.

**Segurança**: sem autenticação/autorização real; dados sensíveis em `localStorage` sem criptografia (aceitável só enquanto não houver dado de terceiros/multiusuário). Nenhuma superfície de XSS/SQLi/CSRF identificada porque não há backend nem `dangerouslySetInnerHTML`.

**Performance**: bundle único sem code-splitting; fontes via `@import` bloqueante; contexto monolítico (risco não medido).

**Testes**: zero testes; lint quebrado; sem CI.

**Produção/Deploy**: sem `.env`, sem pipeline, sem plataforma de deploy definida, sem observabilidade/monitoramento (nenhum, já que é 100% client-side sem telemetria).

## 7. Priorização recomendada

| Prioridade | Item | Severidade | Esforço | Motivo |
|---|---|---|---|---|
| 1 | Corrigir `parseMoney` (milhar) | Crítico | Baixo | Bug de dados, baixo esforço, altíssimo impacto |
| 2 | Corrigir `todayISO` (fuso horário) | Crítico | Baixo | Bug de dados, baixo esforço, altíssimo impacto |
| 3 | CRUD de correção (editar/excluir venda, lançamento, conta) | Alto | Médio | Bloqueador de uso real do produto |
| 4 | Exportação/backup de dados | Alto | Baixo | Mitiga o maior risco de perda total de dados |
| 5 | Testes unitários das funções financeiras | Alto | Médio | Evita repetição dos bugs #1 e #2 |
| 6 | Sincronizar `localStorage` entre abas | Alto | Médio | Perda de dados silenciosa |
| 7 | Error Boundary | Médio | Baixo | Evita tela branca em qualquer exceção |
| 8 | Consertar/remover script de lint | Médio | Baixo | Sinal falso de qualidade hoje |
| 9 | CI mínima (build no PR) | Médio | Baixo | Rede de segurança barata |
| 10 | Feedback de erro nos formulários | Médio | Médio | Reduz confusão do usuário |
| 11 | Definir e documentar auth (manter placeholder ou implementar) | Alto | Alto | Decisão de produto pendente |
| 12 | Code-splitting por rota | Baixo | Baixo | Performance, ganho incremental |
| 13 | Extrair formulário de despesa fixa duplicado | Baixo | Baixo | Manutenibilidade |
| 14 | Mover fontes para `<link>` no HTML | Baixo | Baixo | Performance de carregamento |
| 15 | README + deploy documentado | Baixo | Baixo | Onboarding de time |

## 8. Plano de ação

**Correções imediatas** (antes de qualquer uso além de teste pessoal):
- Corrigir `parseMoney` e `todayISO` (itens 1 e 2 da tabela).
- Adicionar exportação de dados em Configurações.

**Curto prazo**:
- CRUD de correção para vendas/lançamentos/contas.
- Error Boundary.
- Consertar lint + CI mínima no GitHub Actions.
- Sincronização entre abas via evento `storage`.

**Médio prazo**:
- Suite de testes cobrindo `AppDataContext` e `format.ts`.
- Feedback de erro consistente nos formulários (substituir `alert()`).
- Versionamento de schema em `storage.ts`.

**Melhorias futuras**:
- Decisão e eventual implementação de autenticação real (se o produto for multiusuário/multi-dispositivo).
- Code-splitting, extração de componentes duplicados, otimização de carregamento de fontes.
- Definir e documentar pipeline de deploy.

## 9. Veredito final

- **O projeto está pronto para uso?** Não, para uso real de controle financeiro. Está pronto como protótipo/demonstração de produto e para uso pessoal informal, ciente dos bugs de data/valor.
- **O projeto está pronto para produção?** Não. Faltam auth real (ou uma decisão explícita de que não haverá), testes, CI, correção dos bugs críticos e forma de corrigir dados incorretos.
- **O que impede isso hoje?** Os dois bugs críticos de dados (#1 e #2), a impossibilidade de corrigir um lançamento errado, e a ausência total de rede de segurança (testes/CI).
- **Menor lista de ações para torná-lo utilizável com segurança** (uso real, ainda que single-device): corrigir `parseMoney`, corrigir `todayISO`, adicionar exportação de dados, adicionar exclusão de venda/lançamento/conta, sincronizar `localStorage` entre abas.

---

### Top 10 correções mais importantes
1. Corrigir `parseMoney` para aceitar milhar (`src/lib/format.ts`).
2. Corrigir `todayISO` para horário local (`src/lib/format.ts`).
3. Adicionar exclusão/edição de venda, lançamento manual e conta (`AppDataContext.tsx`).
4. Adicionar exportação de dados (JSON) em Configurações.
5. Sincronizar `data` entre abas via evento `storage`.
6. Adicionar testes unitários para `format.ts` e os `useMemo` de `AppDataContext.tsx`.
7. Adicionar Error Boundary global.
8. Consertar (ou remover) o script `lint`.
9. Criar workflow de CI (`build` + `tsc` no PR).
10. Substituir `alert()`/validação silenciosa por feedback inline nos formulários.

### Top 5 riscos de produção
1. Perda/corrupção de valores financeiros por falha de parsing (crítico, confirmado).
2. Lançamentos gravados com data errada à noite (crítico, confirmado).
3. Impossibilidade de corrigir um erro de lançamento — erro vira permanente.
4. Perda de dados ao usar o app em múltiplas abas (sem sincronização).
5. Ausência total de autenticação — qualquer acesso ao dispositivo é acesso total aos dados do negócio.

### Nota final
- Funcionalidade: 5/10
- Arquitetura: 6/10
- Segurança: 3/10
- Manutenibilidade: 4/10
- Produção: 2/10
