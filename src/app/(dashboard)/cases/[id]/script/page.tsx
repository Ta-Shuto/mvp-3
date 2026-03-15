"use client";

import { trpc } from "@/lib/trpc";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/cases/${caseId}`} className="text-muted-foreground hover:text-foreground text-sm">
          &larr; 案件詳細
        </Link>
        <h1 className="text-2xl font-bold">台本生成</h1>
      </div>

      {/* FR-116: 問い合わせメール入力 */}
      <section className="bg-card border border-border rounded-lg p-4">
        <h2 className="font-semibold mb-3">問い合わせメール内容</h2>
        <textarea
          value={inquiryEmail}
          onChange={(e) => setInquiryEmail(e.target.value)}
          onBlur={() => saveInputs.mutate({ caseId, inquiryEmailText: inquiryEmail })}
          className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm min-h-32"
          placeholder="問い合わせメールの内容を入力..."
          rows={6}
        />
      </section>

      {/* FR-117: 事前AI回答結果 */}
      <section className="bg-card border border-border rounded-lg p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold">事前AI回答結果</h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={usePreAi}
              onChange={(e) => {
                setUsePreAi(e.target.checked);
                saveInputs.mutate({ caseId, usePreAiResponse: e.target.checked });
              }}
            />
            台本生成に使用する
          </label>
        </div>
        <textarea
          value={preAiResponse}
          onChange={(e) => setPreAiResponse(e.target.value)}
          onBlur={() => saveInputs.mutate({ caseId, preAiResponseText: preAiResponse })}
          className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm min-h-24"
          placeholder="事前AIの回答結果を入力..."
          rows={4}
        />
      </section>

      {/* FR-118: 台本生成ボタン */}
      <div className="flex justify-center">
        <button
          onClick={() => generate.mutate({ caseId })}
          disabled={generate.isPending || !inquiryEmail.trim()}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50"
        >
          {generate.isPending ? "台本を生成中..." : "台本を生成"}
        </button>
      </div>

      {/* 生成結果表示 */}
      {data?.generatedScript && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold">生成結果</h2>
            <div className="flex gap-2">
              {editingScript ? (
                <>
                  <button
                    onClick={() => setEditingScript(false)}
                    className="px-3 py-1.5 text-sm border border-input rounded-md hover:bg-accent"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={() => {
                      saveVersion.mutate({ caseId, content: scriptForm });
                      setEditingScript(false);
                    }}
                    disabled={saveVersion.isPending}
                    className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90"
                  >
                    保存
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditingScript(true)}
                  className="px-3 py-1.5 text-sm text-primary hover:underline"
                >
                  編集
                </button>
              )}
            </div>
          </div>

          {/* 4セクション */}
          {[
            { key: "scenarios", label: "考えられるシナリオ" },
            { key: "issues", label: "争点になりそうなポイント" },
            { key: "questions", label: "質問リスト（優先度付き）" },
            { key: "pastTrends", label: "過去案件の傾向" },
          ].map(({ key, label }) => (
            <section key={key} className="bg-card border border-border rounded-lg p-4">
              <h3 className="font-semibold mb-2">{label}</h3>
              {editingScript ? (
                <textarea
                  value={(scriptForm as any)[key]}
                  onChange={(e) => setScriptForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm min-h-24"
                  rows={5}
                />
              ) : (
                <div className="text-sm whitespace-pre-wrap">
                  {(data.generatedScript as any)[key] || "（データなし）"}
                </div>
              )}
            </section>
          ))}

          {/* FR-119: バージョン履歴 */}
          {data.versions?.length > 0 && (
            <section className="bg-card border border-border rounded-lg p-4">
              <h3 className="font-semibold mb-3">バージョン履歴</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {data.versions.map((v: any) => (
                  <div key={v.id} className="flex items-center justify-between p-2 border border-border rounded text-sm">
                    <div>
                      <span className="font-medium">v{v.version}</span>
                      <span className="ml-3 text-muted-foreground">
                        {new Date(v.createdAt).toLocaleString("ja-JP")}
                      </span>
                      {v.editedBy && <span className="ml-2 text-xs text-muted-foreground">{v.editedBy.name}</span>}
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
