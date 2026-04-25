"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("prisma/config");
const dbUrl = (process.env.DATABASE_URL || "").trim();
if (!dbUrl) {
    console.error("❌ CRITICAL: DATABASE_URL is empty in prisma.config.ts");
}
else {
    console.log(`✅ Prisma Config: DATABASE_URL detected (Length: ${dbUrl.length})`);
}
exports.default = (0, config_1.defineConfig)({
    schema: "prisma/schema.prisma",
    migrations: {
        path: "prisma/migrations",
    },
    datasource: {
        url: dbUrl,
    },
});
//# sourceMappingURL=prisma.config.js.map