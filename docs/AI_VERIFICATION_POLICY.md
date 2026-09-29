# BidShield AI Verification Policy v1.1

**Document owner:** BidShield Product and Compliance Engineering
**Status:** Research-updated implementation baseline
**Effective date:** 29 September 2026
**Policy version:** `1.1`
**Applies to:** UK public-sector procurement evidence-assurance workflows

> **They Write. BidShield Verifies.**
>
> BidShield uses AI to organise, extract, compare, and explain procurement evidence. AI output is never, by itself, final proof of compliance.

---

## 1. Purpose and scope

This policy governs how BidShield processes tender documents, supplier evidence, requirements, claims, and verification results using Google Gemini Flash and deterministic application rules.

It applies to:

- tender source-document ingestion;
- page-aware text extraction;
- procurement requirement identification;
- evidence fact extraction;
- requirement-to-evidence matching;
- claim verification and status assignment;
- executive and final report generation; and
- human review of ambiguous or consequential results.

It does not authorise BidShield to provide legal advice, certify insurance, attest to financial standing, or submit a tender on behalf of a supplier. It does not transfer any statutory duty from a contracting authority, supplier, reviewer, or data controller to BidShield.

## 1.1 Legal and policy classification

Every policy finding and product result must identify its authority level:

1. Binding UK law: the Procurement Act 2023, Procurement Regulations 2024, applicable transitional instruments, UK GDPR, and the Data Protection Act 2018.
2. Statutory guidance or material carrying a statutory “have regard” duty, where applicable.
3. Mandatory government policy for a stated scope, such as PPN 017 or ATRS requirements for covered bodies and tools.
4. Official government, ICO, NCSC, or provider guidance.
5. BidShield internal control.
6. Unresolved legal or factual question requiring escalation.

BidShield must never output a generic “UK compliant” label without recording the source title, exact provision or paragraph, URL, effective or revision date, scope, evidence observed, evidence missing, uncertainty, and reviewer decision.

## 1.2 Procurement-regime gate

Before applying a procurement conclusion, the system must record or escalate:

- jurisdiction and devolved arrangement;
- authority type and sector;
- contract or procedure type, including light-touch, utility, defence/security, framework, DPS, or qualification system;
- commencement trigger and date;
- applicable new or legacy regime;
- below-threshold or direct-award route; and
- relevant amendments, clarifications, addenda, or saving provisions.

The Procurement Act 2023 commenced for the new regime on 24 February 2025, but transitional rules preserve specified PCR, UCR, CCR, and DSPCR procedures and arrangements. BidShield must not default every post-commencement record to the new Act. Unknown regime fields block cross-regime conclusions and require human review.

## 2. Governing principles

### 2.1 Evidence-grounded output

No compliance conclusion may be marked `VERIFIED` without a source document, page citation, exact source excerpt, and successful deterministic checks where applicable.

### 2.2 No invention

The AI must not invent requirements, dates, monetary values, certificates, issuers, policy numbers, page references, or supporting evidence. Missing information must be represented as `null`, `UNKNOWN`, or `NEEDS_REVIEW`.

### 2.3 AI assists; rules and reviewers decide

Gemini may extract, classify, suggest matches, and produce a traceable explanation. Deterministic rules control objective checks. A designated human reviewer controls final approval where this policy requires review.

### 2.4 Tenant isolation

AI processing may only use records belonging to the current organisation. Cross-organisation documents, pages, evidence, claims, and audit records must be blocked by database RLS and application checks.

### 2.5 Traceability and reproducibility

Every AI-derived result must be reproducible from the stored page IDs, evidence IDs, policy version, model identifier, prompt/schema version, timestamps, and source excerpts recorded at processing time.

## 3. Source hierarchy

When sources conflict, the system must preserve the conflict and apply the following trust order for procurement interpretation:

1. Buyer-issued tender source document.
2. Buyer-issued amendment, clarification, or addendum.
3. Buyer-issued written response to a clarification question.
4. Supplier-issued supporting evidence.
5. Supplier-entered structured information.
6. AI-derived interpretation or summary.

A lower-ranked source must not silently override a higher-ranked source. Conflicts must produce `CONTRADICTED` or `NEEDS_REVIEW`, depending on whether the conflict is objectively provable.

