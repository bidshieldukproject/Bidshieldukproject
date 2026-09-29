# BidShield Daily Progress Report

**Date:** 29 September 2026  
**Project:** BidShield UK Procurement Evidence Assurance  
**Core principle:** *They Write. BidShield Verifies.*  
**Repository:** `bidshieldukproject/Bidshieldukproject`  
**Branch:** `main`

---

## 1. Executive summary

Today BidShield moved from a UI and infrastructure foundation into a functioning evidence-assurance pipeline. The application can now:

1. Preserve tender PDFs in organisation-isolated storage.
2. Extract tender text page by page.
3. Use Google Gemini Flash to identify structured procurement requirements.
4. Apply deterministic checks to citations, dates, amounts, currencies, weights, and word limits.
5. Upload supplier evidence PDFs through authenticated server routes.
6. Extract evidence document pages and preserve their hashes and source text.
7. Use Gemini Flash to extract category-aware evidence facts with page citations.
8. Display extracted requirements and evidence facts in review-focused UI panels.
9. Record provider, model, policy, prompt, source, and audit metadata for reproducibility.

The core architecture deliberately keeps AI responsible for extraction and classification while deterministic application rules and human review remain responsible for consequential verification decisions.

---

## 2. Work completed today

### 2.1 Tender requirement extraction

Implemented the Gemini Flash requirement extraction pipeline.

**Capabilities:**

- Reads stored tender pages with page labels.
- Extracts explicit requirements only.
- Classifies requirements into the existing procurement requirement types.
- Captures:
  - Requirement title
  - Description
  - Mandatory status
  - Requirement type
  - Source page
  - Exact source excerpt
  - Deadline
  - Amount
  - Currency
  - Evaluation weight
  - Word limit
  - Required evidence
  - Extraction confidence
- Uses strict structured JSON output.
- Records the Gemini model, policy version, prompt version, and extraction run ID.

**Important control:** Gemini does not decide whether a supplier complies. It only extracts tender requirements from the source document.

### 2.2 Deterministic requirement validation

Implemented application-level validation gates for extracted requirements.

The validator checks:

- The cited page exists in the stored tender pages.
- The source excerpt appears in the cited page text.
- Dates are valid ISO dates.
- Amounts are non-negative numbers.
- Monetary values use an explicit supported currency: GBP, EUR, or USD.
- Evaluation weights are between 0 and 100.
- Word limits are positive whole numbers.
- Mandatory evidence-bearing requirements identify expected evidence.

Any failed check becomes `NEEDS_REVIEW`; the system does not silently accept the model output.

### 2.3 Tender extraction API

Added the authenticated route:

```text
POST /api/tenders/{id}/extract
```

The route:

- Requires an authenticated user.
- Resolves the user’s organisation membership.
- Queries tender, document, and pages using `organization_id`.
- Rejects missing or unreadable tender text.
- Persists requirements into the existing `requirements` table.
- Stores provenance details in `provenance_metadata`.
- Records an `TENDER_REQUIREMENTS_EXTRACTED` audit event.
- Updates document processing status to `READY` or `FAILED`.

### 2.4 Dashboard extraction workflow

The Command Center now supports tender selection and verification runs.

Users can:

- Select a tender from the active tenders table.
- Press **Run verification**.
- See extraction progress and errors.
- Review:
  - Extracted requirement count
  - Accepted citation count
  - Requirements needing review
  - Gemini model
  - Policy version
  - Extraction run ID
  - Requirement type
  - Mandatory status
  - Page citation
  - Exact source excerpt
  - Deterministic validation issues

### 2.5 Evidence Vault PDF ingestion

The Evidence Vault upload workflow was moved behind authenticated server routes.

Implemented:

- PDF-only validation for the current ingestion increment.
- Maximum file size of 25 MB.
- Evidence category selection:
  - Accreditations
  - Insurances
  - Financial records
  - Policy documents
  - Other evidence
- Organisation-isolated storage paths.
- SHA-256 file hashing.
- Private Supabase Storage uploads.
- Metadata persistence in `evidence_vault`.
- Upload and processing audit events.

New routes:

```text
POST /api/evidence/upload
POST /api/evidence/{id}/process
```

### 2.6 Evidence page extraction

Evidence PDFs are processed page by page.

For each page BidShield preserves:

- Page number
- Extracted text
- Character count
- Page content hash

