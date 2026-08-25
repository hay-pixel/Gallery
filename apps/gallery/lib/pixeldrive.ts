export type CapabilityState = "available" | "pending" | "unsupported" | "unavailable" | "failed";

export type SourceOccurrence = {
  sourceOccurrenceId: string;
  sourceId: string;
  sourceKind: string;
  sourceLocation: string;
  originalPath: string;
  providerFileId?: string;
  archiveId?: string;
  archiveLocation?: string;
  sourceMember?: string;
};

export type ReviewState = "NEEDS_REVIEW" | "APPROVED" | "SKIPPED";
export type FileKind = "Photo" | "Video" | "Document" | "Writing" | "Meme" | "Sidecar";

export type FileRecord = {
  assetId: string;
  sources: SourceOccurrence[];
  analysisState: CapabilityState;
  searchState: CapabilityState;
  fileName: string;
  kind: FileKind;
  mimeType: string;
  sizeBytes: number;
  category: string;
  subcategory: string;
  tags: string[];
  ocrText: string;
  visualDescription: string;
  dateTaken: string;
  dateSource: string;
  reviewState: ReviewState;
  reviewEvidence: string;
  confidence: number;
  duplicateGroupId?: string;
  isPreferredCopy?: boolean;
  preferredSourceOccurrenceId?: string;
  isTechnicalSidecar?: boolean;
  isFlagged18Plus?: boolean;
  userNotes: string;
  previewColor: string;
};

export type DuplicateGroup = {
  id: string;
  type: "Exact" | "Likely";
  assetIds: string[];
  occurrenceIds?: string[];
  reason: string;
  wastedBytes: number;
};

export type IndexingJob = {
  id: string;
  displayName: string;
  status: "RUNNING" | "COMPLETED" | "ERROR" | "QUEUED";
  progressPercent: number;
  processed: number;
  total: number;
  detail: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: string[];
};

export const CATEGORY_ORDER = [
  "All", "Photos", "Videos", "Screenshots", "Memes", "Documents", "Life Admin", "Writing", "Work / Projects", "Needs Review", "Duplicates",
];

type FixtureSeed = Omit<FileRecord, "assetId" | "sources" | "analysisState" | "searchState"> & { id: string; originalPath: string; sourceZipProvenance: string; providerFileId: string; exactSha256: string };

