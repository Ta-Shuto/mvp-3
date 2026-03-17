import { router } from "./router";
import { dashboardRouter } from "./routers/dashboard";
import { caseRouter } from "./routers/case";
import { preChatRouter } from "./routers/preChat";
import { templateRouter } from "./routers/template";
import { meetingRouter } from "./routers/meeting";
import { auditLogRouter } from "./routers/auditLog";
import { scriptGenerationRouter } from "./routers/scriptGeneration";
import { userRouter } from "./routers/user";

export const appRouter = router({
  dashboard: dashboardRouter,
  case: caseRouter,
  preChat: preChatRouter,
  template: templateRouter,
  meeting: meetingRouter,
  auditLog: auditLogRouter,
  scriptGeneration: scriptGenerationRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
