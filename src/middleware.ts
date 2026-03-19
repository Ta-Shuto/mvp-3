export { auth as middleware } from "@/server/auth/config";

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /login
     * - /api/auth (NextAuth routes)
     * - /api/health (health check)
     * - /_next (Next.js internals)
     * - /favicon.ico, /robots.txt, static files
     */
    "/((?!login|api/auth|api/health|_next|favicon\\.ico|robots\\.txt|.*\\.).*)",
  ],
};
