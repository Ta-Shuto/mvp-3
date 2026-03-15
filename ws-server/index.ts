import { Server } from "socket.io";
import { createServer } from "http";
import dotenv from "dotenv";
import { handleTranscription } from "./handlers/transcription";
import { handleRiskDetection } from "./handlers/risk-detection";
import { handleMeetingControl } from "./handlers/meeting-control";

dotenv.config({ path: "../.env" });

const PORT = parseInt(process.env.WS_PORT || "3001", 10);

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXTAUTH_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// Track active meetings: meetingId -> Set<socketId>
const activeMeetings = new Map<string, Set<string>>();

io.on("connection", (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  // Join a meeting room
  socket.on("meeting:join", async (data: { meetingId: string; userId: string }) => {
    const { meetingId, userId } = data;
    socket.join(`meeting:${meetingId}`);

    if (!activeMeetings.has(meetingId)) {
      activeMeetings.set(meetingId, new Set());
    }
    activeMeetings.get(meetingId)!.add(socket.id);

    console.log(`[WS] User ${userId} joined meeting ${meetingId}`);

    // Notify room
    io.to(`meeting:${meetingId}`).emit("meeting:participant_count", {
      count: activeMeetings.get(meetingId)!.size,
    });
  });

  // Leave a meeting room
  socket.on("meeting:leave", (data: { meetingId: string }) => {
    const { meetingId } = data;
    socket.leave(`meeting:${meetingId}`);

    if (activeMeetings.has(meetingId)) {
      activeMeetings.get(meetingId)!.delete(socket.id);
      if (activeMeetings.get(meetingId)!.size === 0) {
        activeMeetings.delete(meetingId);
      }
    }

    io.to(`meeting:${meetingId}`).emit("meeting:participant_count", {
      count: activeMeetings.get(meetingId)?.size ?? 0,
    });
  });

  // FR-050: Receive transcription from bot/STT service
  socket.on("transcript:incoming", async (data) => {
    await handleTranscription(io, data);
  });

  // FR-051: Trigger risk detection on finalized transcript
  socket.on("transcript:finalized", async (data) => {
    await handleRiskDetection(io, data);
  });

  // FR-049, FR-085: Meeting control events
  socket.on("meeting:end", async (data) => {
    await handleMeetingControl(io, data, activeMeetings);
  });

  socket.on("disconnect", () => {
    // Clean up from all meeting rooms
    for (const [meetingId, sockets] of activeMeetings.entries()) {
      if (sockets.has(socket.id)) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          activeMeetings.delete(meetingId);
        }
        io.to(`meeting:${meetingId}`).emit("meeting:participant_count", {
          count: sockets.size,
        });
      }
    }
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[WS] WebSocket server running on port ${PORT}`);
});
