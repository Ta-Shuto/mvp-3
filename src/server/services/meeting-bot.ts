/**
 * Recall.ai Meeting Bot Integration (FR-081, FR-082, FR-080)
 *
 * Manages bot lifecycle for Teams/Zoom meetings:
 * - Bot creation and room join
 * - Participant count validation (FR-082: max 5)
 * - Retry logic (FR-080)
 * - Recording and transcription delegation
 */

const RECALL_API_BASE = process.env.RECALL_API_URL || "https://api.recall.ai/api/v1";
const RECALL_API_KEY = process.env.RECALL_API_KEY || "";

interface BotCreateParams {
  meetingUrl: string;
  botName?: string;
  chatMessage?: string;
  maxParticipants?: number;
}

interface BotStatus {
  id: string;
  status: "joining" | "in_meeting" | "recording" | "done" | "error";
  participantCount: number;
  error?: string;
}

/**
 * FR-081: Create and send a bot to the meeting
 */
export async function createBot(params: BotCreateParams): Promise<{ botId: string }> {
  if (!RECALL_API_KEY) {
    console.warn("[MeetingBot] RECALL_API_KEY not configured - bot creation skipped");
    return { botId: `mock-bot-${Date.now()}` };
  }

  const response = await fetch(`${RECALL_API_BASE}/bot`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${RECALL_API_KEY}`,
    },
    body: JSON.stringify({
      meeting_url: params.meetingUrl,
      bot_name: params.botName || "面談サポートBot",
      chat: params.chatMessage
        ? { on_bot_join: { send_to: "everyone", message: params.chatMessage } }
        : undefined,
      transcription_options: {
        provider: "default",
      },
      real_time_transcription: {
        destination_url: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/webhook/recall`,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Bot creation failed: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return { botId: data.id };
}

/**
 * FR-080: Retry bot join with configurable settings
 */
export async function createBotWithRetry(
  params: BotCreateParams,
  retrySettings: { maxRetries: number; retryIntervalSeconds: number }
): Promise<{ botId: string }> {
  const { maxRetries, retryIntervalSeconds } = retrySettings;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await createBot(params);
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      console.log(`[MeetingBot] Retry ${attempt + 1}/${maxRetries} in ${retryIntervalSeconds}s...`);
      await new Promise((r) => setTimeout(r, retryIntervalSeconds * 1000));
    }
  }

  throw new Error("Bot creation failed after all retries");
}

/**
 * Get bot status from Recall.ai
 */
export async function getBotStatus(botId: string): Promise<BotStatus> {
  if (!RECALL_API_KEY || botId.startsWith("mock-bot-")) {
    return {
      id: botId,
      status: "in_meeting",
      participantCount: 2,
    };
  }

  const response = await fetch(`${RECALL_API_BASE}/bot/${botId}`, {
    headers: {
      Authorization: `Token ${RECALL_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get bot status: ${response.status}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    status: mapRecallStatus(data.status_changes),
    participantCount: data.meeting_participants?.length ?? 0,
  };
}

/**
 * FR-082: Check participant count (max 5)
 */
export async function validateParticipantCount(
  botId: string,
  maxParticipants = 5
): Promise<{ valid: boolean; count: number }> {
  const status = await getBotStatus(botId);
  return {
    valid: status.participantCount <= maxParticipants,
    count: status.participantCount,
  };
}

/**
 * Remove bot from meeting
 */
export async function removeBot(botId: string): Promise<void> {
  if (!RECALL_API_KEY || botId.startsWith("mock-bot-")) {
    return;
  }

  await fetch(`${RECALL_API_BASE}/bot/${botId}/leave`, {
    method: "POST",
    headers: {
      Authorization: `Token ${RECALL_API_KEY}`,
    },
  });
}

/**
 * Get recording/audio file URL after meeting ends
 */
export async function getRecordingUrl(botId: string): Promise<string | null> {
  if (!RECALL_API_KEY || botId.startsWith("mock-bot-")) {
    return null;
  }

  const response = await fetch(`${RECALL_API_BASE}/bot/${botId}`, {
    headers: {
      Authorization: `Token ${RECALL_API_KEY}`,
    },
  });

  if (!response.ok) return null;

  const data = await response.json();
  return data.video_url || data.audio_url || null;
}

function mapRecallStatus(statusChanges: Array<{ code: string }> | undefined): BotStatus["status"] {
  if (!statusChanges?.length) return "joining";
  const latest = statusChanges[statusChanges.length - 1].code;
  switch (latest) {
    case "ready":
    case "joining_call":
      return "joining";
    case "in_waiting_room":
    case "in_call_not_recording":
      return "in_meeting";
    case "in_call_recording":
      return "recording";
    case "call_ended":
    case "done":
      return "done";
    default:
      return "error";
  }
}
