import { ConfigService } from '@nestjs/config';
import { Logger } from 'winston';
export declare class MailService {
    private readonly configService;
    private readonly logger;
    private transporter;
    private readonly fromEmail;
    constructor(configService: ConfigService, logger: Logger);
    private getEtherealTransporter;
    sendMail(to: string, subject: string, text: string, html?: string): Promise<boolean>;
    private logEmailContent;
}
