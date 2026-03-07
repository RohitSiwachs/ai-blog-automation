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
exports.TopicEngineService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const prisma_service_1 = require("../../prisma/prisma.service");
const strapi_service_1 = require("../strapi-service/strapi.service");
const slugify_1 = __importDefault(require("slugify"));
const TOPIC_CLUSTERS = [
    {
        cluster: 'web-design',
        pillar: 'The Complete Guide to Modern Website Design in {year}',
        topics: [
            'How to Design a Professional Website That Converts Visitors Into Customers',
            'Top Website Design Trends Every Business Should Follow in {year}',
            'Why Responsive Website Design Is Essential for Haryana Businesses',
            'How Hisar Haryana Businesses Can Improve Website Design for Better SEO',
            'Mobile-First Website Design: A Step-by-Step Guide for Beginners',
            'Website Design Mistakes That Kill Your Conversion Rate',
            'Color Psychology in Website Design: How to Choose the Right Palette',
            'How Students in Hisar Haryana Can Learn Website Design From Scratch',
            'UX Design Principles Every Web Developer Should Master',
            'How to Create Landing Pages That Generate Leads in {year}',
        ],
    },
    {
        cluster: 'web-development',
        pillar: 'Web Development Roadmap: From Beginner to Professional Developer',
        topics: [
            'Best Programming Languages for Web Development in {year}',
            'Frontend vs Backend Development: Which Career Path Is Right for You',
            'How to Build Your First Website Using HTML CSS and JavaScript',
            'Why Haryana Students Should Learn Web Development for Freelancing',
            'Top Web Development Frameworks Every Developer Should Know',
            'WordPress vs Custom Web Development: Which Is Better for Your Business',
            'How to Become a Full Stack Web Developer in 6 Months',
            'Web Development Tools and Resources for Beginners in Hisar Haryana',
            'How to Build a Portfolio Website That Gets You Hired',
            'Essential Web Development Skills That Companies Look for in {year}',
        ],
    },
    {
        cluster: 'automation',
        pillar: 'Business Automation Guide: Save Time and Scale Your Company',
        topics: [
            'How AI Automation Can Transform Your Small Business Operations',
            'Top Automation Tools Every Digital Marketer Should Use in {year}',
            'How to Automate Your Content Marketing Strategy With AI Tools',
            'Why Businesses in Hisar Haryana Need Marketing Automation',
            'Email Marketing Automation: A Complete Guide for Beginners',
            'How to Use Automation to Scale Your Freelancing Business',
            'Social Media Automation: Best Practices and Tools for {year}',
            'How Haryana Students Can Use Automation to Build Passive Income',
            'CRM Automation: How to Manage Customer Relationships Efficiently',
            'The Future of Work: How Automation Is Changing IT Careers',
        ],
    },
    {
        cluster: 'ai-tools',
        pillar: 'The Ultimate Guide to AI Tools for Business and Education',
        topics: [
            'Best AI Tools for Content Creation and Blog Writing in {year}',
            'How AI Tools Can Help Students Study Smarter and Score Better',
            'AI Tools for Small Businesses: Boost Productivity Without Breaking the Budget',
            'How to Use AI Tools for SEO and Keyword Research',
            'Top AI Design Tools That Are Replacing Traditional Software',
            'How Haryana Students Can Leverage AI Tools for Career Growth',
            'AI Chatbots for Business: How to Set Up and Use Them Effectively',
            'How AI Tools Are Revolutionizing Digital Marketing in {year}',
            'Best Free AI Tools Every Freelancer Should Know About',
            'How to Use AI for Data Analysis and Business Decision Making',
        ],
    },
    {
        cluster: 'digital-skills',
        pillar: 'Digital Skills Every Student and Professional Needs in {year}',
        topics: [
            'Top Digital Skills Haryana Students Must Learn to Get Jobs in {year}',
            'How to Start Freelancing With Digital Skills From Hisar Haryana',
            'Best IT Courses for Students Who Want to Work in Technology',
            'How Digital Marketing Skills Can Launch Your Career in Haryana',
            'SEO Skills for Beginners: A Practical Guide for Indian Students',
            'Why Every Student Should Learn Coding as a Digital Skill',
            'Best Online Platforms to Learn IT Courses and Digital Skills for Free',
            'How to Build a Freelancing Career With Web Development Skills',
            'Digital Literacy: Why It Matters for Students in Hisar Haryana',
            'Top IT Courses That Guarantee Jobs in the Tech Industry in {year}',
        ],
    },
    {
        cluster: 'wordpress',
        pillar: 'WordPress Mastery: Build Professional Websites Without Coding',
        topics: [
            'How to Build a Professional WordPress Website in Under 24 Hours',
            'Best WordPress Plugins Every Website Owner Should Install in {year}',
            'WordPress SEO: The Complete Optimization Guide for Beginners',
            'How to Start a WordPress Blog and Earn Money Online',
            'WordPress vs Other CMS Platforms: Why WordPress Still Wins in {year}',
            'How Students in Hisar Haryana Can Build Portfolios With WordPress',
            'Top Free WordPress Themes for Business and Portfolio Websites',
            'WordPress Security: How to Protect Your Website From Hackers',
            'How to Speed Up Your WordPress Website for Better Rankings',
            'WordPress E-Commerce: How to Set Up an Online Store Easily',
        ],
    },
    {
        cluster: 'freelancing',
        pillar: 'Freelancing Guide: Start Earning Online From Anywhere in India',
        topics: [
            'How to Start Freelancing as a Student in Hisar Haryana',
            'Best Freelancing Platforms for Web Developers and Designers',
            'How to Price Your Freelancing Services and Get Paid What You Deserve',
            'Building a Personal Brand as a Freelancer in the IT Industry',
            'Common Freelancing Mistakes Beginners Make and How to Avoid Them',
            'How Haryana Students Can Earn Through Content Writing Freelancing',
            'Client Management Tips Every Freelancer Should Follow',
            'How to Build a Freelancing Portfolio That Attracts High-Paying Clients',
            'Time Management Strategies for Successful Freelancers',
            'Tax and Legal Tips for Freelancers in India',
        ],
    },
];
let TopicEngineService = class TopicEngineService {
    prisma;
    strapiService;
    configService;
    logger;
    constructor(prisma, strapiService, configService, logger) {
        this.prisma = prisma;
        this.strapiService = strapiService;
        this.configService = configService;
        this.logger = logger;
    }
    async generateTopics(count) {
        this.logger.info(`TopicEngine: Generating ${count} new topics...`);
        await this.syncStrapiTopics();
        const usedTopics = await this.prisma.topic.findMany({
            select: { slug: true, title: true, keywords: true },
        });
        const usedSlugs = new Set(usedTopics.map((t) => t.slug));
        const usedTitleWords = usedTopics.map((t) => this.extractKeywords(t.title));
        const year = new Date().getFullYear().toString();
        const freshTopics = [];
        let clusterIndex = Math.floor(Math.random() * TOPIC_CLUSTERS.length);
        const maxAttempts = TOPIC_CLUSTERS.length * 15;
        let attempts = 0;
        while (freshTopics.length < count && attempts < maxAttempts) {
            const cluster = TOPIC_CLUSTERS[clusterIndex % TOPIC_CLUSTERS.length];
            const topicPool = [cluster.pillar, ...cluster.topics];
            for (const rawTitle of topicPool) {
                if (freshTopics.length >= count)
                    break;
                const title = rawTitle.replace(/\{year\}/g, year);
                const slug = (0, slugify_1.default)(title, { lower: true, strict: true });
                if (usedSlugs.has(slug))
                    continue;
                const titleWords = this.extractKeywords(title);
                const isTooSimilar = usedTitleWords.some((existingWords) => this.calculateOverlap(titleWords, existingWords) >= 0.6);
                if (isTooSimilar)
                    continue;
                const batchWords = freshTopics.map((t) => this.extractKeywords(t.title));
                const tooSimilarToBatch = batchWords.some((bw) => this.calculateOverlap(titleWords, bw) >= 0.6);
                if (tooSimilarToBatch)
                    continue;
                const keywords = this.getKeywordsForCluster(cluster.cluster);
                freshTopics.push({ title, slug, keywords, cluster: cluster.cluster });
                usedSlugs.add(slug);
                usedTitleWords.push(titleWords);
                this.logger.info(`TopicEngine: Selected topic — "${title}" [${cluster.cluster}]`);
            }
            clusterIndex++;
            attempts++;
        }
        for (const topic of freshTopics) {
            await this.prisma.topic.create({
                data: {
                    title: topic.title,
                    slug: topic.slug,
                    keywords: topic.keywords,
                    cluster: topic.cluster,
                },
            });
        }
        this.logger.info(`TopicEngine: Successfully generated ${freshTopics.length} topics`);
        return freshTopics;
    }
    async syncStrapiTopics() {
        try {
            this.logger.info('TopicEngine: Syncing recent topics from Strapi...');
            const recentBlogs = await this.strapiService.fetchRecentBlogs(50);
            for (const blog of recentBlogs) {
                const title = blog.title || '';
                const slug = blog.slug || (0, slugify_1.default)(title, { lower: true, strict: true });
                const exists = await this.prisma.topic.findUnique({
                    where: { slug },
                });
                if (!exists) {
                    await this.prisma.topic.create({
                        data: {
                            title,
                            slug,
                            keywords: this.extractKeywords(title),
                            cluster: 'synced-from-strapi',
                        },
                    });
                }
            }
            this.logger.info('TopicEngine: Strapi sync complete');
        }
        catch (error) {
            this.logger.warn(`TopicEngine: Failed to sync from Strapi — ${error.message}. Continuing with local data.`);
        }
    }
    extractKeywords(title) {
        const stopWords = new Set([
            'the',
            'a',
            'an',
            'is',
            'are',
            'was',
            'were',
            'be',
            'been',
            'being',
            'have',
            'has',
            'had',
            'do',
            'does',
            'did',
            'will',
            'would',
            'could',
            'should',
            'may',
            'might',
            'shall',
            'can',
            'need',
            'dare',
            'ought',
            'used',
            'to',
            'of',
            'in',
            'for',
            'on',
            'with',
            'at',
            'by',
            'from',
            'as',
            'into',
            'through',
            'during',
            'before',
            'after',
            'above',
            'below',
            'between',
            'out',
            'off',
            'over',
            'under',
            'again',
            'further',
            'then',
            'once',
            'and',
            'but',
            'or',
            'nor',
            'not',
            'so',
            'yet',
            'both',
            'either',
            'neither',
            'each',
            'every',
            'all',
            'any',
            'few',
            'more',
            'most',
            'other',
            'some',
            'such',
            'no',
            'only',
            'own',
            'same',
            'than',
            'too',
            'very',
            'just',
            'because',
            'about',
            'up',
            'it',
            'its',
            'that',
            'this',
            'these',
            'those',
            'what',
            'which',
            'who',
            'whom',
            'how',
            'when',
            'where',
            'why',
            'your',
            'you',
            'we',
            'they',
        ]);
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter((word) => word.length > 2 && !stopWords.has(word));
    }
    calculateOverlap(wordsA, wordsB) {
        if (wordsA.length === 0 || wordsB.length === 0)
            return 0;
        const setA = new Set(wordsA);
        const setB = new Set(wordsB);
        let intersection = 0;
        for (const word of setA) {
            if (setB.has(word))
                intersection++;
        }
        const union = new Set([...setA, ...setB]).size;
        return union > 0 ? intersection / union : 0;
    }
    getKeywordsForCluster(cluster) {
        const keywordMap = {
            'web-design': [
                'Website Design',
                'Web Development',
                'Digital skills',
                'Hisar Haryana',
            ],
            'web-development': [
                'Web Development',
                'IT courses',
                'Digital skills',
                'Freelancing',
                'Haryana students',
            ],
            automation: ['Automation', 'AI tools', 'Digital skills', 'Hisar Haryana'],
            'ai-tools': [
                'AI tools',
                'Automation',
                'Digital skills',
                'Haryana students',
            ],
            'digital-skills': [
                'Digital skills',
                'IT courses',
                'Freelancing',
                'Hisar Haryana',
                'Haryana students',
            ],
            wordpress: [
                'WordPress',
                'Website Design',
                'Web Development',
                'Hisar Haryana',
            ],
            freelancing: [
                'Freelancing',
                'Digital skills',
                'Hisar Haryana',
                'Haryana students',
            ],
        };
        return (keywordMap[cluster] || [
            'Website Design',
            'Web Development',
            'Digital skills',
        ]);
    }
};
exports.TopicEngineService = TopicEngineService;
exports.TopicEngineService = TopicEngineService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        strapi_service_1.StrapiService,
        config_1.ConfigService,
        winston_1.Logger])
], TopicEngineService);
//# sourceMappingURL=topic-engine.service.js.map