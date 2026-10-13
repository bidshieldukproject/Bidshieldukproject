import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261010134102_harden_membership_creation.sql"),
  "utf8"
);
const onboarding = readFileSync(
  resolve(process.cwd(), "src/app/onboarding/page.tsx"),
  "utf8"
);
const schema = readFileSync(resolve(process.cwd(), "supabase/schema.sql"), "utf8");
const normalizedMigration = migration.replace(/\s+/g, " ").toLowerCase();
const normalizedSchema = schema.replace(/\s+/g, " ").toLowerCase();

assert.match(
  normalizedMigration,
  /create or replace function public\.create_organization_with_owner\s*\(\s*p_organization_name text,\s*p_display_name text default null\s*\)\s*returns uuid/
);
assert.match(normalizedMigration, /security definer set search_path = pg_catalog/);
assert.match(normalizedMigration, /caller_id uuid := auth\.uid\(\)/);
assert.match(normalizedMigration, /if caller_id is null then/);
assert.match(normalizedMigration, /existing_membership\.auth_user_id = caller_id/);
assert.match(normalizedMigration, /values \(normalized_name, caller_id\)/);
assert.match(
  normalizedMigration,
  /values \( caller_id, new_organization_id, 'owner', nullif\(btrim\(p_display_name\), ''\) \)/
);
assert.match(
  normalizedMigration,
  /revoke insert on table public\.users from public, anon, authenticated/
);
assert.match(normalizedMigration, /drop policy if exists users_insert_own_membership on public\.users/);
assert.match(
  normalizedMigration,
  /grant execute on function public\.create_organization_with_owner\(text, text\) to authenticated/
);

assert.match(onboarding, /\.rpc\("create_organization_with_owner"/);
assert.doesNotMatch(onboarding, /\.from\("users"\)\s*\.insert\s*\(/);
assert.doesNotMatch(onboarding, /organization_id\s*:/);
assert.doesNotMatch(schema, /create policy users_insert_own_membership/i);
assert.match(
  normalizedSchema,
  /revoke insert on table public\.users from public, anon, authenticated/
);
assert.match(
  normalizedSchema,
  /create or replace function public\.create_organization_with_owner/
);

console.log("membership security regression checks passed");
