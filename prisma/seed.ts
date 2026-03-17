import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/interview_support";
const adapter = new PrismaPg({ connectionString });

const prisma = new PrismaClient({ adapter });

async function main() {
  // Create demo organization
  const org = await prisma.organization.upsert({
    where: { id: "demo-org-001" },
    update: {},
    create: {
      id: "demo-org-001",
      name: "デモ法人株式会社",
    },
  });

  // Create admin user
  const adminPassword = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: {},
    create: {
      organizationId: org.id,
      role: "ADMIN",
      name: "管理者 太郎",
      email: "admin@demo.com",
      passwordHash: adminPassword,
      caseViewScope: "all",
    },
  });

  // Create interviewer user
  const interviewerPassword = await bcrypt.hash("interviewer123", 10);
  await prisma.user.upsert({
    where: { email: "interviewer@demo.com" },
    update: {},
    create: {
      organizationId: org.id,
      role: "INTERVIEWER",
      name: "面談担当 花子",
      email: "interviewer@demo.com",
      passwordHash: interviewerPassword,
      caseViewScope: "assigned",
    },
  });

  // Create operator user
  const operatorPassword = await bcrypt.hash("operator123", 10);
  await prisma.user.upsert({
    where: { email: "operator@demo.com" },
    update: {},
    create: {
      organizationId: org.id,
      role: "OPERATOR",
      name: "運営 次郎",
      email: "operator@demo.com",
      passwordHash: operatorPassword,
    },
  });

  // Create templates
  for (const useCase of ["VOLUNTARY_RETIREMENT", "AUDIT"] as const) {
    await prisma.template.upsert({
      where: {
        organizationId_useCase: {
          organizationId: org.id,
          useCase,
        },
      },
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
        summaryPrompt: "以下の事前チャット内容を要約してください。重要なポイントを箇条書きで示してください。",
        scriptPrompt: "以下の情報をもとに、面談用の台本を生成してください。",
        riskDetectionPrompt: "以下の発言にリスク（脅し、退職強要、訴訟に発展しうる表現など）がないか判定してください。",
        rephrasingPrompt: "以下の発言を、より適切な表現に言い換えてください。",
        defaultTone: "POLITE",
      },
    });
  }

  console.log("Seed data created successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
