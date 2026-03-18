"use client";

import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">設定</h1>
      <DataRetentionSettings />
      <AutoEndSettings />
      <MeetingUrlSettings />
      <ScriptTemplateManagement />
    </div>
  );
}

function DataRetentionSettings() {
  const settings = trpc.orgSettings.get.useQuery();
  const updateSettings = trpc.orgSettings.update.useMutation({
    onSuccess: () => settings.refetch(),
  });

  const [autoDeleteEnabled, setAutoDeleteEnabled] = useState(false);
  const [retentionMonths, setRetentionMonths] = useState(36);
  const [targetStatuses, setTargetStatuses] = useState({
    closed: true,
    resolved: false,
  });

  useEffect(() => {
    if (settings.data) {
      setRetentionMonths(Math.round((settings.data.retentionDays ?? 365) / 30));
    }
  }, [settings.data]);

  const handleSave = () => {
    updateSettings.mutate({
      retentionDays: retentionMonths * 30,
      autoDeleteEnabled,
      autoDeleteRetentionMonths: retentionMonths,
      autoDeleteTargetStatuses: [
        ...(targetStatuses.closed ? ["CLOSED"] : []),
        ...(targetStatuses.resolved ? ["COMPLETED"] : []),
      ],
    });
  };

  return (
    <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <h2 className="font-semibold text-xl">データ保持・自動削除設定</h2>
      <p className="text-base text-muted-foreground">
        保持期間を過ぎた案件データを自動的に削除します。削除ログは監査用に保持されます。
      </p>

      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={() => setAutoDeleteEnabled(!autoDeleteEnabled)}
          className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
            autoDeleteEnabled ? "bg-indigo-500" : "bg-white/40"
          }`}
        >
          <div
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
              autoDeleteEnabled ? "translate-x-5" : ""
            }`}
          />
        </div>
        <span className="text-base">自動削除を有効にする</span>
      </label>

      <div>
        <label className="block text-base font-medium mb-1">保持期間（月）</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={retentionMonths}
            onChange={(e) => setRetentionMonths(Number(e.target.value))}
            disabled={!autoDeleteEnabled}
            className="w-24 px-3 py-2 border border-white/50 rounded-xl bg-white/30 text-base disabled:opacity-50"
          />
          <span className="text-base text-muted-foreground">ヶ月（{Math.floor(retentionMonths / 12)}年）</span>
        </div>
      </div>

      <div>
        <label className="block text-base font-medium mb-2">対象ステータス</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-base cursor-pointer">
            <input
              type="checkbox"
              checked={targetStatuses.closed}
              onChange={(e) => setTargetStatuses((s) => ({ ...s, closed: e.target.checked }))}
              disabled={!autoDeleteEnabled}
              className="rounded"
            />
            完了（CLOSED）
          </label>
          <label className="flex items-center gap-2 text-base cursor-pointer">
            <input
              type="checkbox"
              checked={targetStatuses.resolved}
              onChange={(e) => setTargetStatuses((s) => ({ ...s, resolved: e.target.checked }))}
              disabled={!autoDeleteEnabled}
              className="rounded"
            />
            解決済み（COMPLETED）
          </label>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={updateSettings.isPending}
        className="px-4 py-2 btn-glass-primary rounded-xl text-base font-medium hover:opacity-90 disabled:opacity-50"
      >
        {updateSettings.isPending ? "保存中..." : "ポリシーを保存"}
      </button>
      {updateSettings.isSuccess && (
        <span className="text-base text-green-600 ml-3">保存しました</span>
      )}
    </section>
  );
}

