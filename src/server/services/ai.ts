import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

interface AIOptions {
  systemPrompt: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
}

/**
 * Generate AI response using Google Gemini API (FR-029, FR-034, FR-035, FR-118)
 */
export async function generateAIResponse(options: AIOptions): Promise<string> {
  const { systemPrompt, messages, maxTokens = 2048 } = options;

  if (!process.env.GEMINI_API_KEY) {
    return "（AI応答を利用するにはGEMINI_API_KEYの設定が必要です）";
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: systemPrompt,
    });

    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.content }],
    }));

    const result = await model.generateContent({
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens,
      },
    });

    return result.response.text();
  } catch (error) {
    console.error("AI API error:", error);
    throw new Error("AI応答の生成に失敗しました。しばらくしてから再試行してください。");
  }
}

/**
 * Generate pre-chat summary (FR-034)
 */
export async function generatePreChatSummary(
  chatMessages: { role: string; content: string }[],
  answers: { questionId: string; answerText: string }[],
  summaryPrompt: string
): Promise<string> {
  const chatText = chatMessages
    .map((m) => `${m.role === "user" ? "被面談者" : "AI"}: ${m.content}`)
    .join("\n");

  const answersText = answers
    .map((a, i) => `質問${i + 1}: ${a.answerText}`)
    .join("\n");

  const input = `## 事前質問の回答\n${answersText}\n\n## AIチャットの内容\n${chatText}`;

  return generateAIResponse({
    systemPrompt: summaryPrompt || "以下の事前チャット内容を要約してください。重要なポイントを箇条書きで示してください。",
    messages: [{ role: "user", content: input }],
  });
}

/**
 * Generate interview script (FR-118)
 */
export async function generateScript(
  inquiryEmail: string,
  preAiResponse: string | null,
  usePreAiResponse: boolean,
  pastCasesSummary: string,
  scriptPrompt: string
): Promise<{
  scenarios: string;
  issues: string;
  questions: string;
  pastTrends: string;
}> {
  let input = `## 問い合わせメール内容\n${inquiryEmail}\n`;

  if (usePreAiResponse && preAiResponse) {
    input += `\n## 事前AI回答結果\n${preAiResponse}\n`;
  }

  if (pastCasesSummary) {
    input += `\n## 過去案件の傾向データ\n${pastCasesSummary}\n`;
  }

  input += `\n以下の4つのセクションで台本を生成してください:
1. 考えられるシナリオ（複数）
2. 争点になりそうなポイント（箇条書き）
3. 質問リスト（優先度付き）
4. 過去案件の傾向`;

  const response = await generateAIResponse({
    systemPrompt: scriptPrompt || "面談用の台本を生成してください。",
    messages: [{ role: "user", content: input }],
    maxTokens: 4096,
  });

  // Parse sections from response
  const sections = response.split(/(?=#{1,3}\s)/);
  return {
    scenarios: sections.find((s) => s.includes("シナリオ")) ?? response,
    issues: sections.find((s) => s.includes("争点") || s.includes("ポイント")) ?? "",
    questions: sections.find((s) => s.includes("質問")) ?? "",
    pastTrends: sections.find((s) => s.includes("過去") || s.includes("傾向")) ?? "",
  };
}

/**
 * Rephrase text with specified tone (FR-121)
 */
export async function rephraseText(
  text: string,
  tone: "formal" | "gentle" | "firm"
): Promise<string> {
  const toneMap = {
    formal: "フォーマルで丁寧なビジネストーン",
    gentle: "柔らかく親しみやすいトーン",
    firm: "毅然とした断定的なトーン",
  };

  return generateAIResponse({
    systemPrompt: `以下のテキストを「${toneMap[tone]}」に変換してください。内容の意味は変えず、トーンのみ変更してください。変換後のテキストのみを返してください。`,
    messages: [{ role: "user", content: text }],
  });
}

/**
 * Generate meeting summary (FR-114)
 */
export async function generateMeetingSummary(
  transcripts: { speaker: string; text: string; timestamp: number }[]
): Promise<string> {
  const transcriptText = transcripts
    .map((t) => `[${Math.floor(t.timestamp / 60)}:${String(Math.floor(t.timestamp % 60)).padStart(2, "0")}] ${t.speaker}: ${t.text}`)
    .join("\n");

  return generateAIResponse({
    systemPrompt: "以下の面談の文字起こしから、面談要点を3〜10行で生成してください。重要な論点、結論、次のアクションを含めてください。",
    messages: [{ role: "user", content: transcriptText }],
  });
}

/**
 * Detect risks in transcript (FR-051, FR-067)
 */
export async function detectRisks(
  text: string,
  speaker: string,
  riskDetectionPrompt: string
): Promise<{
  isRisky: boolean;
  reason: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  rephrasing?: string;
}> {
  const response = await generateAIResponse({
    systemPrompt: riskDetectionPrompt || "以下の発言にリスクがないか判定してください。JSON形式で回答してください。",
    messages: [
      {
        role: "user",
        content: `話者: ${speaker}\n発言: ${text}\n\n以下のJSON形式で回答してください:\n{"isRisky": boolean, "reason": "理由", "confidence": "HIGH|MEDIUM|LOW", "rephrasing": "言い換え案（リスクがある場合のみ）"}`,
      },
    ],
    maxTokens: 512,
  });

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // fallback
  }

  return { isRisky: false, reason: "", confidence: "LOW" };
}
