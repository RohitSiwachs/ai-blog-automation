import { ConfigService } from '@nestjs/config';
import { Logger } from 'winston';
export declare class ImageGeneratorService {
    private readonly configService;
    private readonly logger;
    private brandName;
    private openai;
    private genAI;
    private nvidiaApiKey;
    private nvidiaEndpoint;
    constructor(configService: ConfigService, logger: Logger);
    generateBannerImage(title: string): Promise<Buffer>;
    private drawDynamicBackground;
    generateNvidiaImage(prompt: string): Promise<Buffer | null>;
    private generateSmartPrompt;
    private tryRegisterFont;
    private wrapText;
}
