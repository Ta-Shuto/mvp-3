import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/server/db/client";

/**
 * Build SSO providers dynamically based on environment variables.
 * Supports SAML (via boxyhq/saml-jackson) and OIDC (generic OpenID Connect).
 */
function buildSSOProviders() {
  const providers: any[] = [];

  // OIDC provider (Azure AD, Okta, Google Workspace, etc.)
  if (process.env.SSO_OIDC_CLIENT_ID && process.env.SSO_OIDC_ISSUER) {
    // Dynamic import not possible at top level for NextAuth config,
    // so we use a generic OIDC config approach
    providers.push({
      id: "oidc",
      name: process.env.SSO_OIDC_PROVIDER_NAME || "SSO (OIDC)",
      type: "oidc",
      issuer: process.env.SSO_OIDC_ISSUER,
      clientId: process.env.SSO_OIDC_CLIENT_ID,
      clientSecret: process.env.SSO_OIDC_CLIENT_SECRET || "",
      profile(profile: any) {
        return {
          id: profile.sub,
          name: profile.name || profile.preferred_username,
          email: profile.email,
        };
      },
    });
  }

  // SAML provider (via BoxyHQ SAML Jackson or similar)
  if (process.env.SSO_SAML_ISSUER && process.env.SSO_SAML_CLIENT_ID) {
    providers.push({
      id: "saml",
      name: process.env.SSO_SAML_PROVIDER_NAME || "SSO (SAML)",
      type: "oauth",
      issuer: process.env.SSO_SAML_ISSUER,
      clientId: process.env.SSO_SAML_CLIENT_ID,
      clientSecret: process.env.SSO_SAML_CLIENT_SECRET || "dummy",
      authorization: { params: { scope: "openid" } },
      token: `${process.env.SSO_SAML_ISSUER}/api/oauth/token`,
      userinfo: `${process.env.SSO_SAML_ISSUER}/api/oauth/userinfo`,
      profile(profile: any) {
        return {
          id: profile.id || profile.sub,
          name: profile.name || profile.firstName,
          email: profile.email,
        };
      },
    });
  }

  return providers;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { organization: true },
        });

        if (!user || !user.passwordHash) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
          organizationName: user.organization.name,
          caseViewScope: user.caseViewScope,
        };
      },
    }),
    ...buildSSOProviders(),
  ],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = request.nextUrl.pathname.startsWith("/login");
      if (isOnLogin) return true;
      return isLoggedIn;
    },
    async signIn({ user, account }) {
      // For SSO (OIDC/SAML) logins, ensure user exists in our system
      if (account?.provider === "oidc" || account?.provider === "saml") {
        const email = user.email;
        if (!email) return false;

        const existingUser = await prisma.user.findUnique({
          where: { email },
        });

        if (!existingUser) {
          // User must be pre-provisioned by admin
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        // For SSO logins, load user data from our DB
        if (account?.provider === "oidc" || account?.provider === "saml") {
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email! },
            include: { organization: true },
          });
          if (dbUser) {
            token.id = dbUser.id;
            token.role = dbUser.role;
            token.organizationId = dbUser.organizationId;
            token.organizationName = dbUser.organization.name;
            token.caseViewScope = dbUser.caseViewScope;
            return token;
          }
        }

        // Credentials login
        const u = user as unknown as Record<string, unknown>;
        token.id = user.id;
        token.role = u.role;
        token.organizationId = u.organizationId;
        token.organizationName = u.organizationName;
        token.caseViewScope = u.caseViewScope;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const su = session.user as unknown as Record<string, unknown>;
        su.id = token.id;
        su.role = token.role;
        su.organizationId = token.organizationId;
        su.organizationName = token.organizationName;
        su.caseViewScope = token.caseViewScope;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
