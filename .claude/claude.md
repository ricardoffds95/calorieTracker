# CalorieTracker Web

Migração de uma app React Native (Expo) de contagem de calorias e macros para uma **web app (PWA)** feita de raiz, com backend no Supabase e deploy na Vercel. O objetivo principal é poder usar no iPhone sem Apple Developer nem Mac (PWA via Safari).

## Projeto antigo (só referência)
- Caminho: `/workspaces/calorieTracker/calorieTracker` (dentro do container) (Expo 54, expo-router, zustand, AsyncStorage). **Nunca alterar** esta pasta.
- Foi feito por vibe coding, por isso a qualidade é irregular. Reaproveitar a lógica, não copiar a estrutura.
- Ecrãs: `app/(tabs)/index.tsx` (Hoje), `log.tsx` (Registar, 1.5k linhas, o mais complexo), `history.tsx` (Histórico), `profile.tsx` (Perfil).
- Stores: `store/foodStore.ts`, `store/goalsStore.ts`, `store/savedMealsStore.ts`.
- Serviços: `services/openFoodFacts.ts` (pesquisa e código de barras), `services/geminiAI.ts` (texto e foto → macros).
- Constantes: `constants/macros.ts`, `constants/theme.ts`. Componentes: `MacroRing`, `MealSection`.

## Stack
- Next.js (App Router) + TypeScript estrito
- Tailwind CSS v4 + shadcn/ui (única fonte de componentes de UI), fonte Geist (pacote `geist`, self-hosted)
- Supabase (Postgres, Auth, RLS). Cliente `@supabase/ssr`
- Vercel (deploy automático via GitHub)
- TanStack Query para dados do servidor; zustand só para estado de UI local
- date-fns, zod (validação), Vitest (testes de lógica)

## Ambiente de desenvolvimento (Dev Container)
- Host: **Linux**. Não há dependências instaladas na máquina; todo o desenvolvimento corre num **Dev Container** do VS Code (ficheiros em `.devcontainer/`, versionados no Git).
- Se `.devcontainer/` não existir, criá-lo ANTES de qualquer outra tarefa:
  - Imagem base oficial de dev containers para Node/TypeScript, com Node.js LTS atual.
  - `postCreateCommand`: `npm install`.
  - `forwardPorts`: 3000 (Next.js), com `portsAttributes` a abrir o preview automaticamente.
  - Extensões recomendadas: ESLint, Prettier, Tailwind CSS IntelliSense.
  - Supabase CLI, se for preciso, como dependência de desenvolvimento do projeto (`npx supabase`), não global.
- Segredos NUNCA vão para `devcontainer.json`. Ficam em `.env.local` (no `.gitignore`); criar também `.env.example` só com os nomes das variáveis.
- Depois de criar o container, confirmar que funciona: `npm install`, `npm run build` e arrancar com `npm run dev` (em `localhost:3000`). Reportar erros em vez de os contornar.
- Pré-requisitos do host: **Docker Engine** (não Desktop) com o meu utilizador no grupo `docker`, e a extensão "Dev Containers" do VS Code. Se faltar algum, avisar-me em vez de tentar instalar.

## Arquitetura
- O frontend fala com o Supabase diretamente, protegido por **RLS**. Não criar backend Node separado.
- Lógica no servidor (chamadas à IA, qualquer segredo) só em **Route Handlers** do Next.js ou Edge Functions do Supabase.
- **Tudo persiste na BD**: perfil e metas, alimentos guardados, refeições guardadas e diário. Nada de dados de utilizador só em localStorage.
- **Cache no browser (cache-first)**: leituras via TanStack Query persistido em IndexedDB (`lib/query/`), mostram a cache de imediato e revalidam na BD; escritas vão sempre à BD (write-through). A cache é descartável e a BD manda. Cache isolada por utilizador e limpa no logout.
- **Sem escritas offline** (decisão fechada): registar e pesquisar exigem rede; mostrar erro explícito "Sem ligação". Uso no iPhone via atalho que abre no Safari (não PWA standalone), por isso manifest/service worker são baixa prioridade. Contadores (`times_used`) incrementam-se em SQL, nunca a partir da cache.
- `gcTime` do TanStack Query nunca acima de 2^31-1 ms (~24,8 dias): faz overflow do `setTimeout` e apaga as queries restauradas. Usar `Infinity`; a expiração é o `maxAge` do persister.
- Ligações MCP: **Supabase** (apenas projeto de DESENVOLVIMENTO) e **Vercel**. Nunca ligar ao projeto de produção.
- Fontes externas ficam atrás de módulos próprios, para poderem ser trocadas sem mexer na UI:
  - `lib/ai.ts` (IA: texto e foto → macros)
  - `lib/food-search.ts` (pesquisa de alimentos e código de barras)

