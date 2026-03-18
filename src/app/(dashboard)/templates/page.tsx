"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";

const useCaseLabels: Record<string, string> = {
  VOLUNTARY_RETIREMENT: "希望退職",
  AUDIT: "監査室",
};

const toneLabels: Record<string, string> = {
  POLITE: "丁寧",
  NEUTRAL: "中立",
  STRONG: "強め",
};

type PreQuestion = { text: string; order: number; isActive: boolean };

export default function TemplatesPage() {
  const [selectedUseCase, setSelectedUseCase] = useState<"VOLUNTARY_RETIREMENT" | "AUDIT">("VOLUNTARY_RETIREMENT");
  const templates = trpc.template.list.useQuery();
  const templateDetail = trpc.template.getByUseCase.useQuery({ useCase: selectedUseCase });
  const versions = trpc.template.getVersions.useQuery({ useCase: selectedUseCase });
  const utils = trpc.useUtils();

  const updateTemplate = trpc.template.update.useMutation({
    onSuccess: () => {
      utils.template.getByUseCase.invalidate({ useCase: selectedUseCase });
      utils.template.getVersions.invalidate({ useCase: selectedUseCase });
      utils.template.list.invalidate();
    },
  });

  const restoreVersion = trpc.template.restore.useMutation({
    onSuccess: () => {
      utils.template.getByUseCase.invalidate({ useCase: selectedUseCase });
      utils.template.getVersions.invalidate({ useCase: selectedUseCase });
    },
  });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    preQuestions: [] as PreQuestion[],
    aiChatPrompt: "",
    summaryPrompt: "",
    scriptPrompt: "",
    riskDetectionPrompt: "",
    rephrasingPrompt: "",
    defaultTone: "POLITE" as "POLITE" | "NEUTRAL" | "STRONG",
  });

  const startEditing = () => {
    if (!templateDetail.data) return;
    const t = templateDetail.data as any;
    let preQuestions: PreQuestion[] = [];
    try {
      preQuestions = typeof t.preQuestions === "string"
        ? JSON.parse(t.preQuestions)
        : t.preQuestions;
    } catch { preQuestions = []; }

    setForm({
      preQuestions,
      aiChatPrompt: t.aiChatPrompt ?? "",
      summaryPrompt: t.summaryPrompt ?? "",
      scriptPrompt: t.scriptPrompt ?? "",
      riskDetectionPrompt: t.riskDetectionPrompt ?? "",
      rephrasingPrompt: t.rephrasingPrompt ?? "",
      defaultTone: t.defaultTone ?? "POLITE",
    });
    setEditing(true);
  };

  const handleSave = () => {
    updateTemplate.mutate({
      useCase: selectedUseCase,
      preQuestions: form.preQuestions,
      aiChatPrompt: form.aiChatPrompt,
      summaryPrompt: form.summaryPrompt,
      scriptPrompt: form.scriptPrompt,
      riskDetectionPrompt: form.riskDetectionPrompt,
      rephrasingPrompt: form.rephrasingPrompt,
      defaultTone: form.defaultTone,
    });
    setEditing(false);
  };

  const addQuestion = () => {
    setForm((f) => ({
      ...f,
      preQuestions: [...f.preQuestions, { text: "", order: f.preQuestions.length + 1, isActive: true }],
    }));
  };

  const updateQuestion = (index: number, field: keyof PreQuestion, value: string | number | boolean) => {
    setForm((f) => ({
      ...f,
      preQuestions: f.preQuestions.map((q, i) => (i === index ? { ...q, [field]: value } : q)),
    }));
  };

  const removeQuestion = (index: number) => {
    setForm((f) => ({
      ...f,
      preQuestions: f.preQuestions.filter((_, i) => i !== index).map((q, i) => ({ ...q, order: i + 1 })),
    }));
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= form.preQuestions.length) return;
    setForm((f) => {
      const questions = [...f.preQuestions];
      [questions[index], questions[newIndex]] = [questions[newIndex], questions[index]];
      return { ...f, preQuestions: questions.map((q, i) => ({ ...q, order: i + 1 })) };
    });
  };

  const t = templateDetail.data as any;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">テンプレ設定</h1>
        <div className="flex gap-2">
          {(["VOLUNTARY_RETIREMENT", "AUDIT"] as const).map((uc) => (
            <button
              key={uc}
              onClick={() => { setSelectedUseCase(uc); setEditing(false); }}
              className={`px-4 py-2 text-base rounded-xl ${
                selectedUseCase === uc ? "btn-glass-primary" : "bg-white/30 hover:bg-white/50"
              }`}
            >
              {useCaseLabels[uc]}
            </button>
          ))}
        </div>
      </div>

      {templateDetail.isLoading && <p className="text-muted-foreground">読み込み中...</p>}

      {t && !editing && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button onClick={startEditing} className="px-4 py-2 text-base btn-glass-primary rounded-xl hover:opacity-90">
              編集
            </button>
          </div>

          {/* 更新者・更新日時 (FR-071) */}
          <div className="text-base text-muted-foreground">
            更新者: {t.updatedBy?.name ?? "—"} | 更新日時: {new Date(t.updatedAt).toLocaleString("ja-JP")}
          </div>

          {/* 事前質問一覧 (FR-060, FR-061) */}
          <section className="bg-card border border-border rounded-2xl p-4">
            <h2 className="font-semibold mb-3">事前質問</h2>
            {(() => {
              let questions: PreQuestion[] = [];
              try { questions = typeof t.preQuestions === "string" ? JSON.parse(t.preQuestions) : t.preQuestions; } catch { /* empty */ }
              return questions.length > 0 ? (
                <div className="space-y-2">
                  {questions.map((q: PreQuestion, i: number) => (
                    <div key={i} className={`flex items-center gap-3 p-2 rounded ${q.isActive ? "" : "opacity-50"}`}>
                      <span className="text-sm text-muted-foreground w-6">{q.order}.</span>
                      <span className="flex-1 text-base">{q.text}</span>
                      <span className={`text-sm px-2 py-0.5 rounded ${q.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                        {q.isActive ? "有効" : "無効"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-base text-muted-foreground">質問がありません</p>;
            })()}
          </section>

          {/* プロンプト設定 (FR-064~068) */}
          {[
            { label: "AIチャット用プロンプト", value: t.aiChatPrompt },
            { label: "要約用プロンプト", value: t.summaryPrompt },
            { label: "台本用プロンプト", value: t.scriptPrompt },
            { label: "リスク検知プロンプト", value: t.riskDetectionPrompt },
            { label: "言い換え用プロンプト", value: t.rephrasingPrompt },
          ].map(({ label, value }) => (
            <section key={label} className="bg-card border border-border rounded-2xl p-4">
              <h2 className="font-semibold mb-2">{label}</h2>
              <p className="text-base whitespace-pre-wrap">{value || "（未設定）"}</p>
            </section>
          ))}

          {/* デフォルトトーン (FR-069) */}
          <section className="bg-card border border-border rounded-2xl p-4">
            <h2 className="font-semibold mb-2">デフォルトトーン</h2>
            <span className="text-base">{toneLabels[t.defaultTone] ?? t.defaultTone}</span>
          </section>

          {/* テンプレ履歴 (FR-093) */}
          <section className="bg-card border border-border rounded-2xl p-4">
            <h2 className="font-semibold mb-3">バージョン履歴</h2>
            {versions.data && versions.data.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(versions.data as any[]).map((v: any) => (
                  <div key={v.id} className="flex items-center justify-between p-2 border border-border rounded text-base">
                    <div>
                      <span className="font-medium">v{v.version}</span>
                      <span className="ml-3 text-muted-foreground">{new Date(v.createdAt).toLocaleString("ja-JP")}</span>
                      {v.restoredAt && <span className="ml-2 text-sm text-blue-600">復元済</span>}
                    </div>
                    <button
                      onClick={() => { if (confirm(`v${v.version}に復元しますか？`)) restoreVersion.mutate({ useCase: selectedUseCase, versionId: v.id }); }}
                      className="text-sm text-primary hover:underline"
                    >
                      復元
                    </button>
                  </div>
                ))}
              </div>
            ) : <p className="text-base text-muted-foreground">履歴がありません</p>}
          </section>
        </div>
      )}

      {/* 編集モード */}
      {editing && (
        <div className="space-y-6">
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="px-4 py-2 text-base border border-white/50 rounded-xl bg-white/30 hover:bg-white/50">
              キャンセル
            </button>
            <button onClick={handleSave} disabled={updateTemplate.isPending} className="px-4 py-2 text-base btn-glass-primary rounded-xl hover:opacity-90 disabled:opacity-50">
              {updateTemplate.isPending ? "保存中..." : "保存"}
            </button>
          </div>

          {/* 事前質問編集 (FR-060~063) */}
          <section className="bg-card border border-border rounded-2xl p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold">事前質問</h2>
              <button onClick={addQuestion} className="text-base text-primary hover:underline">+ 質問追加</button>
            </div>
            <div className="space-y-3">
              {form.preQuestions.map((q, i) => (
                <div key={i} className="flex items-start gap-2 p-3 border border-border rounded">
                  <div className="flex flex-col gap-1">
                    <button onClick={() => moveQuestion(i, "up")} disabled={i === 0} className="text-sm disabled:opacity-30">▲</button>
                    <button onClick={() => moveQuestion(i, "down")} disabled={i === form.preQuestions.length - 1} className="text-sm disabled:opacity-30">▼</button>
                  </div>
                  <input
                    type="text"
                    value={q.text}
                    onChange={(e) => updateQuestion(i, "text", e.target.value)}
                    className="flex-1 px-3 py-2 border border-input rounded-md bg-background text-base"
                    placeholder="質問文..."
                  />
                  <label className="flex items-center gap-1 text-base">
                    <input type="checkbox" checked={q.isActive} onChange={(e) => updateQuestion(i, "isActive", e.target.checked)} />
                    有効
                  </label>
                  <button onClick={() => removeQuestion(i)} className="text-destructive text-base hover:underline">削除</button>
                </div>
              ))}
            </div>
          </section>

          {/* プロンプト編集 */}
          {([
            { key: "aiChatPrompt", label: "AIチャット用プロンプト" },
            { key: "summaryPrompt", label: "要約用プロンプト" },
            { key: "scriptPrompt", label: "台本用プロンプト" },
            { key: "riskDetectionPrompt", label: "リスク検知プロンプト" },
            { key: "rephrasingPrompt", label: "言い換え用プロンプト" },
          ] as const).map(({ key, label }) => (
            <section key={key} className="bg-card border border-border rounded-2xl p-4">
              <h2 className="font-semibold mb-2">{label}</h2>
              <textarea
                value={(form as any)[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-base min-h-24"
                rows={4}
              />
            </section>
          ))}

          {/* デフォルトトーン */}
          <section className="bg-card border border-border rounded-2xl p-4">
            <h2 className="font-semibold mb-2">デフォルトトーン</h2>
            <div className="flex gap-3">
              {(["POLITE", "NEUTRAL", "STRONG"] as const).map((tone) => (
                <label key={tone} className="flex items-center gap-2 text-base">
                  <input
                    type="radio"
                    checked={form.defaultTone === tone}
                    onChange={() => setForm((f) => ({ ...f, defaultTone: tone }))}
                  />
                  {toneLabels[tone]}
                </label>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
