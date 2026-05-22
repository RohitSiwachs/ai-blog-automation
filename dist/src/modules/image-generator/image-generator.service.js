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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageGeneratorService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const canvas_1 = require("canvas");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const axios_1 = __importDefault(require("axios"));
const openai_1 = __importDefault(require("openai"));
const generative_ai_1 = require("@google/generative-ai");
const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;
let ImageGeneratorService = class ImageGeneratorService {
    configService;
    logger;
    brandName;
    openai;
    genAI;
    nvidiaApiKey;
    nvidiaEndpoint;
    nvidiaTextEndpoint;
    FALLBACK_NVIDIA_TEXT_MODEL = 'meta/llama-3.1-8b-instruct';
    constructor(configService, logger) {
        this.configService = configService;
        this.logger = logger;
        this.brandName = this.configService.get('brand.name') || 'TechBlog';
        this.openai = new openai_1.default({
            apiKey: this.configService.get('OPENAI_API_KEY'),
        });
        this.genAI = new generative_ai_1.GoogleGenerativeAI(this.configService.get('gemini.apiKey') || '');
        this.nvidiaApiKey = this.configService.get('nvidia.imageApiKey') || '';
        this.nvidiaEndpoint = this.configService.get('nvidia.imageEndpoint') || '';
        this.nvidiaTextEndpoint = this.configService.get('nvidia.chatEndpoint') || 'https://integrate.api.nvidia.com/v1/chat/completions';
        this.tryRegisterFont();
    }
    async generateBannerImage(title) {
        this.logger.info(`ImageGenerator: Creating professional banner for "${title}"...`);
        try {
            const canvas = (0, canvas_1.createCanvas)(IMAGE_WIDTH, IMAGE_HEIGHT);
            const ctx = canvas.getContext('2d');
            await this.drawDynamicBackground(ctx, title);
            const gradient = ctx.createLinearGradient(0, IMAGE_HEIGHT * 0.5, 0, IMAGE_HEIGHT);
            gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, IMAGE_HEIGHT * 0.5, IMAGE_WIDTH, IMAGE_HEIGHT * 0.5);
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
            ctx.font = 'bold 24px Inter';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.fillText(this.brandName.toUpperCase(), 50, IMAGE_HEIGHT - 30);
            const buffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });
            this.logger.info(`ImageGenerator: Banner created successfully (${(buffer.length / 1024).toFixed(1)} KB)`);
            return buffer;
        }
        catch (error) {
            this.logger.error(`ImageGenerator: Failed to create banner — ${error.message}`);
            throw new Error(`Image generation failed: ${error.message}`);
        }
    }
    async drawDynamicBackground(ctx, title) {
        const smartPrompt = await this.generateSmartPrompt(title);
        if (this.nvidiaApiKey) {
            try {
                this.logger.info(`ImageGenerator: Tier 1 - Requesting NVIDIA NIM for "${title}"...`);
                const imageBuffer = await this.generateNvidiaImage(smartPrompt);
                if (imageBuffer) {
                    const bgImage = await (0, canvas_1.loadImage)(imageBuffer);
                    const scale = Math.max(IMAGE_WIDTH / bgImage.width, IMAGE_HEIGHT / bgImage.height);
                    const x = (IMAGE_WIDTH / 2) - (bgImage.width / 2) * scale;
                    const y = (IMAGE_HEIGHT / 2) - (bgImage.height / 2) * scale;
                    ctx.drawImage(bgImage, x, y, bgImage.width * scale, bgImage.height * scale);
                    this.logger.info(`ImageGenerator: NVIDIA NIM success`);
                    return;
                }
            }
            catch (nvidiaErr) {
                this.logger.warn(`ImageGenerator: Tier 1 (NVIDIA) failed (${nvidiaErr.message}). Moving to Tier 2...`);
            }
        }
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
                const imageResponse = await axios_1.default.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
                const bgImage = await (0, canvas_1.loadImage)(Buffer.from(imageResponse.data));
                const scale = Math.max(IMAGE_WIDTH / bgImage.width, IMAGE_HEIGHT / bgImage.height);
                const x = (IMAGE_WIDTH / 2) - (bgImage.width / 2) * scale;
                const y = (IMAGE_HEIGHT / 2) - (bgImage.height / 2) * scale;
                ctx.drawImage(bgImage, x, y, bgImage.width * scale, bgImage.height * scale);
                this.logger.info(`ImageGenerator: DALL-E 3 success`);
                return;
            }
        }
        catch (dalleError) {
            this.logger.warn(`ImageGenerator: Tier 2 failed (${dalleError.message}). Moving to Tier 3 (Flux)...`);
        }
        const safeTitleId = title.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 30);
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                this.logger.info(`ImageGenerator: Tier 2 - Requesting Flux (Attempt ${attempt})...`);
                const fluxUrl = `https://image.pollinations.ai/prompt/${safeTitleId}?prompt=${encodeURIComponent(smartPrompt)}&width=${IMAGE_WIDTH}&height=${IMAGE_HEIGHT}&nologo=true&seed=${Math.floor(Math.random() * 1000000)}&model=flux`;
                const response = await axios_1.default.get(fluxUrl, { responseType: 'arraybuffer', timeout: attempt === 1 ? 30000 : 50000 });
                if (Buffer.from(response.data).length > 20000) {
                    const bgImage = await (0, canvas_1.loadImage)(Buffer.from(response.data));
                    ctx.drawImage(bgImage, 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
                    this.logger.info(`ImageGenerator: Flux success`);
                    return;
                }
            }
            catch (fluxErr) {
                this.logger.warn(`ImageGenerator: Flux attempt ${attempt} failed: ${fluxErr.message}`);
                if (attempt === 1)
                    await new Promise(r => setTimeout(r, 2000));
            }
        }
        try {
            this.logger.info(`ImageGenerator: Tier 3 - Requesting Turbo...`);
            const turboUrl = `https://image.pollinations.ai/prompt/${safeTitleId}?prompt=${encodeURIComponent(smartPrompt)}&width=${IMAGE_WIDTH}&height=${IMAGE_HEIGHT}&nologo=true&seed=${Math.floor(Math.random() * 1000000)}&model=turbo`;
            const response = await axios_1.default.get(turboUrl, { responseType: 'arraybuffer', timeout: 20000 });
            if (Buffer.from(response.data).length > 15000) {
                const bgImage = await (0, canvas_1.loadImage)(Buffer.from(response.data));
                ctx.drawImage(bgImage, 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
                this.logger.info(`ImageGenerator: Turbo success`);
                return;
            }
        }
        catch (turboErr) {
            this.logger.warn(`ImageGenerator: Tier 3 failed.`);
        }
        const fallbacks = [
            'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200&h=630&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200&h=630&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?q=80&w=1200&h=630&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=1200&h=630&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1200&h=630&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1200&h=630&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1200&h=630&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=1200&h=630&auto=format&fit=crop'
        ];
        const fallbackUrl = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        try {
            this.logger.info(`ImageGenerator: Tier 4 - Using Curated Fallback: ${fallbackUrl}`);
            const fbResponse = await axios_1.default.get(fallbackUrl, { responseType: 'arraybuffer', timeout: 15000 });
            const bgImage = await (0, canvas_1.loadImage)(Buffer.from(fbResponse.data));
            ctx.drawImage(bgImage, 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
            this.logger.info(`ImageGenerator: Curated static fallback success`);
            return;
        }
        catch (fbErr) {
            this.logger.error(`ImageGenerator: All image providers failed. Using branded gradient.`);
            const gradient = ctx.createLinearGradient(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
            gradient.addColorStop(0, '#0f172a');
            gradient.addColorStop(0.5, '#1e1b4b');
            gradient.addColorStop(1, '#0f172a');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
        }
    }
    async generateNvidiaImage(prompt) {
        try {
            const response = await axios_1.default.post(this.nvidiaEndpoint, {
                prompt,
                seed: 0
            }, {
                headers: {
                    'Authorization': `Bearer ${this.nvidiaApiKey}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                timeout: 120000,
            });
            const imageBase64 = response.data?.artifacts?.[0]?.base64 || response.data?.image;
            if (imageBase64) {
                return Buffer.from(imageBase64, 'base64');
            }
            this.logger.error('ImageGenerator: NVIDIA NIM returned no image data');
            return null;
        }
        catch (error) {
            const errorMsg = error.response?.data?.error || error.response?.data || error.message;
            this.logger.error(`ImageGenerator: NVIDIA NIM API error — ${JSON.stringify(errorMsg)}`);
            throw new Error(`NVIDIA NIM failed: ${JSON.stringify(errorMsg)}`);
        }
    }
    async generateSmartPrompt(title) {
        const promptRequest = `You are a professional DALL-E 3 prompt engineer. 
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
        try {
            this.logger.info(`ImageGenerator: Using Gemini to engineer a professional prompt...`);
            const model = this.genAI.getGenerativeModel({
                model: this.configService.get('gemini.model') || 'gemini-2.0-flash'
            });
            const result = await model.generateContent(promptRequest);
            const smartPrompt = result.response.text().trim();
            this.logger.info(`ImageGenerator: Gemini Prompt Engineering complete. Prompt: "${smartPrompt.substring(0, 100)}..."`);
            return smartPrompt;
        }
        catch (geminiErr) {
            this.logger.warn(`ImageGenerator: Gemini prompt engineering failed (${geminiErr.message}). Trying NVIDIA Llama fallback...`);
        }
        try {
            const nvidiaTextApiKey = this.configService.get('nvidia.apiKey') || this.nvidiaApiKey;
            if (nvidiaTextApiKey) {
                this.logger.info(`ImageGenerator: Using NVIDIA Llama for prompt engineering...`);
                const response = await axios_1.default.post(this.nvidiaTextEndpoint, {
                    model: this.FALLBACK_NVIDIA_TEXT_MODEL,
                    messages: [{ role: 'user', content: promptRequest }],
                    max_tokens: 300,
                    temperature: 0.7,
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
        }
        catch (nvidiaErr) {
            this.logger.warn(`ImageGenerator: NVIDIA Llama prompt engineering also failed: ${nvidiaErr.message}`);
        }
        this.logger.warn(`ImageGenerator: All prompt engineering failed, using basic prompt.`);
        return `${title}. photorealistic, high-tech, futuristic, cinematic lighting, 8k`;
    }
    tryRegisterFont() {
        try {
            const fontPath = path.join(process.cwd(), 'assets', 'fonts', 'Inter-Bold.ttf');
            if (fs.existsSync(fontPath)) {
                (0, canvas_1.registerFont)(fontPath, { family: 'Inter', weight: 'bold' });
                this.logger.info('ImageGenerator: Custom font "Inter" registered');
            }
        }
        catch {
            this.logger.info('ImageGenerator: Using system sans-serif font');
        }
    }
    wrapText(ctx, text, maxWidth, maxLines) {
        const words = text.split(' ');
        const lines = [];
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
            }
            else {
                currentLine = testLine;
            }
        }
        if (currentLine)
            lines.push(currentLine);
        return lines;
    }
};
exports.ImageGeneratorService = ImageGeneratorService;
exports.ImageGeneratorService = ImageGeneratorService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        winston_1.Logger])
], ImageGeneratorService);
//# sourceMappingURL=image-generator.service.js.map