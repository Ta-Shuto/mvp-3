"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("メールアドレスまたはパスワードが正しくありません");
      setLoading(false);
    } else {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center glass-bg">
      <div className="w-full max-w-md p-8 space-y-6 bg-card border border-border rounded-2xl shadow-xl">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-500/20">
              IS
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground">面談支援プラットフォーム</h1>
          <p className="text-muted-foreground mt-2">ログイン</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" className="p-3 text-base text-destructive bg-destructive/10 rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-base font-medium text-foreground mb-1">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 border border-white/50 rounded-xl bg-white/30 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-base font-medium text-foreground mb-1">
              パスワード
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 border border-white/50 rounded-xl bg-white/30 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 btn-glass-primary rounded-xl font-medium disabled:opacity-50 transition-all"
          >
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        {/* SSO Login buttons - shown when SSO providers are configured */}
        <div className="space-y-3">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/30" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-card text-muted-foreground">または</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => signIn("oidc", { callbackUrl: "/" })}
            className="w-full py-2.5 px-4 border border-white/50 rounded-xl font-medium text-foreground hover:bg-white/10 transition-all"
          >
            SSO (OIDC) でログイン
          </button>
          <button
            type="button"
            onClick={() => signIn("saml", { callbackUrl: "/" })}
            className="w-full py-2.5 px-4 border border-white/50 rounded-xl font-medium text-foreground hover:bg-white/10 transition-all"
          >
            SSO (SAML) でログイン
          </button>
        </div>
      </div>
    </div>
  );
}
