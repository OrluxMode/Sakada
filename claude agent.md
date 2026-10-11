# Claude Agent — Conversation Memory for Sakada

> **How to use:** start a new session with something like
> *"read `claude agent.md`"* (or *"read claude agent.md and claude read and analyze.md"*).
> Claude will pick up from here. Append a new entry to the log below at the end of each session.

---

## Who / what

- **User:** Orlux (GitHub `OrluxMode`), building **Sakada Logistics**, an agri-delivery platform (farmers/vendors ↔ truck drivers ↔ admin).
- **Local path:** `/home/orlux/Desktop/Sakada`
- **Repo:** `https://github.com/OrluxMode/Sakada.git` (public, branch `main`)
- **Live:** `https://sakada-blue.vercel.app` (Vercel auto-deploys on push to `main`)
- **Supabase project:** `aeeniueayubeugvooyqj`. Credentials live only in `sakada-web/js/config.js`.
- **Stack:** vanilla HTML/CSS/ES modules (no build) + Supabase (Postgres/Auth/Realtime/RLS) + Mapbox. Tests: Vitest + jsdom.

## Working preferences (learned)

- When the user says **"read and analyze only"**, don't modify project files. Only create the report files they ask for.
- Verify claims with evidence (commands, file:line, pixel analysis for screenshots). Earlier sessions found that eyeballing screenshots was unreliable.
- Write findings as `.md` files in the project root so they're easy to recall later.
- Network calls to the live Supabase API from Claude got **blocked by the permission classifier** this session. Ask the user before trying, or ask them to check in the dashboard.

## Key files to read first when resuming

| File | Why |
|---|---|
| `claude read and analyze.md` | Full analysis from 2026-10-10: architecture + 23 new findings (N1–N23) + priority list |
| `SESSION-NOTES-2026-10-03.md` | Previous session: Vercel deploy, CSS P0 fixes, dashboard redirect fix |
| `things-to-improve.md` | Phased roadmap (Phases 1–8 ✅, 9 CI/CD and 10 PWA/i18n open) |
| `things-to-improve-design.md` | Design tokens/animation specs, P0–P3 design backlog |
| `need to fix.md` | Older QA audit (several items already fixed; see analysis §5) |

## Conversation log

### 2026-10-10: Read & analyze session
- **Asked:** read and analyze the whole project (read-only), then write `claude read and analyze.md` and this `claude agent.md`.
- **Did:** read all JS, HTML structure, CSS tokens, all 14 migrations, docs, and planning notes. Ran `npx vitest run` → 41/41 pass. No project files modified.
- **Top findings** (details in the analysis file):
  1. **N1** Contact form inserts `phone/role/purpose` but migration 0014 lacks those columns → likely fails. *Unverified live.*
  2. **N2** Google sign-in role is dropped (`signInWithOAuth` ignores `options.data`) → all Google users become farmers.
  3. **N3** Driver ratings target the driver themselves (`dashboard-shared.js:83`), and RLS doesn't stop it.
  4. **N4/N5** Driver (and pending requester) can edit any delivery column, and `estimated_cost` is set by the client.
  5. **N6** Rate limiting is client-called with client-chosen limits, so it isn't enforced.
  6. **N7** All profiles (incl. phone) are readable by any logged-in user.
  7. **N12** `farmer-dashboard.js` ≡ `vendor-dashboard.js` except one word.
- **Open from before:** og:image domain, `console.warn` in auth.js, unused hero-mobile.jpg, empty assets/images, callback font, status-pill tokens, notif panel animation, shadow tokens, ESLint/CI/E2E, Kairo palette decision, untracked screenshots.
- **Next suggested step:** verify N1 on the live site, then write a `0015` migration (contact columns) and a `0016` RLS hardening migration (N3, N4, N21).

### 2026-10-11: Installed impeccable skill
- User pasted `https://github.com/pbakaus/impeccable`. Cloned to scratchpad, reviewed, installed **v4.5.2** to `.claude/skills/impeccable/` (project scope).
- Launcher `scripts/impeccable` downloads an engine binary on first run from that repo's GitHub releases, checksum-verified (sha256).
- Old custom Sakada version still lives at `.opencode/skills/impeccable/` (OpenCode only, not used by Claude Code).
- Use: `/impeccable audit sakada-web/dashboard/farmer/index.html`, `/impeccable polish ...`, `/impeccable critique ...`, etc.

<!-- Add the next session's entry above this line -->