## 3.1 Procurement integrity controls

For each requirement, condition, specification, award criterion, or assessment summary, BidShield should preserve the exact notice or associated-document passage, attachment, version/hash, page or paragraph, and supporting evidence. A model-generated summary is not a substitute for the tender notice and associated documents.

Clarifications must be classified as either explanation-only or a possible modification of the procurement terms. A possible modification must preserve the question, answer, recipients, dates, before/after artefacts, affected suppliers, deadline assessment, republication or notification evidence, and human legal review. BidShield must flag missing equal-treatment or time-limit evidence rather than silently passing it.

The implementation should support a notice calendar for the applicable regime, including tender, award, contract-details, termination, payment, performance, change, and other required notices. It must preserve central-platform submission acknowledgement or public-access evidence, notice identifiers, links, rendered content, and timestamps. Deadlines and exceptions are regime-specific and must not be inferred from a generic UK rule.

Assessment summaries must be checked at criterion and sub-criterion level. Where the methodology uses scores or weightings, the system should verify scores, totals, and supplier-specific reasons tied to relevant tender information. Generic reasons or missing evidence references require review.

Exclusion, debarment, subcontractor, and conflict-of-interest checks are separate high-impact workflows. BidShield may retrieve and compare evidence, but an authorised procurement decision-maker must review representations, self-cleaning evidence, proportionality, connected-person information, conflicts, and any proposed adverse action. The system must never autonomously exclude, debar, award, or redact.

## 4. Processing stages

```text
Source PDF
  ↓
Page-aware text extraction
  ↓
Requirement extraction
  ↓
Evidence fact extraction
  ↓
Candidate requirement/evidence matching
  ↓
Deterministic validation gates
  ↓
Human review where required
  ↓
Final report and audit trail
```

Each stage must preserve the source record and must not overwrite the original uploaded file.

## 5. Gemini Flash responsibilities

Gemini Flash may:

- identify explicit tender requirements;
- classify requirement types;
- extract dates, amounts, currencies, document types, issuers, and identifiers;
- identify candidate evidence matches;
- return source-page citations and exact excerpts;
- describe why a candidate match appears relevant; and
- generate an executive summary from already-verified or clearly labelled results.

Gemini Flash must not:

- make a final legal or procurement decision;
- mark an item `VERIFIED` without passing application gates;
- treat an uncited statement as evidence;
- infer a missing threshold or deadline;
- convert a supplier assertion into independent proof;
- ignore an expired, rejected, or contradictory document; or
- override organisation isolation, database RLS, or human-review requirements.

## 6. Requirement extraction policy

For each explicit requirement, the extraction output must contain:

- `title`;
- `description`;
- `type`;
- `mandatory`;
- `source_document_id`;
- `source_page`;
- `source_excerpt`;
- `deadline`, if explicitly stated;
- `numeric_thresholds`, if explicitly stated;
- `required_evidence`; and
- `confidence` as a review signal, not a final decision.

If the tender does not explicitly state a field, the field must be `null` or an empty array. The model must not fill missing values from general procurement knowledge.

## 7. Evidence extraction policy

Evidence extraction may capture:

- document type;
- organisation or supplier name;
- issuer;
- certificate or policy number;
- issue date;
- expiry date;
- coverage amount and currency;
- territorial scope;
- relevant service scope;
- source page; and
- exact excerpt.

Evidence is not accepted solely because the extracted words appear semantically similar to a requirement. The source page and excerpt must support the specific fact being matched.

## 8. Matching and deterministic gates

A candidate match may only progress to `SUPPORTED` when all applicable gates pass:

```text
same_tenant
AND source_document_exists
AND source_page_exists
AND exact_excerpt_exists
AND evidence_is_relevant
AND required_numeric_checks_pass
AND required_date_checks_pass
AND document_status_is_acceptable
AND no_unresolved_contradiction
```

### 8.1 Numeric checks

For objective thresholds, the application—not the model—must compare values. Examples:

- required public liability: `£5,000,000`;
- extracted public liability: `£5,000,000`;
- result: threshold passes if extracted value is greater than or equal to required value and currency handling is valid.

