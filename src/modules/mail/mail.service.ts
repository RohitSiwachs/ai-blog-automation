import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter | null = null;
  private readonly fromEmail: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT') || 587;
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    this.fromEmail = this.configService.get<string>('SMTP_FROM') || 'noreply@innovaft.com';

    if (host && user && pass) {
      this.logger.info(`📧 MailService: Initializing SMTP transporter with host "${host}:${port}"`);
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    } else {
      this.logger.warn(
        '⚠️ MailService: No SMTP credentials found in .env. MailService will run in Ethereal Sandbox Mode.',
      );
    }
  }

  /**
   * Helper to dynamically initialize Ethereal transporter when needed.
   */
  private async getEtherealTransporter(): Promise<nodemailer.Transporter | null> {
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
    } catch (err) {
      this.logger.error(`❌ MailService: Failed to create Ethereal test account: ${err.message}`);
      return null;
    }
  }

  /**
   * Send an email notification.
   */
  async sendMail(to: string, subject: string, text: string, html?: string): Promise<boolean> {
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
        } else {
          this.logger.info(`📧 MailService: Email sent successfully via custom SMTP.`);
        }
        return true;
      } catch (error) {
        this.logger.error(`❌ MailService: Failed to send email via SMTP: ${error.message}`);
        this.logEmailContent(to, subject, text);
        return false;
      }
    } else {
      this.logEmailContent(to, subject, text);
      return true;
    }
  }

  private logEmailContent(to: string, subject: string, text: string): void {
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
}