## Modelo de dados (a confirmar no passo de schema)
- `profiles` (user_id, nome, modo: cut/maintain/bulk, metas de calorias e macros)
- `saved_foods` **por utilizador**: id, user_id (default `auth.uid()`), name, brand, off_code (opcional), valores por 100g (calories, protein, carbs, fat), times_used, created_at. Índice único `(user_id, lower(trim(name)))`.
- `saved_meals` (itens em jsonb, totais, `times_used`)
- `diary_entries` (data, refeição: breakfast/lunch/dinner/snacks, tipo food|meal, valores e itens, `saved_food_id`/`saved_meal_id` opcionais para propagar edições)
- Todas as tabelas têm `user_id` e **RLS ativa**: cada utilizador só acede aos seus dados (policy `user_id = auth.uid()` para select/insert/update/delete).
- Alterações de schema só por migrations versionadas em `supabase/migrations/`.
- O plano gratuito do Supabase pode pausar projetos inativos: confirmar as condições atuais.

## Pesquisa de alimentos
- Ordem: 1) alimentos guardados do utilizador (instantâneo, local, a partir de 2 letras) **e** a cache local de pesquisas anteriores do Open Food Facts (IndexedDB, 30 dias, por texto exato; a partir de 3 letras), mostrados por defeito; 2) Open Food Facts **só quando o utilizador carrega em "Pesquisar no Open Food Facts"** (ignora a cache e traz resultados frescos), ou **sozinho quando guardados e cache estão ambos vazios** (`shouldSearchOnline`); 3) opcional: USDA FoodData Central para alimentos genéricos (chave gratuita, 1000 pedidos/h por IP).
- **A pesquisa online passa pelo servidor** (`GET /api/food-search?q=`, sessão obrigatória, zod 3 a 100 letras), que chama a API nova `search.openfoodfacts.org` (`lib/off-search.ts`, `server-only`). Razões, medidas em 2026-10: a API antiga (`world.openfoodfacts.org/cgi/search.pl`) respondia 503 em ~50% dos pedidos, e esses 503 vêm **sem CORS**, pelo que o browser só via "falhou" (e a app dizia "Sem ligação"); a nova respondeu 30 em 30. A API nova não tem CORS para o nosso domínio, por isso só o servidor a pode chamar.
- O servidor envia `User-Agent: CalorieTracker/1.0 (OFF_CONTACT_EMAIL)` (variável de ambiente, não é segredo), tem timeout de 8 s e **1 repetição** em 5xx/429/timeout. Falhando, responde 503 `off_unavailable`.
- **Sem cache no servidor** (decisão do utilizador: não compensa); também não criar cache de pesquisas na BD. A cache é só local no browser (IndexedDB, 30 dias).
- Limites oficiais do Open Food Facts, **por IP**: pesquisa 10/min, leitura de produto 15/min, mais limites globais que dão 503. Como o servidor partilha o IP da Vercel, manter: mínimo de 3 letras, debounce de 600 ms (nunca pesquisar a cada tecla) e a cache local do browser. A API nova não documenta limite: se for limitada, trocar a fonte atrás de `lib/off-search.ts` sem mexer na UI.
- No cliente, `searchOpenFoodFacts` (`lib/food-search.ts`) chama a rota e mantém a cache local em IndexedDB (30 dias, é a única). Erros com mensagem própria: "Sem ligação" **só** quando o pedido falha; 503 → "O Open Food Facts não respondeu. Tenta daqui a pouco ou insere manualmente."; botão "Tentar novamente"; os guardados continuam visíveis.
- Sempre que um alimento vindo da pesquisa é adicionado ao diário, **guardá-lo automaticamente em `saved_foods`** (por 100g), para a próxima vez não chamar a API. Um alimento ainda não guardado também pode ser **só guardado** ("Só guardar nos alimentos", sem diário); não existe "só diário" sem guardar.
- **Tab Guardados** (`/guardados`, 5 tabs): biblioteca de alimentos e refeições guardados (pesquisar, editar com propagação ao diário, apagar, criar). Editar um guardado pergunta: a partir de hoje / todo o histórico / não atualizar. Uma refeição pode ser criada sem a registar no diário.
- Código de barras: leitura direta de produto no Open Food Facts, **do browser** (`/api/v2/product/<código>`, limite por utilizador).
- A API do Open Food Facts pode ser lenta: mostrar estado de "a pesquisar" (skeleton) e os guardados primeiro.

