import { defineConfig } from "prisma/config";

const dbUrl = (process.env.DATABASE_URL || "").trim();

if (!dbUrl) {
  console.error("❌ CRITICAL: DATABASE_URL is empty in prisma.config.ts");
} else {
  console.log(`✅ Prisma Config: DATABASE_URL detected (Length: ${dbUrl.length})`);
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: dbUrl,
  },
});
