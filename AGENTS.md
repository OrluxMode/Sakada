# Project rules

## Shared instructions for Codex, Claude, and OpenCode

These rules apply to every agent working in this repository. Choose and read
the relevant skill's `SKILL.md` before starting the assigned work; the owner
does not need to name the skill each time. This routing is explicitly
authorized by the owner (2026-10-17), including the task-specific skills below
that otherwise require explicit invocation. Load only the skills needed for
the task, not the whole collection.

## Design work → use the impeccable skill

Whenever a task involves designing, redesigning, shaping, critiquing, polishing,
or otherwise improving any frontend UI (landing pages, app screens, components,
dashboards, forms, empty states, theming, motion, typography, layout, color,
responsive or accessibility work on a visible surface), load the `impeccable`
skill first and follow it for the whole task.

This applies whether the request names a design tool or just says things like
"build this page", "make it look better", "fix the design", "match this Figma".

Do not skip it for small polish or "just match the mock" tasks — the skill's
brief-wins, craft-floor, and batched-verification rules apply to those too.

Setup command (run once per session, from the project root):

```
.claude/skills/impeccable/scripts/impeccable context --target <changed-file>
```

## Additional skills by task

Owner-confirmed task assignments (load automatically when applicable):

| Task | Best fit |
|---|---|
| Page layout, hierarchy, typography, colors, UX critique | Impeccable |
| Component polish and interaction details | emil-design-eng |
| Phone behavior: keyboard, safe areas, touch, scrolling | mobile-native |
| Building and reviewing animations | animate / review-animations |
| Testing long addresses, missing data, large fares, empty lists | break-ui |
| Comparing working alternatives in a browser | prototype |

Impeccable remains the primary design workflow, including Figma work. Add the
appropriate specialist when the task calls for it:

| Assigned work | Read before doing the work |
| --- | --- |
| Page layout, hierarchy, typography, colors, UX critique | `.claude/skills/impeccable/SKILL.md` |
| Component polish and interaction details | `.opencode/skills/emil-design-eng/SKILL.md` |
| Mobile web behavior: touch, keyboard, viewport, safe areas, scrolling | `.opencode/skills/mobile-native/SKILL.md` |
| Build an animation or transition | `.opencode/skills/animate/SKILL.md` |
| Review existing animation or motion | `.opencode/skills/review-animations/SKILL.md` |
| Diagnose animation stutter or performance | `.opencode/skills/animation-performance/SKILL.md` |
| Survey existing motion and plan improvements | `.opencode/skills/improve-animations/SKILL.md` |
| Find useful opportunities for motion | `.opencode/skills/find-animation-opportunities/SKILL.md` |
| Stress-test UI with long text, missing data, large amounts, or empty lists | `.opencode/skills/break-ui/SKILL.md` |
| Explore alternative working UI designs in the browser | `.opencode/skills/prototype/SKILL.md` |

Other installed skills are used only when their actual scope matches the task.
Do not introduce React, Expo, Swift, Sonner, or another dependency just because
a skill contains examples using it; Sakada uses vanilla HTML/CSS/ES modules.

Read referenced supporting files when the selected skill requires them. If a
required skill is missing or inaccessible, report it instead of silently
skipping it. Repository skill files can be read directly even when they are
not listed in an agent's skill menu.

The owner's brief, product facts, approved visual identity, and task scope
take precedence over generic skill preferences. Resolve conflicting advice
using that context; do not combine incompatible styling or motion rules.

## Figma-first design and implementation handoff

For new or redesigned UI, agree on scope, design desktop/mobile and relevant
states in Figma, and obtain the owner's design approval before implementation.
Check technical feasibility early when needed. Preserve existing approved
frames when making new design rounds.

Roles (owner decision 2026-10-20): **Claude owns the frontend** (`sakada-web/`:
design, build, review). **Codex owns the backend** (`sakada-backend/`: Supabase
migrations, RLS, SQL). **OpenCode is paused** until the owner says otherwise.
Stay in your own lane; when a change needs the other side, write a short
handoff note instead of editing it. Name backend handoffs for Codex
`codex prompt - <topic>.md` in the project root (local, ignored by Git).

Workflow: design/specification → approved design → implementation by the
owning agent → review → owner push. Include the applicable skill paths and the
instruction to read them in any agent handoff. Implementation should preserve
the approved design; specialist skills refine behavior within that scope.

Existing OpenCode prompt files may be used as build specs. They stay local
and ignored by Git. The owner
commits and pushes manually unless they explicitly request otherwise.
