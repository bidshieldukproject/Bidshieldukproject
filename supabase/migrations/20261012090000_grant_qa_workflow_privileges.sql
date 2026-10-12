-- BidShield QA workflow privilege correction
-- Change type: BUG FIX / SECURITY-PRESERVING DATABASE MIGRATION
-- RLS policies already enforce organization isolation. These grants only make
-- the intended authenticated read/write operations reachable through PostgREST.
-- No DELETE privilege is granted to preserve append-only verification history.

begin;

grant select, insert, update on table public.verification_results to authenticated;
grant select, insert on table public.submission_checks to authenticated;
grant select, insert on table public.alerts to authenticated;
grant select, insert on table public.reviewer_decisions to authenticated;

commit;
