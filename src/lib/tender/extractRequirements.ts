import {
  extractRequirementsWithGemini,
  GeminiExtractionResult,
  GeminiPage
} from "@/lib/gemini/client";

export type TenderPageInput = {
  page_number: number;
  text_content: string;
};

export async function extractTenderRequirements(pages: TenderPageInput[]): Promise<GeminiExtractionResult> {
  const readablePages: GeminiPage[] = pages
    .filter((page) => page.text_content.trim().length > 0)
    .map((page) => ({
      pageNumber: page.page_number,
      text: page.text_content
    }));

  return extractRequirementsWithGemini(readablePages);
}
