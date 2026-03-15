import { Role } from "@/generated/prisma";

type Permission =
  | "case:read"
  | "case:create"
  | "case:update"
  | "case:close"
  | "case:assign"
  | "case:read_all"
  | "pre_chat:read"
  | "pre_chat:manage"
  | "meeting:manage"
  | "template:read"
  | "template:update"
  | "audit_log:read"
  | "settings:read"
  | "settings:update"
  | "user:manage"
  | "ops:read";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    "case:read",
    "case:create",
    "case:update",
    "case:close",
    "case:assign",
    "case:read_all",
    "pre_chat:read",
    "pre_chat:manage",
    "meeting:manage",
    "template:read",
    "template:update",
    "audit_log:read",
    "settings:read",
    "settings:update",
    "user:manage",
  ],
  INTERVIEWER: [
    "case:read",
    "case:create",
    "case:update",
    "pre_chat:read",
    "meeting:manage",
    "template:read",
  ],
  INTERVIEWEE: [],
  OPERATOR: ["ops:read"],
  SYSTEM: [
    "case:update",
    "meeting:manage",
    "pre_chat:manage",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function requirePermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Permission denied: ${permission} for role ${role}`);
  }
}

export { type Permission };
