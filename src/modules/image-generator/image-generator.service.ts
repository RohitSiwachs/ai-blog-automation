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
  private nvidiaTextEndpoint: string;
  private readonly FALLBACK_NVIDIA_TEXT_MODEL = 'meta/llama-3.1-8b-instruct';

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
    this.nvidiaTextEndpoint = this.configService.get<string>('nvidia.chatEndpoint') || 'https://integrate.api.nvidia.com/v1/chat/completions';

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

      // Draw a beautiful premium dark slate / deep indigo gradient first
      // This handles image transparency and ensures the background is never completely black
      const bgGradient = ctx.createLinearGradient(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
      bgGradient.addColorStop(0, '#0a0f1d');
      bgGradient.addColorStop(0.5, '#12132e');
      bgGradient.addColorStop(1, '#0a0f1d');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);

      // --- 1. Draw creative background using AI ---
      await this.drawDynamicBackground(ctx, title);

      // --- 2. Text overlay, gradient, and branding removed as per user preference ---

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

    // Clean prompt: strip leading/trailing quotes and replace nested double quotes with single quotes
    let cleanedPrompt = smartPrompt.trim();
    if (cleanedPrompt.startsWith('"') && cleanedPrompt.endsWith('"')) {
      cleanedPrompt = cleanedPrompt.substring(1, cleanedPrompt.length - 1).trim();
    }
    cleanedPrompt = cleanedPrompt.replace(/"/g, "'");

    this.logger.info(`ImageGenerator: Cleaned prompt — "${cleanedPrompt.substring(0, 100)}..."`);

    // Stage 1: NVIDIA NIM Stable Diffusion 3 Medium (New High Quality Free Tier)
    if (this.nvidiaApiKey) {
      try {
        this.logger.info(`ImageGenerator: Tier 1 - Requesting NVIDIA NIM for "${title}"...`);
        const imageBuffer = await this.generateNvidiaImage(cleanedPrompt);
        if (imageBuffer) {
          const bgImage = await loadImage(imageBuffer);
          this.logger.info(`ImageGenerator: Loaded bgImage from NVIDIA NIM — Width: ${bgImage.width}, Height: ${bgImage.height}`);
          
          const scale = Math.max(IMAGE_WIDTH / bgImage.width, IMAGE_HEIGHT / bgImage.height);
          const x = (IMAGE_WIDTH / 2) - (bgImage.width / 2) * scale;
          const y = (IMAGE_HEIGHT / 2) - (bgImage.height / 2) * scale;
          ctx.drawImage(bgImage, x, y, bgImage.width * scale, bgImage.height * scale);
          
          // Validate: reject if image is too dark (likely a black frame)
          if (this.isCanvasTooBlack(ctx)) {
            this.logger.warn(`ImageGenerator: NVIDIA NIM returned a near-black image — rejecting and falling through...`);
          } else {
            this.logger.info(`ImageGenerator: NVIDIA NIM success — brightness OK`);
            return;
          }
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
        this.logger.info(`ImageGenerator: Loaded bgImage from DALL-E 3 — Width: ${bgImage.width}, Height: ${bgImage.height}`);
        
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
        const fluxUrl = `https://image.pollinations.ai/prompt/${safeTitleId}?prompt=${encodeURIComponent(cleanedPrompt)}&width=${IMAGE_WIDTH}&height=${IMAGE_HEIGHT}&nologo=true&seed=${Math.floor(Math.random() * 1000000)}&model=flux`;
        
        const response = await axios.get(fluxUrl, { responseType: 'arraybuffer', timeout: attempt === 1 ? 30000 : 50000 });
        
        if (Buffer.from(response.data).length > 20000) {
          const bgImage = await loadImage(Buffer.from(response.data));
          this.logger.info(`ImageGenerator: Loaded bgImage from Flux — Width: ${bgImage.width}, Height: ${bgImage.height}`);
          
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
      const randomSeed = Math.floor(Math.random() * 2000000000);
      this.logger.info(`ImageGenerator: NVIDIA NIM using seed: ${randomSeed}`);
      const response = await axios.post(
        this.nvidiaEndpoint,
        {
          prompt,
          seed: randomSeed
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
   * Check if the canvas is too dark / black by sampling pixel brightness.
   * Returns true if the average brightness across sampled points is below threshold.
   */
  private isCanvasTooBlack(ctx: any): boolean {
    const samplePoints = [
      // Sample a grid of 20 points across the image
      [100, 100], [300, 100], [600, 100], [900, 100], [1100, 100],
      [100, 200], [400, 200], [700, 200], [1000, 200],
      [100, 315], [400, 315], [600, 315], [900, 315], [1100, 315],
      [100, 430], [400, 430], [700, 430], [1000, 430],
      [100, 530], [600, 530], [1100, 530],
    ];

    let totalBrightness = 0;
    let validSamples = 0;

    for (const [x, y] of samplePoints) {
      try {
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        // Perceived luminance: 0.299*R + 0.587*G + 0.114*B
        const brightness = 0.299 * pixel[0] + 0.587 * pixel[1] + 0.114 * pixel[2];
        totalBrightness += brightness;
        validSamples++;
      } catch {
        // skip invalid sample points
      }
    }

    if (validSamples === 0) return true;

    const avgBrightness = totalBrightness / validSamples;
    this.logger.info(`ImageGenerator: Image brightness check — avg: ${avgBrightness.toFixed(1)}/255 (${validSamples} samples)`);

    // Threshold: avg brightness below 15 out of 255 means essentially black
    return avgBrightness < 15;
  }

  /**
   * Use Gemini to generate a highly detailed, professional image prompt.
   * This allows free models like Flux to produce DALL-E 3 level quality.
   * The prompt is strongly anchored to the blog title's core topic for contextual relevance.
   */
  private async generateSmartPrompt(title: string): Promise<string> {
    const promptRequest = `You are a world-class visual designer and expert image prompt engineer.
Your task: Create a premium image generation prompt for a blog banner that DIRECTLY represents the topic of the blog.

BLOG TITLE: "${title}"

STEP 1 — ANALYZE THE TITLE:
First, identify the 2-3 core concepts/keywords from the blog title. The generated image MUST visually represent these concepts.

STEP 2 — BUILD A CONTEXTUALLY RELEVANT SCENE:
Design a scene that a viewer would IMMEDIATELY associate with the blog topic. The image should make someone say "yes, this is clearly about [topic]".

EXAMPLES OF CONTEXTUAL RELEVANCE:
- "Freelancing Tips" → a cozy home office workspace with laptop, coffee, and notebooks on a wooden desk, warm ambient lighting
- "Web Development Guide" → a sleek code editor on a monitor showing colorful syntax-highlighted code, dark theme, with IDE panels
- "Digital Marketing Strategy" → an abstract dashboard visualization with analytics charts, growth graphs, and data nodes glowing in neon
- "WordPress Customization" → a modern website builder interface with drag-and-drop components, elegant theme preview on a screen
- "AI Automation Tools" → futuristic robotic arms or neural network visualization with glowing interconnected nodes
- "Data Analytics Careers" → a 3D data visualization with floating charts, graphs, and holographic data dashboards
- "SEO and Keywords" → a search engine interface with magnifying glass, keyword clouds, and ranking indicators

VISUAL QUALITY REQUIREMENTS:
- Ultra-premium quality: 8K, cinematic lighting, professional photography or high-end 3D render
- Clean composition with strong depth-of-field
- Sophisticated color palette: deep navy, slate, violet, emerald, warm gold (avoid plain red/blue/green)
- Choose the best style for the topic: photorealistic workspace, 3D abstract tech art, isometric design, or glassmorphic UI

ABSOLUTE RULES (NEVER VIOLATE):
- ZERO humans, people, faces, hands, fingers, bodies, silhouettes, or human figures of ANY kind
- ZERO text, words, labels, logos, watermarks, or lettering anywhere in the image
- ZERO stock photo vibes — must feel premium and editorial
- The image MUST be semantically relevant to "${title}" — an unrelated beautiful image is a FAILURE

Output ONLY the final image prompt. No explanations, no intros, no labels.`;

    // Try Gemini first
    try {
      this.logger.info(`ImageGenerator: Using Gemini to engineer a professional prompt...`);
      const model = this.genAI.getGenerativeModel({ 
        model: this.configService.get<string>('gemini.model') || 'gemini-2.0-flash' 
      });
      
      const result = await model.generateContent(promptRequest);
      const smartPrompt = result.response.text().trim();
      this.logger.info(`ImageGenerator: Gemini Prompt Engineering complete. Prompt: "${smartPrompt.substring(0, 100)}..."`);
      return smartPrompt;
    } catch (geminiErr) {
      this.logger.warn(`ImageGenerator: Gemini prompt engineering failed (${geminiErr.message}). Trying NVIDIA Llama fallback...`);
    }

    // Fallback: NVIDIA Llama for prompt engineering
    try {
      const nvidiaTextApiKey = this.configService.get<string>('nvidia.apiKey') || this.nvidiaApiKey;
      if (nvidiaTextApiKey) {
        this.logger.info(`ImageGenerator: Using NVIDIA Llama for prompt engineering...`);
        const response = await axios.post(this.nvidiaTextEndpoint, {
          model: this.FALLBACK_NVIDIA_TEXT_MODEL,
          messages: [
            { 
              role: 'system', 
              content: 'You are an expert image prompt engineer. You generate image prompts that are semantically relevant to the given blog topic. NEVER include humans, people, faces, or text in your prompts. Output ONLY the prompt, nothing else.' 
            },
            { role: 'user', content: promptRequest }
          ],
          max_tokens: 350,
          temperature: 0.5,
          stream: false,
        }, {
          headers: {
            'Authorization': `Bearer ${nvidiaTextApiKey}`,
            'Accept': 'application/json',
          },
          timeout: 30000,
        });

        const smartPrompt = response.data.choices[0].message.content.trim();
        this.logger.info(`ImageGenerator: NVIDIA Llama Prompt Engineering complete. Prompt: "${smartPrompt.substring(0, 100)}..."`);
        return smartPrompt;
      }
    } catch (nvidiaErr) {
      this.logger.warn(`ImageGenerator: NVIDIA Llama prompt engineering also failed: ${nvidiaErr.message}`);
    }

    // Final fallback: contextual basic prompt derived from the title
    this.logger.warn(`ImageGenerator: All prompt engineering failed, using contextual fallback prompt.`);
    return `A premium, ultra-detailed 3D visualization representing the concept of "${title}". Abstract tech-inspired scene with glowing elements, dark moody background, cinematic lighting, 8K quality, no text, no people, no faces. Professional editorial blog banner aesthetic.`;
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
