export const RAG_CATEGORIES = [
  "platform",
  "pricing",
  "privacy",
  "security",
  "onboarding",
  "analytics",
  "billing",
  "support",
] as const;

export interface EvaluationSample {
  id: string;
  collection_id: string;
  question: string;
  approved_answer: string;
  category: string;
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SampleInput {
  question: string;
  approved_answer: string;
  category?: string;
  is_active?: boolean;
}

export const DEFAULT_GOLDEN_SAMPLES: Array<Omit<EvaluationSample, "id" | "created_at" | "updated_at">> = [
  {
    collection_id: "pulse360_faq",
    question: "What are the 8 phases in a Pulse360 performance review cycle?",
    approved_answer: "A review cycle in Pulse360 advances linearly through 8 distinct phases: Draft, Nominate, Approve, Review, Calculation, Consultation, Accept, and Closed. Phase transitions are controlled exclusively by HR Administrators.",
    category: "platform",
    is_active: true,
    created_by: "system_default",
  },
  {
    collection_id: "pulse360_faq",
    question: "How is the annual billing discount calculated?",
    approved_answer: "Annual subscriptions receive a standard 15% discount off the total 12-month standard subscription fee. The discounted total is charged upfront upon annual renewal.",
    category: "pricing",
    is_active: true,
    created_by: "system_default",
  },
  {
    collection_id: "pulse360_faq",
    question: "Who is allowed to upload and delete documents in the FAQ Knowledge Base?",
    approved_answer: "Only users with the System Administrator (SYSTEM_ADMIN) role have permissions to upload, preview, commit, and delete documents in the knowledge base. HR Administrators have read-only access to view the indexed sources.",
    category: "security",
    is_active: true,
    created_by: "system_default",
  },
  {
    collection_id: "pulse360_faq",
    question: "What file formats and sizes are supported for FAQ document ingestion?",
    approved_answer: "The knowledge ingestion pipeline supports PDF, TXT, and Markdown (.md) documents up to a maximum file size of 4 MB. Files must contain machine-readable text.",
    category: "platform",
    is_active: true,
    created_by: "system_default",
  },
  {
    collection_id: "pulse360_faq",
    question: "How are peer review ratings anonymized in employee results?",
    approved_answer: "Peer feedback scores are aggregated by rating criterion. Individual peer names are never displayed alongside individual numerical ratings, ensuring objective and confidential review input.",
    category: "privacy",
    is_active: true,
    created_by: "system_default",
  },
];

/**
 * Validates sample question, approved answer, and category.
 */
export function validateSampleInput(input: Partial<SampleInput>): { valid: boolean; error?: string; clean?: SampleInput } {
  if (!input || typeof input !== "object") {
    return { valid: false, error: "Invalid sample payload." };
  }

  const question = typeof input.question === "string" ? input.question.trim() : "";
  if (question.length < 3 || question.length > 1000) {
    return { valid: false, error: "Question must be between 3 and 1000 characters." };
  }

  const approved_answer = typeof input.approved_answer === "string" ? input.approved_answer.trim() : "";
  if (approved_answer.length < 5 || approved_answer.length > 4000) {
    return { valid: false, error: "Approved answer must be between 5 and 4000 characters." };
  }

  let category = typeof input.category === "string" ? input.category.trim().toLowerCase() : "platform";
  if (!category || !(RAG_CATEGORIES as readonly string[]).includes(category)) {
    category = "platform";
  }

  return {
    valid: true,
    clean: {
      question,
      approved_answer,
      category,
      is_active: input.is_active ?? true,
    },
  };
}

/**
 * Parses CSV text containing question, approved_answer, category headers.
 */
export function parseSamplesCsv(csvContent: string): { samples: SampleInput[]; errors: string[] } {
  const lines = csvContent.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) {
    return { samples: [], errors: ["CSV must contain a header row and at least one data row."] };
  }

  const headerLine = lines[0].toLowerCase();
  const headers = headerLine.split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
  const qIdx = headers.findIndex((h) => h.includes("question"));
  const aIdx = headers.findIndex((h) => h.includes("answer") || h.includes("approved"));
  const catIdx = headers.findIndex((h) => h.includes("category"));

  if (qIdx === -1 || aIdx === -1) {
    return { samples: [], errors: ["CSV header must include 'question' and 'approved_answer' columns."] };
  }

  const samples: SampleInput[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Simple comma separation with basic quotes support
    const row = splitCsvRow(lines[i]);
    const question = row[qIdx] ?? "";
    const approved_answer = row[aIdx] ?? "";
    const category = catIdx !== -1 ? row[catIdx] : "platform";

    const validated = validateSampleInput({ question, approved_answer, category });
    if (validated.valid && validated.clean) {
      samples.push(validated.clean);
    } else {
      errors.push(`Row ${i + 1}: ${validated.error}`);
    }
  }

  return { samples, errors };
}

function splitCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim().replace(/^["']|["']$/g, ""));
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^["']|["']$/g, ""));
  return result;
}
