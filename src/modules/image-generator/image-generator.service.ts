// ============================================================
// Image Generator Service
// Creates branded blog banner images using node-canvas.
// Produces 1200x630 images with gradient background,
// title overlay, and brand watermark.
// ============================================================

import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { createCanvas, registerFont, loadImage } from 'canvas';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Image dimensions (Open Graph standard)
const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;

@Injectable()
export class ImageGeneratorService {
  private brandName: string;
  private openai: OpenAI;
  private genAI: GoogleGenerativeAI;
  private nvidiaApiKey: string;
  private nvidiaEndpoint: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    this.brandName = this.configService.get<string>('brand.name') || 'TechBlog';
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
    this.genAI = new GoogleGenerativeAI(
      this.configService.get<string>('gemini.apiKey') || '',
    );
    this.nvidiaApiKey = this.configService.get<string>('nvidia.imageApiKey') || '';
    this.nvidiaEndpoint = this.configService.get<string>('nvidia.imageEndpoint') || '';

    // Attempt to register a custom font if available
    this.tryRegisterFont();
  }

  /**
   * Generate a branded blog banner image as a PNG buffer.
   *
   * @param title - Blog post title to render on the image
   * @returns JPEG image as a Buffer
   */
  async generateBannerImage(title: string): Promise<Buffer> {
    this.logger.info(`ImageGenerator: Creating professional banner for "${title}"...`);

    try {
      const canvas = createCanvas(IMAGE_WIDTH, IMAGE_HEIGHT);
      const ctx = canvas.getContext('2d');

      // --- 1. Draw creative background using AI ---
      await this.drawDynamicBackground(ctx, title);

      // --- 2. Add professional text overlay ---
      // Semi-transparent dark gradient at the bottom for readability
      const gradient = ctx.createLinearGradient(0, IMAGE_HEIGHT * 0.5, 0, IMAGE_HEIGHT);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, IMAGE_HEIGHT * 0.5, IMAGE_WIDTH, IMAGE_HEIGHT * 0.5);

      // Title Text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 50px Inter';
      ctx.textAlign = 'left';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 10;

      const lines = this.wrapText(ctx, title.toUpperCase(), IMAGE_WIDTH - 100, 3);
      const startY = IMAGE_HEIGHT - (lines.length * 60) - 60;
      
      lines.forEach((line, i) => {
        ctx.fillText(line, 50, startY + (i * 65));
      });

      // Brand Watermark
      ctx.font = 'bold 24px Inter';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillText(this.brandName.toUpperCase(), 50, IMAGE_HEIGHT - 30);

      // Convert canvas to JPEG buffer
      const buffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });

      this.logger.info(
        `ImageGenerator: Banner created successfully (${(buffer.length / 1024).toFixed(1)} KB)`,
      );

      return buffer;
    } catch (error) {
      this.logger.error(
        `ImageGenerator: Failed to create banner — ${error.message}`,
      );
      throw new Error(`Image generation failed: ${error.message}`);
    }
  }  /**
   * Fetch a professional background using a tiered approach.
   * NVIDIA NIM SD3 (Tier 1) -> OpenAI DALL-E 3 (Tier 2) -> Pollinations Flux (Tier 3) -> Pollinations Turbo (Tier 4).
   */
  private async drawDynamicBackground(ctx: any, title: string): Promise<void> {
    const smartPrompt = await this.generateSmartPrompt(title);

    // Stage 1: NVIDIA NIM Stable Diffusion 3 Medium (New High Quality Free Tier)
    if (this.nvidiaApiKey) {
      try {
        this.logger.info(`ImageGenerator: Tier 1 - Requesting NVIDIA NIM for "${title}"...`);
        const imageBuffer = await this.generateNvidiaImage(smartPrompt);
        if (imageBuffer) {
          const bgImage = await loadImage(imageBuffer);
          const scale = Math.max(IMAGE_WIDTH / bgImage.width, IMAGE_HEIGHT / bgImage.height);
          const x = (IMAGE_WIDTH / 2) - (bgImage.width / 2) * scale;
          const y = (IMAGE_HEIGHT / 2) - (bgImage.height / 2) * scale;
          ctx.drawImage(bgImage, x, y, bgImage.width * scale, bgImage.height * scale);
          
          this.logger.info(`ImageGenerator: NVIDIA NIM success`);
          return;
        }
      } catch (nvidiaErr) {
        this.logger.warn(`ImageGenerator: Tier 1 (NVIDIA) failed (${nvidiaErr.message}). Moving to Tier 2...`);
      }
    }

    // Stage 2: OpenAI DALL-E 3
    try {
      this.logger.info(`ImageGenerator: Tier 2 - Requesting DALL-E 3 for "${title}"...`);
      const response = await this.openai.images.generate({
        model: "dall-e-3",
        prompt: `A professional, high-quality, photorealistic cinematic background for a blog post titled "${title}". Modern, minimalist, studio lighting. 8k, no text, no watermarks.`,
        n: 1,
        size: "1024x1024",
      });

      const imageUrl = response?.data?.[0]?.url;
      if (imageUrl) {
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
        const bgImage = await loadImage(Buffer.from(imageResponse.data));
        const scale = Math.max(IMAGE_WIDTH / bgImage.width, IMAGE_HEIGHT / bgImage.height);
        const x = (IMAGE_WIDTH / 2) - (bgImage.width / 2) * scale;
        const y = (IMAGE_HEIGHT / 2) - (bgImage.height / 2) * scale;
        ctx.drawImage(bgImage, x, y, bgImage.width * scale, bgImage.height * scale);
        
        this.logger.info(`ImageGenerator: DALL-E 3 success`);
        return;
      }
    } catch (dalleError) {
      this.logger.warn(`ImageGenerator: Tier 2 failed (${dalleError.message}). Moving to Tier 3 (Flux)...`);
    }

    // --- Prepare Metadata for Free Models ---
    const safeTitleId = title.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 30);

    // Stage 2: Pollinations Flux with Gemini Prompt (Highest quality free model)
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        this.logger.info(`ImageGenerator: Tier 2 - Requesting Flux (Attempt ${attempt})...`);
        const fluxUrl = `https://image.pollinations.ai/prompt/${safeTitleId}?prompt=${encodeURIComponent(smartPrompt)}&width=${IMAGE_WIDTH}&height=${IMAGE_HEIGHT}&nologo=true&seed=${Math.floor(Math.random() * 1000000)}&model=flux`;
        
        const response = await axios.get(fluxUrl, { responseType: 'arraybuffer', timeout: attempt === 1 ? 30000 : 50000 });
        
        if (Buffer.from(response.data).length > 20000) {
          const bgImage = await loadImage(Buffer.from(response.data));
          ctx.drawImage(bgImage, 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
          this.logger.info(`ImageGenerator: Flux success`);
          return;
        }
      } catch (fluxErr) {
        this.logger.warn(`ImageGenerator: Flux attempt ${attempt} failed: ${fluxErr.message}`);
        if (attempt === 1) await new Promise(r => setTimeout(r, 2000));
      }
    }

    // Stage 3: Pollinations Turbo with Gemini Prompt
    try {
      this.logger.info(`ImageGenerator: Tier 3 - Requesting Turbo...`);
      const turboUrl = `https://image.pollinations.ai/prompt/${safeTitleId}?prompt=${encodeURIComponent(smartPrompt)}&width=${IMAGE_WIDTH}&height=${IMAGE_HEIGHT}&nologo=true&seed=${Math.floor(Math.random() * 1000000)}&model=turbo`;
      
      const response = await axios.get(turboUrl, { responseType: 'arraybuffer', timeout: 20000 });
      
      if (Buffer.from(response.data).length > 15000) {
        const bgImage = await loadImage(Buffer.from(response.data));
        ctx.drawImage(bgImage, 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
        this.logger.info(`ImageGenerator: Turbo success`);
        return;
      }
    } catch (turboErr) {
      this.logger.warn(`ImageGenerator: Tier 3 failed.`);
    }

    // Stage 4: Static Curated Fallbacks (The "No Cat" Guarantee)
    const fallbacks = [
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200&h=630&auto=format&fit=crop', // Earth/Tech
      'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200&h=630&auto=format&fit=crop', // Circuit
      'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?q=80&w=1200&h=630&auto=format&fit=crop', // Data
      'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=1200&h=630&auto=format&fit=crop', // Security
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1200&h=630&auto=format&fit=crop', // Dashboard
      'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1200&h=630&auto=format&fit=crop', // Coding
      'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1200&h=630&auto=format&fit=crop', // Code
      'https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=1200&h=630&auto=format&fit=crop'  // Development
    ];
    
    const fallbackUrl = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    try {
      this.logger.info(`ImageGenerator: Tier 4 - Using Curated Fallback: ${fallbackUrl}`);
      const fbResponse = await axios.get(fallbackUrl, { responseType: 'arraybuffer', timeout: 15000 });
      const bgImage = await loadImage(Buffer.from(fbResponse.data));
      ctx.drawImage(bgImage, 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
      this.logger.info(`ImageGenerator: Curated static fallback success`);
      return;
    } catch (fbErr) {
      this.logger.error(`ImageGenerator: All image providers failed. Using branded gradient.`);
      const gradient = ctx.createLinearGradient(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
      gradient.addColorStop(0, '#0f172a');
      gradient.addColorStop(0.5, '#1e1b4b');
      gradient.addColorStop(1, '#0f172a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
    }
  }

  /**
   * Directly call NVIDIA NIM Image API.
   * Returns a Buffer containing the image data.
   */
  public async generateNvidiaImage(prompt: string): Promise<Buffer | null> {
    try {
      const response = await axios.post(
        this.nvidiaEndpoint,
        {
          prompt,
          seed: 0
        },
        {
          headers: {
            'Authorization': `Bearer ${this.nvidiaApiKey}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          timeout: 120000,
        }
      );

      const imageBase64 = response.data?.artifacts?.[0]?.base64 || response.data?.image;
      if (imageBase64) {
        return Buffer.from(imageBase64, 'base64');
      }
      
      this.logger.error('ImageGenerator: NVIDIA NIM returned no image data');
      return null;
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.response?.data || error.message;
      this.logger.error(`ImageGenerator: NVIDIA NIM API error — ${JSON.stringify(errorMsg)}`);
      throw new Error(`NVIDIA NIM failed: ${JSON.stringify(errorMsg)}`);
    }
  }

  /**
   * Use Gemini to generate a highly detailed, professional image prompt.
   * This allows free models like Flux to produce DALL-E 3 level quality.
   */
  private async generateSmartPrompt(title: string): Promise<string> {
    try {
      this.logger.info(`ImageGenerator: Using Gemini to engineer a professional prompt...`);
      const model = this.genAI.getGenerativeModel({ 
        model: this.configService.get<string>('gemini.model') || 'gemini-2.0-flash' 
      });
      
      const prompt = `You are a professional DALL-E 3 prompt engineer. 
      Create a highly detailed, professional, and visually stunning image generation prompt for a blog banner.
      The blog title is: "${title}".
      
      TONE & STYLE:
      1. Determine if the topic is HUMAN-CENTRIC (Management, Career, Lifestyle) or TECH-CENTRAL (AI, Hardware, Coding, Cloud).
      
      IF TECH-CENTRAL:
      - Focus on high-tech conceptual art, futuristic 3D renders, glowing circuitry, or abstract digital landscapes.
      - Use keywords: "Cybernetic", "Quantum glow", "Holographic interface", "8k octane render", "Cinematic lighting".
      - SUBJECT: Can be a sleek robot, a glowing AI brain, a futuristic server room, or digital data streams.
      
      IF HUMAN-CENTRIC:
      - Focus on a professional subject (e.g., an Indian professional, focused eyes, confident posture).
      - Background: Modern minimalist office or coworking space.
      
      GENERAL RULES:
      - NO TEXT, NO WATERMARKS, NO LOGOS.
      - Ensure high contrast and vibrant, premium colors.
      
      Output ONLY the final prompt. Do not explain your choice.`;

      const result = await model.generateContent(prompt);
      const smartPrompt = result.response.text().trim();
      this.logger.info(`ImageGenerator: Gemini Prompt Engineering complete. Prompt: "${smartPrompt.substring(0, 100)}..."`);
      return smartPrompt;
    } catch (e) {
      this.logger.warn(`ImageGenerator: Gemini prompt engineering failed, using basic prompt.`);
      return `${title}. photorealistic, high-tech, futuristic, cinematic lighting, 8k`;
    }
  }

  /**
   * Try to register a custom font file if available.
   */
  private tryRegisterFont(): void {
    try {
      const fontPath = path.join(process.cwd(), 'assets', 'fonts', 'Inter-Bold.ttf');
      if (fs.existsSync(fontPath)) {
        registerFont(fontPath, { family: 'Inter', weight: 'bold' });
        this.logger.info('ImageGenerator: Custom font "Inter" registered');
      }
    } catch {
      this.logger.info('ImageGenerator: Using system sans-serif font');
    }
  }

  /**
   * Helper to wrap text (Unused for now as per user request for cleaner look)
   */
  private wrapText(ctx: any, text: string, maxWidth: number, maxLines: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
        if (lines.length >= maxLines) {
          lines[lines.length - 1] = lines[lines.length - 1] + '...';
          return lines;
        }
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }
}