function AutoEndSettings() {
  const settings = trpc.orgSettings.get.useQuery();
  const updateSettings = trpc.orgSettings.update.useMutation({
    onSuccess: () => settings.refetch(),
  });

  const [autoEndSettings, setAutoEndSettings] = useState({
    silenceMinutes: 10,
    endOnNoParticipants: true,
    maxDurationHours: 3,
  });

  useEffect(() => {
    const d = settings.data as any;
    if (d?.autoEndSettings) {
      const s = d.autoEndSettings as any;
      setAutoEndSettings({
        silenceMinutes: s.silenceMinutes ?? 10,
        endOnNoParticipants: s.endOnNoParticipants ?? true,
        maxDurationHours: s.maxDurationHours ?? 3,
      });
    }
  }, [settings.data]);

  const handleSave = () => {
    updateSettings.mutate({ autoEndSettings });
  };

  return (
    <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <h2 className="font-semibold text-xl">自動終了条件</h2>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <label className="text-base text-muted-foreground w-48">無音継続時間:</label>
          <input
            type="number"
            min={1}
            value={autoEndSettings.silenceMinutes}
            onChange={(e) => setAutoEndSettings((s) => ({ ...s, silenceMinutes: Number(e.target.value) }))}
            className="w-20 px-3 py-2 border border-white/50 rounded-xl bg-white/30 text-base"
          />
          <span className="text-base text-muted-foreground">分</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-base text-muted-foreground w-48">参加者0人で終了:</label>
          <input
            type="checkbox"
            checked={autoEndSettings.endOnNoParticipants}
            onChange={(e) => setAutoEndSettings((s) => ({ ...s, endOnNoParticipants: e.target.checked }))}
            className="rounded"
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-base text-muted-foreground w-48">最大継続時間:</label>
          <input
            type="number"
            min={1}
            value={autoEndSettings.maxDurationHours}
            onChange={(e) => setAutoEndSettings((s) => ({ ...s, maxDurationHours: Number(e.target.value) }))}
            className="w-20 px-3 py-2 border border-white/50 rounded-xl bg-white/30 text-base"
          />
          <span className="text-base text-muted-foreground">時間</span>
        </div>
      </div>
      <button
        onClick={handleSave}
        disabled={updateSettings.isPending}
        className="px-4 py-2 btn-glass-primary rounded-xl text-base font-medium hover:opacity-90 disabled:opacity-50"
      >
        {updateSettings.isPending ? "保存中..." : "保存"}
      </button>
    </section>
  );
}

function MeetingUrlSettings() {
  const settings = trpc.orgSettings.get.useQuery();
  const updateSettings = trpc.orgSettings.update.useMutation({
    onSuccess: () => settings.refetch(),
  });

  const [rule, setRule] = useState("new_case");

  useEffect(() => {
    if (settings.data?.meetingUrlReuseRule) {
      setRule(settings.data.meetingUrlReuseRule);
    }
  }, [settings.data]);

  const handleSave = () => {
    updateSettings.mutate({ meetingUrlReuseRule: rule as any });
  };

  return (
    <section className="bg-card border border-border rounded-2xl p-5 space-y-3">
      <h2 className="font-semibold text-xl">会議URL再利用ルール</h2>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-base cursor-pointer">
          <input
            type="radio"
            checked={rule === "new_case"}
            onChange={() => setRule("new_case")}
          />
          毎回新規案件作成
        </label>
        <label className="flex items-center gap-2 text-base cursor-pointer">
          <input
            type="radio"
            checked={rule === "append"}
            onChange={() => setRule("append")}
          />
          既存案件に追加
        </label>
      </div>
      <button
        onClick={handleSave}
        disabled={updateSettings.isPending}
        className="px-4 py-2 btn-glass-primary rounded-xl text-base font-medium hover:opacity-90 disabled:opacity-50"
      >
        {updateSettings.isPending ? "保存中..." : "保存"}
      </button>
    </section>
  );
}

function ScriptTemplateManagement() {
  return (
    <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-semibold text-xl">台本テンプレート管理</h2>
          <p className="text-base text-muted-foreground">テンプレートのバージョン管理</p>
        </div>
        <button className="px-4 py-2 border border-border rounded-lg text-base font-medium hover:bg-white/40 transition-colors">
          + 新規テンプレート
        </button>
      </div>

      <div className="bg-white/20 rounded-lg p-8 text-center">
        <p className="text-muted-foreground text-base">テンプレートがまだ作成されていません</p>
      </div>
    </section>
  );
}
