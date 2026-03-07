import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { StrapiService } from './src/modules/strapi-service/strapi.service';
import { ImageGeneratorService } from './src/modules/image-generator/image-generator.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const strapiService = app.get(StrapiService);
  const imageGenerator = app.get(ImageGeneratorService);

  console.log('Generating image...');
  const imageBuffer = await imageGenerator.generateBannerImage('Testing Formats and Slug');
  
  console.log('Uploading image...');
  const mediaId = await strapiService.uploadImage(imageBuffer, 'test-formats-slug.jpg');
  console.log('Uploaded media ID:', mediaId);

  console.log('Creating post...');
  const articleId = await strapiService.createBlogPost({
    title: 'Testing Formats and Slug 2026',
    description: 'This is a test description specifically for checking the slug mapping and medium size generation.',
    slug: 'testing-formats-and-slug-2026',
    content: '## Hello World\nThis is the markdown content block.',
    metaTitle: 'Testing Formats and Slug 2026',
    metaDescription: 'A brief 150 char meta description here for testing.',
    ogTitle: 'Testing Formats and Slug 2026',
    ogDescription: 'A brief 150 char meta description here for testing.',
    metaKeywords: 'test, web, frontend',
    keywords: ['test', 'web', 'frontend'],
    tags: ['Testing', 'Debugging'],
    cover: mediaId,
    categoryId: 1,
    authorId: 2,
  });

  console.log('Post created with ID:', articleId);
  await app.close();
}

bootstrap().catch(console.error);
