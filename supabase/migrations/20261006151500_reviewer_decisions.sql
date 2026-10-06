-- BidShield human reviewer decision history
-- Change type: SPEC-COMPLIANT IMPLEMENTATION
-- Status: PREPARED FOR APPLICATION
--
-- The PRD requires human review and verification event history but does not
-- define a reviewer-decision table or decision enum. This migration uses the
-- existing deterministic matching statuses as the reviewer decision vocabulary
-- and keeps the decision history append-only.

begin;

create table if not exists public.reviewer_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tender_id uuid not null references public.tenders(id) on delete cascade,
  requirement_id uuid,
  verification_result_id uuid,
  decision text not null check (decision in ('VERIFIED', 'SUPPORTED', 'PARTIALLY_SUPPORTED', 'NEEDS_REVIEW', 'UNVERIFIED', 'CONTRADICTED')),
  rationale text not null check (length(trim(rationale)) > 0),
  reviewer_id uuid not null references public.users(id) on delete restrict,
  provenance_state public.provenance_state not null default 'USER_INPUT',
  provenance_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (id, organization_id),
  foreign key (requirement_id, organization_id)
    references public.requirements(id, organization_id) on delete set null
);

create index if not exists reviewer_decisions_tender_idx
  on public.reviewer_decisions(organization_id, tender_id, created_at desc);
create index if not exists reviewer_decisions_requirement_idx
  on public.reviewer_decisions(organization_id, requirement_id, created_at desc);

alter table public.reviewer_decisions enable row level security;

drop policy if exists reviewer_decisions_select_same_tenant on public.reviewer_decisions;
create policy reviewer_decisions_select_same_tenant on public.reviewer_decisions
  for select to authenticated
  using (organization_id = public.current_user_organization_id());

drop policy if exists reviewer_decisions_insert_same_tenant on public.reviewer_decisions;
create policy reviewer_decisions_insert_same_tenant on public.reviewer_decisions
  for insert to authenticated
  with check (
    organization_id = public.current_user_organization_id()
    and reviewer_id in (
      select id from public.users where auth_user_id = auth.uid() and organization_id = public.current_user_organization_id()
    )
  );

-- Intentionally no UPDATE or DELETE policy: reviewer history is append-only.
comment on table public.reviewer_decisions is
  'Append-only human reviewer decisions. Previous decisions must never be updated or deleted; the latest verification projection is stored separately.';

commit;
