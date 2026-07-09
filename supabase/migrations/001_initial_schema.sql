-- =============================================================================
-- PracticeOwn — Initial Schema (HIPAA-compliant)
-- =============================================================================
-- This migration creates the full database layer for PracticeOwn:
--   0. Extensions
--   1. Helper functions used by RLS policies and triggers
--   2. Tables
--   3. Indexes
--   4. Triggers (updated_at, CAQH due-date, credential status, audit log,
--      independence score recalculation)
--   5. Row Level Security (default-deny, enabled + forced on every table)
--   6. Independence score calculation
--   7. Storage buckets + storage RLS
--
-- Design notes / deliberate interpretations of the spec (flagged so they are
-- easy to revisit):
--   - `clinicians.caqh_username` is stored encrypted at the column level
--     (pgcrypto, via Supabase Vault for the symmetric key) rather than as
--     plain TEXT, per the "(encrypted)" annotation in the spec. Application
--     code must go through `set_clinician_caqh_username()` /
--     `get_clinician_caqh_username()` RPCs rather than reading/writing the
--     column directly through PostgREST.
--   - Access to a practice's data is granted to the practice owner
--     (`practices.owner_id`) OR any clinician whose own `user_id` is linked
--     to a clinician row in that practice (`is_practice_member`). The spec
--     didn't define a distinct staff/roles table, so this two-way check is
--     the simplest model that satisfies "users can only see their own
--     practice" while still letting an employed clinician log in and see
--     their practice's shared data.
--   - "Independence score recalculation ... fires on INSERT/UPDATE" is
--     extended to also fire on DELETE (losing a payer contract or a
--     credential should lower the score too) and additionally on `alerts`
--     changes (dismissing a critical alert is one of the scored factors).
--   - Table-level GRANTs are revoked from `anon`/`authenticated` and
--     re-granted explicitly per table, in addition to RLS, so "default
--     deny" holds at both the grant layer and the row-security layer.
-- =============================================================================


-- =============================================================================
-- 0. EXTENSIONS
-- =============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
-- Supabase Vault, used to store the symmetric key that encrypts
-- clinicians.caqh_username_encrypted. On Supabase-hosted projects this is
-- generally already available; `if not exists` makes this migration safe to
-- re-run and safe on self-hosted stacks where it has already been enabled.
create extension if not exists "supabase_vault";


-- =============================================================================
-- 1. HELPER FUNCTIONS (used by RLS policies; declared before the tables that
--    reference them are protected, but must be created after `practices` and
--    `clinicians` exist since they query those tables)
-- =============================================================================
-- NOTE: the actual `create function` statements for is_practice_member(),
-- is_practice_owner(), and the CAQH encryption helpers are placed after the
-- table definitions in section 2, since they query those tables. They are
-- documented here as a single logical group for readability.


