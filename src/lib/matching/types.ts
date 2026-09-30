export type MatchingStatus =
  | "VERIFIED"
  | "SUPPORTED"
  | "PARTIALLY_SUPPORTED"
  | "UNVERIFIED"
  | "CONTRADICTED"
  | "NEEDS_REVIEW";

export type RequirementInput = {
  id: string;
  tenderId: string;
  title: string;
  description: string | null;
  type: string;
  mandatory: boolean;
  sourcePage: number | null;
  sourceExcerpt: string | null;
  requiredEvidence: string[];
  deadline: string | null;
  weight: number | null;
  wordLimit: number | null;
  confidence: number | null;
  provenanceMetadata: Record<string, unknown>;
};

export type EvidenceFactInput = {
  factType: string;
  label: string;
  value: string | null;
  numericValue: number | null;
  currency: string | null;
  dateValue: string | null;
  sourcePage: number | null;
  sourceExcerpt: string | null;
  confidence: number;
  validationIssues: string[];
};

export type EvidenceInput = {
  id: string;
  documentName: string;
  category: string;
  issueDate: string | null;
  expiryDate: string | null;
  status: string;
  provenanceMetadata: Record<string, unknown>;
  facts: EvidenceFactInput[];
};

export type DeterministicCheck = {
  checkType: string;
  passed: boolean | null;
  reason: string;
  requirementValue: unknown;
  evidenceValue: unknown;
};

export type EvidenceCandidate = {
  evidence: EvidenceInput;
  score: number;
  reasons: string[];
};

export type MatchResult = {
  requirementId: string;
  evidenceId: string | null;
  status: MatchingStatus;
  matchType: string;
  reasoning: string;
  matchedFacts: EvidenceFactInput[];
  evidencePage: number | null;
  evidenceExcerpt: string | null;
  deterministicChecks: DeterministicCheck[];
  candidateScore: number;
};
