import { EvidenceCandidate, EvidenceInput, RequirementInput } from "@/lib/matching/types";

const categoryByRequirement: Record<string, string[]> = {
  INSURANCE: ["INSURANCES"],
  FINANCIAL: ["FINANCIAL"],
  QUALIFICATION: ["ACCREDITATIONS"],
  POLICY: ["POLICIES"],
  DOCUMENT: ["ACCREDITATIONS", "INSURANCES", "FINANCIAL", "POLICIES", "OTHER"],
  EXPERIENCE: ["OTHER", "FINANCIAL"]
};

function tokens(value: string) {
  return new Set(value.toUpperCase().split(/[^A-Z0-9]+/).filter((token) => token.length >= 4));
}

export function findEvidenceCandidates(requirement: RequirementInput, evidence: EvidenceInput[]): EvidenceCandidate[] {
  const requiredTokens = tokens([requirement.title, requirement.description ?? "", ...requirement.requiredEvidence].join(" "));
  const categories = categoryByRequirement[requirement.type] ?? ["OTHER"];

  return evidence.map((item) => {
    const reasons: string[] = [];
    let score = 0;
    if (categories.includes(item.category)) {
      score += 0.55;
      reasons.push(`Requirement type ${requirement.type} aligns with ${item.category} evidence.`);
    }
    const documentTokens = tokens([item.documentName, item.category, ...item.facts.map((fact) => `${fact.label} ${fact.factType}`)].join(" "));
    const overlaps = Array.from(requiredTokens).filter((token) => documentTokens.has(token));
    if (overlaps.length > 0) {
      score += Math.min(0.35, overlaps.length * 0.07);
      reasons.push(`Evidence shares explicit terms: ${overlaps.slice(0, 5).join(", ")}.`);
    }
    if (item.facts.length > 0) {
      score += 0.1;
      reasons.push("Evidence has extracted facts available for comparison.");
    }
    return { evidence: item, score: Math.min(1, score), reasons };
  }).filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score);
}
