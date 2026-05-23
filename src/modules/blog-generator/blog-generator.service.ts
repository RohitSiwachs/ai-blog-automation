// ============================================================
// Blog Generator Service
// Uses Google Gemini AI to generate SEO-optimized blog content
// in Markdown format, compatible with blog.innovaft.com Strapi.
// ============================================================

import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import slugify from 'slugify';
import { buildBlogPrompt, buildHumanizerPrompt } from './prompts';

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
  private geminiModel: string;
  private nvidiaApiKey: string;
  private nvidiaModel: string;
  private nvidiaEndpoint: string;
  private aiProvider: string;
  private readonly FALLBACK_NVIDIA_MODEL = 'meta/llama-3.1-8b-instruct';

  constructor(
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    // Gemini Config
    const geminiApiKey = this.configService.get<string>('gemini.apiKey')!;
    this.geminiModel = this.configService.get<string>('gemini.model')!;
    this.genAI = new GoogleGenerativeAI(geminiApiKey);

    // NVIDIA Config
    this.nvidiaApiKey = this.configService.get<string>('nvidia.apiKey')!;
    this.nvidiaModel = this.configService.get<string>('nvidia.model')!;
    this.nvidiaEndpoint = this.configService.get<string>('nvidia.chatEndpoint')!;

    // Provider choice
    this.aiProvider = this.configService.get<string>('aiProvider') || 'gemini';
  }

  /**
   * Generate a complete SEO-optimized blog post for the given topic.
   */
  async generateBlog(
    title: string,
    keywords: string[],
    categories: string[],
  ): Promise<GeneratedBlog> {
    this.logger.info(`BlogGenerator: Generating content for "${title}" using ${this.aiProvider.toUpperCase()}...`);

    const prompt = buildBlogPrompt(title, keywords, categories);
    let rawText: string;

    // Try primary provider first, then fallback to the other
    const providers = this.aiProvider === 'nvidia'
      ? ['nvidia', 'gemini'] as const
      : ['gemini', 'nvidia'] as const;

    let lastError: Error | null = null;

    for (const provider of providers) {
      try {
        this.logger.info(`BlogGenerator: Trying ${provider.toUpperCase()}...`);

        if (provider === 'nvidia') {
          rawText = await this.generateWithNvidia(prompt);
        } else {
          rawText = await this.generateWithGemini(prompt);
        }

        this.logger.info(`BlogGenerator: ${provider.toUpperCase()} response received, parsing...`);

        const parsed = this.parseAIResponse(rawText!);

        const slug = slugify(parsed.seoTitle, {
          lower: true,
          strict: true,
          trim: true,
        });

        // Step 1: Humanize content using second-pass LLM
        const humanizedContent = await this.humanizeContent(parsed.content);

        // Step 2: Enrich inline Pollinations images inside the humanized content
        const finalContent = await this.enrichInlineImages(humanizedContent);

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
          content: finalContent,
        };

        this.logger.info(
          `BlogGenerator: Content generated successfully — "${blog.seoTitle}" (${this.countWords(blog.content)} words)`,
        );

        return blog;
      } catch (error) {
        lastError = error;
        this.logger.error(`BlogGenerator: ${provider.toUpperCase()} failed — ${error.message}`);

        if (provider !== providers[providers.length - 1]) {
          this.logger.warn(`BlogGenerator: Falling back to ${providers[providers.indexOf(provider) + 1].toUpperCase()}...`);
        }
      }
    }

    throw new Error(`Blog generation failed (all providers exhausted): ${lastError?.message}`);
  }

  /**
   * Calls Google Gemini API
   */
  private async generateWithGemini(prompt: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: this.geminiModel });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  /**
   * Calls NVIDIA NIM API (Gemma/Llama)
   */
  private async generateWithNvidia(prompt: string): Promise<string> {
    // Models to try: primary model first, then fallback
    const modelsToTry = [this.nvidiaModel];
    if (this.nvidiaModel !== this.FALLBACK_NVIDIA_MODEL) {
      modelsToTry.push(this.FALLBACK_NVIDIA_MODEL);
    }

    let lastError: any;

    for (const model of modelsToTry) {
      const payload: any = {
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
        temperature: 0.7,
        top_p: 0.9,
        stream: false,
      };

      // Gemma 4 requires thinking kwargs
      if (model.includes('gemma-4')) {
        payload.chat_template_kwargs = { enable_thinking: true };
      }

      const maxRetries = 2;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          this.logger.info(`BlogGenerator: NVIDIA requesting model "${model}" (attempt ${attempt})...`);
          const response = await axios.post(this.nvidiaEndpoint, payload, {
            headers: {
              Authorization: `Bearer ${this.nvidiaApiKey}`,
              Accept: 'application/json',
            },
            timeout: 600000,
          });

          this.logger.info(`BlogGenerator: NVIDIA model "${model}" succeeded.`);
          return response.data.choices[0].message.content;
        } catch (error) {
          lastError = error;
          const statusCode = error.response?.status;
          const detail = error.response?.data?.detail || '';

          // If model is DEGRADED (400) or unavailable, skip to fallback model immediately
          if (statusCode === 400 && (detail.includes('DEGRADED') || detail.includes('cannot be invoked'))) {
            this.logger.warn(`BlogGenerator: NVIDIA model "${model}" is DEGRADED. Trying fallback model...`);
            break; // Break inner retry loop, try next model
          }

          if (statusCode === 504 && attempt < maxRetries) {
            this.logger.warn(`BlogGenerator: NVIDIA 504 Timeout (Attempt ${attempt}/${maxRetries}). Retrying in 5s...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            continue;
          }

          // For other errors on last retry, break to try next model
          if (attempt >= maxRetries) {
            this.logger.warn(`BlogGenerator: NVIDIA model "${model}" failed after ${maxRetries} attempts. Trying next model...`);
            break;
          }
        }
      }
    }

    throw lastError;
  }

  /**
   * Parse AI's JSON response. Handles markdown fences if present.
   */
  private parseAIResponse(text: string): {
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
    
    // Match markdown image syntax with pollinations URLs (with or without "/prompt/")
    const pollinationsRegex = /!\[([^\]]*)\]\((https?:\/\/(?:[a-zA-Z0-9-]+\.)?pollinations\.ai\/(?:prompt\/)?[^\?\)]+)(\?[^\)]+)?\)/g;
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
      
      const uniqueSeed = Math.floor(Math.random() * 90000000) + 10000000;
      
      // Flux is high quality and free, perfect for multiple inline images
      const finalUrl = `https://image.pollinations.ai/prompt/${pathPart}?prompt=${encodeURIComponent(smartPrompt)}&width=1024&height=1024&nologo=true&seed=${uniqueSeed}&model=flux`;
      
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
    const promptRequest = `You are a world-class visual designer and image prompt engineer for premium tech websites (like Stripe and Apple).
      Create a detailed, beautiful, and ultra-high-quality image generation prompt for an inline blog illustration.
      Context/Intent: "${intent}".
      
      VISUAL RULES:
      1. STYLE: Choose either:
         a) A premium, cozy minimalist tech workspace (e.g. close-up photo of a sleek open laptop, warm ambient lights, a ceramic cup, a small green plant, shot on 85mm lens, high depth of field, warm cozy tone).
         b) A stunning modern 3D abstract illustration (e.g. glowing glassmorphic shapes, translucent frosted glass spheres, glowing wireframe lines, neon gradient lighting, deep navy or slate background, clean and professional).
      2. BAN: Absolutely NO people, NO faces, NO hands (avoids deformed limbs/weird smiles), NO text, NO labels, NO generic stock-photos.
      3. START: Begin the prompt directly with a description (e.g., "A cinematic, shallow depth-of-field close-up of..." or "A high-end 3D render of abstract glassmorphism...").
      
      Output ONLY the final image generation prompt (50-70 words). Do not explain or write anything else.`;

    // Try Gemini first
    try {
      const model = this.genAI.getGenerativeModel({ model: this.geminiModel });
      const result = await model.generateContent(promptRequest);
      return result.response.text().trim();
    } catch (geminiErr) {
      this.logger.warn(`BlogGenerator: Gemini inline prompt failed (${geminiErr.message}). Trying NVIDIA Llama...`);
    }

    // Fallback: NVIDIA Llama
    try {
      if (this.nvidiaApiKey) {
        const response = await axios.post(this.nvidiaEndpoint, {
          model: this.FALLBACK_NVIDIA_MODEL,
          messages: [{ role: 'user', content: promptRequest }],
          max_tokens: 200,
          temperature: 0.7,
          stream: false,
        }, {
          headers: {
            'Authorization': `Bearer ${this.nvidiaApiKey}`,
            'Accept': 'application/json',
          },
          timeout: 30000,
        });
        return response.data.choices[0].message.content.trim();
      }
    } catch (nvidiaErr) {
      this.logger.warn(`BlogGenerator: NVIDIA Llama inline prompt also failed: ${nvidiaErr.message}`);
    }

    // Final fallback: basic prompt
    return `${intent}. photorealistic, professional lighting, cinematic`;
  }

  /**
   * Humanizes the generated blog content using a second-pass LLM prompt.
   * Focuses on natural sentence structure, burstiness, natural transitions,
   * and human-like flow.
   */
  async humanizeContent(content: string): Promise<string> {
    this.logger.info('BlogGenerator: Humanizing text using second-pass LLM...');
    const prompt = buildHumanizerPrompt(content);
    
    try {
      let humanized: string;
      if (this.aiProvider === 'nvidia') {
        humanized = await this.generateWithNvidia(prompt);
      } else {
        humanized = await this.generateWithGemini(prompt);
      }
      
      this.logger.info('BlogGenerator: Second-pass humanization complete.');
      return humanized.trim();
    } catch (e) {
      this.logger.error(`BlogGenerator: LLM Humanization failed: ${e.message}. Falling back to original content.`);
      return content;
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