const FIXTURE_SEEDS: FixtureSeed[] = [
  {
    id: "speaker-wires", fileName: "speaker_wires_circled.jpg", kind: "Photo", mimeType: "image/jpeg", sizeBytes: 3_842_108,
    category: "Photos", subcategory: "Garage", tags: ["speaker", "wires", "garage", "circled"],
    ocrText: "FRONT LEFT  RED  SPEAKER  WIRE", visualDescription: "Garage workbench with speaker wires, including a red cable circled for reference.",
    dateTaken: "2024-03-14", dateSource: "EXIF capture date", originalPath: "Photos/2024/garage/speaker_wires_circled.jpg",
    sourceZipProvenance: "Google Takeout / Photos 2024-03.zip", providerFileId: "drive-photo-0001", exactSha256: "1b8f40e983a5320a7b2aa8f5b7c0ca7f8e7a77a2b20f5aa301d49b7a03bb0011",
    reviewState: "APPROVED", reviewEvidence: "Manual category confirmed", confidence: 0.98, userNotes: "Speaker wire reference photo.", previewColor: "#245B8E",
  },
  {
    id: "housing-lease", fileName: "riverside_housing_lease.pdf", kind: "Document", mimeType: "application/pdf", sizeBytes: 1_228_476,
    category: "Life Admin", subcategory: "Housing", tags: ["housing", "lease", "tenancy", "riverside"],
    ocrText: "Residential tenancy agreement Riverside unit rent commencement date tenant landlord", visualDescription: "Scanned residential tenancy agreement for a Riverside rental.",
    dateTaken: "2023-11-02", dateSource: "Google Takeout sidecar", originalPath: "Documents/Life Admin/Housing/riverside_housing_lease.pdf",
    sourceZipProvenance: "Google Takeout / Drive documents.zip", providerFileId: "drive-doc-0042", exactSha256: "2f6c40e983a5320a7b2aa8f5b7c0ca7f8e7a77a2b20f5aa301d49b7a03bb0042",
    reviewState: "APPROVED", reviewEvidence: "Housing keywords and manual confirmation", confidence: 0.97, userNotes: "", previewColor: "#4338CA",
  },
  {
    id: "resume-current", fileName: "alex_resume_2024.pdf", kind: "Document", mimeType: "application/pdf", sizeBytes: 342_010,
    category: "Documents", subcategory: "Applications", tags: ["resume", "cv", "employment", "application"],
    ocrText: "Alex Morgan curriculum vitae professional experience education skills", visualDescription: "Two-page professional resume with work history and skills.",
    dateTaken: "2024-01-09", dateSource: "Filename timestamp", originalPath: "Documents/Applications/alex_resume_2024.pdf",
    sourceZipProvenance: "Google Takeout / Drive documents.zip", providerFileId: "drive-doc-0101", exactSha256: "ce9d40e983a5320a7b2aa8f5b7c0ca7f8e7a77a2b20f5aa301d49b7a03bb0101",
    reviewState: "APPROVED", reviewEvidence: "Document classification", confidence: 0.99, duplicateGroupId: "resume-exact", isPreferredCopy: true, userNotes: "Preferred current copy.", previewColor: "#2F80ED",
  },
  {
    id: "resume-copy", fileName: "resume_final_copy.pdf", kind: "Document", mimeType: "application/pdf", sizeBytes: 342_010,
    category: "Documents", subcategory: "Applications", tags: ["resume", "cv", "duplicate"],
    ocrText: "Alex Morgan curriculum vitae professional experience education skills", visualDescription: "A byte-identical second copy of the current resume.",
    dateTaken: "2024-01-09", dateSource: "Filename timestamp", originalPath: "Downloads/resume_final_copy.pdf",
    sourceZipProvenance: "Google Takeout / Drive documents.zip", providerFileId: "drive-doc-0102", exactSha256: "ce9d40e983a5320a7b2aa8f5b7c0ca7f8e7a77a2b20f5aa301d49b7a03bb0101",
    reviewState: "APPROVED", reviewEvidence: "Exact SHA-256 duplicate", confidence: 1, duplicateGroupId: "resume-exact", userNotes: "", previewColor: "#2F80ED",
  },
  {
    id: "court-paperwork", fileName: "court_hearing_paperwork.png", kind: "Photo", mimeType: "image/png", sizeBytes: 2_114_786,
    category: "Life Admin", subcategory: "Court", tags: ["court", "hearing", "paperwork", "notice"],
    ocrText: "Court hearing date registry notice application paperwork", visualDescription: "Photograph of court paperwork with a hearing date highlighted.",
    dateTaken: "2022-08-21", dateSource: "EXIF capture date", originalPath: "Photos/Screenshots/court_hearing_paperwork.png",
    sourceZipProvenance: "Google Takeout / Photos 2022-08.zip", providerFileId: "drive-photo-0081", exactSha256: "81d340e983a5320a7b2aa8f5b7c0ca7f8e7a77a2b20f5aa301d49b7a03bb0081",
    reviewState: "NEEDS_REVIEW", reviewEvidence: "OCR mentions court and registry; confirm privacy category", confidence: 0.76, userNotes: "", previewColor: "#7C3AED",
  },
  {
    id: "private-drive-plan", fileName: "private_drive_architecture.md", kind: "Writing", mimeType: "text/markdown", sizeBytes: 41_924,
    category: "Work / Projects", subcategory: "PrivateDrive", tags: ["project", "architecture", "read-only", "catalogue"],
    ocrText: "Read-only source adapter catalogue worker provenance hybrid search", visualDescription: "PrivateDrive system architecture and implementation notes.",
    dateTaken: "2025-02-11", dateSource: "Source modified date", originalPath: "Work/PrivateDrive/private_drive_architecture.md",
    sourceZipProvenance: "Google Takeout / Drive work.zip", providerFileId: "drive-work-0031", exactSha256: "31d340e983a5320a7b2aa8f5b7c0ca7f8e7a77a2b20f5aa301d49b7a03bb0031",
    reviewState: "APPROVED", reviewEvidence: "Project path and document type", confidence: 0.96, userNotes: "", previewColor: "#0F766E",
  },
  {
    id: "vehicle-video", fileName: "commodore_engine_walkthrough.mp4", kind: "Video", mimeType: "video/mp4", sizeBytes: 128_001_024,
    category: "Videos", subcategory: "Vehicle", tags: ["commodore", "engine", "car", "walkthrough"],
    ocrText: "Commodore engine bay service discussion", visualDescription: "Video walkthrough of a Commodore engine bay with maintenance discussion.",
    dateTaken: "2021-06-18", dateSource: "Video metadata", originalPath: "Videos/Vehicles/commodore_engine_walkthrough.mp4",
    sourceZipProvenance: "Google Takeout / Videos 2021.zip", providerFileId: "drive-video-0018", exactSha256: "18d340e983a5320a7b2aa8f5b7c0ca7f8e7a77a2b20f5aa301d49b7a03bb0018",
    reviewState: "APPROVED", reviewEvidence: "Video metadata and tags", confidence: 0.89, userNotes: "", previewColor: "#B45309",
  },
  {
    id: "bank-receipt", fileName: "bank_transfer_receipt.png", kind: "Photo", mimeType: "image/png", sizeBytes: 664_820,
    category: "Life Admin", subcategory: "Banking", tags: ["bank", "transfer", "receipt", "payment"],
    ocrText: "Transfer receipt BSB account payment confirmation transaction reference", visualDescription: "Bank-transfer confirmation screenshot.",
    dateTaken: "2024-05-24", dateSource: "Filename timestamp", originalPath: "Screenshots/bank_transfer_receipt.png",
    sourceZipProvenance: "Google Takeout / Photos 2024-05.zip", providerFileId: "drive-photo-0524", exactSha256: "24d340e983a5320a7b2aa8f5b7c0ca7f8e7a77a2b20f5aa301d49b7a03bb0524",
    reviewState: "NEEDS_REVIEW", reviewEvidence: "Financial terms detected from extracted text", confidence: 0.73, userNotes: "", previewColor: "#166534",
  },
  {
    id: "project-brief", fileName: "northstar_project_brief.docx", kind: "Document", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sizeBytes: 866_240,
    category: "Work / Projects", subcategory: "Northstar", tags: ["project", "brief", "northstar", "work"],
    ocrText: "Northstar project brief milestones scope workshop deliverables", visualDescription: "Project brief outlining Northstar milestones and deliverables.",
    dateTaken: "2024-09-03", dateSource: "Source modified date", originalPath: "Work/Northstar/northstar_project_brief.docx",
    sourceZipProvenance: "Google Takeout / Drive work.zip", providerFileId: "drive-work-0093", exactSha256: "93d340e983a5320a7b2aa8f5b7c0ca7f8e7a77a2b20f5aa301d49b7a03bb0093",
    reviewState: "APPROVED", reviewEvidence: "Path and project terms", confidence: 0.92, userNotes: "", previewColor: "#0E7490",
  },
  {
    id: "draft-letter", fileName: "draft_letter_to_agent.txt", kind: "Writing", mimeType: "text/plain", sizeBytes: 8_602,
    category: "Writing", subcategory: "Drafts", tags: ["draft", "letter", "housing", "agent"],
    ocrText: "Draft letter rental agent housing maintenance request", visualDescription: "Draft letter to a property agent about a housing matter.",
    dateTaken: "2023-11-06", dateSource: "Source modified date", originalPath: "Writing/Drafts/draft_letter_to_agent.txt",
    sourceZipProvenance: "Google Takeout / Drive writing.zip", providerFileId: "drive-writing-006", exactSha256: "06d340e983a5320a7b2aa8f5b7c0ca7f8e7a77a2b20f5aa301d49b7a03bb0006",
    reviewState: "APPROVED", reviewEvidence: "Writing path and content", confidence: 0.94, userNotes: "", previewColor: "#6D28D9",
  },
  {
    id: "meme", fileName: "weekend_reaction_meme.jpg", kind: "Meme", mimeType: "image/jpeg", sizeBytes: 402_180,
    category: "Memes", subcategory: "Internet Media", tags: ["meme", "reaction", "weekend"],
    ocrText: "When it is finally Friday", visualDescription: "Reaction meme with a Friday caption.",
    dateTaken: "2020-07-11", dateSource: "Source modified date", originalPath: "Downloads/weekend_reaction_meme.jpg",
    sourceZipProvenance: "Google Takeout / Drive downloads.zip", providerFileId: "drive-download-711", exactSha256: "11d340e983a5320a7b2aa8f5b7c0ca7f8e7a77a2b20f5aa301d49b7a03bb0711",
    reviewState: "APPROVED", reviewEvidence: "Image text and filename", confidence: 0.9, userNotes: "", previewColor: "#C2410C",
  },
  {
    id: "speaker-sidecar", fileName: "speaker_wires_circled.jpg.json", kind: "Sidecar", mimeType: "application/json", sizeBytes: 1_428,
    category: "Other", subcategory: "Technical metadata", tags: ["takeout", "sidecar", "metadata"],
    ocrText: "", visualDescription: "Google Takeout metadata sidecar linked to speaker_wires_circled.jpg.",
    dateTaken: "2024-03-14", dateSource: "Google Takeout sidecar", originalPath: "Photos/2024/garage/speaker_wires_circled.jpg.json",
    sourceZipProvenance: "Google Takeout / Photos 2024-03.zip", providerFileId: "drive-sidecar-0001", exactSha256: "aa1d40e983a5320a7b2aa8f5b7c0ca7f8e7a77a2b20f5aa301d49b7a03bb0001",
    reviewState: "APPROVED", reviewEvidence: "Linked technical sidecar", confidence: 1, isTechnicalSidecar: true, userNotes: "", previewColor: "#475569",
  },
];