-- =============================================================================
-- 2. TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- practices
-- -----------------------------------------------------------------------------
create table public.practices (
  id                      uuid primary key default uuid_generate_v4(),
  owner_id                uuid not null references auth.users(id) on delete cascade,
  name                    text not null,
  state                   text not null,
  plan                    text not null default 'trial'
                            check (plan in ('trial', 'solo', 'group', 'enterprise')),
  stripe_customer_id      text unique,
  stripe_subscription_id  text unique,
  subscription_status     text default 'inactive',
  trial_ends_at           timestamptz default (now() + interval '14 days'),
  independence_score      integer default 0,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

comment on table public.practices is
  'One row per tenant. Access is scoped to the owner and any linked clinicians (see is_practice_member).';

-- -----------------------------------------------------------------------------
-- clinicians
-- -----------------------------------------------------------------------------
create table public.clinicians (
  id                          uuid primary key default uuid_generate_v4(),
  practice_id                 uuid not null references public.practices(id) on delete cascade,
  user_id                     uuid references auth.users(id) on delete set null,
  first_name                  text not null,
  last_name                   text not null,
  email                       text not null,
  license_type                text not null
                                 check (license_type in
                                   ('LCSW', 'LPC', 'LMFT', 'PhD', 'PsyD', 'MD', 'NP', 'Other')),
  npi_individual               text,
  npi_group                    text,
  caqh_id                       text,
  -- Encrypted at rest via pgcrypto (pgp_sym_encrypt/decrypt). Never store or
  -- select plaintext directly — use set_clinician_caqh_username() /
  -- get_clinician_caqh_username() defined below.
  caqh_username_encrypted      bytea,
  caqh_last_attested_at        date,
  -- Auto-computed by the set_caqh_next_attestation_due trigger below:
  -- caqh_last_attested_at + 120 days.
  caqh_next_attestation_due    date,
  is_primary_clinician         boolean default false,
  created_at                   timestamptz default now(),
  updated_at                   timestamptz default now(),

  constraint clinicians_practice_email_unique unique (practice_id, email)
);

comment on table public.clinicians is
  'Clinicians (providers) belonging to a practice. May optionally be linked to a Supabase auth user via user_id.';
comment on column public.clinicians.caqh_username_encrypted is
  'pgp_sym_encrypt ciphertext. Use set_clinician_caqh_username()/get_clinician_caqh_username() RPCs, never read/write directly.';

-- -----------------------------------------------------------------------------
-- credentials
-- -----------------------------------------------------------------------------
create table public.credentials (
  id                  uuid primary key default uuid_generate_v4(),
  clinician_id        uuid not null references public.clinicians(id) on delete cascade,
  practice_id         uuid not null references public.practices(id) on delete cascade,
  type                text not null
                        check (type in
                          ('license', 'malpractice', 'dea', 'caqh', 'npi', 'payer_enrollment', 'other')),
  name                text not null,
  issuing_body        text,
  credential_number   text,
  issue_date          date,
  expiry_date         date,
  renewal_date        date,
  status              text default 'active'
                        check (status in ('active', 'expiring_soon', 'expired', 'pending', 'unknown')),
  -- Path within the `practice-documents` storage bucket, not a public URL.
  document_path       text,
  notes               text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

comment on table public.credentials is
  'Licenses, malpractice coverage, DEA registrations, CAQH/NPI records, and payer-enrollment credentials.';

-- -----------------------------------------------------------------------------
-- payer_enrollments
-- -----------------------------------------------------------------------------
create table public.payer_enrollments (
  id                    uuid primary key default uuid_generate_v4(),
  clinician_id          uuid not null references public.clinicians(id) on delete cascade,
  practice_id           uuid not null references public.practices(id) on delete cascade,
  payer_name            text not null,
  payer_id              text,
  enrollment_type       text not null
                          check (enrollment_type in
                            ('direct', 'headway', 'grow_therapy', 'alma', 'other_platform')),
  contract_owner        text check (contract_owner in ('practice', 'platform', 'unknown')),
  npi_used              text check (npi_used in ('individual', 'group', 'platform')),
  status                text default 'pending'
                          check (status in
                            ('pending', 'submitted', 'in_review', 'active', 'inactive', 'denied', 'reattesting')),
  submitted_at          date,
  approved_at           date,
  reattestion_due_at    date,
  monthly_rate_cents    integer,
  notes                 text,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

comment on table public.payer_enrollments is
  'Insurance payer enrollments per clinician, whether direct-contracted or via a credentialing platform.';

-- -----------------------------------------------------------------------------
-- documents
-- -----------------------------------------------------------------------------
create table public.documents (
  id                    uuid primary key default uuid_generate_v4(),
  practice_id           uuid not null references public.practices(id) on delete cascade,
  clinician_id          uuid not null references public.clinicians(id) on delete cascade,
  credential_id         uuid references public.credentials(id) on delete set null,
  payer_enrollment_id   uuid references public.payer_enrollments(id) on delete set null,
  file_name             text not null,
  file_path             text not null,
  file_type             text,
  file_size_bytes       integer,
  uploaded_by           uuid references auth.users(id),
  created_at            timestamptz default now()
);

comment on table public.documents is
  'Metadata for files stored in the practice-documents storage bucket.';

-- -----------------------------------------------------------------------------
-- alerts
-- -----------------------------------------------------------------------------
create table public.alerts (
  id                uuid primary key default uuid_generate_v4(),
  practice_id       uuid not null references public.practices(id) on delete cascade,
  clinician_id      uuid references public.clinicians(id) on delete cascade,
  credential_id     uuid references public.credentials(id) on delete set null,
  type              text not null
                      check (type in
                        ('caqh_attestation', 'license_expiry', 'malpractice_expiry', 'dea_expiry',
                         'payer_reattestion', 'document_missing', 'score_drop', 'other')),
  severity          text default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  title             text not null,
  description       text,
  due_date          date,
  is_read           boolean default false,
  is_dismissed      boolean default false,
  email_sent_at     timestamptz,
  created_at        timestamptz default now()
);

comment on table public.alerts is
  'System-generated notifications surfaced in the dashboard (renewals, attestations, score changes, etc).';

-- -----------------------------------------------------------------------------
-- independence_scores
-- -----------------------------------------------------------------------------
create table public.independence_scores (
  id                uuid primary key default uuid_generate_v4(),
  practice_id       uuid not null references public.practices(id) on delete cascade,
  score             integer not null check (score >= 0 and score <= 100),
  score_breakdown   jsonb not null,
  computed_at       timestamptz default now()
);

comment on table public.independence_scores is
  'Historical log of independence score computations. Written only by recalculate_independence_score().';

-- -----------------------------------------------------------------------------
-- roadmap_steps
-- -----------------------------------------------------------------------------
create table public.roadmap_steps (
  id              uuid primary key default uuid_generate_v4(),
  practice_id     uuid not null references public.practices(id) on delete cascade,
  module          text not null
                    check (module in
                      ('ownership', 'credentials', 'independence', 'exit_planner', 'documentation')),
  step_number     integer not null,
  title           text not null,
  description     text,
  action_url      text,
  is_completed    boolean default false,
  completed_at    timestamptz,
  priority        text default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  due_date        date,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  constraint roadmap_steps_module_step_unique unique (practice_id, module, step_number)
);

comment on table public.roadmap_steps is
  'Per-practice checklist items grouped by product module.';

-- -----------------------------------------------------------------------------
-- audit_log (HIPAA mandatory)
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete set null,
  -- Intentionally NOT a foreign key: audit rows must remain even if the
  -- referenced practice is later deleted, for compliance retention.
  practice_id   uuid,
  action        text not null
                  check (action in
                    ('INSERT', 'UPDATE', 'DELETE', 'SELECT_PHI', 'LOGIN', 'LOGOUT', 'FILE_ACCESS', 'EXPORT')),
  table_name    text,
  row_id        uuid,
  old_values    jsonb,
  new_values    jsonb,
  ip_address    inet,
  user_agent    text,
  created_at    timestamptz default now()
);

comment on table public.audit_log is
  'HIPAA-mandatory audit trail. Populated automatically by table triggers for INSERT/UPDATE/DELETE on PHI-bearing tables, and directly by the application for events triggers cannot see (LOGIN, LOGOUT, SELECT_PHI, FILE_ACCESS, EXPORT).';


-- =============================================================================
-- 3. INDEXES
-- =============================================================================

create index idx_practices_owner_id on public.practices (owner_id);

create index idx_clinicians_practice_id on public.clinicians (practice_id);
create index idx_clinicians_user_id on public.clinicians (user_id);

create index idx_credentials_clinician_id on public.credentials (clinician_id);
create index idx_credentials_practice_id on public.credentials (practice_id);
create index idx_credentials_expiry_date on public.credentials (expiry_date);
create index idx_credentials_status on public.credentials (status);
create index idx_credentials_expiring
  on public.credentials (expiry_date)
  where status in ('active', 'expiring_soon');

create index idx_payer_enrollments_clinician_id on public.payer_enrollments (clinician_id);
create index idx_payer_enrollments_practice_id on public.payer_enrollments (practice_id);
create index idx_payer_enrollments_status on public.payer_enrollments (status);

create index idx_documents_practice_id on public.documents (practice_id);
create index idx_documents_clinician_id on public.documents (clinician_id);
create index idx_documents_credential_id on public.documents (credential_id);
create index idx_documents_payer_enrollment_id on public.documents (payer_enrollment_id);

create index idx_alerts_practice_id on public.alerts (practice_id);
create index idx_alerts_clinician_id on public.alerts (clinician_id);
create index idx_alerts_is_read on public.alerts (is_read) where is_read = false;
create index idx_alerts_is_dismissed on public.alerts (is_dismissed) where is_dismissed = false;
create index idx_alerts_due_date on public.alerts (due_date);

create index idx_independence_scores_practice_id on public.independence_scores (practice_id);
create index idx_independence_scores_computed_at on public.independence_scores (computed_at desc);

create index idx_roadmap_steps_practice_id on public.roadmap_steps (practice_id);

create index idx_audit_log_user_id on public.audit_log (user_id);
create index idx_audit_log_practice_id on public.audit_log (practice_id);
create index idx_audit_log_created_at on public.audit_log (created_at desc);
create index idx_audit_log_table_row on public.audit_log (table_name, row_id);


-- =============================================================================
-- 4a. HELPER FUNCTIONS (practice membership, used by RLS policies below)
-- =============================================================================

create or replace function public.is_practice_member(p_practice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.practices pr
    where pr.id = p_practice_id
      and pr.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.clinicians c
    where c.practice_id = p_practice_id
      and c.user_id = auth.uid()
  );
$$;

comment on function public.is_practice_member(uuid) is
  'True if the current authenticated user is the owner of the practice or a clinician linked to it. Used by every RLS policy below.';

revoke execute on function public.is_practice_member(uuid) from public;
grant execute on function public.is_practice_member(uuid) to authenticated;

create or replace function public.is_practice_owner(p_practice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.practices
    where id = p_practice_id
      and owner_id = auth.uid()
  );
$$;

comment on function public.is_practice_owner(uuid) is
  'True only for the practice owner. Used to gate sensitive practice fields (plan, billing) separately from general membership.';

revoke execute on function public.is_practice_owner(uuid) from public;
grant execute on function public.is_practice_owner(uuid) to authenticated;


-- =============================================================================
-- 4b. TRIGGER FUNCTIONS
-- =============================================================================

-- updated_at maintenance -------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- CAQH next attestation due date -----------------------------------------------
create or replace function public.set_caqh_next_attestation_due()
returns trigger
language plpgsql
as $$
begin
  if new.caqh_last_attested_at is not null then
    new.caqh_next_attestation_due := (new.caqh_last_attested_at + interval '120 days')::date;
  else
    new.caqh_next_attestation_due := null;
  end if;
  return new;
end;
$$;

-- Credential status auto-update -------------------------------------------------
create or replace function public.set_credential_status()
returns trigger
language plpgsql
as $$
begin
  if new.expiry_date is not null then
    if new.expiry_date < current_date then
      new.status := 'expired';
    elsif new.expiry_date < (current_date + interval '90 days')::date then
      new.status := 'expiring_soon';
    elsif new.status in ('expired', 'expiring_soon') then
      -- Expiry date was pushed out (renewed) past the 90-day window; clear
      -- a stale auto-computed status. Manually-set statuses such as
      -- 'pending' or 'unknown' are left untouched.
      new.status := 'active';
    end if;
  end if;
  return new;
end;
$$;

-- Generic audit-log capture for PHI-bearing tables -------------------------------
create or replace function public.audit_table_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_practice_id uuid;
  v_row_id      uuid;
begin
  if tg_op = 'DELETE' then
    v_row_id := old.id;
  else
    v_row_id := new.id;
  end if;

  if tg_table_name = 'practices' then
    v_practice_id := v_row_id;
  elsif tg_op = 'DELETE' then
    v_practice_id := old.practice_id;
  else
    v_practice_id := new.practice_id;
  end if;

  insert into public.audit_log (
    user_id, practice_id, action, table_name, row_id, old_values, new_values
  ) values (
    auth.uid(),
    v_practice_id,
    tg_op,
    tg_table_name,
    v_row_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

comment on function public.audit_table_changes() is
  'SECURITY DEFINER so audit rows are written regardless of the audit_log INSERT policy (e.g. for service-role-driven changes where auth.uid() is null).';

revoke execute on function public.audit_table_changes() from public;


-- =============================================================================
-- 4c. TRIGGERS
-- =============================================================================

-- updated_at on every table that has the column --------------------------------
create trigger trg_practices_set_updated_at
  before update on public.practices
  for each row execute function public.set_updated_at();

create trigger trg_clinicians_set_updated_at
  before update on public.clinicians
  for each row execute function public.set_updated_at();

create trigger trg_credentials_set_updated_at
  before update on public.credentials
  for each row execute function public.set_updated_at();

create trigger trg_payer_enrollments_set_updated_at
  before update on public.payer_enrollments
  for each row execute function public.set_updated_at();

create trigger trg_roadmap_steps_set_updated_at
  before update on public.roadmap_steps
  for each row execute function public.set_updated_at();

-- CAQH attestation due date -----------------------------------------------------
create trigger trg_clinicians_set_caqh_next_attestation_due
  before insert or update on public.clinicians
  for each row execute function public.set_caqh_next_attestation_due();

-- Credential status ---------------------------------------------------------------
create trigger trg_credentials_set_status
  before insert or update on public.credentials
  for each row execute function public.set_credential_status();

-- Audit log: automatic capture on PHI-bearing tables -------------------------------
create trigger trg_audit_practices
  after insert or update or delete on public.practices
  for each row execute function public.audit_table_changes();

create trigger trg_audit_clinicians
  after insert or update or delete on public.clinicians
  for each row execute function public.audit_table_changes();

create trigger trg_audit_credentials
  after insert or update or delete on public.credentials
  for each row execute function public.audit_table_changes();

create trigger trg_audit_payer_enrollments
  after insert or update or delete on public.payer_enrollments
  for each row execute function public.audit_table_changes();

create trigger trg_audit_documents
  after insert or update or delete on public.documents
  for each row execute function public.audit_table_changes();

-- NOTE: the independence-score recalculation triggers (clinicians,
-- credentials, payer_enrollments, alerts) are created in section 6, after
-- trigger_recalculate_independence_score() is defined — CREATE TRIGGER
-- resolves its function immediately, so the function must exist first.


-- =============================================================================
-- 5. ROW LEVEL SECURITY
-- =============================================================================

-- Enable + force RLS on every table (FORCE means even the table owner is
-- subject to policies; service_role still bypasses everything via its
-- BYPASSRLS role attribute, which is what lets backend jobs and the
-- SECURITY DEFINER functions above operate).
alter table public.practices             enable row level security;
alter table public.practices             force row level security;
alter table public.clinicians            enable row level security;
alter table public.clinicians            force row level security;
alter table public.credentials           enable row level security;
alter table public.credentials           force row level security;
alter table public.payer_enrollments     enable row level security;
alter table public.payer_enrollments     force row level security;
alter table public.documents             enable row level security;
alter table public.documents             force row level security;
alter table public.alerts                enable row level security;
alter table public.alerts                force row level security;
alter table public.independence_scores   enable row level security;
alter table public.independence_scores   force row level security;
alter table public.roadmap_steps         enable row level security;
alter table public.roadmap_steps         force row level security;
alter table public.audit_log             enable row level security;
alter table public.audit_log             force row level security;

-- Belt-and-suspenders default deny at the GRANT layer, independent of RLS.
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant usage on schema public to authenticated;

-- practices ---------------------------------------------------------------------
grant select, insert, update on public.practices to authenticated;

create policy practices_select on public.practices
  for select to authenticated
  using (public.is_practice_member(id));

create policy practices_insert on public.practices
  for insert to authenticated
  -- No practice exists yet at insert time, so membership can't be checked;
  -- a user may only create a practice they own.
  with check (owner_id = auth.uid());

create policy practices_update on public.practices
  for update to authenticated
  using (public.is_practice_owner(id))
  with check (public.is_practice_owner(id));

-- No delete policy: practices cannot be deleted through the API. Deletion is
-- an offline/support-tooling operation performed with the service role.

-- clinicians ----------------------------------------------------------------------
grant select, insert, update, delete on public.clinicians to authenticated;

create policy clinicians_select on public.clinicians
  for select to authenticated
  using (public.is_practice_member(practice_id));

create policy clinicians_insert on public.clinicians
  for insert to authenticated
  with check (public.is_practice_member(practice_id));

create policy clinicians_update on public.clinicians
  for update to authenticated
  using (public.is_practice_member(practice_id))
  with check (public.is_practice_member(practice_id));

create policy clinicians_delete on public.clinicians
  for delete to authenticated
  using (public.is_practice_member(practice_id));

-- credentials -----------------------------------------------------------------------
grant select, insert, update, delete on public.credentials to authenticated;

create policy credentials_select on public.credentials
  for select to authenticated
  using (public.is_practice_member(practice_id));

create policy credentials_insert on public.credentials
  for insert to authenticated
  with check (public.is_practice_member(practice_id));

create policy credentials_update on public.credentials
  for update to authenticated
  using (public.is_practice_member(practice_id))
  with check (public.is_practice_member(practice_id));

create policy credentials_delete on public.credentials
  for delete to authenticated
  using (public.is_practice_member(practice_id));

-- payer_enrollments -----------------------------------------------------------------
grant select, insert, update, delete on public.payer_enrollments to authenticated;

create policy payer_enrollments_select on public.payer_enrollments
  for select to authenticated
  using (public.is_practice_member(practice_id));

create policy payer_enrollments_insert on public.payer_enrollments
  for insert to authenticated
  with check (public.is_practice_member(practice_id));

create policy payer_enrollments_update on public.payer_enrollments
  for update to authenticated
  using (public.is_practice_member(practice_id))
  with check (public.is_practice_member(practice_id));

create policy payer_enrollments_delete on public.payer_enrollments
  for delete to authenticated
  using (public.is_practice_member(practice_id));

-- documents -----------------------------------------------------------------------
grant select, insert, update, delete on public.documents to authenticated;

create policy documents_select on public.documents
  for select to authenticated
  using (public.is_practice_member(practice_id));

create policy documents_insert on public.documents
  for insert to authenticated
  with check (public.is_practice_member(practice_id));

create policy documents_update on public.documents
  for update to authenticated
  using (public.is_practice_member(practice_id))
  with check (public.is_practice_member(practice_id));

create policy documents_delete on public.documents
  for delete to authenticated
  using (public.is_practice_member(practice_id));

-- alerts ------------------------------------------------------------------------
-- Alerts are system-generated (triggers / scheduled jobs using the service
-- role, which bypasses RLS). Practice members may read them and toggle
-- is_read/is_dismissed, but cannot create or delete them directly.
grant select, update on public.alerts to authenticated;

create policy alerts_select on public.alerts
  for select to authenticated
  using (public.is_practice_member(practice_id));

create policy alerts_update on public.alerts
  for update to authenticated
  using (public.is_practice_member(practice_id))
  with check (public.is_practice_member(practice_id));

-- independence_scores ----------------------------------------------------------------
-- Read-only for practice members; every row is written by
-- recalculate_independence_score() (SECURITY DEFINER, bypasses RLS).
grant select on public.independence_scores to authenticated;

create policy independence_scores_select on public.independence_scores
  for select to authenticated
  using (public.is_practice_member(practice_id));

-- roadmap_steps -------------------------------------------------------------------
grant select, insert, update, delete on public.roadmap_steps to authenticated;

create policy roadmap_steps_select on public.roadmap_steps
  for select to authenticated
  using (public.is_practice_member(practice_id));

create policy roadmap_steps_insert on public.roadmap_steps
  for insert to authenticated
  with check (public.is_practice_member(practice_id));

create policy roadmap_steps_update on public.roadmap_steps
  for update to authenticated
  using (public.is_practice_member(practice_id))
  with check (public.is_practice_member(practice_id));

create policy roadmap_steps_delete on public.roadmap_steps
  for delete to authenticated
  using (public.is_practice_member(practice_id));

-- audit_log -------------------------------------------------------------------------
-- Users (via the app) may only INSERT their own audit rows (for events
-- triggers can't see: LOGIN, LOGOUT, SELECT_PHI, FILE_ACCESS, EXPORT). No
-- SELECT/UPDATE/DELETE policy exists for anon/authenticated, so those
-- operations are denied by default; only the service role (which bypasses
-- RLS entirely) can read or manage the audit trail.
grant insert on public.audit_log to authenticated;

create policy audit_log_insert on public.audit_log
  for insert to authenticated
  with check (user_id = auth.uid());


-- =============================================================================
-- 6. INDEPENDENCE SCORE CALCULATION
-- =============================================================================
-- Score out of 100:
--   individual NPI on file & non-empty ......................... 15 pts
--   CAQH profile controlled by the practice (not a platform) .... 15 pts
--   CAQH attested within the last 120 days ....................... 10 pts (bonus)
--   direct payer contracts, scaled 0/1/2/3+ -> 0/10/20/30 pts .... 30 pts
--   license current (no expired/expiring, at least one active) .. 15 pts
--   malpractice current (same rule) .............................. 10 pts
--   no outstanding critical alerts .................................. 5 pts
--                                                                ------
--                                                                 100 pts
--
-- "CAQH profile controlled by the practice" has no direct boolean column in
-- the spec; it is derived as a proxy from whether the practice holds its own
-- CAQH login for at least one clinician (caqh_id + caqh_username_encrypted
-- both present), as opposed to a credentialing platform managing CAQH on
-- the practice's behalf.

create or replace function public.recalculate_independence_score(p_practice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_individual_npi       boolean;
  v_caqh_practice_controlled boolean;
  v_caqh_attested_current    boolean;
  v_direct_contracts         integer;
  v_license_current          boolean;
  v_malpractice_current      boolean;
  v_no_critical_alerts       boolean;

  v_points_npi           integer := 0;
  v_points_caqh_control   integer := 0;
  v_points_caqh_attest    integer := 0;
  v_points_direct         integer := 0;
  v_points_license        integer := 0;
  v_points_malpractice    integer := 0;
  v_points_alerts         integer := 0;

  v_score     integer;
  v_breakdown jsonb;
begin
  if p_practice_id is null then
    return;
  end if;

  -- Individual NPI exists (15 pts)
  select exists (
    select 1 from public.clinicians
    where practice_id = p_practice_id
      and npi_individual is not null
      and btrim(npi_individual) <> ''
  ) into v_has_individual_npi;
  if v_has_individual_npi then
    v_points_npi := 15;
  end if;

  -- CAQH profile controlled by the practice, not a platform (15 pts)
  select exists (
    select 1 from public.clinicians
    where practice_id = p_practice_id
      and caqh_id is not null
      and caqh_username_encrypted is not null
  ) into v_caqh_practice_controlled;
  if v_caqh_practice_controlled then
    v_points_caqh_control := 15;
  end if;

  -- CAQH attested within the last 120 days (10 pts bonus)
  select exists (
    select 1 from public.clinicians
    where practice_id = p_practice_id
      and caqh_last_attested_at is not null
      and caqh_last_attested_at >= (current_date - interval '120 days')
  ) into v_caqh_attested_current;
  if v_caqh_attested_current then
    v_points_caqh_attest := 10;
  end if;

  -- Direct payer contracts, scaled 0/1/2/3+ -> 0/10/20/30 pts
  select count(distinct payer_name) into v_direct_contracts
  from public.payer_enrollments
  where practice_id = p_practice_id
    and enrollment_type = 'direct'
    and status = 'active';

  v_points_direct := least(coalesce(v_direct_contracts, 0), 3) * 10;

  -- License current: no outstanding expired/expiring license credential,
  -- and at least one active license credential on file (15 pts)
  select
    not exists (
      select 1 from public.credentials
      where practice_id = p_practice_id
        and type = 'license'
        and status in ('expired', 'expiring_soon')
    )
    and exists (
      select 1 from public.credentials
      where practice_id = p_practice_id
        and type = 'license'
        and status = 'active'
    )
  into v_license_current;
  if v_license_current then
    v_points_license := 15;
  end if;

  -- Malpractice current: same rule, type = 'malpractice' (10 pts)
  select
    not exists (
      select 1 from public.credentials
      where practice_id = p_practice_id
        and type = 'malpractice'
        and status in ('expired', 'expiring_soon')
    )
    and exists (
      select 1 from public.credentials
      where practice_id = p_practice_id
        and type = 'malpractice'
        and status = 'active'
    )
  into v_malpractice_current;
  if v_malpractice_current then
    v_points_malpractice := 10;
  end if;

  -- No outstanding critical alerts (5 pts)
  select not exists (
    select 1 from public.alerts
    where practice_id = p_practice_id
      and severity = 'critical'
      and is_dismissed = false
  ) into v_no_critical_alerts;
  if v_no_critical_alerts then
    v_points_alerts := 5;
  end if;

  v_score := greatest(0, least(100,
    v_points_npi + v_points_caqh_control + v_points_caqh_attest
    + v_points_direct + v_points_license + v_points_malpractice + v_points_alerts
  ));

  v_breakdown := jsonb_build_object(
    'individual_npi', jsonb_build_object(
      'points', v_points_npi, 'max', 15, 'met', v_has_individual_npi
    ),
    'caqh_practice_controlled', jsonb_build_object(
      'points', v_points_caqh_control, 'max', 15, 'met', v_caqh_practice_controlled
    ),
    'caqh_attestation_current', jsonb_build_object(
      'points', v_points_caqh_attest, 'max', 10, 'met', v_caqh_attested_current
    ),
    'direct_payer_contracts', jsonb_build_object(
      'points', v_points_direct, 'max', 30, 'active_direct_contracts', coalesce(v_direct_contracts, 0)
    ),
    'license_current', jsonb_build_object(
      'points', v_points_license, 'max', 15, 'met', v_license_current
    ),
    'malpractice_current', jsonb_build_object(
      'points', v_points_malpractice, 'max', 10, 'met', v_malpractice_current
    ),
    'no_critical_alerts', jsonb_build_object(
      'points', v_points_alerts, 'max', 5, 'met', v_no_critical_alerts
    )
  );

  insert into public.independence_scores (practice_id, score, score_breakdown)
  values (p_practice_id, v_score, v_breakdown);

  update public.practices
  set independence_score = v_score
  where id = p_practice_id;
end;
$$;

comment on function public.recalculate_independence_score(uuid) is
  'Recomputes the 0-100 independence score for a practice, logs it to independence_scores, and updates practices.independence_score. SECURITY DEFINER so it can run from triggers regardless of the calling role.';

revoke execute on function public.recalculate_independence_score(uuid) from public;

create or replace function public.trigger_recalculate_independence_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_practice_id uuid;
begin
  if tg_op = 'DELETE' then
    v_practice_id := old.practice_id;
  else
    v_practice_id := new.practice_id;
  end if;

  perform public.recalculate_independence_score(v_practice_id);

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

comment on function public.trigger_recalculate_independence_score() is
  'Trigger wrapper around recalculate_independence_score(), attached to clinicians, credentials, payer_enrollments, and alerts.';

revoke execute on function public.trigger_recalculate_independence_score() from public;

create trigger trg_recalc_score_clinicians
  after insert or update or delete on public.clinicians
  for each row execute function public.trigger_recalculate_independence_score();

create trigger trg_recalc_score_credentials
  after insert or update or delete on public.credentials
  for each row execute function public.trigger_recalculate_independence_score();

create trigger trg_recalc_score_payer_enrollments
  after insert or update or delete on public.payer_enrollments
  for each row execute function public.trigger_recalculate_independence_score();

create trigger trg_recalc_score_alerts
  after insert or update or delete on public.alerts
  for each row execute function public.trigger_recalculate_independence_score();


-- =============================================================================
-- 6a. CAQH USERNAME ENCRYPTION (pgcrypto + Supabase Vault)
-- =============================================================================
-- The symmetric key lives in Supabase Vault, not in this migration. After
-- deploying, set it once via the SQL editor (service role):
--   select vault.create_secret(
--     encode(gen_random_bytes(32), 'hex'),
--     'caqh_encryption_key',
--     'Column-level encryption key for clinicians.caqh_username_encrypted'
--   );

create or replace function public.caqh_encryption_key()
returns text
language sql
stable
security definer
set search_path = public, vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'caqh_encryption_key'
  limit 1;
$$;

revoke execute on function public.caqh_encryption_key() from public;

create or replace function public.encrypt_caqh_username(p_plaintext text)
returns bytea
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_plaintext is null or btrim(p_plaintext) = '' then null
    else pgp_sym_encrypt(p_plaintext, public.caqh_encryption_key())
  end;
$$;

revoke execute on function public.encrypt_caqh_username(text) from public;

create or replace function public.decrypt_caqh_username(p_ciphertext bytea)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_ciphertext is null then null
    else pgp_sym_decrypt(p_ciphertext, public.caqh_encryption_key())
  end;
$$;

revoke execute on function public.decrypt_caqh_username(bytea) from public;

-- Application-facing RPCs: these check practice membership before touching
-- the encrypted column, so the raw encrypt/decrypt primitives above never
-- need to be exposed directly to authenticated clients.

create or replace function public.set_clinician_caqh_username(p_clinician_id uuid, p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_practice_id uuid;
begin
  select practice_id into v_practice_id
  from public.clinicians
  where id = p_clinician_id;

  if v_practice_id is null then
    raise exception 'Clinician not found';
  end if;

  if not public.is_practice_member(v_practice_id) then
    raise exception 'Not authorized for this practice' using errcode = '42501';
  end if;

  update public.clinicians
  set caqh_username_encrypted = public.encrypt_caqh_username(p_username)
  where id = p_clinician_id;
end;
$$;

comment on function public.set_clinician_caqh_username(uuid, text) is
  'Encrypts and stores a clinician''s CAQH username. Use instead of updating clinicians.caqh_username_encrypted directly.';

revoke execute on function public.set_clinician_caqh_username(uuid, text) from public;
grant execute on function public.set_clinician_caqh_username(uuid, text) to authenticated;

create or replace function public.get_clinician_caqh_username(p_clinician_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_practice_id uuid;
  v_encrypted   bytea;
begin
  select practice_id, caqh_username_encrypted
  into v_practice_id, v_encrypted
  from public.clinicians
  where id = p_clinician_id;

  if v_practice_id is null then
    return null;
  end if;

  if not public.is_practice_member(v_practice_id) then
    raise exception 'Not authorized for this practice' using errcode = '42501';
  end if;

  return public.decrypt_caqh_username(v_encrypted);
end;
$$;

comment on function public.get_clinician_caqh_username(uuid) is
  'Returns the decrypted CAQH username for a clinician, after checking the caller is a member of that clinician''s practice.';

revoke execute on function public.get_clinician_caqh_username(uuid) from public;
grant execute on function public.get_clinician_caqh_username(uuid) to authenticated;


-- =============================================================================
-- 7. STORAGE BUCKETS
-- =============================================================================
-- Files are expected to be stored under a `{practice_id}/...` path prefix so
-- that storage RLS can authorize access via is_practice_member() on the
-- first path segment.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'practice-documents',
  'practice-documents',
  false,
  52428800, -- 50 MB
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- storage.objects ships with RLS already enabled on Supabase projects; only
-- policies need to be added here.

create policy "practice-documents: members can view"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'practice-documents'
    and public.is_practice_member(((storage.foldername(name))[1])::uuid)
  );

create policy "practice-documents: members can upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'practice-documents'
    and public.is_practice_member(((storage.foldername(name))[1])::uuid)
  );

create policy "practice-documents: members can update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'practice-documents'
    and public.is_practice_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'practice-documents'
    and public.is_practice_member(((storage.foldername(name))[1])::uuid)
  );

create policy "practice-documents: members can delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'practice-documents'
    and public.is_practice_member(((storage.foldername(name))[1])::uuid)
  );
