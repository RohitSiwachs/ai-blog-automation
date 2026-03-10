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

// Image dimensions (Open Graph standard)
const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;

@Injectable()
export class ImageGeneratorService {
  private brandName: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    this.brandName = this.configService.get<string>('brand.name') || 'TechBlog';

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
    this.logger.info(`ImageGenerator: Creating banner for "${title}"...`);

    try {
      const canvas = createCanvas(IMAGE_WIDTH, IMAGE_HEIGHT);
      const ctx = canvas.getContext('2d');

      // --- 1. Draw creative background ---
      await this.drawDynamicBackground(ctx, title);

      // --- 2. Draw decorative elements (Removed for cleaner look) ---
      // this.drawDecorativeElements(ctx);

      // --- 3. Draw title text (Removed as per user request) ---
      // this.drawTitleText(ctx, title);

      // --- 4. Draw brand watermark (Removed) ---
      // this.drawBrandWatermark(ctx);

      // --- 5. Draw subtle border (Removed) ---
      // this.drawBorder(ctx);

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
  }

  /**
   * Fetch a creative AI background using Pollinations API based on the title.
   * Superimposes a dark gradient so white text stays readable.
   */
  private async drawDynamicBackground(ctx: any, title: string): Promise<void> {
    try {
      // Build a clean, short prompt string for the path (max 5 words to keep URL safe)
      const pathPart = title.toLowerCase()
        .replace(/[^a-z0-9 ]/g, '')
        .trim()
        .split(/\s+/)
        .slice(0, 5)
        .join('-');
        
      const styleParams = encodeURIComponent('photorealistic, professional photography, real life scene, 8k, cinematic lighting');
      const safeRandomSeed = Math.floor(Math.random() * 90000000) + 10000000;
      
      // Use turbo model for much faster and more reliable loading in the browser
      // We put the full query in a prompt param if path is too short, or just use styles
      const pollUrl = `https://image.pollinations.ai/prompt/${pathPart}?prompt=${styleParams}&width=${IMAGE_WIDTH}&height=${IMAGE_HEIGHT}&nologo=true&seed=${safeRandomSeed}&model=turbo`;
      
      try {
        this.logger.info(`ImageGenerator: Requesting Banner from Pollinations: ${pollUrl}`);
        const response = await axios.get(pollUrl, { 
          responseType: 'arraybuffer',
          timeout: 15000, 
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        if (Buffer.from(response.data).length > 5000) {
          const bgImage = await loadImage(Buffer.from(response.data));
          ctx.drawImage(bgImage, 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
          this.logger.info(`ImageGenerator: Banner image loaded successfully`);
          return;
        } else {
          this.logger.warn(`ImageGenerator: Pollinations returned empty or too small image (${Buffer.from(response.data).length} bytes)`);
        }
      } catch (pollError) {
        this.logger.warn(`ImageGenerator: Pollinations Banner failed: ${pollUrl}. Error: ${(pollError as Error).message}`);
      }

      // Stage 2: LoremFlickr with broad tech keywords
      const lfKeywords = 'technology,laptop,computer,code';
      const lfUrl = `https://loremflickr.com/${IMAGE_WIDTH}/${IMAGE_HEIGHT}/${lfKeywords}?random=${Math.floor(Math.random() * 100000)}`;
      this.logger.info(`ImageGenerator: Stage 2 - Falling back to LoremFlickr: ${lfUrl}`);
      
      try {
        const lfResponse = await axios.get(lfUrl, { 
          responseType: 'arraybuffer',
          timeout: 8000 
        });
        
        const lfBytes = Buffer.from(lfResponse.data);
        if (lfBytes[0] === 0xFF && lfBytes[1] === 0xD8) {
          const bgImage = await loadImage(lfBytes);
          ctx.drawImage(bgImage, 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
          this.logger.info(`ImageGenerator: LoremFlickr banner loaded successfully`);
          return;
        }
      } catch (lfError) {
        this.logger.error(`ImageGenerator: LoremFlickr also failed: ${(lfError as Error).message}`);
      }

      throw new Error('All banner providers failed');

    } catch (error) {
      this.logger.error(`ImageGenerator: Final fallback to gradient. Reason: ${(error as Error).message}`);
      const gradient = ctx.createLinearGradient(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
      gradient.addColorStop(0, '#0f172a');
      gradient.addColorStop(0.35, '#1e1b4b');
      gradient.addColorStop(0.65, '#312e81');
      gradient.addColorStop(1, '#0f172a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
    }
  }

  /**
   * Draw subtle geometric decorative elements for visual interest.
   */
  private drawDecorativeElements(ctx: any): void {
    // --- Glowing circles ---
    const circles = [
      { x: 100, y: 80, r: 60, color: 'rgba(139, 92, 246, 0.12)' },
      { x: 1100, y: 550, r: 80, color: 'rgba(59, 130, 246, 0.10)' },
      { x: 900, y: 100, r: 45, color: 'rgba(236, 72, 153, 0.08)' },
      { x: 200, y: 500, r: 50, color: 'rgba(34, 211, 238, 0.10)' },
    ];

    for (const circle of circles) {
      ctx.beginPath();
      ctx.arc(circle.x, circle.y, circle.r, 0, Math.PI * 2);
      ctx.fillStyle = circle.color;
      ctx.fill();
    }

    // --- Grid dots pattern ---
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let x = 30; x < IMAGE_WIDTH; x += 40) {
      for (let y = 30; y < IMAGE_HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // --- Accent lines ---
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, IMAGE_HEIGHT * 0.7);
    ctx.lineTo(IMAGE_WIDTH * 0.3, IMAGE_HEIGHT * 0.5);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(59, 130, 246, 0.12)';
    ctx.beginPath();
    ctx.moveTo(IMAGE_WIDTH * 0.7, 0);
    ctx.lineTo(IMAGE_WIDTH, IMAGE_HEIGHT * 0.3);
    ctx.stroke();
  }

  /**
   * Draw the blog title text with word-wrapping and text shadow.
   */
  private drawTitleText(ctx: any, title: string): void {
    const maxWidth = IMAGE_WIDTH - 160; // 80px padding on each side
    const lineHeight = 52;
    const maxLines = 4;
    const startY = IMAGE_HEIGHT * 0.32;

    // Set font
    ctx.font = 'bold 40px "Inter", "Segoe UI", "Arial", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Word wrap
    const lines = this.wrapText(ctx, title, maxWidth, maxLines);

    // Calculate vertical centering offset
    const totalTextHeight = lines.length * lineHeight;
    const yOffset = startY - totalTextHeight / 2 + IMAGE_HEIGHT * 0.18;

    // Draw text shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    lines.forEach((line, i) => {
      ctx.fillText(line, IMAGE_WIDTH / 2 + 2, yOffset + i * lineHeight + 2);
    });

    // Draw main text
    ctx.fillStyle = '#ffffff';
    lines.forEach((line, i) => {
      ctx.fillText(line, IMAGE_WIDTH / 2, yOffset + i * lineHeight);
    });

    // --- Accent underline below title ---
    const underlineY = yOffset + lines.length * lineHeight + 20;
    const underlineGradient = ctx.createLinearGradient(
      IMAGE_WIDTH * 0.35,
      underlineY,
      IMAGE_WIDTH * 0.65,
      underlineY,
    );
    underlineGradient.addColorStop(0, 'rgba(139, 92, 246, 0)');
    underlineGradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.8)');
    underlineGradient.addColorStop(1, 'rgba(139, 92, 246, 0)');

    ctx.strokeStyle = underlineGradient;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(IMAGE_WIDTH * 0.3, underlineY);
    ctx.lineTo(IMAGE_WIDTH * 0.7, underlineY);
    ctx.stroke();
  }

  /**
   * Draw brand watermark in the bottom-right corner.
   */
  private drawBrandWatermark(ctx: any): void {
    ctx.font = 'bold 18px "Inter", "Segoe UI", "Arial", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillText(this.brandName, IMAGE_WIDTH - 29, IMAGE_HEIGHT - 19);

    // Main watermark text
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(this.brandName, IMAGE_WIDTH - 30, IMAGE_HEIGHT - 20);

    // Small "blog" label
    ctx.font = '12px "Inter", "Segoe UI", "Arial", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillText('BLOG', IMAGE_WIDTH - 30, IMAGE_HEIGHT - 42);
  }

  /**
   * Draw a subtle border around the entire image.
   */
  private drawBorder(ctx: any): void {
    const borderGradient = ctx.createLinearGradient(
      0,
      0,
      IMAGE_WIDTH,
      IMAGE_HEIGHT,
    );
    borderGradient.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
    borderGradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.2)');
    borderGradient.addColorStop(1, 'rgba(236, 72, 153, 0.3)');

    ctx.strokeStyle = borderGradient;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, IMAGE_WIDTH - 2, IMAGE_HEIGHT - 2);
  }

  /**
   * Wrap text into lines that fit within maxWidth.
   */
  private wrapText(
    ctx: any,
    text: string,
    maxWidth: number,
    maxLines: number,
  ): string[] {
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
          // Truncate with ellipsis on the last line
          lines[lines.length - 1] = lines[lines.length - 1] + '...';
          return lines;
        }
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      if (lines.length >= maxLines) {
        lines[lines.length - 1] = lines[lines.length - 1] + '...';
      } else {
        lines.push(currentLine);
      }
    }

    return lines;
  }

  /**
   * Try to register a custom font file if available.
   */
  private tryRegisterFont(): void {
    try {
      const fontPath = path.join(
        process.cwd(),
        'assets',
        'fonts',
        'Inter-Bold.ttf',
      );
      if (fs.existsSync(fontPath)) {
        registerFont(fontPath, { family: 'Inter', weight: 'bold' });
        this.logger.info('ImageGenerator: Custom font "Inter" registered');
      }
    } catch {
      // Font registration is optional; system fonts will be used as fallback
      this.logger.info(
        'ImageGenerator: Using system sans-serif font (custom font not found)',
      );
    }
  }
}
