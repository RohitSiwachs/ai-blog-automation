"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./src/app.module");
const blog_generator_service_1 = require("./src/modules/blog-generator/blog-generator.service");
const image_generator_service_1 = require("./src/modules/image-generator/image-generator.service");
const fs = __importStar(require("fs"));
async function bootstrap() {
    console.log('--- Starting Full Blog Generation Flow (Local Test) ---');
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const blogGenerator = app.get(blog_generator_service_1.BlogGeneratorService);
    const imageGenerator = app.get(image_generator_service_1.ImageGeneratorService);
    const topic = "The Power of NVIDIA NIM: A New Era of AI Image Generation";
    const keywords = ["NVIDIA NIM", "AI Automation", "Stable Diffusion 3", "Tech Innovation"];
    const categories = ["Technology", "AI", "Development"];
    try {
        console.log(`\n[1/2] Generating Blog Content for: "${topic}"...`);
        const blog = await blogGenerator.generateBlog(topic, keywords, categories);
        const mdOutput = `
# ${blog.seoTitle}

**Meta Description:** ${blog.metaDescription}
**Keywords:** ${blog.metaKeywords}
**Category:** ${blog.category}
**Tags:** ${blog.tags.join(', ')}

---

${blog.content}
    `.trim();
        fs.writeFileSync('test-blog-output.md', mdOutput);
        console.log('SUCCESS: Content saved to test-blog-output.md');
        console.log(`\n[2/2] Generating NVIDIA NIM Banner...`);
        const imageBuffer = await imageGenerator.generateBannerImage(topic);
        fs.writeFileSync('test-blog-banner.jpg', imageBuffer);
        console.log('SUCCESS: Banner saved to test-blog-banner.jpg');
        console.log('\n--- Full Flow Completed Successfully! ---');
        console.log('Files created:');
        console.log('- test-blog-output.md');
        console.log('- test-blog-banner.jpg');
    }
    catch (error) {
        console.error('\nFAILED: Generation flow error:', error.message);
    }
    finally {
        await app.close();
    }
}
bootstrap().catch(console.error);
//# sourceMappingURL=test-full-flow.js.map