Unclear currencies, units, or coverage bases must produce `NEEDS_REVIEW`.

### 8.2 Date checks

The application must compare dates using the tender deadline, contract period, or review date specified by the relevant requirement. Expiry before the relevant date must not pass. Missing, ambiguous, or conflicting dates must produce `NEEDS_REVIEW`.

### 8.3 Document status checks

Documents marked `EXPIRED`, `REJECTED`, or otherwise invalid cannot support a `VERIFIED` result. `PENDING_REVIEW` evidence may support only a provisional `SUPPORTED` result where a reviewer is still required.

## 9. Status semantics

| Status | Meaning | Can become `VERIFIED` automatically? |
|---|---|---:|
| `SUPPORTED` | Candidate evidence supports the requirement and objective gates pass; review may still be pending. | No |
| `VERIFIED` | Evidence, citations, deterministic gates, and required human approval are complete. | No; reviewer approval is required where policy says so |
| `UNVERIFIED` | Required evidence is missing, uncited, or does not support the requirement. | No |
| `CONTRADICTED` | Evidence objectively conflicts with the requirement or another authoritative source. | No |
| `NEEDS_REVIEW` | Ambiguous, incomplete, OCR-limited, conflicting, or legally interpretive case. | No |
| `PARTIALLY_SUPPORTED` | Only part of a multi-part requirement is supported. | No |

AI confidence is a diagnostic field only. A high confidence score cannot bypass a failed gate.

## 10. Mandatory human review

Human review is mandatory for:

- `CONTRADICTED` results;
- `NEEDS_REVIEW` results;
- `PARTIALLY_SUPPORTED` results;
- OCR-only or low-quality extraction;
- conflicting source documents;
- expired or near-expiry evidence;
- financial thresholds or financial standing;
- insurance interpretation beyond direct numeric coverage;
- contractual, legal, or jurisdictional interpretation;
- unclear amendments or addenda; and
- any result a reviewer or organisation policy flags for escalation.

A reviewer must record a decision, rationale, and user identity. Reviewer approval must not delete the original AI output or source citation.

No AI-only rejection, exclusion, debarment, award, fraud finding, redaction, or other legally or similarly significant outcome may be final. Meaningful human involvement must include inspection of source evidence, uncertainty, and contrary information, with authority to override. The affected supplier or person must have a documented route for representation, human intervention, explanation at an appropriate level, challenge, and escalation. The current UK automated-decision framework must be checked at implementation time because the Data (Use and Access) Act 2025 amended the former Article 22 structure.

## 11. Privacy, provider, and transfer controls

Before production processing, BidShield must classify each file, field, prompt, output, cache, embedding, and log as personal, non-personal, special-category, criminal-offence, confidential-commercial, credential/security-sensitive, or unknown. Unknown or sensitive inputs default to quarantine and manual review.

For every purpose, the responsible organisation must document the controller, processor or joint-controller role, lawful basis, necessity and minimisation, privacy information, retention, recipients, subprocessors, international-transfer route, and DPIA decision. Where personal data is involved, a DPIA or documented non-high-risk conclusion is required before production use and after material changes. Article 28 terms, security measures, rights assistance, deletion/return, audit information, and subprocessor controls must be contractually addressed where a provider is a processor.

The implementation must:

- keep `GEMINI_API_KEY` server-side in an approved secret store;
- never expose the key in browser JavaScript, logs, GitHub, URLs, or client responses;
- use only a verified paid Gemini API project or approved enterprise route for production tender data;
- prohibit unpaid Gemini services, unqualified AI Studio usage, browser-side production calls, and developer/test keys for confidential or personal data;
- preserve organisation isolation before constructing an AI request;
- send only the minimum page excerpts and structured evidence facts needed for the operation;
- redact or block irrelevant personal, special-category, criminal-offence, credential, and confidential-commercial data unless an approved route exists;
- record provider, model, account/project, endpoint, location, terms/DPA, retention, abuse-monitoring, logging, and feature configuration without storing secrets; and
- support access, rectification, restriction, erasure, objection, and applicable portability across source files, extracted text, prompts, outputs, embeddings, caches, and logs.

