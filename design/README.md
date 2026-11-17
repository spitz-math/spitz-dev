# spitz.dev color system (proposal)

Status: **proposal for review.** `index.html` (the live board) does not load these tokens yet. Open `design/preview.html` to see every token in use, with a live contrast table.

Files:
- `tokens.css` — every color as a CSS custom property, prefixed `--sd-`.
- `preview.html` — review page: neutrals, identities, statuses, actor + status cards, buttons, The Void, auxiliary hues, contrast check. Works at phone width and respects reduced motion.

## Hierarchy

| level | prefix | job | rule |
|---|---|---|---|
| 0 | `--sd-bg`, `--sd-panel`, `--sd-text` … | neutral structure | most of every screen |
| 1 | `--sd-id-*` | identity: who/what it belongs to | spitz/Kody orange, The Void violet, ChatGPT cyan, Claude crimson |
| 2 | `--sd-st-*` | status: what state it is in | always icon + word, never color alone |
| 3 | `--sd-act-*` | interaction: what you can do | primary orange, danger rose |
| 4 | `--sd-aux-*` | charts, art, exploration | carries no meaning, not assigned to anyone |
| 5 | `--sd-atmo-*` | tonal overlays | decoration only |

When two rules conflict: **accessibility > status meaning > identity > brand > decoration.**

## Identity

Each identity has up to three shades:
- base — fills, large marks, dots
- `-text` — small text
- `-line` — borders and outline icons (at least 3:1 on every surface)

| who | base | text | line |
|---|---|---|---|
| spitz.dev / Kody | `#FF892E` | `#FFAC6F` | `#FF892E` |
| The Void | `#AD5CFF` | `#CEADFF` | `#AD5CFF` |
| ChatGPT | `#19CFF5` | `#9BEAFF` | `#19CFF5` |
| Claude | `#B82E49` | `#E77791` | `#D0445F` |
| reserved: basic AI | `#F4C84D` | — | — |
| reserved: advanced AI | `#20D99C` | — | — |

**Claude crimson.** `#B82E49` is 3.27:1 on bg and 2.38:1 on overlay, so it fails as small text and as a thin border. It is used only as a fill (with `#F2F0F8` text on it, 5.28:1) or a thick edge (the 4px card edge). Small text uses `#E77791` (6.91:1). Borders use a new `#D0445F` (4.34 on bg, 3.16 on overlay), added because the base crimson fails 3:1 for thin lines on every panel shade. Tradeoff: the chip and the card border read a little brighter and pinker than the "deep crimson" in the swatch. The deep shade still shows on fills and edges.

## Status

| state | color | icon |
|---|---|---|
| success / done | mint `#8ED8B1` | ✓ |
| warning / blocked | amber `#E9BD70` | ! |
| error / failed | rose `#FF8293` | × |
| info / needs review | periwinkle `#9EB8EE` | i |
| working / neutral | slate `#A5A8B5` | ◌ (spins unless reduced motion) |

Status hues are softer and lighter than identity hues so they don't read as an agent. Mint is not the reserved green, amber is not the reserved yellow, rose is not Claude crimson. Tradeoff: on a Claude card that failed, the crimson edge and the rose pill sit next to each other and are in the same red family. The × and the word "failed" carry the meaning; the edge shows only who the card belongs to. The same goes for a ChatGPT card that is done: cyan edge, mint "done" pill.

## Interaction

Primary action orange; links `#D4DCF4`; hover `#FFAD74`; focus ring `#FFE2AA` (2px); destructive = error rose; disabled = slate + dimmed. Claude crimson is never a "danger" color.

## Products

- **spitz.dev studio** — mostly neutral, orange navigation and primary actions.
- **The Void** — `--sd-atmo-void` purple-black background; violet only for its title and hover; the five categories are neutral tags, not five colors.
- **Arcade, Checkpoint, Off the Clock** — keep their own looks. Don't repaint them to match these colors.

## Migrating index.html (not done in this PR)

Current live tokens, and what each would map to:

| live | now | proposed | note |
|---|---|---|---|
| `--bg` `#0a0a0b` | near-black | `--sd-bg` `#0B0C14` | slight blue-black |
| `--panel` / `--panel2` | charcoal | `--sd-panel` / `--sd-raised` | |
| `--line` `#2a2b2f` | | `--sd-line` | |
| `--ink` / `--muted` | | `--sd-text` / `--sd-muted` | |
| `--orange` `#fc7301` | | `--sd-id-spitz` `#FF892E` | lighter. Text on orange fills stays dark |
| `--orange2`, `--link` `#ff9a3d` | | `--sd-act-hover` / `--sd-act-link` | links become neutral and turn orange on hover |
| `--chatgpt` `#20e6ae` (jade) | | `--sd-id-chatgpt` cyan | |
| `--claude` `#b45aff` (purple) | | crimson set | text → `-text`, borders → `-line` |
| `--bad` `#ff5a5f` | | `--sd-st-error` | |
| `--done` `#6f6e6a` | | `--sd-st-working` / `--sd-muted` | |

Places on the live board where a color now means two things. The migration should fix these:
- `.ok` (success text) uses `--chatgpt`. → `--sd-st-success` plus a ✓.
- `.live i` (connected dot) uses `--chatgpt`, and `--bad` for offline. → status colors plus the word "live"/"offline" (the word is already there).
- `.state.warn` and `.state.bad` both use `--bad`. → split into warning amber and error rose.
- `:focus-visible` is a 1px orange outline. → 2px `--sd-act-focus`.
- Column headings `.col h2` use `--c` as text. → `-text` shades so Claude's heading is readable.

Suggested order: (1) load `tokens.css` and alias the old names to the new ones in one commit, (2) fix the double meanings above, (3) check at phone width and with reduced motion. That would be a separate PR, after Kody signs off on the palette.
