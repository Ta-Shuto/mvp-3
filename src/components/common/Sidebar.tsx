"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "ダッシュボード", href: "/", icon: "grid", roles: ["ADMIN", "INTERVIEWER"] },
  { name: "通報・案件管理", href: "/cases", icon: "folder", roles: ["ADMIN", "INTERVIEWER"] },
  { name: "面談管理", href: "/interviews", icon: "mic", roles: ["ADMIN", "INTERVIEWER"] },
  { name: "テンプレート", href: "/templates", icon: "file-text", roles: ["ADMIN"] },
  { name: "ユーザー管理", href: "/users", icon: "users", roles: ["ADMIN"] },
  { name: "監査ログ", href: "/audit-logs", icon: "shield", roles: ["ADMIN"] },
  { name: "設定", href: "/settings", icon: "settings", roles: ["ADMIN"] },
  { name: "運営管理", href: "/ops", icon: "activity", roles: ["OPERATOR"] },
];

const icons: Record<string, React.ReactElement> = {
  grid: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
  folder: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>,
  mic: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path d="M19 10v2a7 7 0 01-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>,
  "file-text": <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14,2 14,8 20,8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10,9 9,9 8,9" /></svg>,
  users: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>,
  shield: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  settings: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" /></svg>,
  activity: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12" /></svg>,
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = (session?.user as Record<string, unknown>)?.role as string;

  const filteredNav = navigation.filter((item) =>
    item.roles.includes(userRole)
  );

  return (
    <div className="flex flex-col w-64 glass-sidebar min-h-screen">
      {/* Logo */}
      <div className="p-5 border-b border-white/30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-500/20">
            IS
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">Interview Support</h2>
            {session?.user && (
              <p className="text-[11px] text-muted-foreground">
                {(session.user as Record<string, unknown>).organizationName as string}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider px-3 pt-2 pb-1">
          メインメニュー
        </p>
        {filteredNav.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all",
                active
                  ? "nav-active font-medium"
                  : "text-foreground/70 hover:bg-white/40 hover:text-foreground"
              )}
            >
              <span className={active ? "text-white" : "text-muted-foreground"}>
                {icons[item.icon]}
              </span>
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/30">
        {session?.user && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold">
                {session.user.name?.[0] ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-foreground">{session.user.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{session.user.email}</p>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              ログアウト
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
