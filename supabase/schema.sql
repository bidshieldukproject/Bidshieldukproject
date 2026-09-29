-- BidShield — UK procurement evidence assurance schema
-- Supabase/PostgreSQL migration baseline.
-- All tenant-scoped records carry organization_id and are protected by RLS.

create extension if not exists pgcrypto;

create type public.provenance_state as enum (
  'SOURCE',
  'NORMALIZED',
  'CALCULATED',
  'AI_ESTIMATE',
  'USER_INPUT',
  'UNKNOWN'
);

create type public.requirement_type as enum (
  'PARTICIPATION',
  'EXCLUSION',
  'MANDATORY_SUBMISSION',
  'TECHNICAL',
  'FINANCIAL',
  'INSURANCE',
  'QUALIFICATION',
  'EXPERIENCE',
  'AWARD_CRITERIA',
  'POLICY',
  'CONTRACT',
  'DEADLINE',
  'WORD_LIMIT',
  'DOCUMENT',
  'OTHER'
);

create type public.evidence_status as enum (
  'VERIFIED',
  'EXPIRING',
  'EXPIRED',
  'MISSING',
  'PENDING_REVIEW',
  'REJECTED',
  'UNKNOWN'
);

create type public.claim_status as enum (
  'VERIFIED',
  'SUPPORTED',
  'PARTIALLY_SUPPORTED',
  'UNVERIFIED',
  'CONTRADICTED',
  'NEEDS_REVIEW'
);

create type public.tender_status as enum (
  'DRAFT',
  'ACTIVE',
  'REVIEW',
  'READY',
  'SUBMITTED',
  'CLOSED',
  'ARCHIVED'
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  provenance_state public.provenance_state not null default 'USER_INPUT',
  provenance_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  display_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.tenders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  buyer_name text,
  reference_code text,
  deadline timestamptz,
  status public.tender_status not null default 'DRAFT',
  provenance_state public.provenance_state not null default 'USER_INPUT',
  provenance_metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.tender_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tender_id uuid not null references public.tenders(id) on delete cascade,
  document_name text not null,
  document_type text,
  storage_path text not null,
  source_url text,
  content_hash text,
  version text not null default '1',
  page_count integer check (page_count is null or page_count > 0),
  processing_status text not null default 'UPLOADED' check (processing_status in ('UPLOADED', 'PROCESSING', 'READY', 'OCR_REQUIRED', 'FAILED')),
  processing_error text,
  provenance_state public.provenance_state not null default 'SOURCE',
  provenance_metadata jsonb not null default '{}'::jsonb,
  uploaded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, organization_id),
  unique (organization_id, tender_id, storage_path, version)
);

create table public.tender_document_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tender_id uuid not null references public.tenders(id) on delete cascade,
  tender_document_id uuid not null references public.tender_documents(id) on delete cascade,
  page_number integer not null check (page_number > 0),
  text_content text not null default '',
  character_count integer not null default 0 check (character_count >= 0),
  content_hash text,
  provenance_state public.provenance_state not null default 'NORMALIZED',
  provenance_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (tender_document_id, page_number)
);

create table public.requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tender_id uuid not null references public.tenders(id) on delete cascade,
  title text not null,
  description text,
  type public.requirement_type not null,
  mandatory boolean not null default false,
  source_document_id uuid,
  source_page integer check (source_page is null or source_page > 0),
  source_excerpt text,
  deadline timestamptz,
  weight numeric(6, 3) check (weight is null or (weight >= 0 and weight <= 100)),
  word_limit integer check (word_limit is null or word_limit > 0),
  required_evidence jsonb not null default '[]'::jsonb,
  status text not null default 'UNKNOWN' check (status in ('OPEN', 'MET', 'NOT_MET', 'UNKNOWN', 'NEEDS_REVIEW')),
  confidence numeric(5, 4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  provenance_state public.provenance_state not null default 'SOURCE',
  provenance_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, organization_id),
  foreign key (source_document_id, organization_id)
    references public.tender_documents(id, organization_id) on delete set null
);

create table public.evidence_vault (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_name text not null,
  document_type text not null,
  category text not null default 'OTHER',
  storage_path text not null,
  source text,
  issue_date date,
  expiry_date date,
  certificate_number text,
  issuer text,
  version text not null default '1',
  content_hash text,
  status public.evidence_status not null default 'PENDING_REVIEW',
  provenance_state public.provenance_state not null default 'SOURCE',
  provenance_metadata jsonb not null default '{}'::jsonb,
  uploaded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, organization_id),
  unique (organization_id, storage_path, version)
);

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tender_id uuid not null references public.tenders(id) on delete cascade,
  requirement_id uuid,
  response_text text not null,
  claim_type text,
  status public.claim_status not null default 'NEEDS_REVIEW',
  verification_reason text,
  source_page integer check (source_page is null or source_page > 0),
  provenance_state public.provenance_state not null default 'USER_INPUT',
  provenance_metadata jsonb not null default '{}'::jsonb,
  extracted_facts jsonb not null default '[]'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, organization_id),
  foreign key (requirement_id, organization_id)
    references public.requirements(id, organization_id) on delete set null
);