## IA (Gemini)
- Modelo definido em variável de ambiente `GEMINI_MODEL` (nunca hardcoded). Usar um modelo estável sem sufixo `-preview` (modelos preview podem ser descontinuados e têm limites mais restritos). Atual: `gemini-3.5-flash-lite` (os 2.5 só estão acessíveis a quem já os usava, segundo a documentação em 2026-10; confirmar na lista de modelos estáveis antes de trocar).
- A chave NUNCA usa o prefixo `NEXT_PUBLIC_` e vai no header `x-goog-api-key`, nunca no URL. Chamadas só pelo servidor (`POST /api/ai/parse`), com sessão obrigatória e tamanho de pedido limitado (texto ≤ 1000 chars, imagem ≤ ~4 MB).
- **Sem limite por utilizador** (decisão do utilizador): quando a quota esgota (429, chave inválida, indisponível, timeout) o servidor responde 503 `ai_unavailable` e a UI mostra o alerta "Modo IA não disponível" (`requestAiParse` em `lib/ai-client.ts`, resultado tipado, nunca lança).
- Validar a resposta com zod (o JSON da IA pode vir mal formado) e tratar 429 com mensagem clara.
- Todo o código de IA em `lib/ai.ts`, para poder trocar de fornecedor.
- O free tier tem quota partilhada por todos os utilizadores, e os dados enviados podem ser usados pela Google para melhorar produtos; ter isto em conta.

## Histórico
- Por defeito a **semana atual** (segunda a domingo); também mês, ano e intervalo entre 2 datas (máx. 3660 dias). O período vive no URL (`?p=week|month|year|custom&d=…` ou `&from=…&to=…`); setas, "Voltar a hoje" e "Ir para uma data" (um só campo de data, porque `type=month/week` não funciona no iOS). Lógica pura em `lib/history.ts`.
- Os dados vêm de `diary_daily_totals(p_from, p_to)` (SQL, `security invoker`, uma linha por dia com entradas), não de ler as entradas: o PostgREST devolve no máximo 1000 linhas por pedido e um ano tem mais. **Sem tabelas de estatísticas**: o diário é a única fonte de verdade, por isso editar um guardado com "todo o histórico" atualiza também o Histórico (as mutações invalidam `["history", userId]`).
- **A média é por dia registado** (dias sem entradas não puxam a média para baixo, são outliers) e o ecrã diz sempre "N de M dias registados" (M = dias do período que já começaram; mês e ano atuais contam só até hoje).
- **Nada no Histórico é comparado com as metas** (decisão do utilizador): as metas mudam ao longo do ano e não há histórico de metas, por isso comparar um período antigo com a meta atual enganaria. Só voltar a comparar se um dia existir uma média das metas do período. As macros mostram gramas médias e a parte de cada uma nas calorias (`macroSplit`).
- Gráfico de barras próprio (sem biblioteca): barras ≤ 24 px, uma por dia (≤ 31 dias), semana (≤ ~6 meses) ou mês, sempre em `primary`; cada barra é um botão com a lista por baixo como vista em tabela.

## Segurança (regras duras)
- **Nunca** pôr chaves no repositório ou no cliente. Só `NEXT_PUBLIC_SUPABASE_URL` e a chave anónima/publicável são públicas.
- `service_role` nunca vai para o cliente nem para o Git. Segredos em `.env.local` (no `.gitignore`) e nas variáveis da Vercel.
- Validar com zod todos os inputs de Route Handlers.
- Toda a tabela nova precisa de RLS e testes das policies (com dois utilizadores distintos) antes de avançar.

## Design
- Mobile-first (uso principal: iPhone como PWA), com modo claro/escuro.
- Usar a skill `frontend-design` (se não estiver disponível, seguir os princípios de `artifact-design`). A direção visual e os tokens (cores, tipografia, raios, espaçamentos) estão definidos em `DESIGN.md` e em `app/globals.css`. Direção escolhida: neutro monocromático + um acento (azul); "Hoje" na direção B (painel compacto de números).
- O CLI do shadcn falha por vezes com timeouts de rede neste container; se acontecer, descarregar o JSON do registry com `curl` (`https://ui.shadcn.com/r/styles/new-york-v4/<componente>.json`) e escrever os ficheiros a partir dele (trocar o import `cn` por `@/lib/utils`).
- Proibido: cores, tamanhos ou estilos soltos fora dos tokens. Só componentes shadcn/ui; criar componentes novos em `components/` reutilizando os tokens.
- Antes de desenhar um ecrã novo, propor 2-3 direções e esperar a minha escolha (para "Hoje" já escolhida, ver `DESIGN.md`).

## Padrão dos ecrãs com dados (ver `lib/queries/profile.ts`)
- Leitura: `useQuery` com chave `[entidade, userId]` (cache-first). Escrita: `useMutation` write-through (`onMutate` otimista, `onError` reverte e mostra toast "Sem ligação…", `onSuccess` grava a linha devolvida, `onSettled` invalida).
- Validação e regras em `lib/` (zod + funções puras testadas); componentes só compõem. Erros inline com `role="alert"` (uma única mensagem por erro); sucesso por toast (sonner).
- E2E de cada ecrã: valores por defeito, fluxo feliz com persistência (cache e BD), validação, falha de rede sem "falsa gravação", isolamento entre utilizadores; repor o estado no fim (`finally`).

