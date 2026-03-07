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
const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;
let ImageGeneratorService = class ImageGeneratorService {
    configService;
    logger;
    brandName;
    constructor(configService, logger) {
        this.configService = configService;
        this.logger = logger;
        this.brandName = this.configService.get('brand.name') || 'TechBlog';
        this.tryRegisterFont();
    }
    async generateBannerImage(title) {
        this.logger.info(`ImageGenerator: Creating banner for "${title}"...`);
        try {
            const canvas = (0, canvas_1.createCanvas)(IMAGE_WIDTH, IMAGE_HEIGHT);
            const ctx = canvas.getContext('2d');
            await this.drawDynamicBackground(ctx, title);
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
        try {
            this.logger.info(`ImageGenerator: Fetching AI background for: ${title}`);
            const cleanTitle = title.replace(/[^a-zA-Z0-9 ]/g, ' ');
            const richPrompt = encodeURIComponent(`${cleanTitle}, modern 3d render, flat vector illustration, tech UI concept, vibrant dark theme, clean professional digital art, high resolution`);
            const pollUrl = `https://image.pollinations.ai/prompt/${richPrompt}?width=${IMAGE_WIDTH}&height=${IMAGE_HEIGHT}&nologo=true&seed=${Math.floor(Math.random() * 100000)}`;
            try {
                this.logger.info(`ImageGenerator: Stage 1 - Pollinations: ${pollUrl}`);
                const response = await axios_1.default.get(pollUrl, {
                    responseType: 'arraybuffer',
                    timeout: 12000,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                if (Buffer.from(response.data).length > 5000) {
                    const bgImage = await (0, canvas_1.loadImage)(Buffer.from(response.data));
                    ctx.drawImage(bgImage, 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
                    this.logger.info(`ImageGenerator: Pollinations image loaded successfully`);
                    return;
                }
            }
            catch (pollError) {
                this.logger.warn(`ImageGenerator: Pollinations failed, trying LoremFlickr. ${pollError.message}`);
            }
            const lfKeywords = 'technology,software,coding,office,computer';
            const lfUrl = `https://loremflickr.com/${IMAGE_WIDTH}/${IMAGE_HEIGHT}/${lfKeywords}/all`;
            this.logger.info(`ImageGenerator: Stage 2 - LoremFlickr: ${lfUrl}`);
            const lfResponse = await axios_1.default.get(lfUrl, {
                responseType: 'arraybuffer',
                timeout: 8000
            });
            const lfBytes = Buffer.from(lfResponse.data);
            if (lfBytes[0] === 0xFF && lfBytes[1] === 0xD8) {
                const bgImage = await (0, canvas_1.loadImage)(lfBytes);
                ctx.drawImage(bgImage, 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
                this.logger.info(`ImageGenerator: LoremFlickr tech image loaded successfully`);
                return;
            }
            throw new Error('Invalid image data from all providers');
        }
        catch (error) {
            this.logger.warn(`ImageGenerator: All image providers failed, falling back to gradient. ${error.message}`);
            const gradient = ctx.createLinearGradient(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
            gradient.addColorStop(0, '#0f172a');
            gradient.addColorStop(0.35, '#1e1b4b');
            gradient.addColorStop(0.65, '#312e81');
            gradient.addColorStop(1, '#0f172a');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
        }
    }
    drawDecorativeElements(ctx) {
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
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        for (let x = 30; x < IMAGE_WIDTH; x += 40) {
            for (let y = 30; y < IMAGE_HEIGHT; y += 40) {
                ctx.beginPath();
                ctx.arc(x, y, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
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
    drawTitleText(ctx, title) {
        const maxWidth = IMAGE_WIDTH - 160;
        const lineHeight = 52;
        const maxLines = 4;
        const startY = IMAGE_HEIGHT * 0.32;
        ctx.font = 'bold 40px "Inter", "Segoe UI", "Arial", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const lines = this.wrapText(ctx, title, maxWidth, maxLines);
        const totalTextHeight = lines.length * lineHeight;
        const yOffset = startY - totalTextHeight / 2 + IMAGE_HEIGHT * 0.18;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        lines.forEach((line, i) => {
            ctx.fillText(line, IMAGE_WIDTH / 2 + 2, yOffset + i * lineHeight + 2);
        });
        ctx.fillStyle = '#ffffff';
        lines.forEach((line, i) => {
            ctx.fillText(line, IMAGE_WIDTH / 2, yOffset + i * lineHeight);
        });
        const underlineY = yOffset + lines.length * lineHeight + 20;
        const underlineGradient = ctx.createLinearGradient(IMAGE_WIDTH * 0.35, underlineY, IMAGE_WIDTH * 0.65, underlineY);
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
    drawBrandWatermark(ctx) {
        ctx.font = 'bold 18px "Inter", "Segoe UI", "Arial", sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillText(this.brandName, IMAGE_WIDTH - 29, IMAGE_HEIGHT - 19);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillText(this.brandName, IMAGE_WIDTH - 30, IMAGE_HEIGHT - 20);
        ctx.font = '12px "Inter", "Segoe UI", "Arial", sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillText('BLOG', IMAGE_WIDTH - 30, IMAGE_HEIGHT - 42);
    }
    drawBorder(ctx) {
        const borderGradient = ctx.createLinearGradient(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
        borderGradient.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
        borderGradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.2)');
        borderGradient.addColorStop(1, 'rgba(236, 72, 153, 0.3)');
        ctx.strokeStyle = borderGradient;
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, IMAGE_WIDTH - 2, IMAGE_HEIGHT - 2);
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
        if (currentLine) {
            if (lines.length >= maxLines) {
                lines[lines.length - 1] = lines[lines.length - 1] + '...';
            }
            else {
                lines.push(currentLine);
            }
        }
        return lines;
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
            this.logger.info('ImageGenerator: Using system sans-serif font (custom font not found)');
        }
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