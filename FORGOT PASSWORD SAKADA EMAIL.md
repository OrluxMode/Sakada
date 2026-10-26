# Forgot password: Sakada email setup

**Priority: low** (owner decision 2026-10-27). Do this before real users rely
on Forgot password or sign-up confirmation emails.

## Why

Forgot password works (commit `7004e07`), but Supabase's built-in email sender
is only meant for testing:

- it might only send to addresses on your Supabase team
- it allows about 2 emails an hour

Custom SMTP fixes both. The cheapest free way is to send through a Gmail
account. No domain needed, about 10 minutes.

## Already done

Supabase → Authentication → URL Configuration → Redirect URLs has:

- `https://sakada-blue.vercel.app/auth/reset-password.html`
- `http://localhost:4400/**`
- `http://192.168.254.156:4400/**` (phone testing; can be deleted later)

## Steps

### 1. Get a Gmail app password

1. Use a Gmail account just for the app, e.g. `sakadalogistics@gmail.com`,
   not a personal one. Users will see this address.
2. Turn on **2-Step Verification** for it:
   https://myaccount.google.com/security
   (app passwords don't show up without it).
3. Go to https://myaccount.google.com/apppasswords, type a name like
   `Supabase`, click **Create**.
4. Copy the 16-letter password. It is shown only once.

### 2. Put it in Supabase

**Authentication → Emails → SMTP Settings** (older dashboards: Project
Settings → Authentication). Turn on **Enable custom SMTP**:

| Field | Value |
|---|---|
| Sender email | `sakadalogistics@gmail.com` |
| Sender name | `Sakada Logistics` |
| Host | `smtp.gmail.com` |
| Port | `465` |
| Username | `sakadalogistics@gmail.com` |
| Password | the 16-letter app password, no spaces |

Click **Save**.

### 3. Raise the email limit

**Authentication → Rate Limits** → set "emails per hour" to around `30`.
With custom SMTP you control this limit instead of Supabase.

### 4. Test it

On the live site, tap **Forgot password?** and use an email that isn't on
your Supabase team (e.g. a friend's). If it arrives (check Spam), it's done.
Sign-up confirmation emails will come from Gmail too.

### 5. Optional: nicer email

**Authentication → Emails → Templates → Reset Password**: change the subject
to something like "Set a new Sakada password". Keep `{{ .ConfirmationURL }}`
in the body, because that's the link itself.

## Limits to know

- Gmail allows about 500 emails a day, which is fine for now.
- Some emails may land in Spam because they come from a gmail.com address.

## Later: own domain

Once a domain like `sakadalogistics.ph` actually points to the site, switch
to **Resend** or **Brevo** (both have free plans) so emails come from
`no-reply@sakadalogistics.ph` and are less likely to land in Spam. Ask Claude
to walk through it then.
