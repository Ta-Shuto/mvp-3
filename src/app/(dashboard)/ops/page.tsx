"use client";

// FR-076: 運営管理（遅延一覧）
export default function OpsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">運営管理</h1>

      <section className="bg-card border border-border rounded-lg p-4">
        <h2 className="font-semibold mb-3">遅延一覧</h2>
        <p className="text-sm text-muted-foreground mb-4">
          発言からリスク表示が5秒超の回数を案件単位で記録し一覧表示します。
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-3">案件ID</th>
              <th className="text-left p-3">案件名</th>
              <th className="text-left p-3">遅延回数</th>
              <th className="text-left p-3">最終遅延</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={4} className="p-4 text-center text-muted-foreground">
                リアルタイム面談支援の実装後にデータが表示されます
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