The processing result is stored in the existing `evidence_vault.provenance_metadata` JSON field, avoiding a database migration in this increment.

The processor identifies documents with no useful readable text and marks them for OCR review rather than pretending that extraction succeeded.

### 2.7 Gemini evidence fact extraction

Implemented category-aware evidence fact extraction.

The extractor can identify facts such as:

- Accreditation name
- Standard or certification
- Certificate number
- Issuer
- Insurance type
- Insurance cover amount
- Currency
- Policy number
- Effective date
- Expiry date
- Financial period
- Revenue
- Profit or loss
- Policy version
- Policy owner
- Policy review date

Every fact includes:

- Fact type
- Human-readable label
- Text value
- Numeric value
- Currency
- Date value
- Source page
- Exact source excerpt
- Extraction confidence

**No-invention controls:**

- Missing values are returned as `null`.
- Facts without reliable citations are flagged.
- Gemini does not decide whether the evidence satisfies a requirement.
- Monetary facts without explicit currency are sent to review.
- Excerpts that do not match the stored source page are sent to review.

New route:

```text
POST /api/evidence/{id}/extract-facts
```

The Evidence Vault now shows an **Extract facts** action beneath each document, with cited facts and review warnings.

---

## 3. Provenance and compliance controls preserved

Today’s implementation continues to follow the BidShield AI Verification Policy v1.1.

### Source hierarchy

The system preserves the distinction between:

1. Buyer-issued tender source material.
2. Supplier-issued evidence.
3. Supplier-entered information.
4. AI-derived interpretation.

AI output is not treated as a replacement for the source document.

### Tenant isolation

The new API routes require authentication and scope database and storage operations to the authenticated user’s `organization_id`.

### Traceability

The following metadata is preserved where relevant:

- Source document ID
- Source page
- Exact source excerpt
- Content hash
- Provider
- Model identifier
- Policy version
- Prompt version
- Extraction run ID
- Processing timestamp
- Deterministic validation issues

### Human review

The system uses `NEEDS_REVIEW` and review flags for ambiguity, missing citations, mismatched excerpts, and unsupported structured facts.

No autonomous exclusion, award, submission, or legal conclusion is implemented.

---

## 4. Validation and delivery status

All implemented increments passed:

- TypeScript checking
- `git diff --check`
- Next.js production build
- Route compilation
- Working-tree cleanliness after push

The production build successfully included these dynamic routes:

```text
/api/tenders/[id]/extract
/api/evidence/upload
/api/evidence/[id]/process
/api/evidence/[id]/extract-facts
```

### Git commits pushed today

```text
3f5dcdc  feat: add Gemini requirement extraction pipeline
7669af5  fix: preserve extracted monetary facts
4f680d6  feat: wire tender extraction into dashboard
9af89b9  feat: add evidence vault pdf ingestion
35e8c99  feat: add evidence fact extraction review
```

The latest `main` branch is clean and aligned with `origin/main` at:

```text
35e8c99 feat: add evidence fact extraction review
```

---

## 5. Upcoming phase: requirement-to-evidence matching

The next phase is the central BidShield verification engine:

```text
Tender requirement
        ↓
Candidate supplier evidence
        ↓
Fact-level comparison
        ↓
Deterministic validation gates
        ↓
Claim/evidence link
        ↓
Verified / Supported / Needs Review / Contradicted
```

### 5.1 Matching inputs

The engine will consume:

- Extracted tender requirements.
- Required evidence descriptions.
- Supplier evidence documents.
- Gemini-extracted evidence facts.
- Source pages and exact excerpts.
- Dates, amounts, currencies, document categories, and issuers.

### 5.2 Candidate matching

The first matching layer should identify plausible evidence candidates using deterministic signals:

- Requirement type versus evidence category.
- Required evidence terms versus document category and title.
- Requirement keywords versus fact labels.
- Certificate or insurance terminology.
- Issuer and document-type alignment.
- Date and expiry availability.

Gemini may help suggest candidate matches, but the application should preserve the reason a candidate was selected.

### 5.3 Deterministic comparison rules

The matching engine should apply explicit rules such as:

#### Monetary requirements

- Required amount must be present.
- Evidence amount must be present.
- Currency must be explicit.
- Currency mismatch must not be silently converted.
- Evidence amount must meet or exceed the requirement where comparison is objectively valid.

#### Expiry and effective dates

