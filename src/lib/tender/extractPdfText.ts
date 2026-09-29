import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export type TenderPageExtraction = {
  pageNumber: number;
  textContent: string;
  characterCount: number;
  contentHash: string;
};

export type TenderExtractionResult = {
  pageCount: number;
  pages: TenderPageExtraction[];
  status: "READY" | "OCR_REQUIRED";
};

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function extractTenderPdfPages(file: File): Promise<TenderExtractionResult> {
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({
    data: new Uint8Array(buffer)
  }).promise;
  const pages: TenderPageExtraction[] = [];

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

  const hasText = pages.some((page) => page.characterCount >= 40);
  return {
    pageCount: pdf.numPages,
    pages,
    status: hasText ? "READY" : "OCR_REQUIRED"
  };
}
