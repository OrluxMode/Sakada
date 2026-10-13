# OpenCode task: fix the step 02 copy on the landing page

Step 02 of the "How it works" strip says a driver **nearby** accepts the booking. That isn't true: new bookings go to available drivers nationwide, not by distance. Remove the word "nearby". Nothing else changes.

## Reference
- Figma file `8q1102hOL3ZvFsiePuJrQv`, frame "Idea 2 — Landing when logged in (desktop)" (node `33:370`), step 02. Only the step 02 text is in scope. The logged-in nav and the hidden role chips in that frame are a separate later task, so ignore them.

## Files you may touch
- `sakada-web/index.html`

Nothing else. Don't commit.

## The change (`index.html`, around line 214)
Replace:
```html
        <p class="step-body">
          An available driver nearby accepts your booking. You see the estimated
          cost before you confirm.
        </p>
```
with:
```html
        <p class="step-body">
          An available driver accepts your booking. You see the estimated cost
          before you confirm.
        </p>
```

Keep the title "Get matched with a driver" and the step number exactly as they are. Don't add a fare example here (that goes on the How It Works page later).

## Check
- `grep -n "nearby" sakada-web/index.html` returns nothing.
- `cd sakada-web && npx vitest run` still passes (48/48).
