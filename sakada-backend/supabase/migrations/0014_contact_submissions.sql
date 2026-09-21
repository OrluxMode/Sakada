-- Contact form submissions table.
-- Anyone can submit (INSERT), only admins can read (SELECT).

create table if not exists contact_submissions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  message    text not null,
  created_at timestamptz not null default now()
);

alter table contact_submissions enable row level security;

-- Drop existing policies if re-running this migration
drop policy if exists "anyone can submit contact form" on contact_submissions;
drop policy if exists "admins can view contact submissions" on contact_submissions;

-- Anyone can submit (the form is public)
create policy "anyone can submit contact form"
  on contact_submissions for insert
  with check (true);

-- Only admins can read submissions
create policy "admins can view contact submissions"
  on contact_submissions for select
  using (is_admin());
