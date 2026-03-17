"use client";

import { trpc } from "@/lib/trpc";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";

const toneLabels: Record<string, string> = {
  POLITE: "丁寧",
  NEUTRAL: "中立",
  STRONG: "厳格",
};

export default function ScriptGenerationPage() {
  const params = useParams();
  const caseId = params.id as string;
  const utils = trpc.useUtils();

  const scriptGen = trpc.scriptGeneration.getByCase.useQuery({ caseId });
  const saveInputs = trpc.scriptGeneration.saveInputs.useMutation({
    onSuccess: () => utils.scriptGeneration.getByCase.invalidate({ caseId }),
  });
  const generate = trpc.scriptGeneration.generate.useMutation({
    onSuccess: () => utils.scriptGeneration.getByCase.invalidate({ caseId }),
  });
  const saveVersion = trpc.scriptGeneration.saveVersion.useMutation({
    onSuccess: () => utils.scriptGeneration.getByCase.invalidate({ caseId }),
  });
  const rephrase = trpc.scriptGeneration.rephrase.useMutation();

  const [inquiryEmail, setInquiryEmail] = useState("");
  const [preAiResponse, setPreAiResponse] = useState("");
  const [usePreAi, setUsePreAi] = useState(false);
  const [editingScript, setEditingScript] = useState(false);
  const [scriptForm, setScriptForm] = useState({
    scenarios: "",
    issues: "",
    questions: "",
    pastTrends: "",
  });
  const [selectedTone, setSelectedTone] = useState<string>("POLITE");
  const [rephraseTarget, setRephraseTarget] = useState<string | null>(null);
  const [rephrasedText, setRephrasedText] = useState("");

  const data = scriptGen.data as any;

  useEffect(() => {
    if (data) {
      setInquiryEmail(data.inquiryEmailText ?? "");
      setPreAiResponse(data.preAiResponseText ?? "");
      setUsePreAi(data.usePreAiResponse ?? false);
      if (data.generatedScript) {
        setScriptForm({
          scenarios: data.generatedScript.scenarios ?? "",
          issues: data.generatedScript.issues ?? "",
          questions: data.generatedScript.questions ?? "",
          pastTrends: data.generatedScript.pastTrends ?? "",
        });
      }
    }
  }, [data]);

  const handleRephrase = async (section: string, text: string) => {
    setRephraseTarget(section);
    try {
      const result = await rephrase.mutateAsync({
        caseId,
        text,
        tone: selectedTone as any,
      });
      setRephrasedText((result as any)?.rephrasedText ?? text);
    } catch {
      setRephrasedText(text);
    }
  };

  const applyRephrase = (section: string) => {
    setScriptForm((f) => ({ ...f, [section]: rephrasedText }));
    setRephraseTarget(null);
    setRephrasedText("");
  };

  const handleExportScript = () => {
    const script = data?.generatedScript ?? scriptForm;
    const sections = [
      { label: "考えられるシナリオ", content: script.scenarios },
      { label: "争点になりそうなポイント", content: script.issues },
      { label: "質問リスト（優先度付き）", content: script.questions },
      { label: "過去案件の傾向", content: script.pastTrends },
    ];

    const text = sections
      .map(({ label, content }) => `【${label}】\n${content || "（未記入）"}`)
      .join("\n\n");

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `script-${caseId.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scriptSections = [
    { key: "scenarios", label: "考えられるシナリオ" },
    { key: "issues", label: "争点になりそうなポイント" },
    { key: "questions", label: "質問リスト（優先度付き）" },
    { key: "pastTrends", label: "過去案件の傾向" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/cases/${caseId}`} className="text-muted-foreground hover:text-foreground text-sm">
            &larr; 案件詳細
          </Link>
          <h1 className="text-2xl font-bold">台本生成</h1>
        </div>
        {data?.generatedScript && (
          <button
            onClick={handleExportScript}
            className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent"
          >
            テキスト出力
          </button>
        )}
      </div>

      {/* 問い合わせメール入力 */}
      <section className="bg-card border border-border rounded-lg p-5">
        <h2 className="font-semibold mb-3">問い合わせメール内容</h2>
        <textarea
          value={inquiryEmail}
          onChange={(e) => setInquiryEmail(e.target.value)}
          onBlur={() => saveInputs.mutate({ caseId, inquiryEmailText: inquiryEmail })}
          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm min-h-32 resize-y"
          placeholder="問い合わせメールの内容を入力..."
          rows={6}
        />
      </section>

      {/* 事前AI回答結果 */}
      <section className="bg-card border border-border rounded-lg p-5">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold">事前AI回答結果</h2>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={usePreAi}
              onChange={(e) => {
                setUsePreAi(e.target.checked);
                saveInputs.mutate({ caseId, usePreAiResponse: e.target.checked });
              }}
              className="rounded"
            />
            台本生成に使用する
          </label>
        </div>
        <textarea
          value={preAiResponse}
          onChange={(e) => setPreAiResponse(e.target.value)}
          onBlur={() => saveInputs.mutate({ caseId, preAiResponseText: preAiResponse })}
          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm min-h-24 resize-y"
          placeholder="事前AIの回答結果を入力..."
          rows={4}
        />
      </section>

      {/* 台本生成ボタン */}
      <div className="flex justify-center">
        <button
          onClick={() => generate.mutate({ caseId })}
          disabled={generate.isPending || !inquiryEmail.trim()}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
        >
          {generate.isPending ? "台本を生成中..." : "台本を生成"}
        </button>
      </div>

      {/* 生成結果表示 */}
      {data?.generatedScript && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold">生成結果</h2>
            <div className="flex items-center gap-3">
              {/* トーン選択 */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">トーン:</span>
                <div className="flex rounded-lg border border-border overflow-hidden">
                  {Object.entries(toneLabels).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedTone(key)}
                      className={`px-3 py-1 text-xs font-medium transition-colors ${
                        selectedTone === key
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {editingScript ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingScript(false)}
                    className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-accent"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={() => {
                      saveVersion.mutate({ caseId, content: scriptForm });
                      setEditingScript(false);
                    }}
                    disabled={saveVersion.isPending}
                    className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90"
                  >
                    保存
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingScript(true)}
                  className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-accent"
                >
                  編集
                </button>
              )}
            </div>
          </div>

          {/* 4セクション */}
          {scriptSections.map(({ key, label }) => (
            <section key={key} className="bg-card border border-border rounded-lg p-5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold">{label}</h3>
                {!editingScript && (
                  <button
                    onClick={() => handleRephrase(key, (data.generatedScript as any)[key] ?? "")}
                    disabled={rephrase.isPending && rephraseTarget === key}
                    className="px-3 py-1 text-xs border border-border rounded-lg hover:bg-accent disabled:opacity-50"
                  >
                    {rephrase.isPending && rephraseTarget === key ? "変換中..." : `${toneLabels[selectedTone]}トーンに変換`}
                  </button>
                )}
              </div>

              {editingScript ? (
                <textarea
                  value={(scriptForm as any)[key]}
                  onChange={(e) => setScriptForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm min-h-24 resize-y"
                  rows={5}
                />
              ) : (
                <div className="text-sm whitespace-pre-wrap">
                  {(data.generatedScript as any)[key] || "（データなし）"}
                </div>
              )}

              {/* トーン変換結果 */}
              {rephraseTarget === key && rephrasedText && !rephrase.isPending && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium text-blue-700">{toneLabels[selectedTone]}トーンに変換</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => applyRephrase(key)}
                        className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        適用
                      </button>
                      <button
                        onClick={() => { setRephraseTarget(null); setRephrasedText(""); }}
                        className="px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{rephrasedText}</p>
                </div>
              )}
            </section>
          ))}

          {/* バージョン履歴 */}
          {data.versions?.length > 0 && (
            <section className="bg-card border border-border rounded-lg p-5">
              <h3 className="font-semibold mb-3">バージョン履歴</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {data.versions.map((v: any) => (
                  <div key={v.id} className="flex items-center justify-between p-2 border border-border rounded-lg text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">v{v.version}</span>
                      <span className="text-muted-foreground">
                        {new Date(v.createdAt).toLocaleString("ja-JP")}
                      </span>
                      {v.editedBy && <span className="text-xs text-muted-foreground">{v.editedBy.name}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
