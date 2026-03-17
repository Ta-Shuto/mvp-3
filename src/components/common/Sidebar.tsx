"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "ダッシュボード", href: "/", roles: ["ADMIN", "INTERVIEWER"] },
  { name: "案件一覧", href: "/cases", roles: ["ADMIN", "INTERVIEWER"] },
  { name: "面談履歴", href: "/interviews", roles: ["ADMIN", "INTERVIEWER"] },
  { name: "ユーザー管理", href: "/users", roles: ["ADMIN"] },
  { name: "テンプレ設定", href: "/templates", roles: ["ADMIN"] },
  { name: "法人設定", href: "/settings", roles: ["ADMIN"] },
  { name: "監査ログ", href: "/audit-logs", roles: ["ADMIN"] },
  { name: "運営管理", href: "/ops", roles: ["OPERATOR"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = (session?.user as Record<string, unknown>)?.role as string;

  const filteredNav = navigation.filter((item) =>
    item.roles.includes(userRole)
  );

  return (
    <div className="flex flex-col w-64 bg-card border-r border-border min-h-screen">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-bold text-foreground">面談支援</h2>
        {session?.user && (
          <p className="text-sm text-muted-foreground mt-1">
            {(session.user as Record<string, unknown>).organizationName as string}
          </p>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {filteredNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "block px-3 py-2 rounded-md text-sm transition-colors",
              pathname === item.href
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-accent"
            )}
          >
            {item.name}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        {session?.user && (
          <div className="space-y-2">
            <p className="text-sm text-foreground">{session.user.name}</p>
            <p className="text-xs text-muted-foreground">{session.user.email}</p>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-sm text-destructive hover:underline"
            >
              ログアウト
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
