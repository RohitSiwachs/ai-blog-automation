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
exports.MailService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const nodemailer = __importStar(require("nodemailer"));
let MailService = class MailService {
    configService;
    logger;
    transporter = null;
    fromEmail;
    constructor(configService, logger) {
        this.configService = configService;
        this.logger = logger;
        const host = this.configService.get('SMTP_HOST');
        const port = this.configService.get('SMTP_PORT') || 587;
        const user = this.configService.get('SMTP_USER');
        const pass = this.configService.get('SMTP_PASS');
        this.fromEmail = this.configService.get('SMTP_FROM') || 'noreply@innovaft.com';
        if (host && user && pass) {
            this.logger.info(`📧 MailService: Initializing SMTP transporter with host "${host}:${port}"`);
            this.transporter = nodemailer.createTransport({
                host,
                port,
                secure: port === 465,
                auth: { user, pass },
            });
        }
        else {
            this.logger.warn('⚠️ MailService: No SMTP credentials found in .env. MailService will run in Ethereal Sandbox Mode.');
        }
    }
    async getEtherealTransporter() {
        try {
            this.logger.info('📧 MailService: Generating dynamic Ethereal test SMTP account...');
            const testAccount = await nodemailer.createTestAccount();
            return nodemailer.createTransport({
                host: testAccount.smtp.host,
                port: testAccount.smtp.port,
                secure: testAccount.smtp.secure,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
            });
        }
        catch (err) {
            this.logger.error(`❌ MailService: Failed to create Ethereal test account: ${err.message}`);
            return null;
        }
    }
    async sendMail(to, subject, text, html) {
        this.logger.info(`📧 MailService: Dispatching email to "${to}" with subject: "${subject}"`);
        let activeTransporter = this.transporter;
        let isEthereal = false;
        if (!activeTransporter) {
            this.logger.warn('⚠️ MailService: Custom SMTP not configured. Falling back to Ethereal sandbox SMTP...');
            activeTransporter = await this.getEtherealTransporter();
            isEthereal = true;
        }
        if (activeTransporter) {
            try {
                const info = await activeTransporter.sendMail({
                    from: isEthereal ? '"Innovaft Alerts Sandbox" <noreply@innovaft.com>' : this.fromEmail,
                    to,
                    subject,
                    text,
                    html: html || text.replace(/\n/g, '<br>'),
                });
                if (isEthereal) {
                    const previewUrl = nodemailer.getTestMessageUrl(info);
                    this.logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    this.logger.info('📧 [ETHEREAL SANDBOX] OUTGOING EMAIL');
                    this.logger.info(`TO:           ${to}`);
                    this.logger.info(`SUBJECT:      ${subject}`);
                    this.logger.info(`PREVIEW URL:  ${previewUrl}`);
                    this.logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                }
                else {
                    this.logger.info(`📧 MailService: Email sent successfully via custom SMTP.`);
                }
                return true;
            }
            catch (error) {
                this.logger.error(`❌ MailService: Failed to send email via SMTP: ${error.message}`);
                this.logEmailContent(to, subject, text);
                return false;
            }
        }
        else {
            this.logEmailContent(to, subject, text);
            return true;
        }
    }
    logEmailContent(to, subject, text) {
        this.logger.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        this.logger.warn('📧 [MAIL FALLBACK MODE] OUTGOING EMAIL');
        this.logger.warn(`TO:      ${to}`);
        this.logger.warn(`FROM:    ${this.fromEmail}`);
        this.logger.warn(`SUBJECT: ${subject}`);
        this.logger.warn('-------------------------------------------------');
        this.logger.warn(text);
        this.logger.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        this.logger.warn('💡 Tip: Configure SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in your .env to send real emails.');
    }
};
exports.MailService = MailService;
exports.MailService = MailService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        winston_1.Logger])
], MailService);
//# sourceMappingURL=mail.service.js.map