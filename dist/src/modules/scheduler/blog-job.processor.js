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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlogJobProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const prisma_service_1 = require("../../prisma/prisma.service");
const blog_generator_service_1 = require("../blog-generator/blog-generator.service");
const image_generator_service_1 = require("../image-generator/image-generator.service");
const strapi_service_1 = require("../strapi-service/strapi.service");
const config_1 = require("@nestjs/config");
const mail_service_1 = require("../mail/mail.service");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let BlogJobProcessor = class BlogJobProcessor extends bullmq_1.WorkerHost {
    blogGenerator;
    imageGenerator;
    strapiService;
    prisma;
    configService;
    mailService;
    logger;
    constructor(blogGenerator, imageGenerator, strapiService, prisma, configService, mailService, logger) {
        super();
        this.blogGenerator = blogGenerator;
        this.imageGenerator = imageGenerator;
        this.strapiService = strapiService;
        this.prisma = prisma;
        this.configService = configService;
        this.mailService = mailService;
        this.logger = logger;
    }
    async process(job) {
        const { title, slug, keywords, blogLogId } = job.data;
        this.logger.info(`🚀 BlogJob [${job.id}]: Starting processing — "${title}"`);
        try {
            await this.updateBlogLog(blogLogId, {
                status: 'generating',
                attempts: job.attemptsMade + 1,
            });
            await job.updateProgress(10);
            this.logger.info(`BlogJob [${job.id}]: Step 1/4 — Generating content...`);
            const categoriesList = await this.strapiService.fetchCategories();
            const categoryNames = categoriesList.map((c) => c.name);
            const blog = await this.blogGenerator.generateBlog(title, keywords || [], categoryNames);
            this.logger.info(`BlogJob [${job.id}]: Step 1.5/4 — Enriching inline images with NVIDIA NIM...`);
            blog.content = await this.processInlineImages(blog.content, job.id?.toString() || 'unknown');
            const selectedCategory = categoriesList.find((c) => c.name.toLowerCase() === blog.category?.toLowerCase());
            const categoryId = selectedCategory ? selectedCategory.id : 1;
            this.logger.info(`BlogJob [${job.id}]: Selected Category — "${blog.category}" (ID: ${categoryId})`);
            await job.updateProgress(40);
            this.logger.info(`BlogJob [${job.id}]: Content generated — "${blog.seoTitle}"`);
            this.logger.info(`BlogJob [${job.id}]: Step 2/4 — Generating banner image...`);
            const imageBuffer = await this.imageGenerator.generateBannerImage(blog.seoTitle);
            await job.updateProgress(60);
            this.logger.info(`BlogJob [${job.id}]: Banner image generated`);
            const isBypass = this.configService.get('BYPASS_STRAPI') || false;
            if (isBypass) {
                const previewDir = path.join(process.cwd(), 'previews');
                if (!fs.existsSync(previewDir)) {
                    fs.mkdirSync(previewDir, { recursive: true });
                }
                const contentPath = path.join(previewDir, `${blog.slug}.md`);
                fs.writeFileSync(contentPath, blog.content);
                const imagePath = path.join(previewDir, `${blog.slug}-banner.jpg`);
                fs.writeFileSync(imagePath, imageBuffer);
                this.logger.info(`📸 PREVIEW SAVED: file:///${contentPath.replace(/\\/g, '/')}`);
                this.logger.info(`🖼️ BANNER SAVED: file:///${imagePath.replace(/\\/g, '/')}`);
            }
            this.logger.info(`BlogJob [${job.id}]: Step 3/4 — Uploading image to Strapi...`);
            const imageFilename = `${slug}-banner.jpg`;
            const mediaId = await this.strapiService.uploadImage(imageBuffer, imageFilename);
            await job.updateProgress(80);
            this.logger.info(`BlogJob [${job.id}]: Image uploaded — Media ID: ${mediaId}`);
            this.logger.info(`BlogJob [${job.id}]: Step 4/4 — Publishing article...`);
            const authors = await this.strapiService.fetchAuthors();
            const randomAuthor = authors.length > 0
                ? authors[Math.floor(Math.random() * authors.length)]
                : { id: 2, name: 'Nikhil Chauhan' };
            this.logger.info(`BlogJob [${job.id}]: Selected author — "${randomAuthor.name}" (ID: ${randomAuthor.id})`);
            const strapiId = await this.strapiService.createBlogPost({
                title: blog.seoTitle,
                description: blog.description,
                slug: blog.slug,
                content: blog.content,
                metaTitle: blog.seoTitle,
                metaDescription: blog.metaDescription,
                ogTitle: blog.ogTitle,
                ogDescription: blog.ogDescription,
                metaKeywords: blog.metaKeywords,
                keywords: job.data.keywords || [],
                tags: blog.tags,
                cover: mediaId,
                authorId: randomAuthor.id,
                authorName: randomAuthor.name,
                categoryId,
            });
            await job.updateProgress(100);
            await this.updateBlogLog(blogLogId, {
                status: 'published',
                strapiId,
                imageId: mediaId,
                title: blog.seoTitle,
                slug: blog.slug,
            });
            this.logger.info(`✅ BlogJob [${job.id}]: Successfully published — ` +
                `Strapi ID: ${strapiId}, slug: "${blog.slug}"`);
        }
        catch (error) {
            const currentAttempt = job.attemptsMade + 1;
            const maxAttempts = job.opts?.attempts || 5;
            this.logger.error(`❌ BlogJob [${job.id}]: Failed (Attempt ${currentAttempt}/${maxAttempts}) — ${error.message}`);
            await this.updateBlogLog(blogLogId, {
                status: 'failed',
                error: error.message,
                attempts: currentAttempt,
            });
            if (currentAttempt >= maxAttempts) {
                this.logger.warn(`🚨 BlogJob [${job.id}]: All ${maxAttempts} attempts failed. Dispatching critical alert email...`);
                const recipient = 'innovaft.co@gmail.com';
                const subject = `⚠️ CRITICAL: Blog Automation APIs Failed Repeatedly — "${title}"`;
                const textContent = `Hello Team,

This is an automated alert from the Innovaft Blog Automation system.

A blog generation job has failed repeatedly and exhausted all ${maxAttempts} attempts.

=======================================================
JOB DETAILS:
=======================================================
- Job ID: ${job.id}
- Blog Topic/Title: "${title}"
- Slug: ${slug}
- Keywords: ${keywords?.join(', ') || 'None'}
- Failed At: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST)

=======================================================
ERROR DETAILS:
=======================================================
- Error Message: ${error.message}
- Stack Trace: 
${error.stack || 'No stack trace available'}

Please inspect the system logs or the Prisma database (BlogLog ID: ${blogLogId}) for more details.

Best regards,
Innovaft AI Automation Engine`;
                const htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #f5c6cb; border-radius: 4px; padding: 20px; background-color: #f8d7da; color: #721c24;">
            <h2 style="margin-top: 0; color: #721c24; border-bottom: 2px solid #f5c6cb; padding-bottom: 10px;">⚠️ Critical System Alert</h2>
            <p><strong>Innovaft Blog Automation System has failed repeatedly.</strong></p>
            <p>A blog generation job has exhausted all <strong>${maxAttempts}</strong> attempts and failed to compile or publish.</p>
            
            <div style="background: #ffffff; padding: 15px; border-radius: 4px; color: #333333; margin: 15px 0; border: 1px solid #ddd;">
              <h3 style="margin-top: 0; color: #333;">Job Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="width: 120px; font-weight: bold; padding: 4px 0;">Job ID:</td><td>${job.id}</td></tr>
                <tr><td style="font-weight: bold; padding: 4px 0;">Blog Title:</td><td>"${title}"</td></tr>
                <tr><td style="font-weight: bold; padding: 4px 0;">Slug:</td><td><code>${slug}</code></td></tr>
                <tr><td style="font-weight: bold; padding: 4px 0;">Keywords:</td><td>${keywords?.join(', ') || 'None'}</td></tr>
                <tr><td style="font-weight: bold; padding: 4px 0;">Timestamp:</td><td>${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</td></tr>
              </table>
            </div>

            <div style="background: #2b2b2b; padding: 15px; border-radius: 4px; color: #ff6b6b; font-family: monospace; font-size: 13px; white-space: pre-wrap; overflow-x: auto; margin-top: 15px;">
              <strong>Error Message:</strong><br>${error.message}<br><br>
              <strong>Stack Trace:</strong><br>${error.stack || 'No stack trace available'}
            </div>
            
            <p style="font-size: 12px; color: #6c757d; margin-top: 20px; text-align: center;">
              This is an auto-generated system message from Innovaft AI Engine. Please do not reply.
            </p>
          </div>
        `;
                this.mailService.sendMail(recipient, subject, textContent, htmlContent)
                    .catch(mailErr => this.logger.error(`❌ BlogJob: Failed to send failure notification email: ${mailErr.message}`));
            }
            throw error;
        }
    }
    async processInlineImages(content, jobId) {
        const imageRegex = /!\[([^\]]*)\]\((https?:\/\/[^\)]+)\)/g;
        const matches = Array.from(content.matchAll(imageRegex));
        if (matches.length === 0)
            return content;
        this.logger.info(`BlogJob [${jobId}]: Found ${matches.length} inline images to replace with NVIDIA...`);
        let updatedContent = content;
        for (let i = 0; i < matches.length; i++) {
            const [fullMatch, alt, url] = matches[i];
            try {
                const promptMatch = url.match(/\/prompt\/([^?&]+)/);
                const nvidiaPrompt = promptMatch
                    ? decodeURIComponent(promptMatch[1]).replace(/-/g, ' ')
                    : alt || 'professional office technology';
                this.logger.info(`BlogJob [${jobId}]: Generating NVIDIA image ${i + 1}/${matches.length} for "${alt}"...`);
                const imageBuffer = await this.imageGenerator.generateNvidiaImage(nvidiaPrompt);
                if (imageBuffer) {
                    const filename = `inline-${jobId}-${i}.jpg`;
                    const mediaId = await this.strapiService.uploadImage(imageBuffer, filename);
                    const mediaUrl = await this.strapiService.getMediaUrl(mediaId);
                    if (mediaUrl) {
                        updatedContent = updatedContent.replace(fullMatch, `![${alt}](${mediaUrl})`);
                        this.logger.info(`BlogJob [${jobId}]: Inline image ${i + 1} replaced successfully.`);
                    }
                }
            }
            catch (err) {
                this.logger.warn(`BlogJob [${jobId}]: Failed to process inline image ${i + 1}: ${err.message}. Keeping original.`);
            }
        }
        return updatedContent;
    }
    async updateBlogLog(id, data) {
        try {
            await this.prisma.blogLog.update({
                where: { id },
                data,
            });
        }
        catch (error) {
            this.logger.warn(`BlogJob: Failed to update BlogLog ${id} — ${error.message}`);
        }
    }
};
exports.BlogJobProcessor = BlogJobProcessor;
exports.BlogJobProcessor = BlogJobProcessor = __decorate([
    (0, bullmq_1.Processor)('blog-generation', {
        concurrency: 1,
    }),
    __param(6, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [blog_generator_service_1.BlogGeneratorService,
        image_generator_service_1.ImageGeneratorService,
        strapi_service_1.StrapiService,
        prisma_service_1.PrismaService,
        config_1.ConfigService,
        mail_service_1.MailService,
        winston_1.Logger])
], BlogJobProcessor);
//# sourceMappingURL=blog-job.processor.js.map