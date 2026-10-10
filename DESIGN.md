# Design

Single source of truth for visual decisions. Tokens live in [app/globals.css](app/globals.css); never use literal colors, sizes or shadows outside them.

## Direction
Neutral monochrome + **one accent**. Mobile-first (iPhone PWA), light and dark following the system (`prefers-color-scheme`). Borders instead of shadows. Numbers are the hero: `tabular-nums`, large, high contrast.

## Tokens
| Token | Light | Dark | Use |
|---|---|---|---|
| `background` / `foreground` | `#fafafb` / `#14171f` | `#0e1015` / `#f2f3f5` | page, text |
| `card` | `#ffffff` | `#171a21` | surfaces |
| `muted` / `muted-foreground` | `#f1f2f5` / `#5f6675` | `#1f232c` / `#9aa1b0` | secondary surfaces and text |
| `border` / `input` | `#e3e5ea` / `#d5d8df` | `#2a2f3a` / `#333946` | lines, fields |
| `primary` (the accent) | `#2d6be4` | `#5b8df0` | primary actions, focus ring, active tab |
| `destructive` | `#d92d4a` | `#f0607a` | errors, goal exceeded |
| `protein` / `carbs` / `fat` | `#3a6fd8` / `#b87708` / `#d6456b` | `#6e9bf2` / `#f0b342` / `#f27a98` | **data only** (rings, bars, charts) |

Rules:
- The accent never colors data; macro colors never color actions.
- Macro tokens are used as `text-protein`, `bg-carbs`, `bg-fat`, etc.
- Radii: `rounded-sm` 10px, `rounded-md` 14px, `rounded-lg` 20px.
- Spacing in multiples of 4px (Tailwind scale). Touch targets at least 44px.
- Font: Geist Sans (self-hosted via the `geist` package). Small type scale; page title `text-2xl font-semibold`.
- Safe areas: tab bar and page padding use `env(safe-area-inset-*)`; tab bar height is `--tab-bar-height`.
- Only shadcn/ui primitives in `components/ui/`; new components go in `components/` and reuse tokens.

## "Hoje" screen (direction B: compact numbers panel)
```
◀  Hoje, 10 out  ▶

580
kcal restantes
1 420 / 2 000  ▓▓▓▓▓▓▓░░░

P 98   │ H 120  │ G 40
/150g  │ /200g  │ /65g
▓▓▓▓░  │ ▓▓▓░░  │ ▓▓▓▓░

Pequeno-almoço   420    +
  Aveia 60g           210
  Banana               90
Almoço            650    +
Jantar              —    +
Snacks              —    +
```
- "kcal restantes" is the focal number; it turns `destructive` and reads "kcal acima" when the goal is exceeded.
- Macro columns use the macro tokens for the mini bars; over-goal bars switch to `destructive`.
- Each meal row has a `+` action (accent) to add food; entries are tappable to edit.
