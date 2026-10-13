# CalorieTracker Web

Calorie and macro tracking web app (PWA-style, used on an iPhone through Safari: no Apple Developer account or Mac). Next.js + Supabase + Vercel. Live: https://calorie-tracker-tau-three.vercel.app

## Stack
- Next.js (App Router) + strict TypeScript. Read `node_modules/next/dist/docs/` before writing Next code (see `AGENTS.md`: this version has breaking changes).
- Tailwind CSS v4 + shadcn/ui (the only source of UI components), Geist font (self-hosted `geist` package).
- Supabase (Postgres, Auth, RLS) with `@supabase/ssr`. Vercel deploys on every push to `main`.
- TanStack Query for server data (zustand only for local UI state), date-fns, zod, Vitest, Playwright.
- Dev Container (`.devcontainer/`): all development runs in it. The Supabase CLI is `npx supabase`, never global. Secrets live in `.env.local` (git-ignored); `.env.example` lists the names only.

## Environments
- **Dev** Supabase project `eiyajwuauwqsoeckkdce`: used by the MCP, the E2E tests and local work.
- **Prod** Supabase project `yvuiklqgtctnagxzjkua`: never connect the MCP to it. Migrations reach prod only when the user asks: `npx supabase db push --dry-run` first, check the project ref, then push. The CLI in this container is linked to prod; relink before dev-only CLI work.
- Prod auth: email confirmation is currently **off** (users enter right after sign-up). Site URL and redirect list point to the Vercel domain above. Supabase's default SMTP is limited to 2 emails/hour: set up a custom SMTP before turning confirmation back on.
- Schema changes only through versioned files in `supabase/migrations/` (never edit an applied one). After a migration, patch `lib/supabase/database.types.ts`.

## Architecture
- The frontend talks to Supabase directly, protected by **RLS**. No separate Node backend. Server-side logic (AI, anything secret) only in Next.js Route Handlers.
- **Everything persists in the DB**: profile and goals, saved foods, saved meals, diary. Nothing user-owned lives only in localStorage (the only localStorage use is the collapsed meals of Today, a per-device preference).
- **Cache-first**: reads go through TanStack Query persisted in IndexedDB (`lib/query/`), show the cache at once and revalidate; writes always hit the DB (write-through, optimistic with rollback). The cache is disposable, per user, cleared on logout. `gcTime` is `Infinity` (anything above 2^31-1 ms overflows `setTimeout` and wipes restored queries); expiry is the persister's `maxAge`.
- **No offline writes** (closed decision): adding and searching need the network; show an explicit error. Counters (`times_used`) are incremented in SQL, never from the cache.
- External sources sit behind our own modules so they can be swapped without touching the UI: `lib/ai.ts` (server-only), `lib/off-search.ts` (server-only) and `lib/food-search.ts`.

## Data model
- `profiles`: name, mode (cut/maintain/bulk), calorie and macro goals, questionnaire answers, avatar, saved plans (`saved_plans`: three plans).
- `saved_foods` (per user, per 100 g values, `times_used`, unique `(user_id, lower(trim(name)))`), `saved_meals` (items in jsonb, totals, `times_used`).
- `diary_entries`: date, meal (breakfast/lunch/dinner/snacks), kind food|meal, values, items, optional `saved_food_id`/`saved_meal_id` (so edits of a saved item propagate).
- SQL functions (`security invoker`, RLS applies): `diary_daily_totals`, `diary_top_items`, `diary_meal_totals`, `apply_saved_food`; `delete_my_account()` is `security definer` and deletes `auth.users`, whose `on delete cascade` removes all user data.
- Every table has `user_id` and RLS (`user_id = auth.uid()`). A new table needs RLS and policy tests with two different users before moving on.