## Testes E2E (Playwright)
- `npm run test:e2e` (pasta `e2e/`, viewport mobile). Utilizadores de teste A e B no projeto DEV, credenciais em `.env.local` (`E2E_USER_*`), nunca no Git.
- Cada ecrã novo da Fase 4 leva E2E como critério de aceitação (ex: adicionar refeição e verificar contadores de macros e gráficos).
- Por defeito os E2E correm contra o build de produção (`npm run build && npm start`); `E2E_DEV=1` usa o dev server (lento na primeira compilação de cada rota).
- Se cada ligação nova demorar ~5 s (DNS do container herdado de uma rede antiga, ex. hotspot), reconstruir o container: o `devcontainer.json` já fixa `--dns=1.1.1.1 --dns=8.8.8.8`. Diagnóstico: `curl -w "dns %{time_namelookup}s\n" -o /dev/null -s https://example.com`. Enquanto estiver lento, Nos E2E, minimizar chamadas Node→Supabase (`e2e/seed.ts`): limpar em paralelo no `beforeEach` e uma vez no `afterAll`; dados semeados fora da app só aparecem após o `staleTime` de 30 s, por isso semear ANTES do login/primeira visita.
- Esperar pela hidratação (`networkidle`) antes de interagir com formulários; a primeira compilação em dev é lenta (timeouts largos no config).

## Convenções
- Idioma da UI: português (PT). Código, nomes e commits em inglês.
- Componentes pequenos (idealmente <200 linhas). O ecrã de Registar deve ser dividido em componentes e hooks, não replicar o monólito.
- Lógica pura em `lib/`, sem dependência de React, com testes Vitest ao lado: `macros.ts` (metas e presets), `nutrition.ts` (arredondamentos, escala por 100g, doses, totais, propagação de edições de guardados), `diary.ts` (agrupar e somar entradas do diário), `schemas.ts` (zod), `food-search.ts` (+ `food-search-cache.ts`, só browser), `ai.ts` (**só servidor**, `server-only`) e `ai-client.ts`.
- Arredondamentos: calorias inteiras e macros com 1 casa decimal em TODO o lado (itens, totais de refeição e do dia); a app antiga arredondava os totais de refeição a 1 casa e isso foi corrigido. Usar sempre `roundCalories`/`roundMacro` de `lib/nutrition.ts`.
- Sem `any`. Sem dependências novas sem as justificar.

## Funcionalidades a migrar
- Diário por dia e refeição (pequeno-almoço, almoço, jantar, snacks), com alimentos e refeições compostas
- Alimentos e refeições guardados (contador de uso; editar um guardado propaga-se às entradas do diário)
- Pesquisa de alimentos e leitura de código de barras (ver secção própria)
- Registo por texto ou foto com IA (Gemini), via servidor
- Metas e modos (cut/maintain/bulk) com cálculo de macros por percentagem
- Histórico com gráficos
- Opcional: importar os dados antigos através de um JSON exportado da app RN

## Equivalentes web de módulos nativos
- `expo-camera` (scan) → biblioteca JS de leitura de códigos de barras (ex: zxing); `BarcodeDetector` não é fiável no Safari
- `expo-image-picker` → `<input type="file" accept="image/*" capture>`
- `expo-image-manipulator` → redimensionar/comprimir com canvas antes de enviar
- `AsyncStorage` → Supabase (dados) e localStorage (só cache descartável)

## Fases (uma funcionalidade por sessão)
0. Dev Container + `package.json` com scripts (`dev`, `build`, `lint`, `typecheck`, `test`) e confirmar que arranca
1. Schema do Supabase + RLS + auth
2. Setup Next.js, Tailwind, shadcn, tokens de design, shell com 4 tabs
3. Lógica em `lib/` com testes + Route Handler da IA
4. Ecrãs por ordem: Perfil → Hoje → Histórico → Registar
5. Scan, fotos, ícone do atalho (`apple-touch-icon`; manifest só se for fácil) e deploy na Vercel

## Fluxo de trabalho
- Usar plan mode antes de cada funcionalidade e esperar a minha aprovação do plano.
- No fim de cada funcionalidade: correr lint, typecheck e testes; depois fazer uma revisão crítica das alterações (bugs, segurança, RLS) antes de eu fazer commit.
- Commits pequenos. Não fazer commit nem push sem eu pedir.
- Se algo for ambíguo, perguntar em vez de assumir.

## Comandos
- `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`