create table public.claim_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  claim_id uuid not null,
  evidence_id uuid not null,
  match_type text not null default 'NEEDS_REVIEW',
  support_level public.claim_status not null default 'NEEDS_REVIEW',
  evidence_page integer check (evidence_page is null or evidence_page > 0),
  reasoning text,
  provenance_state public.provenance_state not null default 'CALCULATED',
  provenance_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (claim_id, organization_id)
    references public.claims(id, organization_id) on delete cascade,
  foreign key (evidence_id, organization_id)
    references public.evidence_vault(id, organization_id) on delete cascade,
  unique (claim_id, evidence_id)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  provenance_state public.provenance_state not null default 'CALCULATED',
  created_at timestamptz not null default timezone('utc', now())
);

create index tenders_organization_id_idx on public.tenders(organization_id);
create index tender_documents_tender_id_idx on public.tender_documents(tender_id, organization_id);
create index tender_document_pages_document_idx on public.tender_document_pages(tender_document_id, page_number);
create index tender_document_pages_tender_idx on public.tender_document_pages(tender_id, organization_id, page_number);
create index requirements_tender_id_idx on public.requirements(tender_id, organization_id);
create index evidence_vault_expiry_idx on public.evidence_vault(organization_id, expiry_date);
create index claims_tender_id_idx on public.claims(tender_id, organization_id);
create index audit_events_organization_created_idx on public.audit_events(organization_id, created_at desc);

create or replace function public.current_user_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.users
  where auth_user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.current_user_organization_id() from public;
grant execute on function public.current_user_organization_id() to authenticated;

alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.tenders enable row level security;
alter table public.tender_documents enable row level security;
alter table public.tender_document_pages enable row level security;
alter table public.requirements enable row level security;
alter table public.evidence_vault enable row level security;
alter table public.claims enable row level security;
alter table public.claim_evidence enable row level security;
alter table public.audit_events enable row level security;

create policy organizations_select_same_tenant on public.organizations
  for select to authenticated
  using (id = public.current_user_organization_id() or created_by = auth.uid());

create policy organizations_insert_authenticated_owner on public.organizations
  for insert to authenticated
  with check (created_by = auth.uid());

create policy organizations_update_same_tenant on public.organizations
  for update to authenticated
  using (id = public.current_user_organization_id())
  with check (id = public.current_user_organization_id());

create policy users_select_same_tenant on public.users
  for select to authenticated
  using (organization_id = public.current_user_organization_id() or auth_user_id = auth.uid());

create policy users_insert_own_membership on public.users
  for insert to authenticated
  with check (auth_user_id = auth.uid());

create policy users_update_same_tenant on public.users
  for update to authenticated
  using (organization_id = public.current_user_organization_id() or auth_user_id = auth.uid())
  with check (organization_id = public.current_user_organization_id() or auth_user_id = auth.uid());

create policy tenders_tenant_isolation on public.tenders
  for all to authenticated
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

create policy tender_documents_tenant_isolation on public.tender_documents
  for all to authenticated
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

create policy tender_document_pages_tenant_isolation on public.tender_document_pages
  for all to authenticated
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

create policy requirements_tenant_isolation on public.requirements
  for all to authenticated
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

create policy evidence_vault_tenant_isolation on public.evidence_vault
  for all to authenticated
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

create policy claims_tenant_isolation on public.claims
  for all to authenticated
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

create policy claim_evidence_tenant_isolation on public.claim_evidence
  for all to authenticated
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

create policy audit_events_tenant_isolation on public.audit_events
  for all to authenticated
  using (organization_id = public.current_user_organization_id())
  with check (organization_id = public.current_user_organization_id());

-- Keep updated_at deterministic for mutable records.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger organizations_set_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();
create trigger users_set_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger tenders_set_updated_at before update on public.tenders
  for each row execute function public.set_updated_at();
create trigger tender_documents_set_updated_at before update on public.tender_documents
  for each row execute function public.set_updated_at();
create trigger requirements_set_updated_at before update on public.requirements
  for each row execute function public.set_updated_at();
create trigger evidence_vault_set_updated_at before update on public.evidence_vault
  for each row execute function public.set_updated_at();
create trigger claims_set_updated_at before update on public.claims
  for each row execute function public.set_updated_at();