## Screens (routes: `/`, `/add`, `/saved`, `/history`, `/profile`, `/login`, `/onboarding`)
- **Today**: day navigation, kcal left, macro columns, four meal sections. Every row uses the same three columns (`components/today/row-layout.ts`). A meal heading minimizes to just its total (state kept on the device, for every day). An entry moves to another meal from its edit dialog.
- **Add** (`components/log/`): meal and day are chosen on this screen (`DiaryTargetPicker`); the `+` of a meal on Today preselects it (`?meal=&d=`); default is snacks. Food quantity: 10 g steps (10 to 500 g) with a "type grams" field; meals in portions (0.5 steps). No dialog or sheet focuses a field on open (`onOpenAutoFocus` is cancelled in `ui/dialog.tsx` and `ui/sheet.tsx`: iOS would open the keyboard).
- **Saved**: library of foods and meals; a row opens a sheet with Add to diary / Edit / Delete. Editing a saved item asks: from today / whole history / don't update.
- **Profile**: goals (calories, % and grams edited together), nutrition plan, avatar menu (Settings, User data, Log out, delete account) with an unsaved-changes guard. Onboarding questionnaire on first login, with an AI plan (`/api/ai/plan`).

## Food search
- Always both sources, in two tabs: the user's saved foods (local, instant) and Open Food Facts (OFF), 20 results per page. Opens on Saved when it has results. Search starts 700 ms after typing stops, or on Search/Enter; minimum 2 letters. **No search cache** of any kind (decision).
- Online search goes through the server: `GET /api/food-search?q=&page=` (session required; zod: 2 to 100 letters, page 1 to 25) calls `search.openfoodfacts.org` via `lib/off-search.ts`. Reason: the old `world.openfoodfacts.org/cgi/search.pl` failed ~50% (503 without CORS) and the new API has no CORS for our domain. 8 s timeout, one retry on 5xx/429/timeout, then 503 `off_unavailable` with a `reason` (`rate_limited` shows "Too many searches. Wait a bit"; the reason is also logged by the route; the UI offers "try again"; "No connection" only when the request itself fails).
- The server sends `User-Agent: CalorieTracker/1.0 (OFF_CONTACT_EMAIL)`. OFF limits per IP (search 10/min, product 15/min), so keep the 700 ms pause.
- Read only the `*_100g` OFF fields (the others can be per serving). Some OFF products have wrong data: pick another result or fix the food in Saved.
- A food added to the diary from search is saved automatically (per 100 g). Not-yet-saved foods offer three choices: save and add (main), only add (entry not linked), only save.
- Barcode: the browser reads the product directly from OFF (`/api/v2/product/<code>`), using zxing.

## AI (Gemini)
- Model from env `GEMINI_MODEL` (never hardcoded; use a stable model without `-preview`; currently `gemini-3.5-flash-lite`). The key never uses `NEXT_PUBLIC_` and goes in the `x-goog-api-key` header, never the URL.
- Server only (`POST /api/ai/parse`, `/api/ai/plan`): session required, request size limited (text up to 1000 chars, image about 4 MB), zod on the request and on the AI's JSON (it can be malformed). No per-user limit (decision). Google often answers a passing 503 "overloaded": `geminiText` tries up to 3 times (0.8 s and 2 s pauses) on 500/502/503/504, never on 429/401/403. On quota, bad key, outage or timeout the server answers 503 `ai_unavailable` and the UI shows the "AI mode unavailable" alert (`requestAiParse` in `lib/ai-client.ts`, typed result, never throws).
- Free-tier quota is shared by all users, and Google may use the data sent.
- Plans: three saved plans (cut/maintain/bulk) are reconciled against a reference calculation (`lib/nutrition-plan.ts`).

