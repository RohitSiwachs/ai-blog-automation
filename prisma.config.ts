import { defineConfig } from "prisma/config";

const dbUrl = process.env.DATABASE_URL?.trim();
if (!dbUrl) {
  console.error("❌ DATABASE_URL is missing in prisma.config.ts!");
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
