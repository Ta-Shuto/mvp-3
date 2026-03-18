"use client";

import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { useState } from "react";

const useCaseLabels: Record<string, string> = {
  VOLUNTARY_RETIREMENT: "自主退職",
  AUDIT: "監査",
};

const statusLabels: Record<string, string> = {
  PRE_INPUT_PENDING: "入力待ち",
  PRE_INPUT_SUBMITTED: "提出済み",
  IN_MEETING: "面談中",
  MEETING_ENDED: "面談終了",
  CLOSED: "完了",
};

const statusColors: Record<string, string> = {
  PRE_INPUT_PENDING: "bg-yellow-100 text-yellow-700",
  PRE_INPUT_SUBMITTED: "bg-blue-100 text-blue-700",
  IN_MEETING: "bg-green-100 text-green-700",
  MEETING_ENDED: "bg-purple-100 text-purple-700",
  CLOSED: "bg-gray-100 text-gray-600",
};

const categoryLabels: Record<string, string> = {
  HARASSMENT: "ハラスメント",
  FRAUD: "不正・不祥事",
  SAFETY: "安全衛生",
  OTHER: "その他",
};

export default function QuestionsPage() {
  const [tab, setTab] = useState<"templates" | "answers">("templates");
  const templates = trpc.question.list.useQuery();
  const answers = trpc.question.getAnswers.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">質問管理</h1>
        <p className="text-base text-muted-foreground mt-1">
          事前質問テンプレートと回答の管理
        </p>
      </div>

      {/* タブ切替 */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("templates")}
          className={`px-4 py-1.5 rounded-full text-base font-medium transition-colors ${
            tab === "templates"
              ? "btn-glass-primary"
              : "bg-secondary text-muted-foreground hover:bg-white/40"
          }`}
        >
          質問テンプレート
        </button>
        <button
          onClick={() => setTab("answers")}
          className={`px-4 py-1.5 rounded-full text-base font-medium transition-colors ${
            tab === "answers"
              ? "btn-glass-primary"
              : "bg-secondary text-muted-foreground hover:bg-white/40"
          }`}
        >
          回答一覧 {answers.data ? `(${answers.data.length})` : ""}
        </button>
      </div>

      {tab === "templates" && (
        <div className="space-y-4">
          {templates.isLoading && (
            <p className="text-muted-foreground">読み込み中...</p>
          )}
          {templates.data?.length === 0 && (
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <p className="text-muted-foreground">
                質問テンプレートがありません
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                テンプレート管理ページから事前質問を設定してください
              </p>
              <Link
                href="/templates"
                className="inline-block mt-3 px-4 py-2 btn-glass-primary rounded-xl text-base font-medium"
              >
                テンプレート管理へ
              </Link>
            </div>
          )}
          {templates.data?.map((template) => (
            <div
              key={template.id}
              className="bg-card border border-border rounded-2xl p-5"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-700 text-sm font-medium">
                      {useCaseLabels[template.useCase] ?? template.useCase}
                    </span>
                    事前質問テンプレート
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {template.questions.length}件の質問 ・ 最終更新:{" "}
                    {new Date(template.updatedAt).toLocaleDateString("ja-JP")}
                    {template.updatedBy && ` by ${template.updatedBy.name}`}
                  </p>
                </div>
                <Link
                  href="/templates"
                  className="px-3 py-1.5 text-sm border border-border rounded-xl hover:bg-white/40 transition-colors"
                >
                  編集
                </Link>
              </div>

              {template.questions.length > 0 ? (
                <div className="space-y-2">
                  {template.questions.map((q: any, i: number) => (
                    <div
                      key={q.id ?? i}
                      className="flex items-start gap-3 p-3 rounded-xl bg-white/30"
                    >
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-sm font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-base font-medium">{q.label}</p>
                        <div className="flex gap-2 mt-1">
                          {q.type && (
                            <span className="text-xs text-muted-foreground bg-white/50 px-2 py-0.5 rounded">
                              {q.type === "text"
                                ? "テキスト"
                                : q.type === "textarea"
                                  ? "長文"
                                  : q.type === "select"
                                    ? "選択"
                                    : q.type}
                            </span>
                          )}
                          {q.required && (
                            <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded">
                              必須
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  質問が設定されていません
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "answers" && (
        <div className="space-y-4">
          {answers.isLoading && (
            <p className="text-muted-foreground">読み込み中...</p>
          )}
          {answers.data?.length === 0 && (
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <p className="text-muted-foreground">
                回答済みの事前質問がありません
              </p>
            </div>
          )}
          {answers.data?.map((preChat: any) => (
            <div
              key={preChat.id}
              className="bg-card border border-border rounded-2xl p-5"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <Link
                    href={`/cases/${preChat.case?.id}`}
                    className="text-lg font-semibold text-primary hover:underline"
                  >
                    {preChat.case?.caseName ??
                      preChat.case?.category ??
                      `案件 ${preChat.case?.id?.slice(0, 8)}`}
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    {preChat.case?.caseCategory && (
                      <span className="text-xs bg-white/50 px-2 py-0.5 rounded text-muted-foreground">
                        {categoryLabels[preChat.case.caseCategory] ??
                          preChat.case.caseCategory}
                      </span>
                    )}
                    {preChat.case?.status && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[preChat.case.status] ?? "bg-gray-100"}`}
                      >
                        {statusLabels[preChat.case.status] ??
                          preChat.case.status}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      提出日:{" "}
                      {preChat.submittedAt
                        ? new Date(preChat.submittedAt).toLocaleDateString(
                            "ja-JP"
                          )
                        : "—"}
                    </span>
                  </div>
                </div>
                <Link
                  href={`/cases/${preChat.case?.id}`}
                  className="px-3 py-1.5 text-sm border border-border rounded-xl hover:bg-white/40 transition-colors"
                >
                  案件を開く
                </Link>
              </div>

              {preChat.answers.length > 0 ? (
                <div className="space-y-2">
                  {preChat.answers.map((answer: any, i: number) => (
                    <div
                      key={answer.id}
                      className="p-3 rounded-xl bg-white/30"
                    >
                      <p className="text-sm text-muted-foreground mb-1">
                        Q{i + 1}. {answer.questionId}
                      </p>
                      <p className="text-base">
                        {answer.answerText || (
                          <span className="text-muted-foreground">
                            未回答
                          </span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">回答なし</p>
              )}

              {preChat.aiSummary && (
                <div className="mt-3 p-3 rounded-xl bg-indigo-50/50 border border-indigo-100">
                  <p className="text-sm font-medium text-indigo-700 mb-1">
                    AI サマリー
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {preChat.aiSummary}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