export function canonicaliseFixtureSeeds(seeds: FixtureSeed[]): FileRecord[] {
  const assets = new Map<string, FileRecord>();
  for (const seed of seeds) {
    const assetId = `sha256:${seed.exactSha256}`;
    const source: SourceOccurrence = {
      sourceOccurrenceId: `fixture-occurrence:${seed.providerFileId}`,
      sourceId: `fixture-source:${seed.sourceZipProvenance}`,
      sourceKind: "fixture",
      sourceLocation: seed.sourceZipProvenance,
      originalPath: seed.originalPath,
      providerFileId: seed.providerFileId,
      archiveLocation: seed.sourceZipProvenance,
      sourceMember: seed.originalPath,
    };
    const { id: _fixtureId, exactSha256: _hash, originalPath: _path, sourceZipProvenance: _archive, providerFileId: _providerId, ...metadata } = seed;
    const current = assets.get(assetId);
    if (current) {
      current.sources = [...current.sources, source];
      continue;
    }
    assets.set(assetId, { ...metadata, assetId, sources: [source], analysisState: "available", searchState: "unavailable" });
  }
  return [...assets.values()];
}

export const FIXTURE_FILES: FileRecord[] = canonicaliseFixtureSeeds(FIXTURE_SEEDS);

export const INITIAL_JOBS: IndexingJob[] = [
  { id: "scan", displayName: "Source scan", status: "COMPLETED", progressPercent: 100, processed: 12, total: 12, detail: "Fixture source catalogued safely" },
  { id: "metadata", displayName: "Metadata & provenance", status: "COMPLETED", progressPercent: 100, processed: 12, total: 12, detail: "Date-source hierarchy applied" },
  { id: "hash", displayName: "SHA-256 duplicate check", status: "COMPLETED", progressPercent: 100, processed: 12, total: 12, detail: "One exact duplicate group found" },
  { id: "ocr", displayName: "OCR & text extraction", status: "RUNNING", progressPercent: 82, processed: 10, total: 12, detail: "Searching available extracted text" },
  { id: "index", displayName: "Catalogue index", status: "QUEUED", progressPercent: 0, processed: 0, total: 12, detail: "Ready for a safe local refresh" },
];

