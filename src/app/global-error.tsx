"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ja">
      <body className="antialiased">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f3f4f6" }}>
          <div style={{ maxWidth: 400, padding: 32, background: "white", borderRadius: 16, textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.1)" }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>システムエラー</h2>
            <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 24 }}>
              予期しないエラーが発生しました。
            </p>
            <button
              onClick={reset}
              style={{ padding: "10px 24px", background: "#4f46e5", color: "white", border: "none", borderRadius: 12, cursor: "pointer", fontSize: 14 }}
            >
              再試行
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
