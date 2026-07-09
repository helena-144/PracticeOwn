-- =============================================================================
-- PracticeOwn — Onboarding Wizard schema additions
-- =============================================================================
-- Adds the columns the 5-step onboarding wizard (/dashboard/onboarding) needs
-- to save progress after every step and resume where a user left off:
--   1. practices: practice profile fields collected in Step 1, plus
--      onboarding_step / onboarding_completed_at for resume tracking.
--   2. clinicians: tri-state NPI/CAQH answers collected in Step 2 (the
--      existing npi_individual/npi_group/caqh_id/caqh_last_attested_at
--      columns hold the values *when known*; these new columns hold the
--      answer to the question itself, including "no" and "don't know").
--   3. Updates recalculate_independence_score() to use the new, explicit
--      caqh_status column instead of the caqh_id/caqh_username_encrypted
--      presence proxy it previously relied on for the "CAQH controlled by
--      the practice" scoring factor — strictly more accurate now that the
--      wizard captures this directly.
-- =============================================================================


-- =============================================================================
-- 1. practices — Step 1 fields + resume tracking
-- =============================================================================

alter table public.practices
  add column if not exists practice_type text
    check (practice_type in ('solo', 'small_group', 'group')),
  add column if not exists years_in_practice integer
    check (years_in_practice is null or (years_in_practice >= 0 and years_in_practice <= 70)),
  add column if not exists current_platforms text[] not null default '{}',
  add column if not exists platforms_other_detail text,
  add column if not exists onboarding_step integer not null default 1
    check (onboarding_step >= 1 and onboarding_step <= 5),
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.practices.current_platforms is
  'Slugs from the Step 1 platform checklist: headway, grow_therapy, alma, simple_practice, therapy_notes, theranest, none, other.';
comment on column public.practices.onboarding_step is
  'Furthest onboarding step (1-5) the user has reached. Used to resume the wizard after closing the browser.';
comment on column public.practices.onboarding_completed_at is
  'Set once Step 5 finishes computing an independence score. NULL means the wizard is still in progress.';


-- =============================================================================
-- 2. clinicians — Step 2 tri-state answers
-- =============================================================================

alter table public.clinicians
  add column if not exists has_individual_npi text
    check (has_individual_npi in ('yes', 'no', 'unknown')),
  add column if not exists has_group_npi text
    check (has_group_npi in ('yes', 'no', 'not_applicable')),
  add column if not exists caqh_status text
    check (caqh_status in ('practice_controlled', 'platform_managed', 'no', 'unknown'));

comment on column public.clinicians.has_individual_npi is
  'Answer to Step 2''s "Do you have an Individual NPI?" — independent of whether npi_individual is actually on file yet.';
comment on column public.clinicians.has_group_npi is
  'Answer to Step 2''s "Do you have a Group NPI?"';
comment on column public.clinicians.caqh_status is
  'Answer to Step 2''s CAQH question. practice_controlled/platform_managed/no map to "Yes" variants and "No"; unknown maps to "Don''t know".';


-- =============================================================================
-- 3. recalculate_independence_score() — use caqh_status instead of the
--    caqh_id/caqh_username_encrypted presence proxy
-- =============================================================================

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
      and caqh_status = 'practice_controlled'
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
