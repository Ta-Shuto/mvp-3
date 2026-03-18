// @ts-nocheck
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/interview_support";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting dummy data insertion...");

  // Ensure base org and users exist
  const org = await prisma.organization.upsert({
    where: { id: "demo-org-001" },
    update: {},
    create: { id: "demo-org-001", name: "デモ法人株式会社" },
  });

  const adminPw = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: {},
    create: {
      organizationId: org.id,
      role: "ADMIN",
      name: "管理者 太郎",
      email: "admin@demo.com",
      passwordHash: adminPw,
      caseViewScope: "all",
    },
  });

  const interviewerPw = await bcrypt.hash("interviewer123", 10);
  const interviewer = await prisma.user.upsert({
    where: { email: "interviewer@demo.com" },
    update: {},
    create: {
      organizationId: org.id,
      role: "INTERVIEWER",
      name: "面談担当 花子",
      email: "interviewer@demo.com",
      passwordHash: interviewerPw,
      caseViewScope: "assigned",
    },
  });

  const interviewer2Pw = await bcrypt.hash("interviewer456", 10);
  const interviewer2 = await prisma.user.upsert({
    where: { email: "interviewer2@demo.com" },
    update: {},
    create: {
      organizationId: org.id,
      role: "INTERVIEWER",
      name: "面談担当 健太",
      email: "interviewer2@demo.com",
      passwordHash: interviewer2Pw,
      caseViewScope: "assigned",
    },
  });

  const operatorPw = await bcrypt.hash("operator123", 10);
  await prisma.user.upsert({
    where: { email: "operator@demo.com" },
    update: {},
    create: {
      organizationId: org.id,
      role: "OPERATOR",
      name: "運営 次郎",
      email: "operator@demo.com",
      passwordHash: operatorPw,
    },
  });

  // Templates
  for (const useCase of ["VOLUNTARY_RETIREMENT", "AUDIT"] as const) {
    await prisma.template.upsert({
      where: { organizationId_useCase: { organizationId: org.id, useCase } },
      update: {},
      create: {
        organizationId: org.id,
        useCase,
        preQuestions: JSON.stringify([
          { text: "現在のお気持ちをお聞かせください。", order: 1, isActive: true },
          { text: "ご不安に感じていることはありますか？", order: 2, isActive: true },
          { text: "ご質問やご要望があればお書きください。", order: 3, isActive: true },
        ]),
        aiChatPrompt: "あなたは面談の事前相談を受けるAIアシスタントです。丁寧に、共感を持って対応してください。",
        summaryPrompt: "以下の事前チャット内容を要約してください。",
        scriptPrompt: "以下の情報をもとに、面談用の台本を生成してください。",
        riskDetectionPrompt: "以下の発言にリスクがないか判定してください。",
        rephrasingPrompt: "以下の発言を、より適切な表現に言い換えてください。",
        defaultTone: "POLITE",
      },
    });
  }

  // ============================================
  // Case 1: 面談完了済み（自主退職）
  // ============================================
  const case1 = await prisma.case.create({
    data: {
      organizationId: org.id,
      useCase: "VOLUNTARY_RETIREMENT",
      caseName: "田中一郎氏 退職勧奨面談",
      status: "MEETING_ENDED",
      progress: "RECORDING",
      primaryAssigneeId: interviewer.id,
      category: "退職勧奨",
      caseCategory: "OTHER",
      riskLevel: "MEDIUM",
      intakeChannel: "EMAIL",
      reportContent: "田中一郎氏（営業部・勤続8年）について、業績不振が続いており退職勧奨面談を実施。本人は退職に前向きではあるものの、退職条件について交渉希望あり。",
      issue: "退職条件の交渉（退職金上乗せ、有給消化期間）",
      nextTask: "面談記録の最終確認",
      deadline: new Date("2026-03-20"),
      scheduledAt: new Date("2026-03-15T10:00:00Z"),
    },
  });

  await prisma.caseAssignment.create({
    data: { caseId: case1.id, userId: interviewer.id },
  });

  // PreChat for Case 1
  const preChat1 = await prisma.preChat.create({
    data: {
      caseId: case1.id,
      consentAt: new Date("2026-03-14T09:00:00Z"),
      isSubmitted: true,
      submittedAt: new Date("2026-03-14T10:30:00Z"),
      aiSummary:
        "田中氏は退職自体には前向きだが、退職金の上乗せ（3ヶ月分）と有給休暇の完全消化を希望。転職活動は既に開始済み。精神的には安定しているが、退職条件が折り合わない場合は弁護士への相談も検討している。",
    },
  });

  await prisma.preChatAnswer.createMany({
    data: [
      { preChatId: preChat1.id, questionId: "q1", answerText: "退職すること自体は理解しています。ただ、条件面でしっかり話し合いたいと思っています。" },
      { preChatId: preChat1.id, questionId: "q2", answerText: "退職金が適正に支払われるか、有給休暇を全て消化できるかが不安です。" },
      { preChatId: preChat1.id, questionId: "q3", answerText: "できれば退職金の上乗せと、転職活動のための有給消化期間をいただきたいです。" },
    ],
  });

  await prisma.aIChatMessage.createMany({
    data: [
      { preChatId: preChat1.id, role: "user", content: "退職金について相談したいのですが。" },
      { preChatId: preChat1.id, role: "assistant", content: "もちろんです。退職金についてどのような点が気になっていますか？具体的にお聞かせいただければ、面談時にスムーズにお話しできるよう準備いたします。" },
      { preChatId: preChat1.id, role: "user", content: "勤続8年なので、規定の退職金に加えて3ヶ月分の上乗せをお願いしたいです。" },
      { preChatId: preChat1.id, role: "assistant", content: "ご希望を承りました。勤続8年のご貢献は十分認識しています。退職金の上乗せについては面談時に担当者からご説明いたします。その他にご不安な点はありますか？" },
    ],
  });

  // Meeting for Case 1
  const meeting1 = await prisma.meeting.create({
    data: {
      caseId: case1.id,
      startedAt: new Date("2026-03-15T10:00:00Z"),
      endedAt: new Date("2026-03-15T10:45:00Z"),
      endReason: "MANUAL",
      meetingSummary:
        "面談は45分間実施。田中氏は退職に同意し、退職金2ヶ月分上乗せ＋有給休暇20日消化で合意。退職日は4月末日。引継ぎ期間として3月中に主要顧客リストを作成予定。全体的に穏やかに進行したが、一部退職条件の表現についてリスク発言あり。",
    },
  });

  // Transcripts for Meeting 1
  await prisma.transcript.createMany({
    data: [
      { meetingId: meeting1.id, speaker: "面談担当 花子", text: "本日はお忙しい中お時間いただきありがとうございます。早速ですが、今回の面談の趣旨についてお話しさせていただきます。", timestamp: 0, isFinal: true, confidence: "HIGH" },
      { meetingId: meeting1.id, speaker: "田中一郎", text: "はい、よろしくお願いします。事前に伺った内容は理解しています。", timestamp: 15, isFinal: true, confidence: "HIGH" },
      { meetingId: meeting1.id, speaker: "面談担当 花子", text: "ありがとうございます。まず、今後のキャリアについてどのようにお考えか、お聞かせいただけますか？", timestamp: 30, isFinal: true, confidence: "HIGH" },
      { meetingId: meeting1.id, speaker: "田中一郎", text: "正直なところ、転職活動は既に始めています。ただ、退職条件についてはしっかりと話し合いたいと思っています。", timestamp: 60, isFinal: true, confidence: "HIGH" },
      { meetingId: meeting1.id, speaker: "面談担当 花子", text: "もちろんです。退職条件について具体的にどのような点をご希望されますか？", timestamp: 90, isFinal: true, confidence: "HIGH" },
      { meetingId: meeting1.id, speaker: "田中一郎", text: "退職金の上乗せと、有給休暇の完全消化をお願いしたいです。8年間貢献してきたので、それなりの対応はしていただきたい。", timestamp: 120, isFinal: true, confidence: "HIGH" },
      { meetingId: meeting1.id, speaker: "面談担当 花子", text: "ご希望はよくわかります。退職金については規定に加えて2ヶ月分の上乗せをご提案させていただきます。有給休暇についても残日数の完全消化をお約束いたします。", timestamp: 180, isFinal: true, confidence: "HIGH" },
      { meetingId: meeting1.id, speaker: "田中一郎", text: "2ヶ月ですか...3ヶ月を希望していたのですが。条件が合わないなら弁護士に相談することも考えています。", timestamp: 240, isFinal: true, confidence: "HIGH" },
      { meetingId: meeting1.id, speaker: "面談担当 花子", text: "ご不満な点は理解いたします。社内で再度検討させていただきますが、現時点では2ヶ月が上限となっております。弁護士へのご相談はもちろんご自由です。", timestamp: 300, isFinal: true, confidence: "HIGH" },
      { meetingId: meeting1.id, speaker: "田中一郎", text: "わかりました。2ヶ月の上乗せ＋有給完全消化であれば、受け入れます。退職日は4月末でよろしいですか？", timestamp: 360, isFinal: true, confidence: "HIGH" },
      { meetingId: meeting1.id, speaker: "面談担当 花子", text: "承知しました。退職日は4月30日、引継ぎ期間として3月中に主要顧客リストの作成をお願いできますか？", timestamp: 420, isFinal: true, confidence: "HIGH" },
      { meetingId: meeting1.id, speaker: "田中一郎", text: "はい、それは対応します。お互いにとって良い形で終わりにしたいと思います。", timestamp: 480, isFinal: true, confidence: "HIGH" },
    ],
  });

  // Risk items for Meeting 1
  await prisma.riskItem.createMany({
    data: [
      {
        meetingId: meeting1.id,
        text: "条件が合わないなら弁護士に相談することも考えています。",
        speaker: "田中一郎",
        reason: "法的措置の示唆。訴訟に発展する可能性を示唆する発言。",
        rephrasing: "「条件について更に検討させていただけますか」と応じ、相手の不満を和らげることが推奨されます。",
        status: "ACCEPTED",
        timestamp: 240,
        confidence: "HIGH",
      },
      {
        meetingId: meeting1.id,
        text: "8年間貢献してきたので、それなりの対応はしていただきたい。",
        speaker: "田中一郎",
        reason: "不満の表明。条件に対する強い期待を示しており、対応を誤ると感情的になる可能性がある。",
        status: "REJECTED",
        timestamp: 120,
        confidence: "MEDIUM",
      },
    ],
  });

  // Script Generation for Case 1
  await prisma.scriptGeneration.create({
    data: {
      caseId: case1.id,
      inquiryEmailText: "田中一郎氏（営業部・勤続8年）の退職勧奨について。業績不振が続いており、会社としては退職勧奨を行いたい。",
      usePreAiResponse: true,
      preAiResponseText: "田中氏は退職金上乗せと有給消化を希望。転職活動は開始済み。",
      generatedScript: {
        scenarios: "シナリオ1: 円満合意（退職金上乗せ2-3ヶ月分で合意）\nシナリオ2: 条件交渉難航（弁護士介入の可能性）\nシナリオ3: 退職拒否（配置転換の提案へ移行）",
        issues: "・退職金上乗せ額の妥当性\n・有給休暇消化期間の取り扱い\n・引継ぎスケジュール\n・退職勧奨の法的リスク",
        questions: "1. 転職活動の進捗状況\n2. 希望する退職条件の詳細\n3. 引継ぎに必要な期間\n4. 会社への要望事項",
        pastTrends: "過去の類似案件では退職金1-2ヶ月上乗せで合意するケースが多い。有給消化は全件で認めている。",
      },
    },
  });

  // ============================================
  // Case 2: 面談予定（監査）
  // ============================================
  const case2 = await prisma.case.create({
    data: {
      organizationId: org.id,
      useCase: "AUDIT",
      caseName: "鈴木部長 ハラスメント調査面談",
      status: "PRE_INPUT_SUBMITTED",
      progress: "PREPARATION",
      primaryAssigneeId: interviewer2.id,
      category: "ハラスメント調査",
      caseCategory: "HARASSMENT",
      riskLevel: "HIGH",
      intakeChannel: "WEB_FORM",
      reportContent: "営業部の複数の部下から鈴木部長のパワーハラスメントに関する通報あり。具体的には、大声での叱責、業務時間外のメール強要、人格を否定する発言が報告されている。",
      issue: "パワーハラスメントの事実確認と証拠収集",
      nextTask: "事前チャット結果の確認",
      deadline: new Date("2026-03-25"),
      scheduledAt: new Date("2026-03-22T14:00:00Z"),
    },
  });

  await prisma.caseAssignment.createMany({
    data: [
      { caseId: case2.id, userId: interviewer2.id },
      { caseId: case2.id, userId: admin.id },
    ],
  });

  const preChat2 = await prisma.preChat.create({
    data: {
      caseId: case2.id,
      consentAt: new Date("2026-03-16T14:00:00Z"),
      isSubmitted: true,
      submittedAt: new Date("2026-03-16T15:00:00Z"),
      aiSummary:
        "通報者は営業部の3名の部下。鈴木部長の行為として、①週3回程度の大声での叱責（会議室外にも聞こえる程度）、②深夜0時以降のメール返信強要、③「お前は使えない」等の人格否定発言を報告。被害期間は約6ヶ月間。うち1名は精神的不調で通院中。",
    },
  });

  await prisma.preChatAnswer.createMany({
    data: [
      { preChatId: preChat2.id, questionId: "q1", answerText: "鈴木部長の言動に非常に苦しんでいます。毎日出社するのが辛い状態です。" },
      { preChatId: preChat2.id, questionId: "q2", answerText: "報復されないか不安です。通報したことが部長に知られたらどうなるか心配です。" },
      { preChatId: preChat2.id, questionId: "q3", answerText: "早急に対処していただきたいです。同僚の中には体調を崩している人もいます。" },
    ],
  });

  // ============================================
  // Case 3: 事前入力待ち
  // ============================================
  const case3 = await prisma.case.create({
    data: {
      organizationId: org.id,
      useCase: "VOLUNTARY_RETIREMENT",
      caseName: "佐藤美咲氏 退職相談",
      status: "PRE_INPUT_PENDING",
      progress: "RECEPTION",
      primaryAssigneeId: interviewer.id,
      category: "退職相談",
      caseCategory: "OTHER",
      riskLevel: "LOW",
      intakeChannel: "PHONE",
      reportContent: "佐藤美咲氏（経理部・勤続3年）から退職希望の相談。キャリアアップのための転職を希望。特にトラブルはなく、円満退職の見込み。",
      nextTask: "事前チャットURLの送付",
      deadline: new Date("2026-03-28"),
      scheduledAt: new Date("2026-03-27T11:00:00Z"),
    },
  });

  await prisma.caseAssignment.create({
    data: { caseId: case3.id, userId: interviewer.id },
  });

  await prisma.preChat.create({
    data: {
      caseId: case3.id,
      urlActive: true,
      isSubmitted: false,
    },
  });

  // ============================================
  // Case 4: クローズ済み
  // ============================================
  const case4 = await prisma.case.create({
    data: {
      organizationId: org.id,
      useCase: "AUDIT",
      caseName: "山田課長 経費不正調査",
      status: "CLOSED",
      progress: "COMPLETED",
      primaryAssigneeId: interviewer2.id,
      category: "経費不正",
      caseCategory: "FRAUD",
      riskLevel: "HIGH",
      intakeChannel: "EMAIL",
      reportContent: "内部通報により山田課長の経費不正使用疑惑が発覚。約50万円の架空経費請求の疑い。",
      issue: "架空経費請求の事実確認",
      conclusion: "調査の結果、約42万円の不正経費請求が確認された。山田課長は事実を認め、全額返還に同意。懲戒処分（減給3ヶ月）を実施。",
      action: "・不正額42万円の全額返還\n・懲戒処分（減給10%×3ヶ月）\n・経費承認フローの見直し\n・全社員向け経費ルール研修の実施",
      referencePoint: "経費不正の再発防止策として承認フローを2段階に変更",
      closedAt: new Date("2026-02-28"),
      scheduledAt: new Date("2026-02-10T09:00:00Z"),
    },
  });

  await prisma.caseAssignment.create({
    data: { caseId: case4.id, userId: interviewer2.id },
  });

  const meeting4 = await prisma.meeting.create({
    data: {
      caseId: case4.id,
      startedAt: new Date("2026-02-10T09:00:00Z"),
      endedAt: new Date("2026-02-10T10:15:00Z"),
      endReason: "MANUAL",
      meetingSummary: "山田課長への聴取を実施。当初は否認していたが、証拠提示後に事実を認めた。全額返還と処分を受け入れる意向を示した。",
    },
  });

  await prisma.transcript.createMany({
    data: [
      { meetingId: meeting4.id, speaker: "面談担当 健太", text: "山田課長、本日は経費使用についてお話を伺いたく、お時間をいただきました。", timestamp: 0, isFinal: true, confidence: "HIGH" },
      { meetingId: meeting4.id, speaker: "山田課長", text: "はい、何でしょうか。私の経費使用に問題があるということですか？", timestamp: 20, isFinal: true, confidence: "HIGH" },
      { meetingId: meeting4.id, speaker: "面談担当 健太", text: "はい。昨年6月から12月の間に計8件、合計約50万円の経費申請について確認させてください。", timestamp: 45, isFinal: true, confidence: "HIGH" },
      { meetingId: meeting4.id, speaker: "山田課長", text: "全て正当な経費ですよ。取引先との会食やセミナー参加費です。", timestamp: 75, isFinal: true, confidence: "HIGH" },
      { meetingId: meeting4.id, speaker: "面談担当 健太", text: "こちらの資料をご覧ください。該当する店舗に確認したところ、予約記録が存在しない案件が5件ありました。", timestamp: 120, isFinal: true, confidence: "HIGH" },
      { meetingId: meeting4.id, speaker: "山田課長", text: "...それは...少し記憶違いがあったかもしれません。", timestamp: 180, isFinal: true, confidence: "HIGH" },
    ],
  });

  await prisma.riskItem.create({
    data: {
      meetingId: meeting4.id,
      text: "全て正当な経費ですよ。",
      speaker: "山田課長",
      reason: "虚偽の主張。後に証拠により覆された発言。調査記録として重要。",
      status: "ACCEPTED",
      timestamp: 75,
      confidence: "HIGH",
    },
  });

  // ============================================
  // Case 5: 面談中
  // ============================================
  const case5 = await prisma.case.create({
    data: {
      organizationId: org.id,
      useCase: "AUDIT",
      caseName: "品質管理部 安全違反調査",
      status: "IN_MEETING",
      progress: "EXECUTION",
      primaryAssigneeId: admin.id,
      category: "安全違反",
      caseCategory: "SAFETY",
      riskLevel: "URGENT",
      intakeChannel: "IN_PERSON",
      reportContent: "品質管理部で安全基準を満たしていない製品の出荷が行われた疑いがある。製造ラインの検査記録に不備があり、関係者への聴取が必要。",
      issue: "安全基準未達製品の出荷有無と責任者の特定",
      nextTask: "面談実施中",
      scheduledAt: new Date("2026-03-17T13:00:00Z"),
    },
  });

  await prisma.caseAssignment.createMany({
    data: [
      { caseId: case5.id, userId: admin.id },
      { caseId: case5.id, userId: interviewer.id },
      { caseId: case5.id, userId: interviewer2.id },
    ],
  });

  // Case reference: Case 5 references Case 4
  await prisma.caseReference.create({
    data: {
      fromCaseId: case5.id,
      toCaseId: case4.id,
      reason: "同様の内部統制不備に起因する事案。経費不正と安全違反はいずれも承認フローの形骸化が背景にある。",
    },
  });

  // Progress history for Case 5
  await prisma.progressHistory.createMany({
    data: [
      { caseId: case5.id, previousValue: "RECEPTION", currentValue: "INITIAL_JUDGMENT", updatedById: admin.id },
      { caseId: case5.id, previousValue: "INITIAL_JUDGMENT", currentValue: "INVESTIGATION_PLAN", updatedById: admin.id },
      { caseId: case5.id, previousValue: "INVESTIGATION_PLAN", currentValue: "PREPARATION", updatedById: admin.id },
      { caseId: case5.id, previousValue: "PREPARATION", currentValue: "EXECUTION", updatedById: admin.id },
    ],
  });

  // Audit logs
  const allCases = [case1, case2, case3, case4, case5];
  for (const c of allCases) {
    await prisma.auditLog.create({
      data: {
        organizationId: org.id,
        userId: admin.id,
        caseId: c.id,
        eventType: "CASE_CREATED",
        details: { caseName: c.caseName },
      },
    });
  }

  await prisma.auditLog.createMany({
    data: [
      { organizationId: org.id, userId: interviewer.id, caseId: case1.id, eventType: "SCRIPT_GENERATED", details: { pastCasesCount: 3 } },
      { organizationId: org.id, userId: interviewer.id, caseId: case1.id, eventType: "MEETING_STARTED", details: {} },
      { organizationId: org.id, userId: interviewer.id, caseId: case1.id, eventType: "MEETING_ENDED", details: { duration: 2700, endReason: "MANUAL" } },
      { organizationId: org.id, userId: interviewer2.id, caseId: case4.id, eventType: "MEETING_STARTED", details: {} },
      { organizationId: org.id, userId: interviewer2.id, caseId: case4.id, eventType: "MEETING_ENDED", details: { duration: 4500, endReason: "MANUAL" } },
      { organizationId: org.id, userId: admin.id, caseId: case4.id, eventType: "CASE_CLOSED", details: { conclusion: "不正確認・処分実施" } },
      { organizationId: org.id, userId: admin.id, eventType: "USER_LOGIN", details: { ip: "192.168.1.100" } },
      { organizationId: org.id, userId: interviewer.id, eventType: "USER_LOGIN", details: { ip: "192.168.1.101" } },
    ],
  });

  console.log("Dummy data created successfully!");
  console.log(`  - 5 cases created`);
  console.log(`  - 4 users (admin, interviewer×2, operator)`);
  console.log(`  - 2 meetings with transcripts`);
  console.log(`  - Risk items, pre-chats, audit logs included`);
  console.log("");
  console.log("Login credentials:");
  console.log("  admin@demo.com / admin123");
  console.log("  interviewer@demo.com / interviewer123");
  console.log("  interviewer2@demo.com / interviewer456");
  console.log("  operator@demo.com / operator123");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
