"use client";

import { trpc } from "@/lib/trpc";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";

type PreQuestion = { text: string; order: number; isActive: boolean };

export default function PreChatPage() {
  const params = useParams();
  const token = params.token as string;
  const utils = trpc.useUtils();

  const preChat = trpc.preChat.getByToken.useQuery({ token });
  const consent = trpc.preChat.consent.useMutation({
    onSuccess: () => utils.preChat.getByToken.invalidate({ token }),
  });
  const saveAnswer = trpc.preChat.saveAnswer.useMutation();
  const sendAiMessage = trpc.preChat.sendAiMessage.useMutation({
    onSuccess: () => utils.preChat.getByToken.invalidate({ token }),
  });
  const submit = trpc.preChat.submit.useMutation({
    onSuccess: () => utils.preChat.getByToken.invalidate({ token }),
  });

  const [phase, setPhase] = useState<"consent" | "questions" | "chat" | "submitted">("consent");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [chatInput, setChatInput] = useState("");

  const data = preChat.data as any;

  useEffect(() => {
    if (!data) return;
    if (data.isSubmitted) {
      setPhase("submitted");
    } else if (data.consentAt) {
      setPhase("questions");
      // Restore saved answers
      const savedAnswers: Record<string, string> = {};
      data.answers?.forEach((a: any) => { savedAnswers[a.questionId] = a.answerText; });
      setAnswers(savedAnswers);
    }
  }, [data]);

  if (preChat.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  if (preChat.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="bg-card p-8 rounded-lg border border-border max-w-md text-center">
          <h1 className="text-xl font-bold text-destructive mb-2">リンクが無効です</h1>
          <p className="text-sm text-muted-foreground">このリンクは無効か、期限が切れています。</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  let preQuestions: PreQuestion[] = [];
  try {
    const snapshot = data.case?.templateSnapshot as any;
    const raw = snapshot?.preQuestions;
    preQuestions = typeof raw === "string" ? JSON.parse(raw) : (raw ?? []);
    preQuestions = preQuestions.filter((q: PreQuestion) => q.isActive);
  } catch { /* empty */ }

  // FR-025: 同意画面
  if (phase === "consent") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-card p-8 rounded-lg border border-border max-w-lg w-full">
          <h1 className="text-xl font-bold mb-4">事前チャット</h1>
          <p className="text-sm text-muted-foreground mb-2">
            {data.case?.organization?.name}
          </p>
          <div className="bg-muted p-4 rounded-md mb-6 text-sm space-y-2">
            <p>こちらは面談の事前準備のためのチャットページです。</p>
            <p>いくつかの質問にお答えいただき、AIアシスタントに自由にご相談いただけます。</p>
            <p>入力内容は面談担当者に共有されます。</p>
          </div>
          <button
            onClick={() => consent.mutate({ token })}
            disabled={consent.isPending}
            className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50"
          >
            {consent.isPending ? "処理中..." : "同意して開始"}
          </button>
        </div>
      </div>
    );
  }

  // FR-031, FR-032: 提出完了画面
  if (phase === "submitted") {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-card p-6 rounded-lg border border-border mb-6">
            <h1 className="text-xl font-bold mb-2">提出完了</h1>
            <p className="text-sm text-muted-foreground">ご回答ありがとうございました。内容は面談担当者に共有されました。</p>
          </div>

          {/* 事前質問の回答表示 */}
          {data.answers?.length > 0 && (
            <div className="bg-card p-6 rounded-lg border border-border mb-4">
              <h2 className="font-semibold mb-3">事前質問の回答</h2>
              {data.answers.map((a: any, i: number) => (
                <div key={a.id} className="mb-3">
                  <p className="text-sm text-muted-foreground">質問 {i + 1}</p>
                  <p className="text-sm">{a.answerText}</p>
                </div>
              ))}
            </div>
          )}

          {/* チャット履歴表示 */}
          {data.messages?.length > 0 && (
            <div className="bg-card p-6 rounded-lg border border-border">
              <h2 className="font-semibold mb-3">チャット履歴</h2>
              <div className="space-y-3">
                {data.messages.map((m: any) => (
                  <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] p-3 rounded-lg text-sm ${
                      m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}>
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // FR-026, FR-027: 質問画面 & スキップ
  if (phase === "questions" && preQuestions.length > 0 && currentQuestionIndex < preQuestions.length) {
    const currentQuestion = preQuestions[currentQuestionIndex];
    const questionId = `q_${currentQuestionIndex}`;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-card p-8 rounded-lg border border-border max-w-lg w-full">
          <div className="flex justify-between items-center mb-6">
            <span className="text-sm text-muted-foreground">
              質問 {currentQuestionIndex + 1} / {preQuestions.length}
            </span>
            <button
              onClick={() => setPhase("chat")}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              事前質問をスキップ →
            </button>
          </div>

          <h2 className="text-lg font-medium mb-4">{currentQuestion.text}</h2>

          <textarea
            value={answers[questionId] ?? ""}
            onChange={(e) => setAnswers((a) => ({ ...a, [questionId]: e.target.value }))}
            onBlur={() => {
              if (answers[questionId]) {
                saveAnswer.mutate({ token, questionId, answerText: answers[questionId] });
              }
            }}
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm min-h-32"
            placeholder="ご回答を入力してください..."
            rows={5}
          />

          <div className="flex justify-between mt-4">
            <button
              onClick={() => setCurrentQuestionIndex((i) => Math.max(0, i - 1))}
              disabled={currentQuestionIndex === 0}
              className="px-4 py-2 text-sm border border-input rounded-md hover:bg-accent disabled:opacity-30"
            >
              前へ
            </button>
            <button
              onClick={() => {
                if (answers[questionId]) {
                  saveAnswer.mutate({ token, questionId, answerText: answers[questionId] });
                }
                if (currentQuestionIndex < preQuestions.length - 1) {
                  setCurrentQuestionIndex((i) => i + 1);
                } else {
                  setPhase("chat");
                }
              }}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90"
            >
              {currentQuestionIndex < preQuestions.length - 1 ? "次へ" : "AIチャットへ"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // FR-029, FR-030: AIチャット画面
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-card border-b border-border p-4 flex justify-between items-center">
        <h1 className="text-lg font-bold">AIチャット相談</h1>
        <button
          onClick={() => {
            if (confirm("提出すると編集できなくなります。よろしいですか？")) {
              submit.mutate({ token });
            }
          }}
          disabled={submit.isPending}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
        >
          {submit.isPending ? "提出中..." : "提出する"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full space-y-3">
        {data.messages?.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            AIアシスタントに自由にご相談ください。
          </div>
        )}
        {data.messages?.map((m: any) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] p-3 rounded-lg text-sm whitespace-pre-wrap ${
              m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {sendAiMessage.isPending && (
          <div className="flex justify-start">
            <div className="bg-muted p-3 rounded-lg text-sm text-muted-foreground">
              考え中...
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border p-4 max-w-2xl mx-auto w-full">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!chatInput.trim() || sendAiMessage.isPending) return;
            sendAiMessage.mutate({ token, content: chatInput.trim() });
            setChatInput("");
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="メッセージを入力..."
            className="flex-1 px-3 py-2 border border-input rounded-md bg-background text-sm"
            disabled={sendAiMessage.isPending}
          />
          <button
            type="submit"
            disabled={!chatInput.trim() || sendAiMessage.isPending}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
          >
            送信
          </button>
        </form>
      </div>
    </div>
  );
}
