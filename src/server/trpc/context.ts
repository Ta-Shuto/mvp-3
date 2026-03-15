import { auth } from "@/server/auth/config";
import { getTenantDb } from "@/server/db/tenant";
import prisma from "@/server/db/client";
import type { Role } from "@/generated/prisma";

export async function createContext() {
  const session = await auth();

  if (!session?.user) {
    return {
      session: null,
      prisma,
      tenantDb: null,
    };
  }

  const tenantDb = getTenantDb(session.user.organizationId);

  return {
    session: {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role as Role,
        organizationId: session.user.organizationId,
        caseViewScope: session.user.caseViewScope,
      },
    },
    prisma,
    tenantDb,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
