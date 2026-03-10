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
  category: string; // Selected category from list
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
   * @param categories - List of available Strapi categories
   * @returns Parsed blog with all fields needed for Strapi Article
   */
  async generateBlog(
    title: string,
    keywords: string[],
    categories: string[],
  ): Promise<GeneratedBlog> {
    this.logger.info(`BlogGenerator: Generating content for "${title}"...`);

    const prompt = buildBlogPrompt(title, keywords, categories);
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
        category: parsed.category || categories[0] || 'Development',
        tags: parsed.tags || [],
        slug,
        content: this.randomizeInlineImages(parsed.content),
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
    category: string;
    tags: string[];
    content: string;
  } {
    let cleaned = text.trim();
    
    // Robust JSON extraction: Find the first '{' and the last '}'
    const startIdx = cleaned.indexOf('{');
    const endIdx = cleaned.lastIndexOf('}');
    
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      cleaned = cleaned.substring(startIdx, endIdx + 1);
    } else {
      // Stripping fences if the bracket search failed for some reason
      if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
      else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
      if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
      cleaned = cleaned.trim();
    }

    try {
      const parsed = JSON.parse(cleaned);
      if (!parsed.seoTitle || !parsed.content) {
        throw new Error('Missing required fields in Gemini response');
      }
      return parsed;
    } catch (parseError) {
      this.logger.warn(
        `BlogGenerator: JSON parse failed, attempting super-robust brute-force extraction...`,
      );

      // Desperate extraction: Find values between keys more loosely
      const extractFieldLoose = (key: string): string => {
        // Option 1: Standard quoted match
        const standardRegex = new RegExp(`"${key}"\\s*:\\s*"([\\s\\S]*?)"(?=\\s*[,}]|\\s*$)`, 'i');
        const match = cleaned.match(standardRegex);
        if (match) return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
        
        // Option 2: Even looser — look for the key followed by any text until the NEXT key or end
        const keys = ['seoTitle', 'metaDescription', 'ogTitle', 'ogDescription', 'metaKeywords', 'description', 'category', 'tags', 'content'];
        const otherKeys = keys.filter(k => k !== key).join('|');
        const looseRegex = new RegExp(`"${key}"\\s*:\\s*"([\\s\\S]*?)(?="\\s*(?:${otherKeys})|\\s*}$)`, 'i');
        const looseMatch = cleaned.match(looseRegex);
        if (looseMatch) return looseMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
        
        return '';
      };

      const seoTitle = extractFieldLoose('seoTitle');
      const content = extractFieldLoose('content');

      if (seoTitle && content) {
        this.logger.info(`BlogGenerator: Brute-force succeeded for "${seoTitle}"`);
        
        // Extract tags from array format "tags": ["Tag1", "Tag2"]
        const tagsMatch = cleaned.match(/"tags"\s*:\s*\[([^\]]+)\]/);
        let extractedTags: string[] = [];
        if (tagsMatch) {
          extractedTags = tagsMatch[1]
            .split(',')
            .map(t => t.replace(/"/g, '').trim())
            .filter(t => t.length > 0);
        }

        return {
          seoTitle,
          metaDescription: extractFieldLoose('metaDescription'),
          ogTitle: extractFieldLoose('ogTitle') || seoTitle,
          ogDescription: extractFieldLoose('ogDescription'),
          metaKeywords: extractFieldLoose('metaKeywords'),
          description: extractFieldLoose('description'),
          category: extractFieldLoose('category'),
          tags: extractedTags,
          content,
        };
      }

      throw new Error(`Super-robust parsing also failed. Please check AI logs for formatting issues.`);
    }
  }

  /** Truncate a string to a max length at a word boundary */
  private truncate(text: string, maxLen: number): string {
    if (!text || text.length <= maxLen) return text || '';
    const truncated = text.substring(0, maxLen - 3);
    const lastSpace = truncated.lastIndexOf(' ');
    return truncated.substring(0, lastSpace) + '...';
  }

  /**
   * Scans markdown for image URLs and replaces/adds a unique seed to each one.
   * This ensures no two images are identical in the same blog post.
   */
  private randomizeInlineImages(content: string): string {
    this.logger.info('BlogGenerator: Finalizing and randomizing seeds for inline images...');
    
    // Match markdown image syntax with pollinations URLs
    const pollinationsRegex = /!\[([^\]]*)\]\((https?:\/\/(?:image\.)?pollinations\.ai\/prompt\/[^\?\)]+)(\?[^\)]+)?\)/g;
    
    const count = (content.match(pollinationsRegex) || []).length;
    this.logger.info(`BlogGenerator: Found ${count} Pollinations images in content`);

    return content.replace(pollinationsRegex, (match, alt, rawBaseUrl, query) => {
      // Extract the original prompt part from the path
      const promptMatch = rawBaseUrl.match(/\/prompt\/([^\/]+)/);
      let promptText = promptMatch ? promptMatch[1] : 'tech-innovation';
      
      // Clean and shorten the path part (max 5 words)
      const pathPart = promptText.toLowerCase()
        .replace(/[^a-z0-9 ]/g, ' ')
        .trim()
        .split(/\s+/)
        .slice(0, 5)
        .join('-');
      
      const secureBaseUrl = `https://image.pollinations.ai/prompt/${pathPart || 'blog-image'}`;
      
      // Style params: photorealistic focus
      const styleParams = 'photorealistic,professional-photography,real-life-scene,8k,cinematic-lighting';
      
      // Create a truly random 8-digit seed
      const uniqueSeed = Math.floor(Math.random() * 90000000) + 10000000;
      
      // Clean query string with safety width/height
      let newQuery = query || '?width=1024&height=1024&nologo=true';
      
      // Inject seed and swap to turbo model for speed/reliability
      if (newQuery.includes('seed=')) {
        newQuery = newQuery.replace(/seed=[^&]*/, `seed=${uniqueSeed}`);
      } else {
        newQuery += (newQuery.includes('?') ? '&' : '?') + `seed=${uniqueSeed}`;
      }
      
      // Force turbo model and style params
      newQuery = newQuery.replace(/model=[^&]*/, 'model=turbo');
      if (!newQuery.includes('model=')) newQuery += '&model=turbo';
      if (!newQuery.includes('prompt=')) newQuery += `&prompt=${styleParams}`;

      const finalUrl = `${secureBaseUrl}${newQuery.replace(/\?&/g, '?')}`;
      this.logger.info(`BlogGenerator: Standardized URL for "${alt}": ${finalUrl}`);
      
      return `![${alt}](${finalUrl})`;
    });
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