## History
- Period lives in the URL (`?p=week|month|year|custom&d=…` or `&from=…&to=…`); default is the current week (Monday to Sunday); a custom range is at most 3660 days. Pure logic in `lib/history.ts`.
- Data comes from SQL aggregates (PostgREST returns at most 1000 rows per request), never from reading the entries. **No statistics tables**: the diary is the only source of truth, and diary and saved mutations invalidate `["history", userId, …]`.
- **Averages are per logged day** (days without entries are not zeros) and the screen always says "N of M days logged".
- **Nothing is compared with the goals** (decision): goals change over time and there is no goal history. Only the change against the previous period is shown, as direction and percentage, with no good/bad judgment.
- Layout: period picker, summary with change vs previous period, one chart with metric tabs (Calories/Protein/Carbs/Fat) and Avg/Max/Min, calories by meal, most eaten (by times and by calories), collapsed list of days.
- No Apple Health or smartwatch import (decision); History uses only data already in the app.

## Security (hard rules)
- Never put keys in the repository or the client. Only `NEXT_PUBLIC_SUPABASE_URL` and the anon/publishable key are public. `service_role` never reaches the client or Git. Secrets live in `.env.local` and Vercel variables.
- Validate every Route Handler input with zod.

## Design
- Mobile-first (iPhone), light and dark. Direction and tokens are in `DESIGN.md` and `app/globals.css`. Forbidden: loose colors, sizes or styles outside the tokens; only shadcn/ui components, and new components in `components/` reuse the tokens. The accent never colors data and macro colors never color actions.
- Before designing a new screen, propose 2 or 3 directions and wait for the user's choice.
- If the shadcn CLI times out in the container, download the registry JSON with `curl` (`https://ui.shadcn.com/r/styles/new-york-v4/<component>.json`) and write the files from it (use `@/lib/utils` for `cn`).

## Code conventions
- UI language: **English**. Texts, validations and errors as short as possible, no explanatory sentences in the middle of a screen ("Add meal", not "Add food"). Code, names and commits in English.
- Small components (ideally under 200 lines). Pure logic in `lib/` with no React and Vitest tests beside it; components only compose.
- Rounding everywhere (items, meal and day totals): calories whole, macros 1 decimal, always through `roundCalories`/`roundMacro` in `lib/nutrition.ts`.
- No `any`. No new dependency without justifying it.
- Data screens follow `lib/queries/profile.ts`: `useQuery` with key `[entity, userId]`; `useMutation` write-through (`onMutate` optimistic, `onError` rolls back with a toast, `onSuccess` stores the returned row, `onSettled` invalidates). Inline errors with `role="alert"` (one message per error); success as a sonner toast.

## Tests
- Vitest covers `lib/**`, `app/api/**` and `app/auth/**`.
- E2E (`npm run test:e2e`, folder `e2e/`, mobile viewport) runs against the production build (`npm run build && npm start`; `E2E_DEV=1` uses the dev server, slow on first compile). Kill anything on port 3000 first (`fuser -k 3000/tcp`): a stale server is reused and gives false failures. Test users A and B live in the DEV project, credentials in `.env.local` (`E2E_USER_*`), never in Git.
- Every screen has E2E for: defaults, the happy path with persistence (cache and DB), validation, network failure without a false "saved", isolation between users; restore state in `finally`.
- After fixing failures, rerun **only the failed tests** (`npx playwright test --last-failed`); run the full suite once at the end.
- Wait for hydration (`networkidle`) before touching forms. Seed data BEFORE the first visit (queries have a 30 s `staleTime`). Keep Node-to-Supabase calls few and parallel (`e2e/seed.ts`).
- If every new connection takes ~5 s, rebuild the container (`devcontainer.json` pins `--dns=1.1.1.1 --dns=8.8.8.8`); diagnose with `curl -w "dns %{time_namelookup}s\n" -o /dev/null -s https://example.com`.

## Workflow
- Use plan mode before each feature and wait for the user's approval of the plan.
- At the end: lint, typecheck and tests, plus a critical review of the changes (bugs, security, RLS).
- Small commits. **Commit and push to `main` on your own after each finished, tested change** (no secrets in the diff), without asking.
- If something is ambiguous, ask instead of assuming. Chat with the user in Portuguese.

## Commands
`npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`