Paid Gemini usage must not be described as zero retention, no human access, no cross-border processing, or UK residency. Provider documentation describes abuse monitoring and possible transient or cached processing outside the UK. BidShield must prohibit Google Search/Maps grounding, File API, stateful interactions, live resumption, explicit context caching, tuning, datasets, or request/response logging for tender text unless separately approved with retention, deletion, and transfer evidence. Where location matters, a supported regional enterprise endpoint is preferred, but the exact model and endpoint must be verified.

If personal data is sent outside the UK, the controller or DPO must document whether the transfer is restricted and record adequacy, appropriate safeguards, supplementary measures, or a valid exception before release. A UK Supabase region or Google availability in the UK is not, by itself, evidence of UK-only processing.

## 12. Audit trail requirements

Every extraction or matching run must record:

- organisation ID;
- tender ID;
- source document and page IDs;
- evidence IDs used;
- model name and provider;
- model response schema version;
- policy version;
- deterministic checks and their results;
- AI output and confidence;
- final status;
- reviewer identity and decision, if applicable; and
- UTC timestamps.

Audit records are append-only from the application workflow. Corrections create a new version or event rather than silently rewriting the historical decision.

## 13. Prompt and schema controls

All production prompts and JSON schemas must be versioned. Structured output must reject unknown fields and require source citations for extracted or matched facts.

A processing run must fail closed when:

- the model returns invalid JSON;
- a required citation is absent;
- a page ID does not belong to the current document;
- a referenced evidence ID is outside the current organisation; or
- the result cannot be reconciled with deterministic checks.

The result in a fail-closed case is `NEEDS_REVIEW` or `FAILED`, never `VERIFIED`.

## 13.1 Secure AI architecture

Production Gemini calls must run through a server-side BidShield backend or edge function. The client must never call Gemini directly. The service must use an SSRF-safe fetcher, allow only `http` and `https`, block private and link-local addresses, limit redirects, size, and time, validate content types, and apply rate limits, timeouts, idempotency, and a circuit breaker.

Tender text and external pages are untrusted data. The implementation must delimit and label source text, prevent source instructions from overriding the system policy, disable browsing, tools, code execution, and external actions for verification calls, and never allow model output to choose URLs, SQL, tenant IDs, permissions, or executable code. Prompt-injection and exfiltration tests are required before each material model or prompt change.

Supabase tenant isolation must remain explicit and testable. Every tenant-owned table must have a non-null organisation reference, RLS must be enabled on every exposed table, and select/insert/update/delete policies must bind rows to server-validated membership. `with check` rules must prevent tenant reassignment. Equivalent controls are required for storage objects, RPCs, views, realtime, exports, and background jobs. Service-role paths are server-only, narrowly scoped, explicitly tenant-filtered, and separately audited.

The AI pipeline must have a security and continuity playbook covering key rotation, Gemini disablement, affected-tenant identification, incident escalation, log preservation, restoration, and tenant-isolation validation. Prompts, outputs, embeddings, logs, backups, and provider copies are sensitive assets with component-level retention and deletion controls.

## 14. Final report policy

The Final Report may include:

- executive summary;
- readiness indicators;
- supported requirements;
- missing evidence;
- expiring or expired evidence;
- unsupported or contradicted claims;
- reviewer actions; and
- source citations and excerpts.

Every summary statement must link back to one or more requirement, evidence, page, or audit records. The report must clearly distinguish:

- AI-generated summary;
- deterministic calculation; and
- human-approved decision.

The report must include the policy version used for its results.

## 15. Change management

This document is versioned independently from model versions and application releases. A policy change must:

1. receive an owner review;
2. receive an appropriate compliance/security review;
3. increment the policy version;
4. preserve compatibility or migration rules for existing audit records; and
5. be tested against known supported, unsupported, contradicted, and ambiguous examples.

Historical decisions must retain the policy version under which they were generated.

## 16. Test acceptance cases

The first implementation must pass at least these cases:

