import { z } from "zod";
import { publicProcedure, router, sessionProcedure } from "./_core/trpc";
import { aiGatewayClient } from "./aiGatewayClient";
import {
  getGoogleDriveSource,
  listCatalogueAssets,
  listGoogleDriveSourceRecords,
  listGoogleDriveSources,
  setDuplicatePreference,
  updateAssetCategory,
  updateAssetReviewState,
} from "./db";
import { createDriveAuthorizationUrl, listDriveFiles } from "./googleDrive";
import { getDriveCallbackUri, isAllowedDriveReturnUri } from "./googleDriveRoutes";
import { createDriveAccessGrant, createGallerySession } from "./session";


function galleryDriveFile(ownerId: string, sourceId: number, file: Awaited<ReturnType<typeof listDriveFiles>>[number]) {
  const { thumbnailLink, ...metadata } = file;
  return { ...metadata, hasThumbnail: Boolean(thumbnailLink), mediaGrant: createDriveAccessGrant({ ownerId, sourceId, fileId: file.id, kind: "media" }), thumbnailGrant: thumbnailLink ? createDriveAccessGrant({ ownerId, sourceId, fileId: file.id, kind: "thumbnail" }) : undefined };
}

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true as const })),
  session: router({ create: publicProcedure.mutation(() => createGallerySession()) }),
  ai: router({
    health: publicProcedure.query(async () => {
      const raw = await aiGatewayClient.health();
      return {
        status: raw.status,
        analysis_service: raw.analysis_service,
        search_service: raw.search_service,
        ollama: {
          reachable: raw.ollama.reachable,
          status: raw.ollama.status,
          version: raw.ollama.version,
          latency_ms: raw.ollama.latency_ms,
        },
      };
    }),
    askArchive: sessionProcedure
      .input(z.object({ question: z.string().min(1).max(1000) }))
      .mutation(async ({ input }) => {
        try {
          return await aiGatewayClient.ask(input.question);
        } catch {
          return {
            answer: "AI reasoning service is currently unavailable. Deterministic catalogue search remains fully active.",
            supporting_assets: [],
            limitations: ["AI gateway is offline or unreachable."],
            web_context: [],
          };
        }
      }),
    interpret: sessionProcedure
      .input(z.object({ query: z.string().min(1).max(500) }))
      .query(async ({ input }) => {
        return aiGatewayClient.interpretQuery(input.query);
      }),
  }),
  search: router({
    metadata: sessionProcedure
      .input(
        z.object({
          query: z.string().max(500).default(""),
          filters: z.record(z.string(), z.unknown()).optional(),
          limit: z.number().int().min(1).max(100).default(50),
          cursor: z.string().max(200).nullable().optional(),
        }),
      )
      .query(async ({ input }) => {
        return aiGatewayClient.searchMetadata(input.query, input.filters, input.limit, input.cursor);
      }),
    similar: sessionProcedure
      .input(
        z.object({
          assetId: z.string().regex(/^sha256:[0-9a-f]{64}$/),
          limit: z.number().int().min(1).max(50).default(20),
        }),
      )
      .query(async ({ input }) => {
        return aiGatewayClient.findVisuallySimilar(input.assetId, input.limit);
      }),
  }),
  catalogue: router({
    files: sessionProcedure.query(async () => {
      return listCatalogueAssets();
    }),
    applyCategory: sessionProcedure
      .input(
        z.object({
          assetId: z.string().regex(/^sha256:[0-9a-f]{64}$/),
          category: z.string().min(1).max(64),
          subcategory: z.string().max(64).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        await updateAssetCategory(input.assetId, input.category, input.subcategory);
        return { success: true };
      }),
    applyReviewState: sessionProcedure
      .input(
        z.object({
          assetId: z.string().regex(/^sha256:[0-9a-f]{64}$/),
          reviewState: z.enum(["NEEDS_REVIEW", "APPROVED", "SKIPPED"]),
          reviewEvidence: z.string().max(500).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        await updateAssetReviewState(input.assetId, input.reviewState, input.reviewEvidence);
        return { success: true };
      }),
    setDuplicatePreference: sessionProcedure
      .input(
        z.object({
          assetId: z.string().regex(/^sha256:[0-9a-f]{64}$/),
          duplicateGroupId: z.string().min(1).max(128),
        }),
      )
      .mutation(async ({ input }) => {
        await setDuplicatePreference(input.assetId, input.duplicateGroupId);
        return { success: true };
      }),
    importFolder: sessionProcedure
      .input(
        z.object({
          path: z.string().min(1),
          sourceId: z.string().min(1).default("local_collection"),
          recursive: z.boolean().default(true),
        }),
      )
      .mutation(async ({ input }) => {
        return aiGatewayClient.scanDirectory(input.path, input.sourceId, input.recursive);
      }),
    importExtract: sessionProcedure
      .input(
        z.object({
          path: z.string().min(1),
          sourceId: z.string().min(1).default("extract_export"),
        }),
      )
      .mutation(async ({ input }) => {
        return aiGatewayClient.importExtract(input.path, input.sourceId);
      }),
  }),
  googleDrive: router({
    list: sessionProcedure.query(({ ctx }) => listGoogleDriveSources(ctx.session.ownerId)),
    beginConnect: sessionProcedure.input(z.object({ returnUri: z.string().min(1).max(2000) })).mutation(({ ctx, input }) => {
      if (!isAllowedDriveReturnUri(input.returnUri)) throw new Error("Unapproved Drive connection return URI");
      const redirectUri = getDriveCallbackUri(ctx.req);
      return { redirectUri, authorizationUrl: createDriveAuthorizationUrl({ ownerId: ctx.session.ownerId, returnUri: input.returnUri, redirectUri }) };
    }),
    files: sessionProcedure.query(async ({ ctx }) => {
      const sources = await listGoogleDriveSourceRecords(ctx.session.ownerId);
      return Promise.all(sources.map(async (source) => {
        try { return { source: { id: source.id, displayName: source.displayName, email: source.email }, status: "available" as const, files: (await listDriveFiles(source.refreshTokenEncrypted)).map((file) => galleryDriveFile(ctx.session.ownerId, source.id, file)) }; }
        catch { return { source: { id: source.id, displayName: source.displayName, email: source.email }, status: "unavailable" as const, files: [], errorCode: "authorization_or_provider_unavailable" as const }; }
      }));
    }),
    sourceFiles: sessionProcedure.input(z.object({ sourceId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const source = await getGoogleDriveSource(ctx.session.ownerId, input.sourceId);
      if (!source) throw new Error("Drive source not found");
      return (await listDriveFiles(source.refreshTokenEncrypted)).map((file) => ({ ...galleryDriveFile(ctx.session.ownerId, source.id, file), sourceId: source.id, sourceName: source.displayName }));
    }),
  }),
});
export type AppRouter = typeof appRouter;
