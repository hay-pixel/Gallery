/**
 * Private AI Service Gateway client for Node.js / tRPC backend.
 *
 * Connects strictly to localhost (127.0.0.1:8000).
 * Never exposes raw internal ports or model keys to browser/mobile clients.
 */

const DEFAULT_AI_GATEWAY_URL = process.env.AI_GATEWAY_URL || "http://127.0.0.1:8000";

export interface AIHealthResponse {
  status: "ok" | "unavailable";
  analysis_service: boolean;
  search_service: boolean;
  ollama: {
    reachable: boolean;
    status: "available" | "unavailable" | "degraded";
    host?: string;
    version?: string;
    latency_ms?: number;
    error_message?: string;
  };
}

export interface GroundedCitation {
  asset_id: string;
  relationship: string;
  matched_metadata: string[];
  analysis_id?: string;
  analysis_result_id?: string;
  evidence_source: string;
  source_occurrences: {
    source_occurrence_id: string;
    source_id: string;
    original_path: string;
  }[];
  confidence: number;
}

export interface AskAIResponse {
  answer: string;
  supporting_assets: GroundedCitation[];
  limitations: string[];
  web_context: {
    source: "web";
    url: string;
    used_for: string;
    local_asset_truth: boolean;
  }[];
}

export interface VisuallySimilarResult {
  asset_id: string;
  score: number;
  relationship: string;
  analysis_id?: string;
  analysis_result_id?: string;
}

export interface MetadataSearchPage {
  results: {
    asset_id: string;
    content_hash: string;
    retrieval_mode: "metadata";
    relationship_type: "metadata_match";
    matched_fields: {
      field: string;
      value: string;
      match_type: "exact" | "substring" | "range";
      confidence: number;
    }[];
    provenance: {
      source_occurrences: {
        source_occurrence_id: string;
        source_id: string;
        original_path: string;
        source_kind?: string;
        source_location?: string;
      }[];
    };
    analysis_id?: string;
    analysis_result_id?: string;
    index_id: string;
    index_version: string;
  }[];
  next_cursor: string | null;
}

export interface AnalysisOutcomeResponse {
  status: "ready" | "partial" | "unsupported" | "failed" | "stale";
  analysis_id: string;
  result_id: string;
  tags: { label: string; confidence?: number; source: string }[];
  categories: { label: string; confidence?: number; source: string }[];
  summary: string;
  visual_features_count: number;
}

export interface IngestSummaryResponse {
  job_id: string;
  source_id: string;
  files_scanned: number;
  assets_created: number;
  duplicate_occurrences: number;
  failed_count: number;
  assets_count: number;
  occurrences_count: number;
}

export class AIGatewayClient {
  private baseUrl: string;

  constructor(baseUrl: string = DEFAULT_AI_GATEWAY_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI Gateway ${response.status}: ${errorText}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  async health(): Promise<AIHealthResponse> {
    try {
      return await this.request<AIHealthResponse>("/health");
    } catch (error) {
      return {
        status: "unavailable",
        analysis_service: false,
        search_service: false,
        ollama: {
          reachable: false,
          status: "unavailable",
          error_message: String(error),
        },
      };
    }
  }

  async ask(question: string, context?: Record<string, unknown>): Promise<AskAIResponse> {
    return this.request<AskAIResponse>("/ai/ask", {
      method: "POST",
      body: JSON.stringify({ question, context }),
    });
  }

  async interpretQuery(query: string, context?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("/ai/interpret", {
      method: "POST",
      body: JSON.stringify({ query, context }),
    });
  }

  async findVisuallySimilar(assetId: string, limit: number = 20): Promise<{ results: VisuallySimilarResult[] }> {
    return this.request<{ results: VisuallySimilarResult[] }>("/search/similar", {
      method: "POST",
      body: JSON.stringify({ asset_id: assetId, limit }),
    });
  }

  async searchMetadata(
    query: string = "",
    filters?: Record<string, unknown>,
    limit: number = 50,
    cursor?: string | null,
  ): Promise<MetadataSearchPage> {
    return this.request<MetadataSearchPage>("/search/metadata", {
      method: "POST",
      body: JSON.stringify({ query, filters, limit, cursor }),
    });
  }

  async analyzeAsset(assetId: string, storageLocator: string, mimeType?: string): Promise<AnalysisOutcomeResponse> {
    return this.request<AnalysisOutcomeResponse>("/analysis/analyze", {
      method: "POST",
      body: JSON.stringify({ asset_id: assetId, storage_locator: storageLocator, mime_type: mimeType }),
    });
  }

  async scanDirectory(directoryPath: string, sourceId: string = "local_folder", recursive: boolean = true): Promise<IngestSummaryResponse> {
    return this.request<IngestSummaryResponse>("/ingest/scan", {
      method: "POST",
      body: JSON.stringify({ path: directoryPath, source_id: sourceId, recursive }),
    });
  }

  async importExtract(exportPath: string, sourceId: string = "extract_export"): Promise<IngestSummaryResponse> {
    return this.request<IngestSummaryResponse>("/ingest/import-extract", {
      method: "POST",
      body: JSON.stringify({ path: exportPath, source_id: sourceId }),
    });
  }
}

export const aiGatewayClient = new AIGatewayClient();
