# BidShield AI Verification Policy v1.0

**Document owner:** BidShield Product and Compliance Engineering  
**Status:** Approved implementation baseline  
**Effective date:** 29 September 2026  
**Policy version:** `1.0`  
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

It does not authorise BidShield to provide legal advice, certify insurance, attest to financial standing, or submit a tender on behalf of a supplier.

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

## 11. Privacy and provider controls

Only the minimum page text and evidence facts necessary for the current operation should be sent to Gemini. The application should prefer page excerpts and structured facts over unnecessary full-document transmission.

The implementation must:

- keep `GEMINI_API_KEY` server-side;
- never expose the key in browser JavaScript, logs, GitHub, or client responses;
- preserve organisation isolation before constructing an AI request;
- avoid sending unrelated tenant records;
- record provider/model metadata without storing secrets;
- respect the configured provider's data-processing and retention terms; and
- provide a configurable path to redact personal data before AI processing.

Before production use with real confidential tenders, the organisation must review its provider agreement, retention settings, UK GDPR role allocation, international transfer position, and any applicable data-processing agreement.

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

---

**Policy conclusion:** BidShield may use Gemini Flash to accelerate reading and matching, but the product's trust boundary remains the source citation, deterministic validation, tenant isolation, audit trail, and human review.
