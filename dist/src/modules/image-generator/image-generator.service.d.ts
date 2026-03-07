import { ConfigService } from '@nestjs/config';
import { Logger } from 'winston';
export declare class ImageGeneratorService {
    private readonly configService;
    private readonly logger;
    private brandName;
    constructor(configService: ConfigService, logger: Logger);
    generateBannerImage(title: string): Promise<Buffer>;
    private drawDynamicBackground;
    private drawDecorativeElements;
    private drawTitleText;
    private drawBrandWatermark;
    private drawBorder;
    private wrapText;
    private tryRegisterFont;
}
