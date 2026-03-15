"use client";

import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">法人設定</h1>
      <OrganizationSettings />
      <UserManagement />
    </div>
  );
}

function OrganizationSettings() {
  const [retentionDays, setRetentionDays] = useState(365);
  const [meetingUrlReuseRule, setMeetingUrlReuseRule] = useState("new_case");
  const [autoEndSettings, setAutoEndSettings] = useState({
    silenceMinutes: 10,
    endOnNoParticipants: true,
    maxDurationHours: 3,
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // We'll use a simple fetch since tenantDb.organization isn't exposed via tRPC yet
  // For now, show the form with defaults

  useEffect(() => { setLoaded(true); }, []);

  const handleSave = async () => {
    setSaving(true);
    // TODO: Connect to tRPC endpoint for org settings update
    setTimeout(() => setSaving(false), 500);
  };

  if (!loaded) return <p className="text-muted-foreground">読み込み中...</p>;

  return (
    <div className="space-y-6">
      {/* FR-057: 保存期間設定 */}
      <section className="bg-card border border-border rounded-lg p-4">
        <h2 className="font-semibold mb-3">保存期間設定</h2>
        <div className="flex items-center gap-3">
          <label className="text-sm text-muted-foreground">音声/文字起こし/事前チャットの保存期間:</label>
          <input
            type="number"
            min={1}
            value={retentionDays}
            onChange={(e) => setRetentionDays(Number(e.target.value))}
            className="w-24 px-3 py-2 border border-input rounded-md bg-background text-sm"
          />
          <span className="text-sm">日</span>
        </div>
      </section>

      {/* FR-083: 会議URL再利用ルール */}
      <section className="bg-card border border-border rounded-lg p-4">
        <h2 className="font-semibold mb-3">会議URL再利用ルール</h2>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={meetingUrlReuseRule === "new_case"}
              onChange={() => setMeetingUrlReuseRule("new_case")}
            />
            毎回新規案件作成
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={meetingUrlReuseRule === "append"}
              onChange={() => setMeetingUrlReuseRule("append")}
            />
            既存案件に追加
          </label>
        </div>
      </section>

      {/* FR-084: 自動終了条件 */}
      <section className="bg-card border border-border rounded-lg p-4">
        <h2 className="font-semibold mb-3">自動終了条件</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted-foreground w-48">無音継続時間:</label>
            <input
              type="number"
              min={1}
              value={autoEndSettings.silenceMinutes}
              onChange={(e) => setAutoEndSettings((s) => ({ ...s, silenceMinutes: Number(e.target.value) }))}
              className="w-20 px-3 py-2 border border-input rounded-md bg-background text-sm"
            />
            <span className="text-sm">分</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted-foreground w-48">参加者0人で終了:</label>
            <input
              type="checkbox"
              checked={autoEndSettings.endOnNoParticipants}
              onChange={(e) => setAutoEndSettings((s) => ({ ...s, endOnNoParticipants: e.target.checked }))}
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted-foreground w-48">最大継続時間:</label>
            <input
              type="number"
              min={1}
              value={autoEndSettings.maxDurationHours}
              onChange={(e) => setAutoEndSettings((s) => ({ ...s, maxDurationHours: Number(e.target.value) }))}
              className="w-20 px-3 py-2 border border-input rounded-md bg-background text-sm"
            />
            <span className="text-sm">時間</span>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "保存中..." : "設定を保存"}
        </button>
      </div>
    </div>
  );
}

function UserManagement() {
  // FR-113: 案件閲覧範囲の付与
  return (
    <section className="bg-card border border-border rounded-lg p-4">
      <h2 className="font-semibold mb-3">ユーザー・権限管理</h2>
      <p className="text-sm text-muted-foreground mb-4">
        法人内ユーザーの案件閲覧範囲を設定します。
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="text-left p-3">名前</th>
            <th className="text-left p-3">メール</th>
            <th className="text-left p-3">ロール</th>
            <th className="text-left p-3">閲覧範囲</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={4} className="p-4 text-center text-muted-foreground">
              ユーザー一覧はtRPCエンドポイント接続後に表示されます
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
