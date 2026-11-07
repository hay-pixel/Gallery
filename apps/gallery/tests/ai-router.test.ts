import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../server/routers";
import { createGallerySession } from "../server/session";

const db = vi.hoisted(() => ({
  listGoogleDriveSources: vi.fn(),
  listGoogleDriveSourceRecords: vi.fn(),
  getGoogleDriveSource: vi.fn(),
  listCatalogueAssets: vi.fn(),
  updateAssetCategory: vi.fn(),
  updateAssetReviewState: vi.fn(),
  setDuplicatePreference: vi.fn(),
}));

const aiGateway = vi.hoisted(() => ({
  health: vi.fn(),
  ask: vi.fn(),
  interpretQuery: vi.fn(),
  searchMetadata: vi.fn(),
  findVisuallySimilar: vi.fn(),
  analyzeAsset: vi.fn(),
  scanDirectory: vi.fn(),
  importExtract: vi.fn(),
}));

vi.mock("../server/db", () => ({ ...db }));
vi.mock("../server/aiGatewayClient", () => ({
  aiGatewayClient: aiGateway,
}));

const req = { headers: {}, header: () => undefined, query: {}, protocol: "http", get: () => "localhost:3000" } as any;
const res = {} as any;

describe("AI, Search, and Catalogue routers", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "session-test-secret";
    vi.clearAllMocks();
  });

  it("ai.health reports gateway availability without leaking raw host URLs", async () => {
    aiGateway.health.mockResolvedValue({
      status: "ok",
      analysis_service: true,
      search_service: true,
      ollama: { reachable: true, status: "available", host: "http://127.0.0.1:11434" },
    });

    const result = await appRouter.createCaller({ req, res, session: null }).ai.health();
    expect(result.status).toBe("ok");
    expect(result.ollama.reachable).toBe(true);
    expect("host" in result.ollama).toBe(false);
  });

  it("search.metadata returns paginated metadata matches with provenance", async () => {
    const session = createGallerySession().session;
    const validHash = "sha256:1111111111111111111111111111111111111111111111111111111111111111";
    aiGateway.searchMetadata.mockResolvedValue({
      results: [
        {
          asset_id: validHash,
          content_hash: validHash,
          retrieval_mode: "metadata",
          relationship_type: "metadata_match",
          matched_fields: [{ field: "analysis.tags", value: "car", match_type: "exact", confidence: 1.0 }],
          provenance: {
            source_occurrences: [
              {
                source_occurrence_id: "occurrence:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                source_id: "local_archive",
                original_path: "camera/IMG_001.jpg",
              },
            ],
          },
          index_id: "metadata-index:v1",
          index_version: "metadata-index-v1",
        },
      ],
      next_cursor: null,
    });

    const caller = appRouter.createCaller({ req, res, session });
    const page = await caller.search.metadata({ query: "car", limit: 10 });
    expect(page.results).toHaveLength(1);
    expect(page.results[0].asset_id).toBe(validHash);
    expect(page.next_cursor).toBeNull();
  });

  it("ai.askArchive returns grounded response when AI gateway is available", async () => {
    const session = createGallerySession().session;
    aiGateway.ask.mockResolvedValue({
      answer: "I found 2 car photos.",
      supporting_assets: [
        {
          asset_id: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
          relationship: "evidence",
          matched_metadata: ["tag:car"],
          evidence_source: "search",
          source_occurrences: [],
          confidence: 0.95,
        },
      ],
      limitations: [],
      web_context: [],
    });

    const caller = appRouter.createCaller({ req, res, session });
    const response = await caller.ai.askArchive({ question: "Show me cars" });

    expect(response.answer).toBe("I found 2 car photos.");
    expect(response.supporting_assets).toHaveLength(1);
    expect(response.supporting_assets[0].asset_id).toBe("sha256:1111111111111111111111111111111111111111111111111111111111111111");
  });

  it("ai.askArchive falls back gracefully when AI gateway is offline", async () => {
    const session = createGallerySession().session;
    aiGateway.ask.mockRejectedValue(new Error("Connection refused"));

    const caller = appRouter.createCaller({ req, res, session });
    const response = await caller.ai.askArchive({ question: "Show me cars" });

    expect(response.answer).toContain("AI reasoning service is currently unavailable");
    expect(response.limitations[0]).toContain("AI gateway is offline");
  });

  it("search.similar validates canonical SHA-256 asset ID format", async () => {
    const session = createGallerySession().session;
    const caller = appRouter.createCaller({ req, res, session });

    // Rejects non-hash
    await expect(caller.search.similar({ assetId: "not-a-hash" })).rejects.toThrow();

    // Accepts valid sha256
    const validHash = "sha256:1111111111111111111111111111111111111111111111111111111111111111";
    aiGateway.findVisuallySimilar.mockResolvedValue({ results: [] });
    const searchOutput = await caller.search.similar({ assetId: validHash });
    expect(searchOutput.results).toEqual([]);
    expect(aiGateway.findVisuallySimilar).toHaveBeenCalledWith(validHash, 20);
  });

  it("catalogue router updates review state and category", async () => {
    const session = createGallerySession().session;
    const caller = appRouter.createCaller({ req, res, session });
    const validHash = "sha256:2222222222222222222222222222222222222222222222222222222222222222";

    await caller.catalogue.applyCategory({
      assetId: validHash,
      category: "Photos",
      subcategory: "Garage",
    });
    expect(db.updateAssetCategory).toHaveBeenCalledWith(validHash, "Photos", "Garage");

    await caller.catalogue.applyReviewState({
      assetId: validHash,
      reviewState: "APPROVED",
      reviewEvidence: "Manual approval",
    });
    expect(db.updateAssetReviewState).toHaveBeenCalledWith(validHash, "APPROVED", "Manual approval");
  });

  it("catalogue router delegates importFolder and importExtract to AI gateway", async () => {
    const session = createGallerySession().session;
    const caller = appRouter.createCaller({ req, res, session });

    aiGateway.scanDirectory.mockResolvedValue({
      job_id: "scan_123",
      source_id: "local_drive",
      files_scanned: 5,
      assets_created: 4,
      duplicate_occurrences: 1,
      failed_count: 0,
      assets_count: 4,
      occurrences_count: 5,
    });

    const scanResult = await caller.catalogue.importFolder({
      path: "/home/user/Pictures",
      sourceId: "local_drive",
      recursive: true,
    });
    expect(scanResult.assets_created).toBe(4);
    expect(aiGateway.scanDirectory).toHaveBeenCalledWith("/home/user/Pictures", "local_drive", true);

    aiGateway.importExtract.mockResolvedValue({
      job_id: "extract_456",
      source_id: "extract_export",
      files_scanned: 2,
      assets_created: 2,
      duplicate_occurrences: 0,
      failed_count: 0,
      assets_count: 2,
      occurrences_count: 2,
    });

    const extractResult = await caller.catalogue.importExtract({
      path: "/home/user/Extract",
      sourceId: "extract_export",
    });
    expect(extractResult.files_scanned).toBe(2);
    expect(aiGateway.importExtract).toHaveBeenCalledWith("/home/user/Extract", "extract_export");
  });
});
