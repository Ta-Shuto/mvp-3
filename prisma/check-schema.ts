import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";

const connectionString = process.env.DATABASE_URL || "";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const columns: any[] = await prisma.$queryRawUnsafe(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position"
  );
  console.log("Users table columns:");
  for (const col of columns) {
    console.log(`  ${col.column_name} (${col.data_type})`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
