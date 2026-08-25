import { z } from "zod";
import { publicProcedure, router, sessionProcedure } from "./_core/trpc";
import { getGoogleDriveSource, listGoogleDriveSourceRecords, listGoogleDriveSources } from "./db";
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
