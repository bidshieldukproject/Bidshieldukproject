# BidShield UK Rules Research Memo — 29 September 2026

## Purpose

This memo records the authoritative research used to update `AI_VERIFICATION_POLICY.md` from v1.0 to v1.1. It is an implementation aid, not legal advice or a certification of compliance.

## Findings that changed the policy

### Procurement law and transition

The Procurement Act 2023 and Procurement Regulations 2024 are binding UK law for the new regime, which commenced on 24 February 2025. Transitional and saving regulations preserve specified legacy PCR, UCR, CCR, and DSPCR procurements, contracts, frameworks, DPS arrangements, and qualification systems. BidShield now requires a regime gate before drawing conclusions and must preserve legacy rule packs rather than treating every record as an Act procurement.

The Act and regulations require source-linked procurement evidence. The updated policy therefore requires tender notices and associated documents, versions, amendments, clarification history, assessment-summary evidence, notice publication evidence, identifiers, timestamps, and record-keeping lineage. It also adds human-reviewed controls for exclusions, debarment, subcontractors, conflicts, redactions, and modifications.

### UK GDPR, DPA 2018, and AI governance

ICO guidance and UK GDPR/DPA 2018 requirements make lawful basis, role allocation, data minimisation, transparency, DPIA decisions, security, retention, rights handling, and international-transfer assessment explicit policy gates. The policy now treats unknown, personal, special-category, criminal-offence, and confidential-commercial inputs as quarantine/manual-review cases unless an approved route exists.

The Data (Use and Access) Act 2025 changed the former Article 22 structure. The policy therefore prohibits AI-only adverse or legally significant outcomes and requires meaningful human review, representation, intervention, challenge, and escalation. Current legislation and ICO material must be revalidated at implementation time.

The UK Government AI Playbook, Data and AI Ethics Framework, PPN 017, and ATRS guidance are classified separately from legislation. Their controls are adopted as internal safeguards without presenting them as universal statutory duties. PPN 017 and ATRS applicability are scoped to the relevant bodies and tools.

### Security and residency

NCSC guidance distinguishes the customer’s responsibility from the cloud provider’s responsibility. Data location must cover content, derivatives, logs, backups, support access, metadata, and machine-learning artefacts. A UK Supabase region or UK API availability is not enough to establish UK-only processing.

The policy now requires server-side AI calls, prompt-injection controls, SSRF-safe fetching, strict JSON schemas, tenant-isolation regression tests, privileged-path controls, secret rotation, tamper-resistant audit logging, incident playbooks, and component-level retention/deletion.

### Gemini provider controls

Google’s Additional Terms distinguish unpaid and paid Gemini services. Unpaid services may use submitted content and responses to improve products and may involve human review; confidential, sensitive, and personal information must not be submitted to unpaid services. Paid status is project/account-specific and must be verified.

Paid use improves data-use terms but does not mean zero retention, no human access, or UK residency. Google documents abuse monitoring, limited retention, possible transient/cache processing outside the UK, and feature-specific retention for grounding, File API, stateful interactions, live resumption, context caching, and request/response logging. The policy now prohibits those features for tender text unless separately approved with retention, deletion, location, and transfer evidence.

## Implementation gates adopted

1. Procurement jurisdiction, authority, contract type, commencement trigger, and legacy/new regime confirmed.
2. Data classification, lawful purpose/basis, role allocation, minimisation, privacy notice, DPIA, retention, and transfer route recorded.
3. Paid Gemini project, model, endpoint, location, terms/DPA, retention, abuse monitoring, logging, and feature configuration verified.
4. Source citations, hashes, timestamps, schema validation, uncertainty, deterministic checks, and human review completed before consequential output.
5. Notice, assessment-summary, exclusion, conflict, redaction, amendment, and equal-treatment evidence complete where applicable.
6. RLS, storage, RPC, realtime, export, and service-role tenant-isolation tests pass before release.
7. Provider, model, prompt, endpoint, subprocessor, schema, data-source, or retention changes trigger reapproval.

## Source register

- [Procurement Act 2023](https://www.legislation.gov.uk/ukpga/2023/54/contents)
- [Procurement Regulations 2024](https://www.legislation.gov.uk/uksi/2024/692/contents)
- [Procurement Act 2023 transitional regulations](https://www.legislation.gov.uk/uksi/2024/716)
- [Cabinet Office Procurement Act guidance](https://www.gov.uk/government/collections/procurement-act-2023-guidance-documents)
- [UK GDPR](https://www.legislation.gov.uk/eur/2016/679/contents)
- [Data Protection Act 2018](https://www.legislation.gov.uk/ukpga/2018/12/contents)
- [Data (Use and Access) Act 2025](https://www.legislation.gov.uk/ukpga/2025/18)
- [ICO AI and data protection guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/guidance-on-ai-and-data-protection/)
- [AI Playbook for the UK Government](https://www.gov.uk/government/publications/ai-playbook-for-the-uk-government/artificial-intelligence-playbook-for-the-uk-government-html)
- [Data and AI Ethics Framework](https://www.gov.uk/government/publications/data-ethics-framework/data-and-ai-ethics-framework)
- [PPN 017](https://www.gov.uk/government/publications/ppn-017-improving-transparency-of-ai-use-in-procurement/ppn-017-improving-transparency-of-ai-use-in-procurement-html)
- [ATRS guidance](https://www.gov.uk/government/publications/guidance-for-organisations-using-the-algorithmic-transparency-recording-standard/algorithmic-transparency-recording-standard-guidance-for-public-sector-bodies)
- [NCSC Cloud Security Principles](https://www.ncsc.gov.uk/collection/cloud/the-cloud-security-principles)
- [NCSC supplier assurance questions](https://www.ncsc.gov.uk/guidance/supplier-assurance-questions)
- [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms)
- [Gemini abuse monitoring](https://ai.google.dev/gemini-api/docs/usage-policies)
- [Gemini logs and sharing](https://ai.google.dev/gemini-api/docs/logs-policy)
- [Gemini zero data retention](https://ai.google.dev/gemini-api/docs/zdr)
- [Gemini locations](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations)
- [Google Cloud DPA](https://cloud.google.com/terms/data-processing-addendum)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase API keys](https://supabase.com/docs/guides/api/api-keys)
