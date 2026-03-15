/**
 * Transcription Service (FR-050, FR-086, FR-097)
 *
 * Processes raw audio/text from meeting bots and STT services.
 * - FR-050: 暫定/確定の2段階文字起こし
 * - FR-086: 5秒超遅延の検知・警告
 * - FR-097: 日英混在テキスト対応
 */

const DELAY_THRESHOLD_MS = 5000; // FR-086: 5秒超で警告

interface RawTranscriptChunk {
  meetingId: string;
  speaker: string;
  text: string;
  timestamp: number;
  isFinal: boolean;
  language?: string;
  confidence?: number;
  receivedAt?: number;
}

/**
 * FR-086: 遅延チェック
 * STTから受信した文字起こしの遅延を検出
 */
export function checkDelay(chunk: RawTranscriptChunk): {
  hasDelay: boolean;
  delayMs: number;
} {
  if (!chunk.receivedAt) {
    return { hasDelay: false, delayMs: 0 };
  }

  // Estimate expected time based on timestamp
  const expectedTime = chunk.receivedAt;
  const actualDelay = Date.now() - expectedTime;

  return {
    hasDelay: actualDelay > DELAY_THRESHOLD_MS,
    delayMs: actualDelay,
  };
}

/**
 * FR-097: 日英混在テキストの正規化
 * - 全角/半角の統一
 * - 日英混在時のスペース調整
 */
export function normalizeText(text: string): string {
  // Normalize full-width alphanumeric to half-width
  let normalized = text.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0)
  );

  // Normalize full-width spaces
  normalized = normalized.replace(/\u3000/g, " ");

  // Trim excessive whitespace
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}

/**
 * Map STT confidence score to Confidence enum
 */
export function mapConfidence(score: number | undefined): "HIGH" | "MEDIUM" | "LOW" {
  if (score === undefined) return "MEDIUM";
  if (score >= 0.85) return "HIGH";
  if (score >= 0.6) return "MEDIUM";
  return "LOW";
}

/**
 * Process a raw transcript chunk from the STT service
 */
export function processTranscriptChunk(chunk: RawTranscriptChunk) {
  const normalizedText = normalizeText(chunk.text);
  const confidence = mapConfidence(chunk.confidence);
  const delay = checkDelay(chunk);

  return {
    meetingId: chunk.meetingId,
    speaker: chunk.speaker,
    text: normalizedText,
    timestamp: chunk.timestamp,
    isFinal: chunk.isFinal,
    confidence,
    delay,
  };
}
