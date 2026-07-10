-- =============================================================================
-- PracticeOwn — Dashboard support: roadmap seeding + payer-linked alerts
-- =============================================================================
-- The main dashboard (/dashboard) needs two things the schema didn't yet
-- provide:
--   1. roadmap_steps rows to show — nothing ever seeded them, so every
--      practice's roadmap was permanently empty. This adds a default
--      checklist, seeded automatically the moment a practice is created.
--   2. A way to know which payer enrollment an alert is about, mirroring
--      the existing credential_id column, so the dashboard's alert list can
--      show "Aetna" the same way it shows a credential's name.
-- =============================================================================


-- =============================================================================
-- 1. alerts — link to payer_enrollments, same shape as the existing
--    credential_id column
-- =============================================================================

alter table public.alerts
  add column if not exists payer_enrollment_id uuid references public.payer_enrollments(id) on delete set null;

comment on column public.alerts.payer_enrollment_id is
  'Set for payer_reattestion (and other payer-related) alerts, mirroring credential_id for credential-related alerts.';

create index if not exists idx_alerts_payer_enrollment_id on public.alerts (payer_enrollment_id);


-- =============================================================================
-- 2. Default roadmap checklist, seeded on practice creation
-- =============================================================================

create or replace function public.seed_default_roadmap_steps()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.roadmap_steps
    (practice_id, module, step_number, title, description, action_url, priority)
  values
    (new.id, 'credentials', 1, 'Add your professional license',
     'Track your license number, issuing state, and expiration date.', '/credentials', 'critical'),
    (new.id, 'credentials', 2, 'Add malpractice insurance',
     'Record your carrier, policy number, and expiration date.', '/credentials', 'critical'),
    (new.id, 'credentials', 3, 'Record your CAQH profile details',
     'Add your CAQH ID and last attestation date so we can track re-attestation.', '/credentials', 'high'),

    (new.id, 'ownership', 1, 'Review your ownership structure',
     'Confirm who owns what share of your practice.', '/ownership-audit', 'medium'),
    (new.id, 'ownership', 2, 'Confirm CPOM compliance for your state',
     'Corporate Practice of Medicine rules vary by state — make sure your structure is compliant.',
     '/ownership-audit', 'high'),

    (new.id, 'independence', 1, 'Calculate your independence score',
     'See how independent your practice is from outside platforms and payers.',
     '/independence-score', 'high'),
    (new.id, 'independence', 2, 'Take ownership of your CAQH profile',
     'Control your own credentialing data instead of leaving it with a platform.',
     '/independence-score', 'medium'),

    (new.id, 'exit_planner', 1, 'Set a target exit timeline',
     'Define when and how you plan to eventually exit your practice.', '/exit-planner', 'low'),

    (new.id, 'documentation', 1, 'Upload key compliance documents',
     'Keep your practice''s core documents in one place.', '/documentation-qa', 'medium');

  return new;
end;
$$;

comment on function public.seed_default_roadmap_steps() is
  'Seeds a default 5-module roadmap checklist for a newly created practice. SECURITY DEFINER purely for consistency with the codebase''s other triggers — the inserting user already owns the new practice, so this would satisfy roadmap_steps RLS on its own.';

revoke execute on function public.seed_default_roadmap_steps() from public;

create trigger trg_practices_seed_roadmap
  after insert on public.practices
  for each row execute function public.seed_default_roadmap_steps();
