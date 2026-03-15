"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
exports.BlogGeneratorService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const generative_ai_1 = require("@google/generative-ai");
const slugify_1 = __importDefault(require("slugify"));
const prompts_1 = require("./prompts");
let BlogGeneratorService = class BlogGeneratorService {
    configService;
    logger;
    genAI;
    modelName;
    constructor(configService, logger) {
        this.configService = configService;
        this.logger = logger;
        const apiKey = this.configService.get('gemini.apiKey');
        this.modelName = this.configService.get('gemini.model');
        this.genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    }
    async generateBlog(title, keywords, categories) {
        this.logger.info(`BlogGenerator: Generating content for "${title}"...`);
        const prompt = (0, prompts_1.buildBlogPrompt)(title, keywords, categories);
        const model = this.genAI.getGenerativeModel({ model: this.modelName });
        try {
            const result = await model.generateContent(prompt);
            const response = result.response;
            const text = response.text();
            this.logger.info('BlogGenerator: Gemini response received, parsing...');
            const parsed = this.parseGeminiResponse(text);
            const slug = (0, slugify_1.default)(parsed.seoTitle, {
                lower: true,
                strict: true,
                trim: true,
            });
            const blog = {
                seoTitle: parsed.seoTitle,
                metaDescription: this.truncate(parsed.metaDescription, 160),
                ogTitle: parsed.ogTitle || parsed.seoTitle,
                ogDescription: parsed.ogDescription || parsed.metaDescription,
                metaKeywords: parsed.metaKeywords || keywords.join(', '),
                description: this.truncate(parsed.description || parsed.metaDescription, 180),
                category: parsed.category || categories[0] || 'Development',
                tags: parsed.tags || [],
                slug,
                content: await this.enrichInlineImages(parsed.content),
            };
            this.logger.info(`BlogGenerator: Content generated successfully — "${blog.seoTitle}" (${this.countWords(blog.content)} words)`);
            return blog;
        }
        catch (error) {
            this.logger.error(`BlogGenerator: Gemini API failed — ${error.message}`);
            throw new Error(`Blog generation failed: ${error.message}`);
        }
    }
    parseGeminiResponse(text) {
        let cleaned = text.trim();
        const startIdx = cleaned.indexOf('{');
        const endIdx = cleaned.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
            cleaned = cleaned.substring(startIdx, endIdx + 1);
        }
        else {
            if (cleaned.startsWith('```json'))
                cleaned = cleaned.slice(7);
            else if (cleaned.startsWith('```'))
                cleaned = cleaned.slice(3);
            if (cleaned.endsWith('```'))
                cleaned = cleaned.slice(0, -3);
            cleaned = cleaned.trim();
        }
        try {
            const parsed = JSON.parse(cleaned);
            if (!parsed.seoTitle || !parsed.content) {
                throw new Error('Missing required fields in Gemini response');
            }
            return parsed;
        }
        catch (parseError) {
            this.logger.warn(`BlogGenerator: JSON parse failed, attempting super-robust brute-force extraction...`);
            const extractFieldLoose = (key) => {
                const standardRegex = new RegExp(`"${key}"\\s*:\\s*"([\\s\\S]*?)"(?=\\s*[,}]|\\s*$)`, 'i');
                const match = cleaned.match(standardRegex);
                if (match)
                    return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
                const keys = ['seoTitle', 'metaDescription', 'ogTitle', 'ogDescription', 'metaKeywords', 'description', 'category', 'tags', 'content'];
                const otherKeys = keys.filter(k => k !== key).join('|');
                const looseRegex = new RegExp(`"${key}"\\s*:\\s*"([\\s\\S]*?)(?="\\s*(?:${otherKeys})|\\s*}$)`, 'i');
                const looseMatch = cleaned.match(looseRegex);
                if (looseMatch)
                    return looseMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
                return '';
            };
            const seoTitle = extractFieldLoose('seoTitle');
            const content = extractFieldLoose('content');
            if (seoTitle && content) {
                this.logger.info(`BlogGenerator: Brute-force succeeded for "${seoTitle}"`);
                const tagsMatch = cleaned.match(/"tags"\s*:\s*\[([^\]]+)\]/);
                let extractedTags = [];
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
    truncate(text, maxLen) {
        if (!text || text.length <= maxLen)
            return text || '';
        const truncated = text.substring(0, maxLen - 3);
        const lastSpace = truncated.lastIndexOf(' ');
        return truncated.substring(0, lastSpace) + '...';
    }
    async enrichInlineImages(content) {
        this.logger.info('BlogGenerator: Finalizing and enriching inline images with Gemini...');
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
            const promptMatch = rawBaseUrl.match(/\/prompt\/([^\/]+)/);
            const originalIntent = promptMatch
                ? promptMatch[1].replace(/-/g, ' ')
                : (alt || 'professional technology');
            this.logger.info(`BlogGenerator: Engineering prompt for inline image: "${originalIntent.substring(0, 30)}..."`);
            const smartPrompt = await this.generateInlineSmartPrompt(originalIntent);
            const pathPart = originalIntent.toLowerCase()
                .replace(/[^a-z0-9 ]/g, ' ')
                .trim()
                .split(/\s+/)
                .slice(0, 5)
                .join('-');
            const forcedSubject = "Realistic photo of a professional person, ";
            const uniqueSeed = Math.floor(Math.random() * 90000000) + 10000000;
            const finalUrl = `https://image.pollinations.ai/prompt/${pathPart}?prompt=${encodeURIComponent(forcedSubject + smartPrompt)}&width=1024&height=1024&nologo=true&seed=${uniqueSeed}&model=flux`;
            this.logger.info(`BlogGenerator: Inline image enriched for "${alt}"`);
            enrichedContent = enrichedContent.replace(fullMatch, `![${alt}](${finalUrl})`);
        }
        return enrichedContent;
    }
    async generateInlineSmartPrompt(intent) {
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
        }
        catch (e) {
            this.logger.warn(`BlogGenerator: Inline prompt engineering failed: ${e.message}`);
            return `${intent}. photorealistic, professional lighting, cinematic`;
        }
    }
    countWords(markdown) {
        const text = markdown
            .replace(/[#*`\[\]]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        return text.split(' ').filter((w) => w.length > 0).length;
    }
};
exports.BlogGeneratorService = BlogGeneratorService;
exports.BlogGeneratorService = BlogGeneratorService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        winston_1.Logger])
], BlogGeneratorService);
//# sourceMappingURL=blog-generator.service.js.map