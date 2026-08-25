import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
const t = initTRPC.context<TrpcContext>().create({ transformer: superjson });
export const router = t.router;
export const publicProcedure = t.procedure;
export const sessionProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED", message: "A valid Gallery session is required" });
  return next({ ctx: { ...ctx, session: ctx.session } });
});
