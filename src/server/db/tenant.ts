import prisma from "./client";

/**
 * Creates a tenant-scoped query helper.
 * All queries through this helper automatically filter by organizationId.
 */
export function getTenantDb(organizationId: string) {
  return {
    case: {
      findMany: (args?: any) =>
        prisma.case.findMany({
          ...args,
          where: { ...args?.where, organizationId },
        }),
      findFirst: (args?: any) =>
        prisma.case.findFirst({
          ...args,
          where: { ...args?.where, organizationId },
        }),
      create: (args: any) =>
        prisma.case.create({
          ...args,
          data: { ...args.data, organizationId },
        }),
      count: (args?: any) =>
        prisma.case.count({
          ...args,
          where: { ...args?.where, organizationId },
        }),
    },
    user: {
      findMany: (args?: any) =>
        prisma.user.findMany({
          ...args,
          where: { ...args?.where, organizationId },
        }),
      findFirst: (args?: any) =>
        prisma.user.findFirst({
          ...args,
          where: { ...args?.where, organizationId },
        }),
    },
    template: {
      findFirst: (args?: any) =>
        prisma.template.findFirst({
          ...args,
          where: { ...args?.where, organizationId },
        }),
      findMany: (args?: any) =>
        prisma.template.findMany({
          ...args,
          where: { ...args?.where, organizationId },
        }),
    },
    auditLog: {
      findMany: (args?: any) =>
        prisma.auditLog.findMany({
          ...args,
          where: { ...args?.where, organizationId },
        }),
      create: (args: any) =>
        prisma.auditLog.create({
          ...args,
          data: { ...args.data, organizationId },
        }),
    },
    organization: {
      findUnique: () =>
        prisma.organization.findUnique({ where: { id: organizationId } }),
      update: (args: any) =>
        prisma.organization.update({
          ...args,
          where: { id: organizationId },
        }),
    },
  };
}

export type TenantDb = ReturnType<typeof getTenantDb>;