export function duplicateGroups(files: FileRecord[]): DuplicateGroup[] {
  const exact = files.filter((file) => file.sources.length > 1).map((file) => ({
    id: `exact:${file.assetId}`, type: "Exact" as const, assetIds: [file.assetId],
    occurrenceIds: file.sources.map((source) => source.sourceOccurrenceId),
    reason: "One canonical asset observed at multiple source locations",
    wastedBytes: file.sizeBytes * (file.sources.length - 1),
  }));
  const near = new Map<string, FileRecord[]>();
  for (const file of files) if (file.duplicateGroupId) near.set(file.duplicateGroupId, [...(near.get(file.duplicateGroupId) ?? []), file]);
  return [...exact, ...[...near].filter(([, members]) => new Set(members.map((file) => file.assetId)).size > 1).map(([id, members]) => ({ id: `near:${id}`, type: "Likely" as const, assetIds: members.map((file) => file.assetId), reason: "Near-duplicate candidate from Search", wastedBytes: 0 }))];
}

export const DUPLICATE_GROUPS: DuplicateGroup[] = duplicateGroups(FIXTURE_FILES);

const STOP_WORDS = new Set(["a", "about", "all", "an", "and", "are", "copies", "do", "file", "files", "find", "for", "have", "i", "in", "is", "me", "my", "of", "on", "show", "that", "the", "to", "what", "where", "with"]);
const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function searchFiles(files: FileRecord[], query: string): FileRecord[] {
  const q = normalise(query);
  if (!q) return [];
  const terms = q.split(" ").filter((term) => term.length > 1 && !STOP_WORDS.has(term));
  return files
    .map((file) => {
      const title = normalise(file.fileName);
      const corpus = normalise([file.fileName, file.category, file.subcategory, file.tags.join(" "), file.ocrText, file.visualDescription, file.sources.map((source) => [source.originalPath, source.sourceLocation, source.sourceMember].filter(Boolean).join(" ")).join(" "), file.userNotes].join(" "));
      const exactPhrase = corpus.includes(q) ? 12 : 0;
      const score = terms.reduce((total, term) => total + (title.includes(term) ? 6 : 0) + (file.tags.some((tag) => normalise(tag).includes(term)) ? 4 : 0) + (corpus.includes(term) ? 2 : 0), exactPhrase);
      return { file, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.file.fileName.localeCompare(b.file.fileName))
    .map(({ file }) => file);
}

export function askArchive(files: FileRecord[], question: string): { answer: string; citations: string[] } {
  const matches = searchFiles(files, question).filter((file) => !file.isTechnicalSidecar).slice(0, 4);
  if (!matches.length) {
    return { answer: "I couldn’t find a supporting catalogue record for that question. Try a filename, category, date, tag, or a detail you remember from the file.", citations: [] };
  }
  const duplicateQuestion = /duplicate|copies|copy/.test(normalise(question));
  const cited = matches.map((file) => file.fileName);
  if (duplicateQuestion) {
    const duplicateMatches = matches.filter((file) => file.duplicateGroupId);
    if (duplicateMatches.length) {
      return { answer: `I found ${duplicateMatches.length} catalogue records with duplicate evidence. ${duplicateMatches.map((file) => `${file.fileName} is in an ${file.isPreferredCopy ? "exact group and marked as the preferred copy" : "exact duplicate group"}`).join(" ")} This is a virtual catalogue preference only; no source files are changed.`, citations: duplicateMatches.map((file) => file.assetId) };
    }
  }
  const summary = matches.slice(0, 3).map((file) => `${file.fileName} (${file.category}${file.subcategory ? ` › ${file.subcategory}` : ""})`).join("; ");
  return { answer: `I found ${matches.length} grounded catalogue ${matches.length === 1 ? "record" : "records"}: ${summary}. The matches are ranked from stored filenames, metadata, tags, descriptions, extracted text, and your saved notes.`, citations: matches.map((file) => file.assetId) };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes > 10 * 1024 * 1024 ? 0 : 1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function getCategoryCount(files: FileRecord[], category: string): number {
  return files.filter((file) => file.category === category && !file.isTechnicalSidecar).length;
}

export function filterLibraryFiles(files: FileRecord[], category: string, showSidecars: boolean): FileRecord[] {
  return files.filter((file) => {
    const matchesSidecar = showSidecars || !file.isTechnicalSidecar;
    const matchesCategory = category === "All"
      || (category === "Duplicates" ? Boolean(file.duplicateGroupId) : category === "Needs Review" ? file.reviewState === "NEEDS_REVIEW" : file.category === category);
    return matchesSidecar && matchesCategory;
  });
}

export function applyCategory(files: FileRecord[], id: string, category: string, subcategory: string): FileRecord[] {
  return files.map((file) => file.assetId === id ? { ...file, category, subcategory, reviewState: file.reviewState === "NEEDS_REVIEW" ? "APPROVED" : file.reviewState, reviewEvidence: "Manual category selection" } : file);
}

export function applyReviewState(files: FileRecord[], id: string, reviewState: ReviewState, reviewEvidence: string): FileRecord[] {
  return files.map((file) => file.assetId === id ? { ...file, reviewState, reviewEvidence } : file);
}

export function applyPreferredCopy(files: FileRecord[], id: string, groupId: string): FileRecord[] {
  return files.map((file) => file.duplicateGroupId === groupId ? { ...file, isPreferredCopy: file.assetId === id } : file);
}

export function applyPreferredOccurrence(files: FileRecord[], assetId: string, sourceOccurrenceId: string): FileRecord[] {
  return files.map((file) => file.assetId === assetId && file.sources.some((source) => source.sourceOccurrenceId === sourceOccurrenceId) ? { ...file, preferredSourceOccurrenceId: sourceOccurrenceId } : file);
}
