-- BidShield PRD v2.0 missing entities
-- Change type: SPEC-COMPLIANT IMPLEMENTATION / DATABASE MIGRATION
-- Status: PREPARED, NOT APPLIED
--
-- Source of truth:
--   BidShield_PRD_v2.0_UK_Procurement.md sections 19-25
--   BidShield Revised Next-Phase Execution Plan phases 3-7
--
-- This migration adds only entities absent from the verified production schema:
--   award_criteria, evidence_versions, verification_results,
--   submission_checks, alerts.
--
-- UNDEFINED in the PRD: exact reviewer-decision schema, alert lifecycle,
-- submission-check status enum, report persistence format, and verification
-- result versioning semantics. The columns below are a minimal, traceable
-- recommendation. Product/API behavior must not be treated as approved until
-- reconciled against the final implementation decisions.
--
-- Safety:
--   * No seed data is inserted.
--   * Every organization-scoped table has organization_id and RLS.
--   * Foreign keys preserve organization scope where the existing schema has
--     composite tenant-safe keys.
--   * Human review fields remain separate from system result fields.

begin;

create table if not exists public.award_criteria (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tender_id uuid not null references public.tenders(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  weight numeric(6, 3) check (weight is null or (weight >= 0 and weight <= 100)),
  word_limit integer check (word_limit is null or word_limit > 0),
  description text,
  source_document_id uuid,
  source_page integer check (source_page is null or source_page > 0),
  source_excerpt text,
  status text not null default 'UNKNOWN',
  provenance_state public.provenance_state not null default 'SOURCE',
  provenance_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, organization_id),
  foreign key (source_document_id, organization_id)
    references public.tender_documents(id, organization_id) on delete set null
);

create table if not exists public.evidence_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  evidence_id uuid not null,
  version text not null,
  document_name text not null,
  document_type text not null,
  category text not null default 'OTHER',
  storage_path text not null,
  content_hash text,
  issue_date date,
  expiry_date date,
  certificate_number text,
  issuer text,
  status public.evidence_status not null default 'PENDING_REVIEW',
  provenance_state public.provenance_state not null default 'SOURCE',
  provenance_metadata jsonb not null default '{}'::jsonb,
  uploaded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, organization_id),
  unique (organization_id, evidence_id, version),
  foreign key (evidence_id, organization_id)
    references public.evidence_vault(id, organization_id) on delete cascade
);

create table if not exists public.verification_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tender_id uuid not null references public.tenders(id) on delete cascade,
  requirement_id uuid,
  claim_id uuid,
  claim_evidence_id uuid,
  system_status public.claim_status not null default 'NEEDS_REVIEW',
  system_reasoning text,
  deterministic_checks jsonb not null default '[]'::jsonb,
  matched_facts jsonb not null default '[]'::jsonb,
  engine_version text,
  matching_run_id uuid,
  reviewer_decision text,
  reviewer_reason text,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  provenance_state public.provenance_state not null default 'CALCULATED',
  provenance_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, organization_id),
  foreign key (requirement_id, organization_id)
    references public.requirements(id, organization_id) on delete set null,
  foreign key (claim_id, organization_id)
    references public.claims(id, organization_id) on delete set null
);

create table if not exists public.submission_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tender_id uuid not null references public.tenders(id) on delete cascade,
  check_type text not null,
  status text not null default 'NEEDS_REVIEW',
  severity text,
  title text not null,
  detail text,
  entity_type text,
  entity_id uuid,
  source_page integer check (source_page is null or source_page > 0),
  source_excerpt text,
  provenance_state public.provenance_state not null default 'CALCULATED',
  provenance_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, organization_id)
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tender_id uuid references public.tenders(id) on delete cascade,
  alert_type text not null,
  severity text not null default 'WARNING',
  title text not null,
  detail text,
  status text not null default 'OPEN',
  entity_type text,
  entity_id uuid,
  due_at timestamptz,
  resolved_by uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  provenance_state public.provenance_state not null default 'CALCULATED',
  provenance_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, organization_id)
);

create index if not exists award_criteria_tender_idx
  on public.award_criteria(organization_id, tender_id, created_at);
create index if not exists evidence_versions_evidence_idx
  on public.evidence_versions(organization_id, evidence_id, created_at desc);
create index if not exists verification_results_tender_idx
  on public.verification_results(organization_id, tender_id, created_at desc);
create index if not exists verification_results_requirement_idx
  on public.verification_results(organization_id, requirement_id, created_at desc);
create index if not exists submission_checks_tender_idx
  on public.submission_checks(organization_id, tender_id, status, created_at desc);
create index if not exists alerts_open_idx
  on public.alerts(organization_id, status, due_at, created_at desc);

alter table public.award_criteria enable row level security;
alter table public.evidence_versions enable row level security;
alter table public.verification_results enable row level security;
alter table public.submission_checks enable row level security;
alter table public.alerts enable row level security;

drop policy if exists award_criteria_tenant_isolation on public.award_criteria;
create policy award_criteria_tenant_isolation on public.award_criteria
  for all to authenticated
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

drop policy if exists evidence_versions_tenant_isolation on public.evidence_versions;
create policy evidence_versions_tenant_isolation on public.evidence_versions
  for all to authenticated
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

drop policy if exists verification_results_tenant_isolation on public.verification_results;
create policy verification_results_tenant_isolation on public.verification_results
  for all to authenticated
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

drop policy if exists submission_checks_tenant_isolation on public.submission_checks;
create policy submission_checks_tenant_isolation on public.submission_checks
  for all to authenticated
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

drop policy if exists alerts_tenant_isolation on public.alerts;
create policy alerts_tenant_isolation on public.alerts
  for all to authenticated
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

-- Keep updated_at deterministic for mutable records. The existing function is
-- reused; no new trigger function is introduced.
drop trigger if exists award_criteria_set_updated_at on public.award_criteria;
create trigger award_criteria_set_updated_at before update on public.award_criteria
  for each row execute function public.set_updated_at();

drop trigger if exists evidence_versions_set_updated_at on public.evidence_versions;
create trigger evidence_versions_set_updated_at before update on public.evidence_versions
  for each row execute function public.set_updated_at();

drop trigger if exists verification_results_set_updated_at on public.verification_results;
create trigger verification_results_set_updated_at before update on public.verification_results
  for each row execute function public.set_updated_at();

drop trigger if exists submission_checks_set_updated_at on public.submission_checks;
create trigger submission_checks_set_updated_at before update on public.submission_checks
  for each row execute function public.set_updated_at();

drop trigger if exists alerts_set_updated_at on public.alerts;
create trigger alerts_set_updated_at before update on public.alerts
  for each row execute function public.set_updated_at();

comment on table public.award_criteria is
  'PRD v2.0 award-criteria coverage model; exact response-coverage fields remain UNDEFINED until reconciled.';
comment on table public.evidence_versions is
  'Immutable evidence-version metadata; application must create a new version rather than overwrite historical provenance.';
comment on table public.verification_results is
  'System verification result plus separately stored human-review decision; reviewer fields do not replace system status.';
comment on table public.submission_checks is
  'Final QA check records sourced from stored requirements, evidence, claims, and verification results.';
comment on table public.alerts is
  'Organization-scoped action alerts for missing, expiring, contradictory, or unresolved verification states.';

commit;
