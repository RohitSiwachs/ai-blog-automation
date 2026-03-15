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
        content: await this.enrichInlineImages(parsed.content),
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
   * Scans markdown for image URLs and uses Gemini to engineer professional prompts for them.
   * This ensures inline images match the banner quality (human subjects, realistic).
   */
  private async enrichInlineImages(content: string): Promise<string> {
    this.logger.info('BlogGenerator: Finalizing and enriching inline images with Gemini...');
    
    // Match markdown image syntax with pollinations URLs
    const pollinationsRegex = /!\[([^\]]*)\]\((https?:\/\/(?:image\.)?pollinations\.ai\/prompt\/[^\?\)]+)(\?[^\)]+)?\)/g;
    const matches = Array.from(content.matchAll(pollinationsRegex));
    
    if (matches.length === 0) {
      this.logger.info('BlogGenerator: No Pollinations images found in content.');
      return content;
    }

    this.logger.info(`BlogGenerator: Found ${matches.length} Pollinations images to enrich.`);

    let enrichedContent = content;
    for (const match of matches) {
      const [fullMatch, alt, rawBaseUrl] = match;
      
      // Extract original intent from URL or alt text
      const promptMatch = rawBaseUrl.match(/\/prompt\/([^\/]+)/);
      const originalIntent = promptMatch 
        ? promptMatch[1].replace(/-/g, ' ') 
        : (alt || 'professional technology');

      // 1. Generate a "Pro" prompt using Gemini
      this.logger.info(`BlogGenerator: Engineering prompt for inline image: "${originalIntent.substring(0, 30)}..."`);
      const smartPrompt = await this.generateInlineSmartPrompt(originalIntent);
      
      // 2. Standardize path and build forced subject URL
      const pathPart = originalIntent.toLowerCase()
        .replace(/[^a-z0-9 ]/g, ' ')
        .trim()
        .split(/\s+/)
        .slice(0, 5)
        .join('-');
      
      const forcedSubject = "Realistic photo of a professional person, ";
      const uniqueSeed = Math.floor(Math.random() * 90000000) + 10000000;
      
      // Flux is high quality and free, perfect for multiple inline images
      const finalUrl = `https://image.pollinations.ai/prompt/${pathPart}?prompt=${encodeURIComponent(forcedSubject + smartPrompt)}&width=1024&height=1024&nologo=true&seed=${uniqueSeed}&model=flux`;
      
      this.logger.info(`BlogGenerator: Inline image enriched for "${alt}"`);
      
      // Replace the specific match in the content
      enrichedContent = enrichedContent.replace(fullMatch, `![${alt}](${finalUrl})`);
    }

    return enrichedContent;
  }

  /**
   * Helper to generate a professional image prompt for inline images.
   */
  private async generateInlineSmartPrompt(intent: string): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `You are a professional image prompt engineer. 
      Create a detailed, ultra-realistic prompt for a blog image.
      Context: "${intent}".
      
      MANDATORY Rules:
      1. SUBJECT: Include a person (e.g. an Indian student, an IT professional, or a freelancer) interacting with technology or in a modern setting.
      2. LOOK: Cinematic photography, realistic skin textures, high resolution.
      3. BAN: No text, no logos, no fake-looking 3D renders.
      4. START: Begin with "A high-resolution photo of [subject]..."
      
      Output ONLY the description (50-70 words).`;

      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (e) {
      this.logger.warn(`BlogGenerator: Inline prompt engineering failed: ${e.message}`);
      return `${intent}. photorealistic, professional lighting, cinematic`;
    }
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
