# Saved language and phone alerts setup

These steps use the hosted Supabase SQL Editor; no local Postgres or Docker
is needed. Run commands from the Sakada project root unless a step says
otherwise. Nothing here is deployed automatically by editing the files.

1. **Apply the two migrations.** Open your Supabase project → **SQL Editor**
   → **New query**. Confirm migrations 0001–0026 have already been applied.
   Paste all of `supabase/migrations/0027_profile_language.sql` from this
   backend folder, click **Run**, and confirm success. Repeat with
   `0028_push_subscriptions.sql`. Both can be rerun safely. Existing accounts
   start in English (`en`); saved choices are `en`, `fil`, or `taglish`.

2. **Generate one VAPID key pair.** In a terminal run:

   ```sh
   npx web-push generate-vapid-keys
   ```

   Save the public and private keys securely. Keep this same pair for this
   deployment; replacing it requires phones to subscribe again. The private
   key belongs only in Supabase secrets. The public key also goes on the website.

3. **Add the secrets.** In the project dashboard open **Edge Functions →
   Secrets → Add new secret** (some dashboard versions label this **Manage
   secrets**). Add these values and save:

   | Name | Value |
   |---|---|
   | `VAPID_PUBLIC_KEY` | Generated public key |
   | `VAPID_PRIVATE_KEY` | Generated private key |
   | `VAPID_SUBJECT` | `mailto:` followed by your real contact email |
   | `PUSH_WEBHOOK_SECRET` | A new random value from the command below |

   Generate the webhook value separately:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   This fourth secret authenticates the database webhook. It gives the
   webhook no general database privileges, and avoids putting a service-role
   key in the webhook's trigger definition. Keep it private too. The runtime
   already provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; do not
   paste either server credential into the website.

4. **Deploy `send-push`.** Open **Project Settings → General** and copy the
   project reference (the part before `.supabase.co` in the project URL).
   In the terminal run these commands, replacing `YOUR_PROJECT_REF`:

   ```sh
   cd sakada-backend
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase functions deploy send-push --no-verify-jwt
   ```

   Login opens Supabase in the browser; complete it and return to the
   terminal. Linking may ask for the project's database password. Do not run
   `db push`: migrations in this project are applied through SQL Editor.
   Deployment includes `index.ts`, `handler.ts`, `alert-text.ts`, and
   `transport.ts`. Open **Edge Functions → send-push** and confirm it exists.
   JWT verification is disabled in `supabase/config.toml` because this is a
   webhook. The handler still requires the exact `x-push-webhook-secret` value;
   a signed-in user or public API key cannot invoke it alone.