- Evidence must not be expired at the relevant tender or submission date.
- Required validity windows must be calculated from explicit dates.
- Missing dates must result in `NEEDS_REVIEW` rather than a pass.

#### Certificate and accreditation requirements

- Required accreditation name or standard must match the evidence fact.
- Certificate number should be preserved when present.
- Issuer and scope should be compared where the tender requires them.
- Ambiguous or partial matches must remain reviewable.

#### Policy and document requirements

- Required document type must correspond to the evidence category and extracted document facts.
- Version and effective date should be checked where required.
- A generic document title must not be treated as proof of its contents.

#### Experience requirements

- Evidence dates must cover the required period.
- Relevant project or client information must be explicitly cited.
- Similarity alone must not be treated as proof of compliance.

### 5.4 Result statuses

The engine should use the existing status vocabulary carefully:

| Result | Meaning |
|---|---|
| `VERIFIED` | Evidence meets the deterministic checks and has complete citations; still available for human review where policy requires it. |
| `SUPPORTED` | Evidence supports the requirement but one or more non-critical fields remain incomplete. |
| `PARTIALLY_SUPPORTED` | Some requirement elements are supported, but at least one element is missing or uncertain. |
| `UNVERIFIED` | No adequate cited evidence has been found. |
| `CONTRADICTED` | Evidence conflicts with the requirement or another higher-ranked source. |
| `NEEDS_REVIEW` | The system cannot make a reliable deterministic conclusion. |

### 5.5 Claims and evidence records

The existing schema already provides the intended persistence model:

- `claims`
- `claim_evidence`
- `requirements`
- `evidence_vault`
- `audit_events`

The matching phase should create traceable links containing:

- Requirement ID
- Evidence ID
- Evidence page
- Match type
- Support level
- Deterministic reasoning
- Matched facts
- Provenance metadata
- Extraction and matching run IDs

No new database migration should be needed for the first matching increment unless testing demonstrates a clear missing field.

### 5.6 Matching UI

The recommended first UI is a requirement review panel showing:

- Requirement text
- Mandatory flag
- Tender source page and excerpt
- Suggested evidence document
- Evidence fact used for the match
- Evidence source page and excerpt
- Deterministic check results
- Current status
- Clear review action for ambiguous cases

The UI must never hide unsupported claims or present an AI suggestion as final proof.

---

## 6. Recommended implementation order

### Increment 1 — Deterministic matching core

Create the comparison functions first, independent of Gemini:

- Amount and currency comparison
- Expiry-date comparison
- Document category matching
- Accreditation and certificate matching
- Evidence completeness checks
- Status assignment

### Increment 2 — Authenticated matching API

Add a tenant-scoped route that:

- Loads one tender’s requirements.
- Loads the organisation’s evidence facts.
- Creates candidate matches.
- Applies deterministic checks.
- Persists `claim_evidence` and claim records.
- Writes an audit event.

### Increment 3 — Requirement review UI

Add a focused screen or panel that displays:

- Coverage summary
- Verified items
- Partial matches
- Missing evidence
- Contradictions
- Needs-review queue
- Citation drill-down

### Increment 4 — Report generation

After matching is reliable, generate an audit-ready summary containing:

- Requirement coverage
- Evidence coverage
- Open risks
- Expired or expiring documents
- Missing citations
- Human review decisions
- Source and provenance appendix

---

## 7. Important boundaries for the matching phase

The next phase must not:

- Mark a requirement verified without a source page and exact excerpt.
- Convert currencies without an explicit approved conversion policy and traceable rate.
- Treat model confidence as compliance proof.
- Infer missing expiry dates or certificate validity.
- Automatically exclude a supplier.
- Automatically submit or attest to a tender.
- Override a buyer-issued source with a lower-ranked supplier or AI source.
- Remove ambiguous results from the review queue.

The matching engine should optimise for **explainability, evidence citation, and safe uncertainty**, not for producing the highest possible pass rate.

---

## 8. Current product position

BidShield now has a working foundation for the complete evidence-assurance lifecycle:

```text
Source tender
  → Page-aware tender text
  → Structured requirements
  → Deterministic requirement validation
  → Supplier evidence upload
  → Page-aware evidence text
  → Structured evidence facts
  → Upcoming requirement/evidence matching
  → Upcoming audit-ready verification report
```

The product is ready to move into its defining phase: converting extracted requirements and evidence facts into transparent, deterministic, citation-backed verification outcomes.
