"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard Error]", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full p-8 bg-card border border-border rounded-2xl shadow-lg text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
          <svg className="w-7 h-7 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">エラーが発生しました</h2>
        <p className="text-sm text-muted-foreground mb-6">
          ページの読み込み中に問題が発生しました。再試行するか、問題が続く場合は管理者にお問い合わせください。
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 btn-glass-primary rounded-xl text-sm font-medium"
          >
            再試行
          </button>
          <button
            onClick={() => window.location.href = "/"}
            className="px-5 py-2.5 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-white/10"
          >
            ダッシュボードに戻る
          </button>
        </div>
      </div>
    </div>
  );
}
