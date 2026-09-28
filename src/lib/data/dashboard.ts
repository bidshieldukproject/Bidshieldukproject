import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DashboardTender = {
  id: string;
  name: string;
  buyer: string;
  deadline: string;
  requirements: string;
  issues: string;
  evidence: string;
  status: string;
};

export type DashboardData = {
  metrics: {
    activeTenders: number;
    requiringAction: number;
    evidenceExpiring: number;
    readinessPercent: number;
  };
  tenders: DashboardTender[];
  alerts: { title: string; detail: string; tone: "critical" | "warning" | "action" }[];
  error: string | null;
};

type TenderRow = { id: string; title: string; buyer_name: string | null; deadline: string | null; status: string };
type RequirementRow = { id: string; tender_id: string; status: string; mandatory: boolean };
type EvidenceRow = { document_name: string; expiry_date: string | null; status: string };
type ClaimRow = { tender_id: string; status: string };

function formatDeadline(deadline: string | null) {
  if (!deadline) return "No deadline";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(deadline));
}

function isWithinDays(date: string | null, days: number) {
  if (!date) return false;
  const expiry = new Date(`${date}T23:59:59Z`).getTime();
  const now = Date.now();
  return expiry >= now && expiry <= now + days * 24 * 60 * 60 * 1000;
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createSupabaseServerClient();
  const [tendersResult, requirementsResult, evidenceResult, claimsResult] = await Promise.all([
    supabase.from("tenders").select("id, title, buyer_name, deadline, status").order("deadline", { ascending: true }).limit(100),
    supabase.from("requirements").select("id, tender_id, status, mandatory").limit(1000),
    supabase.from("evidence_vault").select("document_name, expiry_date, status").order("expiry_date", { ascending: true }).limit(1000),
    supabase.from("claims").select("tender_id, status").limit(1000)
  ]);

  const queryError = tendersResult.error ?? requirementsResult.error ?? evidenceResult.error ?? claimsResult.error;
  if (queryError) {
    return {
      metrics: { activeTenders: 0, requiringAction: 0, evidenceExpiring: 0, readinessPercent: 0 },
      tenders: [],
      alerts: [],
      error: queryError.message
    };
  }

  const tenders = (tendersResult.data ?? []) as TenderRow[];
  const requirements = (requirementsResult.data ?? []) as RequirementRow[];
  const evidence = (evidenceResult.data ?? []) as EvidenceRow[];
  const claims = (claimsResult.data ?? []) as ClaimRow[];
  const activeTenders = tenders.filter((tender) => !["CLOSED", "ARCHIVED", "SUBMITTED"].includes(tender.status));
  const expiringEvidence = evidence.filter((item) => isWithinDays(item.expiry_date, 30) || item.status === "EXPIRING");
  const unresolvedClaims = claims.filter((claim) => ["UNVERIFIED", "CONTRADICTED", "NEEDS_REVIEW", "PARTIALLY_SUPPORTED"].includes(claim.status));
  const incompleteRequirements = requirements.filter((requirement) => ["NOT_MET", "UNKNOWN", "NEEDS_REVIEW"].includes(requirement.status));
  const requiringAction = new Set([...unresolvedClaims.map((claim) => claim.tender_id), ...incompleteRequirements.map((requirement) => requirement.tender_id)]).size;
  const totalChecks = requirements.length + claims.length;
  const passedChecks = requirements.filter((requirement) => ["MET"].includes(requirement.status)).length + claims.filter((claim) => ["SUPPORTED", "VERIFIED"].includes(claim.status)).length;
  const readinessPercent = totalChecks ? Math.round((passedChecks / totalChecks) * 100) : 0;

  const dashboardTenders = activeTenders.slice(0, 20).map((tender) => {
    const tenderRequirements = requirements.filter((requirement) => requirement.tender_id === tender.id);
    const tenderClaims = claims.filter((claim) => claim.tender_id === tender.id);
    const tenderIssues = tenderRequirements.filter((requirement) => requirement.mandatory && requirement.status !== "MET").length + tenderClaims.filter((claim) => ["UNVERIFIED", "CONTRADICTED"].includes(claim.status)).length;
    const tenderEvidence = evidence.filter((item) => item.status === "VERIFIED").length;
    return {
      id: tender.id,
      name: tender.title,
      buyer: tender.buyer_name ?? "Buyer not specified",
      deadline: formatDeadline(tender.deadline),
      requirements: `${tenderRequirements.filter((requirement) => requirement.status === "MET").length} / ${tenderRequirements.length}`,
      issues: tenderIssues ? `${tenderIssues} open` : "None",
      evidence: tenderEvidence ? `${tenderEvidence} verified` : "No evidence",
      status: tender.status === "READY" ? "Submission ready" : tender.status === "REVIEW" ? "Review" : "In progress"
    };
  });

  const alerts: DashboardData["alerts"] = [];
  if (incompleteRequirements.length) alerts.push({ title: "Requirements need review", detail: `${incompleteRequirements.length} requirement records are not marked met.`, tone: "critical" });
  if (expiringEvidence.length) alerts.push({ title: "Evidence expiring soon", detail: `${expiringEvidence.length} evidence records need expiry attention.`, tone: "warning" });
  if (unresolvedClaims.length) alerts.push({ title: "Claims require verification", detail: `${unresolvedClaims.length} claims are not fully supported.`, tone: "action" });

  return {
    metrics: { activeTenders: activeTenders.length, requiringAction, evidenceExpiring: expiringEvidence.length, readinessPercent },
    tenders: dashboardTenders,
    alerts,
    error: null
  };
}
