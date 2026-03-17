"use client";

import { useState, useEffect } from "react";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">設定</h1>
      <DataRetentionSettings />
      <ScriptTemplateManagement />
      <AutoEndSettings />
      <MeetingUrlSettings />
    </div>
  );
}

function DataRetentionSettings() {
  const [autoDeleteEnabled, setAutoDeleteEnabled] = useState(false);
  const [retentionMonths, setRetentionMonths] = useState(36);
  const [targetStatuses, setTargetStatuses] = useState({
    closed: true,
    resolved: false,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // TODO: Connect to tRPC endpoint
    setTimeout(() => setSaving(false), 500);
  };

  return (
    <section className="bg-card border border-border rounded-lg p-5 space-y-4">
      <h2 className="font-semibold text-lg">データ保持・自動削除設定</h2>
      <p className="text-sm text-muted-foreground">
        保持期間を過ぎた案件データを自動的に削除します。削除ログは監査用に保持されます。
      </p>

      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={() => setAutoDeleteEnabled(!autoDeleteEnabled)}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            autoDeleteEnabled ? "bg-primary" : "bg-gray-300"
          }`}
        >
          <div
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
              autoDeleteEnabled ? "translate-x-5" : ""
            }`}
          />
        </div>
        <span className="text-sm">自動削除を有効にする</span>
      </label>

      <div>
        <label className="block text-sm font-medium mb-1">保持期間（月）</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={retentionMonths}
            onChange={(e) => setRetentionMonths(Number(e.target.value))}
            disabled={!autoDeleteEnabled}
            className="w-24 px-3 py-2 border border-border rounded-lg bg-background text-sm disabled:opacity-50"
          />
          <span className="text-sm text-muted-foreground">ヶ月（{Math.floor(retentionMonths / 12)}年）</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">対象ステータス</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={targetStatuses.closed}
              onChange={(e) => setTargetStatuses((s) => ({ ...s, closed: e.target.checked }))}
              disabled={!autoDeleteEnabled}
              className="rounded"
            />
            完了（CLOSED）
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={targetStatuses.resolved}
              onChange={(e) => setTargetStatuses((s) => ({ ...s, resolved: e.target.checked }))}
              disabled={!autoDeleteEnabled}
              className="rounded"
            />
            解決済み（RESOLVED）
          </label>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          選択したステータスの案件のみ自動削除の対象になります
        </p>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "保存中..." : "ポリシーを保存"}
      </button>
    </section>
  );
}

function ScriptTemplateManagement() {
  return (
    <section className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-semibold text-lg">台本テンプレート管理</h2>
          <p className="text-sm text-muted-foreground">テンプレートのバージョン管理</p>
        </div>
        <button className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors">
          + 新規テンプレート
        </button>
      </div>

      <div className="bg-muted/50 rounded-lg p-8 text-center">
        <p className="text-muted-foreground text-sm">テンプレートがまだ作成されていません</p>
      </div>
    </section>
  );
}

function AutoEndSettings() {
  const [autoEndSettings, setAutoEndSettings] = useState({
    silenceMinutes: 10,
    endOnNoParticipants: true,
    maxDurationHours: 3,
  });

  return (
    <section className="bg-card border border-border rounded-lg p-5 space-y-4">
      <h2 className="font-semibold text-lg">自動終了条件</h2>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <label className="text-sm text-muted-foreground w-48">無音継続時間:</label>
          <input
            type="number"
            min={1}
            value={autoEndSettings.silenceMinutes}
            onChange={(e) => setAutoEndSettings((s) => ({ ...s, silenceMinutes: Number(e.target.value) }))}
            className="w-20 px-3 py-2 border border-border rounded-lg bg-background text-sm"
          />
          <span className="text-sm text-muted-foreground">分</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-muted-foreground w-48">参加者0人で終了:</label>
          <input
            type="checkbox"
            checked={autoEndSettings.endOnNoParticipants}
            onChange={(e) => setAutoEndSettings((s) => ({ ...s, endOnNoParticipants: e.target.checked }))}
            className="rounded"
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-muted-foreground w-48">最大継続時間:</label>
          <input
            type="number"
            min={1}
            value={autoEndSettings.maxDurationHours}
            onChange={(e) => setAutoEndSettings((s) => ({ ...s, maxDurationHours: Number(e.target.value) }))}
            className="w-20 px-3 py-2 border border-border rounded-lg bg-background text-sm"
          />
          <span className="text-sm text-muted-foreground">時間</span>
        </div>
      </div>
    </section>
  );
}

function MeetingUrlSettings() {
  const [meetingUrlReuseRule, setMeetingUrlReuseRule] = useState("new_case");

  return (
    <section className="bg-card border border-border rounded-lg p-5 space-y-3">
      <h2 className="font-semibold text-lg">会議URL再利用ルール</h2>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            checked={meetingUrlReuseRule === "new_case"}
            onChange={() => setMeetingUrlReuseRule("new_case")}
          />
          毎回新規案件作成
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            checked={meetingUrlReuseRule === "append"}
            onChange={() => setMeetingUrlReuseRule("append")}
          />
          既存案件に追加
        </label>
      </div>
    </section>
  );
}