5. **Create the database webhook.** Open **Database → Webhooks → Enable
   Webhooks** if needed, then **Create a new hook**. Enter:

   | Setting | Value |
   |---|---|
   | Name | `notifications_send_push` |
   | Schema / table | `public` / `notifications` |
   | Events | **Insert** only |
   | Type | **HTTP Request** |
   | Method | `POST` |
   | URL | `https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-push` |
   | Header | `Content-Type`: `application/json` |
   | Header | `x-push-webhook-secret`: the exact secret from step 3 |
   | Timeout | `30000` milliseconds, if editable |

   Click **Create webhook**. The standard webhook automatically supplies the
   inserted row as `record` along with `type`, `schema`, and `table`; no custom
   request body is needed. Do not add a second webhook for this function or
   select Update: marking a notification read must not resend it.

   Database Webhooks use asynchronous `pg_net`: external push-service delays
   and HTTP failures do not roll back or wait inside a booking status update.
   We use the dashboard webhook so its URL and authentication are configured
   outside the schema migrations. See [Supabase Database Webhooks](https://supabase.com/docs/guides/database/webhooks).
   A broken database extension/trigger can still cause SQL errors; this
   isolates network delivery failures, rather than promising immunity from
   every database configuration failure.

6. **Set the website's public key.** In `sakada-web/js/config.js`, paste
   **only the VAPID public key** into the `vapidPublicKey` field Claude adds
   to the config object. It must match `VAPID_PUBLIC_KEY` from step 3.
   The owner publishes the website after its frontend changes are ready.
   The private VAPID key and webhook secret never go in frontend config.

7. **Enable your own phone.** Open the deployed HTTPS website, sign in as
   a farmer or vendor, open **Profile**, choose a language, and enable
   **Phone alerts**. Accept the browser's notification permission request.
   On iPhone/iPad (iOS/iPadOS 16.4+), first use Safari → **Share → Add to Home
   Screen**, then open that Home Screen app to enable alerts. On Android
   Chrome, enable them in the browser. These controls require Claude's
   service worker and frontend implementation. In SQL Editor verify the
   saved account and subscription without exposing endpoint keys:

   ```sql
   select p.id, p.language, count(s.id) as phones
   from public.profiles p
   join auth.users u on u.id = p.id
   left join public.push_subscriptions s on s.user_id = p.id
   where u.email = 'YOUR_SIGN_IN_EMAIL'
   group by p.id, p.language;
   ```

8. **Send yourself a simple test alert.** Replace the email and click
   **Run** in SQL Editor:

   ```sql
   insert into public.notifications (user_id, message)
   select id, 'Sakada phone alerts test.'
   from auth.users where email = 'YOUR_SIGN_IN_EMAIL'
   returning id, created_at;
   ```

   Confirm one row was inserted. Put the phone app in the background. The
   phone should receive **Sakada / Sakada phone alerts test.** This deliberate
   test has no booking, so tapping it opens the role's dashboard.

9. **Test a localized shipment alert and its link.** Use an existing
   booking belonging to your account which has reached one of the five
   supported statuses. Insert a notification referencing it:

   ```sql
   insert into public.notifications (user_id, delivery_id, message)
   select d.requester_id, d.id, 'Shipment phone alert test.'
   from public.deliveries d
   join auth.users u on u.id = d.requester_id
   where u.email = 'YOUR_SIGN_IN_EMAIL'
     and d.status in ('driver_assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled')
   order by d.updated_at desc limit 1
   returning id, delivery_id;
   ```

   If no row returns, first create and advance a real test booking. The alert
   uses that delivery's **current status** and your saved language. Tap it
   and confirm the right shipment opens. Repeat after choosing Filipino and
   Taglish. A real booking status change should produce the same result
   through the existing notification trigger. The payload is
   `{title, body, url, tag}`, where `url` is
   `/dashboard/<role>/index.html#track/<CODE>` and `tag` is the booking code.
   The service worker uses the tag to replace an older alert for that booking.

10. **Check logout and delivery behavior.** Disable alerts and confirm
    the phone's subscription is removed. Enable again, then log out while
    online and verify removal. On a shared phone, sign into another account,
    enable alerts, and verify the endpoint now belongs only to that account.
    The frontend must call `delete_push_subscription` **before** signing out
    (while its authenticated session is still valid), and handle an offline
    logout appropriately. A push already accepted by the external push
    service cannot be recalled by deleting a database row. The sender
    rechecks ownership before sending and guards subsequent cleanup/stamps
    by the subscription's owner and keys.

For troubleshooting, open **Edge Functions → send-push → Invocations / Logs**.
HTTP 401 means the webhook secret header is missing or differs. HTTP 400
means the event is not an Insert on `public.notifications`. HTTP 204 means
the notification/profile is gone or the account has no subscriptions. HTTP
200 reports successful sends (and may also include expired/skipped phones).
HTTP 502 means one or more pushes failed; logged subscription IDs and status
codes help investigate without exposing endpoints or keys. A 404/410 from
the push service removes the stale phone; other errors retain it. Successful
sends stamp `last_sent_at`, which means the service accepted the push, not
that the user saw it. Browser permissions, Focus mode and OS settings can
still hide alerts.

Messages have a 12-hour TTL. The function reads current delivery state when
it runs, so delayed events may show a newer status. Database Webhooks do not
provide a durable, exactly-once push queue here: outages may lose an alert,
and manual replays may resend one. In-app notifications remain the durable
record. A failed invocation is independent of the original booking update;
replaying the standard webhook JSON with its existing notification ID and
private header is possible from the function's dashboard test tool.

Local verification (PGlite uses an auth stub and Storage DDL stub):

```sh
npm install --prefix /tmp/sakada-text-limits-test @electric-sql/pglite
NODE_PATH=/tmp/sakada-text-limits-test/node_modules node sakada-backend/tests/language-and-push.cjs
npx --yes --package=deno deno check sakada-backend/supabase/functions/send-push/index.ts
npx --yes --package=deno deno test --allow-env sakada-backend/supabase/functions/send-push/send-push_test.ts
```

The Deno tests exercise exact localized copy, webhook authentication,
per-phone failure handling, expiry cleanup, and real Web Push encryption /
VAPID signing with a mocked HTTP transport. Hosted device delivery still
needs steps 7–10. The npm Web Push library generates signed/encrypted request
details; native `fetch` sends them with a timeout and redirects disabled,
avoiding Node HTTPS transport assumptions in the Edge runtime. See the
[Web Push library API](https://github.com/web-push-libs/web-push#generaterequestdetailspushsubscription-payload-options)
and [Supabase function configuration](https://supabase.com/docs/guides/functions/function-configuration).
