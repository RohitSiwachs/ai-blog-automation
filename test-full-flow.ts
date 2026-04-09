
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { BlogGeneratorService } from './src/modules/blog-generator/blog-generator.service';
import { ImageGeneratorService } from './src/modules/image-generator/image-generator.service';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  console.log('--- Starting Full Blog Generation Flow (Local Test) ---');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const blogGenerator = app.get(BlogGeneratorService);
  const imageGenerator = app.get(ImageGeneratorService);

  const topic = "The Power of NVIDIA NIM: A New Era of AI Image Generation";
  const keywords = ["NVIDIA NIM", "AI Automation", "Stable Diffusion 3", "Tech Innovation"];
  const categories = ["Technology", "AI", "Development"];

  try {
    // 1. Generate Blog Content
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

    // 2. Generate Banner Image
    console.log(`\n[2/2] Generating NVIDIA NIM Banner...`);
    const imageBuffer = await imageGenerator.generateBannerImage(topic);
    
    fs.writeFileSync('test-blog-banner.jpg', imageBuffer);
    console.log('SUCCESS: Banner saved to test-blog-banner.jpg');

    console.log('\n--- Full Flow Completed Successfully! ---');
    console.log('Files created:');
    console.log('- test-blog-output.md');
    console.log('- test-blog-banner.jpg');

  } catch (error: any) {
    console.error('\nFAILED: Generation flow error:', error.message);
  } finally {
    await app.close();
  }
}

bootstrap().catch(console.error);
