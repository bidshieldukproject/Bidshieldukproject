export type EvidencePageExtraction = {
  pageNumber: number;
  textContent: string;
  characterCount: number;
  contentHash: string;
};

export type EvidenceExtractionResult = {
  pageCount: number;
  pages: EvidencePageExtraction[];
  status: "READY" | "OCR_REQUIRED";
};

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function extractEvidencePdf(buffer: ArrayBuffer): Promise<EvidenceExtractionResult> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false }).promise;
  const pages: EvidencePageExtraction[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    pages.push({
      pageNumber,
      textContent: text,
      characterCount: text.length,
      contentHash: await sha256(text)
    });
  }

  return {
    pageCount: pdf.numPages,
    pages,
    status: pages.some((page) => page.characterCount >= 40) ? "READY" : "OCR_REQUIRED"
  };
}