1. Exact insurance threshold match with valid expiry → `SUPPORTED` pending review.
2. Evidence below required amount → `UNVERIFIED` or `CONTRADICTED`, not `VERIFIED`.
3. Expired evidence → `UNVERIFIED` or `NEEDS_REVIEW`.
4. Missing source page → `NEEDS_REVIEW`.
5. Scanned page without OCR → `OCR_REQUIRED` / `NEEDS_REVIEW`.
6. Conflicting certificates → `CONTRADICTED` or `NEEDS_REVIEW`.
7. Cross-tenant evidence reference → blocked by RLS and application validation.
8. Invalid model JSON → fail closed; no compliance approval.
9. Requirement not explicit in tender → not invented.
10. Human approval recorded with reviewer and timestamp → eligible for `VERIFIED` if all other gates pass.

## 17. Research references

The following sources were reviewed for this policy update on 29 September 2026. They must be revalidated before material releases because legislation, guidance, provider terms, model locations, retention, and scope can change.

- [Procurement Act 2023](https://www.legislation.gov.uk/ukpga/2023/54/contents) — binding primary legislation, including tender documents, modifications, assessment summaries, exclusions, conflicts, information, records, and oversight.
- [Procurement Regulations 2024](https://www.legislation.gov.uk/uksi/2024/692/contents) — binding secondary legislation for notices, publication, tender information, and related requirements.
- [Procurement Act 2023 Commencement and Transitional Regulations 2024](https://www.legislation.gov.uk/uksi/2024/716) — binding transitional and saving rules.
- [Cabinet Office Procurement Act guidance collection](https://www.gov.uk/government/collections/procurement-act-2023-guidance-documents) — official technical guidance, including transition, publication, assessment summaries, exclusions, debarment, and modifications.
- [UK GDPR and Data Protection Act 2018](https://www.legislation.gov.uk/eur/2016/679/contents) — binding data-protection law; see also the [Data Protection Act 2018](https://www.legislation.gov.uk/ukpga/2018/12/contents) and [Data (Use and Access) Act 2025](https://www.legislation.gov.uk/ukpga/2025/18).
- [ICO guidance on AI and data protection](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/guidance-on-ai-and-data-protection/) — regulatory guidance on lawfulness, transparency, accuracy, security, DPIAs, rights, and automated decisions.
- [Artificial Intelligence Playbook for the UK Government](https://www.gov.uk/government/publications/ai-playbook-for-the-uk-government/artificial-intelligence-playbook-for-the-uk-government-html) — official government guidance on meaningful human control, assurance, monitoring, and accountability.
- [Data and AI Ethics Framework](https://www.gov.uk/government/publications/data-ethics-framework/data-and-ai-ethics-framework) — official guidance on transparency, fairness, privacy, safety, and lifecycle governance.
- [PPN 017: Improving transparency of AI use in procurement](https://www.gov.uk/government/publications/ppn-017-improving-transparency-of-ai-use-in-procurement/ppn-017-improving-transparency-of-ai-use-in-procurement-html) — government procurement policy for its stated in-scope bodies.
- [Algorithmic Transparency Recording Standard guidance](https://www.gov.uk/government/publications/guidance-for-organisations-using-the-algorithmic-transparency-recording-standard/algorithmic-transparency-recording-standard-guidance-for-public-sector-bodies) — public-sector transparency guidance and scope.
- [NCSC Cloud Security Principles](https://www.ncsc.gov.uk/collection/cloud/the-cloud-security-principles) and [supplier assurance questions](https://www.ncsc.gov.uk/guidance/supplier-assurance-questions) — official security guidance on separation, locations, access, supply chain, logging, and resilience.
- [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms), [abuse monitoring](https://ai.google.dev/gemini-api/docs/usage-policies), [logs and sharing](https://ai.google.dev/gemini-api/docs/logs-policy), [zero data retention](https://ai.google.dev/gemini-api/docs/zdr), [locations](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations), and [Cloud DPA](https://cloud.google.com/terms/data-processing-addendum) — provider terms and operational documentation; applicability depends on the exact Google account, project, model, endpoint, and contract.
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) and [API keys](https://supabase.com/docs/guides/api/api-keys) — provider security documentation for tenant isolation and secret handling.

---

**Policy conclusion:** BidShield may use an approved paid Gemini route to accelerate reading and matching, but the product's trust boundary remains the applicable procurement regime, source citation, deterministic validation, tenant isolation, privacy and transfer assessment, audit trail, and meaningful human review.
