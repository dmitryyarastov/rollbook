# Design system

Rollbook's UI implements the **Nocturne** design system from a high-fidelity design handoff (the prototype "BJJ Tracker.dc.html" and its README). Treat the rules below as law, not preference: every pixel value in `src/app.css` traces back to that handoff. When adding UI, reuse the existing vocabulary rather than inventing new patterns — an AI agent extending this app should be able to build a new card, row, or form control entirely from the classes and conventions documented here.

Sibling docs: [architecture.md](architecture.md) (component tree, state flow), [data-model.md](data-model.md) (the types rendered here), [curriculum.md](curriculum.md) (tag ordering used by chip pickers and the tag cloud), [build-pwa.md](build-pwa.md) (font precache interaction), [testing.md](testing.md).

## The Nocturne rules (non-negotiable)

1. **Inter 400 and 500 only.** No other weights, ever. Visual hierarchy comes from **size and spacing**, never from bolding. `font-weight: 500` is the "strong" register; body text is 400. The fonts are self-hosted via `@fontsource/inter` (`latin-400.css` / `latin-500.css` imported in `src/main.tsx` — the handoff's Google Fonts `@import` was deliberately dropped for offline use). If you add a weight import, you have broken the system; don't. Only `.woff2` is ever fetched by target browsers — `scripts/sw-precache.mjs` excludes `.woff` from the precache manifest for exactly this reason (see [build-pwa.md](build-pwa.md)).
2. **The accent `#9184d9` is never a large fill.** It appears only as: thin lines and borders (`.save-btn`, `.step--accent`, `.ring`, `.tab-log`, chip `--on` border), glows (`box-shadow` on `.ring` and `.tab-log`), progress fills (`.progress-fill`, which is a 3px line), and text/number marks (`.hero-num`, `.log-count`, `.kicker--accent`, `.link`). **On-states use the dark accent shades as fills** — `--color-accent-900` background + `--color-accent-300` text is the canonical "selected" look (`.chip--on`, `.tagchip`, `.srow-badge--gi`); `:active` press states darken to `--color-accent-800`.
3. **Buttons are outlined, not solid.** `.save-btn` is a transparent box with a 1px accent border and accent text; hover fills with `accent-900`, active with `accent-800`. Steppers, chips, and the tab-bar log button follow the same outline grammar. Never ship a solid accent-filled button.
4. **Hierarchy from size/space.** The type scale runs 60px log count → 46px hero → 26px screen title → 17px card title → 15px body → 13px sub → 12px meta → 11px kicker → 10px micro → 9px ring label. De-emphasis is done with the neutral ramp (500 → 600 as text recedes), not opacity or weight changes (the one opacity exception: `.mrow--pending` at 0.7 for unachieved milestones).

## Token inventory — `src/nocturne.css`

`src/nocturne.css` is a verbatim copy of the handoff's token sheet plus a minimal reset. Do not add component styles to it; components live in `src/app.css`.

| Token | Value | Role |
|---|---|---|
| `--color-bg` | `#161826` | Page/app background; also input backgrounds (`.input`, `.match`) and the tab-log button fill, so controls read as "cut into" the surface |
| `--color-surface` | `#232532` | Card background (`.card`) |
| `--color-text` | `#e9e9ed` | Default body text |
| `--color-accent` | `#9184d9` | THE accent — lines, borders, glows, text marks only (rule 2 above) |
| `--color-divider` | `color-mix(in srgb, #e9e9ed 16%, transparent)` | Defined by the handoff; currently unused in app.css (dividers use `neutral-800`/`neutral-900` borders instead) — keep it, it's part of the token contract |
| `--color-neutral-100` | `#f3f5fe` | (unused; top of ramp) |
| `--color-neutral-200` | `#e4e7f5` | (unused) |
| `--color-neutral-300` | `#cfd3e5` | Bright secondary text: stepper icons, badge text, tagstat text, comp note text |
| `--color-neutral-400` | `#b2b6ca` | Mid text: units (`.stat-u`), captions (`.hero-cap`), AGAINST numbers, hover-brightened icon/chip text |
| `--color-neutral-500` | `#9397ab` | Muted text: subtitles, meta lines, kickers, empty states, inactive tab labels, LOSS pills |
| `--color-neutral-600` | `#75798c` | Faintest text: `.micro`, field labels, hints, placeholders, sync note, tagstat counts |
| `--color-neutral-700` | `#595d6c` | Control borders: `.input` border, `.step` border, hover border for cards/chips |
| `--color-neutral-800` | `#3f424d` | Structural borders: `.card` border, chip border, panel dividers (`.srow-panel`, `.focus-panel` border-top), `.vdiv` gradient |
| `--color-neutral-900` | `#292b31` | Darkest fill: empty bar tracks (`.weekbar-fill`, `.progress-track`, `.trow-track`), `.srow-badge` bg, `.tagstat` bg, tab-bar border-top |
| `--color-accent-100` | `#f5f4ff` | (unused) |
| `--color-accent-200` | `#e7e5fe` | (unused) |
| `--color-accent-300` | `#d2cefd` | Bright accent TEXT: FOR numbers, on-state chip/badge text, WIN pills, `.link:hover`, `.ring-n`, `.saved-msg`, active tab label |
| `--color-accent-400` | `#b5abfc` | (unused) |
| `--color-accent-500` | `#968ae0` | Bright bar fills: active week bar, current-week volume bar, #1 technique bar |
| `--color-accent-600` | `#796cbf` | (unused) |
| `--color-accent-700` | `#5d5294` | Mid bar fill: top-3 technique bars |
| `--color-accent-800` | `#423a6a` | On-state borders (`.card--accent`, `.srow--open`, `.tagchip` border) and `:active` press fills; default technique-bar fill |
| `--color-accent-900` | `#2b2741` | On-state background fills (`.chip--on`, `.tagchip`, `.srow-badge--gi`, hover fills for accent buttons) |
| `--font-body` | `'Inter', system-ui, sans-serif` | Set once on `body`; everything inherits (see the `.input` rule below) |
| `--radius-sm` | `4px` | Badges, tag chips, technique bar tracks |
| `--radius-md` | `8px` | Default: cards, chips, inputs, steppers, save button |
| `--radius-lg` | `14px` | Large cards only (`.card--lg`: hero, log cards, streak card) |

The reset in nocturne.css also matters: `button { font: inherit; background: none; border: 0; ... }` is what lets rows BE buttons (see SessionRow below); `:focus-visible` gets a 2px accent outline (never remove focus styling — `.input` replaces the outline with an accent border-color, which is the approved pattern); `::selection` is a 30% accent mix.

**The reset covers `button` but NOT `input`/`textarea`** — form controls do not inherit the body font by default. Hence every input class sets `font-family: inherit` explicitly (see `.input` and `.chip-input`). If you add any new form control, you must set `font-family: inherit` on it or it will render in the UA font.

## `src/app.css` organization

All component CSS lives in `src/app.css` as **ordered sections** delimited by `/* ── Section name ── */` comment blocks. Longhand font properties only (`font-weight` / `font-size` / `line-height` separately, never the `font:` shorthand — the shorthand resets `font-family` and breaks inheritance). Current section order:

1. `Shell` — `.app`, `.screens`, `.screen` (100dvh flex column; scroll lives on `.screens`; `.screen` carries the safe-area top padding and 110px bottom clearance for the tab bar)
2. `Type` — `.screen-title`, `.screen-sub`, `.kicker`, `.section-label`, `.micro`, `.empty`, `.section-head`, `.label-row`, `.link`
3. `Cards` — `.card`, `.card--lg`, `.card--accent`
4. `Home: header` — `.home-head`, `.home-title`, `.home-date`, `.sync-note`
5. `Home: hero card` — `.hero`, `.hero-num`, `.weekbars`
6. `Stat cards` — `.stat-row`, `.stat-card`, `.subs-line`
7. `Focus card` — `.focus`, `.progress-track`, `.icon-btn`, `.focus-panel`, `.field-label`, `.input`
8. `Session rows` — `.slist`, `.srow`, `.srow-badge`, `.srow-panel`, `.tagchip`
9. `Competition rows` — `.srow-badge--comp`, `.crow-*`
10. `Chips (filters, durations, technique toggles)` — `.chips`, `.chip`, `.chip-input`
11. `Log screen` — `.log-stack`, `.log-card`, `.stepper-row`, `.step`, `.dur-row`, `.dur-cap`, `.subs-split`, `.vdiv`, `.save-btn`, `.saved-msg`
12. `Log: when (session start)` — `.when-row`, `.input--time`
13. `Log: competition mode` — `.log-mode`, `.match`, `.match-*`, `.input--sm`, `.input--area`
14. `Techniques screen` — `.trows`, `.trow`, `.tag-cloud`, `.tagstat`
15. `Techniques: curriculum groups` — `.cloud-group`, `.cloud-group-label`
16. `Progress screen` — `.streak-card`, `.ring`, `.vol-card`, `.mrows`
17. `Tab bar` — `.tabbar`, `.tab`, `.tab-log`

**Where a new section goes:** shared primitives extend an existing early section (Type/Cards/Chips); a screen-specific block goes adjacent to its screen's existing sections, sub-scoped with a `Screen: feature` title (the pattern set by `Log: when` and `Techniques: curriculum groups`). The tab bar stays last. Never scatter a component's rules across sections.

Hover states are always wrapped in `@media (hover: hover)` (touch devices must not get sticky hover); `:active` press states sit outside that wrapper. Animations respect `@media (prefers-reduced-motion: reduce)` (see `.ring-pulse`).

## BEM-lite naming

- Block: `.chip`, `.srow`, `.match`. Element: single hyphen, `.srow-title`, `.match-head` (not BEM's `__`). Modifier: double hyphen, `.chip--on`, `.srow--open`, `.card--lg`, `.trow-fill--first`.
- Modifiers are applied **alongside** the base class in JSX (`className={`card srow${expanded ? ' srow--open' : ''}`}`), composed by string concatenation — there is no classnames library and none should be added.
- Prefixes group by screen where classes are screen-local: `srow-`/`crow-` (history rows), `log-`, `match-`, `trow-`, `vol-`, `mrow-`, `hero-`, `focus-`.

## Component contracts

### Chip — `src/components/Chip.tsx`

Props: `{ on: boolean; onClick: () => void; children; variant?: 'filter' | 'dur' | 'tech' }`. Renders `<button class="chip [chip--dur|chip--tech] [chip--on]" aria-pressed={on}>`. Variants differ **only in horizontal padding** (filter 8×15, dur 8×14, tech 8×13 — values from the prototype); `filter` is the default and adds no modifier class. `aria-pressed` is part of the contract — keep it.

Chip **selection semantics are the caller's job**, and both idioms are established:

- **Single-select (radio-like):** `on={value === option}`, click sets — gi/no-gi and training/comp rows in `src/screens/Log.tsx`, round-length `DUR_OPTIONS`, history filter in `src/screens/Sessions.tsx`, match outcome. Two of these allow **toggle-off to empty**: cardio rating (`compForm.cardio === n ? 0 : n`) and the FocusCard linked tag (re-tap clears to `''`).
- **Multi-select:** technique tags in Log (`form.tags.includes(t)`, click toggles membership).

The trailing `+ Add` control in the Log tag picker is a bare `<button class="chip chip--tech">` (not the Chip component — it has no on-state), which swaps to `.chip-input` (an accent-bordered inline text input, width 118px) while adding; commit on Enter/blur, cancel on Escape, guarded by a `committed` ref against double-commit. `+ Add match` in comp mode reuses the same bare-chip-button idiom.

### Stepper — `src/components/Stepper.tsx`

Props: `{ kind: 'minus' | 'plus'; size: 'lg' | 'sm'; accent?: boolean; label: string; onClick }`. Renders `<button class="step step--lg|step--sm [step--accent]" aria-label={label}>` with a Phosphor Minus/Plus (icon size 20 for lg, 16 for sm). Convention: **the plus (increment) side gets `accent` when it is the "primary" direction the user usually taps** — rounds plus, subs-FOR plus, my-points plus are accent; all minus buttons and the "against/them" plus are neutral. Callers clamp at 0 with `Math.max(0, n - 1)` — the component itself has no min/max. `.step::after { inset: -6px }` extends the tap target invisibly; `.icon-btn::after { inset: -8px }` does the same for pencil/close icon buttons — keep this pattern for any new small tap target.

### SessionRow + CompRow — the accordion row pattern

`src/components/SessionRow.tsx` and `src/components/CompRow.tsx` share one CSS block (`.srow`) and one structural rule: **the row root is a single `<button class="card srow">` with `aria-expanded`, and therefore every descendant is a `<span>`, never a `<div>`** — divs inside buttons are invalid HTML that browsers will silently re-parent, breaking layout. Since spans are inline by default, app.css force-blocks the structural children (`.srow-body, .srow-title, .srow-meta, .srow-panel, ... { display: block }`, plus per-class `display: block` on every `crow-*` child and flex on the row containers). **If you add an element inside these rows, it must be a span and you must give its class an explicit `display` in app.css.**

Anatomy: `.srow-main` (always visible) = 40px `.srow-badge` (weekday letters via `weekdayBadge` in `src/dates.ts`; `--gi` accent-tinted for gi sessions; `--comp` shows a Trophy icon with an accent border) + `.srow-title`/`.srow-meta` body + `.srow-right` (big number `.srow-rolls` over a `.micro` caption — rounds count for sessions, W-L(-D) record string for comps). When `expanded`, `.srow-panel` renders below a `neutral-800` border-top: sessions show a `.srow-stats` triplet + `.tagchip` list; comps show per-match lines (`.crow-match`: outcome pill + score + optional submission), a cardio line, and the two note blocks. `.srow--open` swaps the card border to `accent-800`. Expansion state lives in the parent (`expandedId` in `src/App.tsx` — single-open accordion; Home rows navigate to Sessions and open there instead).

### FocusCard — `src/components/FocusCard.tsx`

`card card--accent` (accent-800 border marks it as the special card). Props: `{ variant: 'home' | 'tech'; focus: FocusGoal; progress: FocusProgress; tagList; onChange }`. The variants differ only in where the percentage renders: `home` puts `.focus-pct` in the header row, `tech` puts it in a `.focus-foot` bottom row (per the handoff). The design shipped **no edit UI**; the pencil `.icon-btn` (PencilSimple ⇄ Check) toggling an inline `.focus-panel` below the content is the handoff-sanctioned "real-app addition" — an in-system panel, not a modal (this app has no modals; keep it that way). The panel = `.field-label` + `.input` for the title, and a `chip-wrap` of `tech`-variant Chips for the linked tag (single-select, toggle-off), ordered by `orderTagsByCurriculum` from `src/curriculum.ts` (see [curriculum.md](curriculum.md)). Edits write through `onChange` on every keystroke (state lives in App; localStorage is the source of truth — see [architecture.md](architecture.md)).

### TabBar — `src/components/TabBar.tsx`

The `TABS` array is the registration point: `{ id: Tab; label; icon?: Icon }`. **Adding a screen requires touching three places in lockstep** (coupling table below). An entry **without** an icon renders the raised circular `.tab-log` button (accent outline + glow, `margin-top: -20px`) — that slot is the Log tab and there should only ever be one iconless entry. Active state = `aria-current="page"` + `.tab--active` (accent icon, accent-300 label). Icons come from `@phosphor-icons/react` at size 21 (22 for the log Plus) — the only icon library; stay in it.

| If you change… | …you must also change |
|---|---|
| `TABS` in `src/components/TabBar.tsx` | the `Tab` union in `src/types.ts` — `'dash' \| 'history' \| 'log' \| 'tech' \| 'progress'` — AND the `{tab === '…' && …}` render branches in `src/App.tsx` |
| Any `.chip` padding variant | the `variant` doc comment in `src/components/Chip.tsx` (padding values are stated there) |
| `.srow` child structure (new element in SessionRow/CompRow) | app.css `display: block` coverage for the new span's class |
| Fonts (weights/subsets in `src/main.tsx`) | rule 1 above forbids it; if a subset is ever added, re-check `scripts/sw-precache.mjs` `.woff` exclusion still holds ([build-pwa.md](build-pwa.md)) |
| `.screen` bottom padding or `.tabbar` height | the other one — 110px clearance exists so content scrolls clear of the floating bar |

## Established conventions — reuse, don't reinvent

**The caps system** (three registers of uppercase micro-type, tracked out; `.kicker` and `.section-label` are `font-weight: 500`, `.micro` stays body 400):
- `.kicker` — 11px, letter-spacing 0.08em, neutral-500: the label INSIDE a card, above its content ("This week", "Rounds sparred"). `.kicker--accent` for the FocusCard only.
- `.section-label` — 12px, 0.08em, neutral-400: the label BETWEEN cards, naming a page section ("Recent sessions", "Milestones"); paired with `.section-head` (label + `.link` action on one baseline) or `.label-row` (label alone, 24px top margin).
- `.micro` — 10px, 0.06em, neutral-600, uppercase supplied by the caller in the string ("ROUNDS", "SUBS FOR", "MATCH 1"): the caption under/next to a number. Related: `.field-label` (10px uppercase, form-field labels) and `.cloud-group-label` (10px uppercase, curriculum group headers).

**FOR vs AGAINST coloring** — anything "mine/positive" is `accent-300`, anything "theirs/negative" is neutral. Instances that must stay consistent: `.subs-for` vs `.subs-against` (Home stat card), `.srow-stat-n--for` (session panel), `.subs-half-label--for/--against` (Log steppers), `.match-half-label--me/--them` (match points), `.crow-oc--win` (accent-300) vs `--loss` (neutral-500) vs `--draw` (neutral-400). Any new mine/theirs or win/loss surface uses exactly these two colors.

**dur-row / dur-cap** — a centered row of `dur`-variant chips with a single 11px neutral-600 caption below (`.dur-cap`). Used for round length ("round length"), cardio ("cardio — 1 fine · 5 gassed"), and the When picker's live today/yesterday caption. This is the house pattern for "small option row + explanatory caption".

**The `.input` family** — `.input` is the base (bg `--color-bg`, neutral-700 border, accent caret, accent border on focus, and the mandatory `font-family: inherit`). Modifiers: `.input--sm` (compact, match submission field), `.input--area` (textarea: `resize: none`, min-height 64px), `.input--time` (native `type="time"`: auto width and **`color-scheme: dark`**, without which the browser renders a light-themed time control — keep this on any future native date/time input). `.chip-input` is the separate chip-shaped text input for inline tag creation.

**Numbers over captions** — big 500-weight number, tiny muted caption below, everywhere: hero, stat cards, `.srow-rolls`/ROUNDS, `.srow-stat-n`/micro, `.ring-n`/WEEKS, `.crow-cardio-n`/CARDIO.

**Bar charts are divs** — `.weekbar-fill`, `.vol-fill`, `.trow-fill` with inline `style={{ height }}` or `width` computed in the component against the series max; track = neutral-900, emphasis fill = accent-500 (current/first), secondary = accent-700, default = accent-800. Minimum heights keep zero values visible (4px/2px stubs). No chart library; don't add one.

**Empty-state voice** — `.empty` (13px neutral-500), one sentence, em-dash pivot to the action, no illustrations, no exclamation marks: "No sessions yet — hit the + tab after class." / "No matches yet — add your first below." / "Tag techniques when you log sessions to see them here." Screen subtitles share the terse-encouraging register ("30 seconds now — details optional, later.", "Consistency beats intensity."). The save confirmation is `.saved-msg`: "Session saved — nice work." Match this voice for any new empty/confirmation copy.

## Pre-merge design-fidelity checklist

Before merging any UI change, verify:

1. **No new font weights** — only Inter 400/500; grep the diff for `font-weight` values other than 400/500 and for `font:` shorthand (longhand only).
2. **No hardcoded colors** — every color is a `var(--color-*)` token from nocturne.css; no new hex values in app.css.
3. **Accent discipline** — `--color-accent` used only as border/line/glow/text; any selected-state FILL is `accent-900` (or `accent-800` pressed) with `accent-300` text; buttons outlined, never solid-filled.
4. **CSS placement** — new rules in the correct `/* ── section ── */` block of `src/app.css`, BEM-lite names, nothing added to nocturne.css.
5. **Form controls** — any new input/textarea/select sets `font-family: inherit`; native date/time controls set `color-scheme: dark`.
6. **Buttons contain no divs** — anything inside a `<button>` (rows, chips) is a `<span>` with an explicit `display` in CSS.
7. **Interaction states** — hover rules wrapped in `@media (hover: hover)`; `:active` provided for tappable controls; small targets get an `::after { inset: -6px }`-style hit extension; focus-visible never suppressed without a replacement.
8. **A11y attributes** — `aria-pressed` on toggles, `aria-expanded` on accordions, `aria-label` on icon-only buttons, `aria-current` on the active tab; animations gated on `prefers-reduced-motion`.
9. **Caps + coloring conventions** — kicker/section-label/micro used at the right level; FOR/mine = accent-300, AGAINST/theirs = neutral; numbers-over-captions for stats.
10. **Copy voice** — empty states and confirmations follow the em-dash single-sentence pattern above.
11. **Layout invariants** — content respects `.screen` padding (safe-area top, 110px bottom); charts remain div-based with token fills.
12. `npm test` and `npm run build` green (required before any commit — see [testing.md](testing.md) and [operations.md](operations.md)).
