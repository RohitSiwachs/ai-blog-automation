// ============================================================
// Blog Generator Service
// Uses Google Gemini AI to generate SEO-optimized blog content
// in Markdown format, compatible with blog.innovaft.com Strapi.
// ============================================================

import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { GoogleGenerativeAI } from '@google/generative-ai';
import slugify from 'slugify';
import { buildBlogPrompt } from './prompts';

/** Represents a fully generated blog post ready for publishing */
export interface GeneratedBlog {
  seoTitle: string; // SEO-optimized title (max 60 chars)
  metaDescription: string; // 150-160 char meta description
  ogTitle: string; // Open Graph title
  ogDescription: string; // Open Graph description
  metaKeywords: string; // Comma-separated keywords
  description: string; // Short excerpt for blog listing
  tags: string[]; // 2-4 short topic tags
  slug: string; // URL-friendly slug from seoTitle
  content: string; // Markdown content for Strapi blocks
}

@Injectable()
export class BlogGeneratorService {
  private genAI: GoogleGenerativeAI;
  private modelName: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    const apiKey = this.configService.get<string>('gemini.apiKey')!;
    this.modelName = this.configService.get<string>('gemini.model')!;
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Generate a complete SEO-optimized blog post for the given topic.
   *
   * @param title - The blog topic/title
   * @param keywords - Target SEO keywords to incorporate
   * @returns Parsed blog with all fields needed for Strapi Article
   */
  async generateBlog(
    title: string,
    keywords: string[],
  ): Promise<GeneratedBlog> {
    this.logger.info(`BlogGenerator: Generating content for "${title}"...`);

    const prompt = buildBlogPrompt(title, keywords);
    const model = this.genAI.getGenerativeModel({ model: this.modelName });

    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      this.logger.info('BlogGenerator: Gemini response received, parsing...');

      const parsed = this.parseGeminiResponse(text);

      const slug = slugify(parsed.seoTitle, {
        lower: true,
        strict: true,
        trim: true,
      });

      const blog: GeneratedBlog = {
        seoTitle: parsed.seoTitle,
        metaDescription: this.truncate(parsed.metaDescription, 160),
        ogTitle: parsed.ogTitle || parsed.seoTitle,
        ogDescription: parsed.ogDescription || parsed.metaDescription,
        metaKeywords: parsed.metaKeywords || keywords.join(', '),
        description: this.truncate(
          parsed.description || parsed.metaDescription,
          180,
        ),
        tags: parsed.tags || [],
        slug,
        content: parsed.content,
      };

      this.logger.info(
        `BlogGenerator: Content generated successfully — "${blog.seoTitle}" (${this.countWords(blog.content)} words)`,
      );

      return blog;
    } catch (error) {
      this.logger.error(`BlogGenerator: Gemini API failed — ${error.message}`);
      throw new Error(`Blog generation failed: ${error.message}`);
    }
  }

  /**
   * Parse Gemini's JSON response. Handles markdown fences if present.
   */
  private parseGeminiResponse(text: string): {
    seoTitle: string;
    metaDescription: string;
    ogTitle: string;
    ogDescription: string;
    metaKeywords: string;
    description: string;
    tags: string[];
    content: string;
  } {
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();

    try {
      const parsed = JSON.parse(cleaned);
      if (!parsed.seoTitle || !parsed.content) {
        throw new Error('Missing required fields in Gemini response');
      }
      return parsed;
    } catch (parseError) {
      this.logger.warn(
        `BlogGenerator: JSON parse failed, attempting fallback extraction...`,
      );

      // Fallback: manually extract fields
      const titleMatch = cleaned.match(/"seoTitle"\s*:\s*"([^"]+)"/);
      const metaMatch = cleaned.match(/"metaDescription"\s*:\s*"([^"]+)"/);
      const contentMatch = cleaned.match(/"content"\s*:\s*"([\s\S]+?)"\s*[,}]/);

      if (titleMatch && contentMatch) {
        return {
          seoTitle: titleMatch[1],
          metaDescription: metaMatch ? metaMatch[1] : '',
          ogTitle: titleMatch[1],
          ogDescription: metaMatch ? metaMatch[1] : '',
          metaKeywords: '',
          description: metaMatch ? metaMatch[1] : '',
          tags: [],
          content: contentMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
        };
      }

      throw new Error(`Failed to parse Gemini response: ${parseError.message}`);
    }
  }

  /** Truncate a string to a max length at a word boundary */
  private truncate(text: string, maxLen: number): string {
    if (!text || text.length <= maxLen) return text || '';
    const truncated = text.substring(0, maxLen - 3);
    const lastSpace = truncated.lastIndexOf(' ');
    return truncated.substring(0, lastSpace) + '...';
  }

  /** Count words in Markdown text */
  private countWords(markdown: string): number {
    const text = markdown
      .replace(/[#*`\[\]]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return text.split(' ').filter((w) => w.length > 0).length;
  }
}
