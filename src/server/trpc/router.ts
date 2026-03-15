import { initTRPC, TRPCError } from "@trpc/server";
import { type Context } from "./context";
import { hasPermission, type Permission } from "@/server/auth/rbac";
import type { Role } from "@/generated/prisma";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Protected procedure - requires authenticated user
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (!ctx.tenantDb) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context not available" });
  }
  return next({
    ctx: {
      session: ctx.session,
      prisma: ctx.prisma,
      tenantDb: ctx.tenantDb,
    },
  });
});

/**
 * Permission-checked procedure factory
 */
export function withPermission(permission: Permission) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    if (!hasPermission(ctx.session.user.role as Role, permission)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Permission denied: ${permission}`,
      });
    }
    return next({ ctx });
  });
}
