// ============================================================
// Topic Engine Service
// Manages topic generation, deduplication, and clustering.
// Ensures no duplicate or semantically similar topics are used.
// ============================================================

import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { PrismaService } from '../../prisma/prisma.service';
import { StrapiService } from '../strapi-service/strapi.service';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import slugify from 'slugify';

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

/** Represents a topic ready for blog generation */
export interface GeneratedTopic {
  title: string;
  slug: string;
  keywords: string[];
  cluster: string;
}

@Injectable()
export class TopicEngineService {
  private genAI: GoogleGenerativeAI;
  private geminiModel: string;
  private nvidiaApiKey: string;
  private nvidiaModel: string;
  private nvidiaEndpoint: string;
  private aiProvider: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly strapiService: StrapiService,
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    // Gemini Config
    const geminiApiKey = this.configService.get<string>('gemini.apiKey')!;
    this.geminiModel = this.configService.get<string>('gemini.model')!;
    this.genAI = new GoogleGenerativeAI(geminiApiKey);

    // NVIDIA Config
    this.nvidiaApiKey = this.configService.get<string>('nvidia.apiKey')!;
    this.nvidiaModel = this.configService.get<string>('nvidia.model')!;
    this.nvidiaEndpoint = this.configService.get<string>('nvidia.chatEndpoint')!;

    // Provider choice
    this.aiProvider = this.configService.get<string>('aiProvider') || 'gemini';
  }

  /**
   * Main entry: generate N fresh, deduplicated topics for daily batch.
   */
  async generateTopics(count: number): Promise<GeneratedTopic[]> {
    this.logger.info(`TopicEngine: Generating ${count} new topics...`);

    // Step 1: Sync recent blogs from Strapi into local DB
    const isBypass = this.configService.get<boolean>('strapi.bypassMode') || false;
    if (!isBypass) {
      await this.syncStrapiTopics();
    } else {
      this.logger.info('TopicEngine: Skipping Strapi sync (BYPASS MODE)');
    }

    // Step 2: Load all used slugs and title keywords for dedup
    const usedTopics = await this.prisma.topic.findMany({
      select: { slug: true, title: true, keywords: true },
    });

    const usedSlugs = new Set(usedTopics.map((t) => t.slug));
    const usedTitleWords = usedTopics.map((t) => this.extractKeywords(t.title));

    // Step 3: Pick topics from clusters using round-robin strategy
    const year = new Date().getFullYear().toString();
    const freshTopics: GeneratedTopic[] = [];
    let clusterIndex = Math.floor(Math.random() * TOPIC_CLUSTERS.length);

    // Shuffle attempts to get diverse topics
    const maxAttempts = TOPIC_CLUSTERS.length * 15;
    let attempts = 0;

    while (freshTopics.length < count && attempts < maxAttempts) {
      const cluster = TOPIC_CLUSTERS[clusterIndex % TOPIC_CLUSTERS.length];
      const topicPool = [cluster.pillar, ...cluster.topics];

      for (const rawTitle of topicPool) {
        if (freshTopics.length >= count) break;

        const title = rawTitle.replace(/\{year\}/g, year);
        const slug = slugify(title, { lower: true, strict: true });

        // Skip if slug already used
        if (usedSlugs.has(slug)) continue;

        // Skip if semantically too similar (≥60% keyword overlap)
        const titleWords = this.extractKeywords(title);
        const isTooSimilar = usedTitleWords.some(
          (existingWords) =>
            this.calculateOverlap(titleWords, existingWords) >= 0.6,
        );
        if (isTooSimilar) continue;

        // Also check against topics already selected in this batch
        const batchWords = freshTopics.map((t) =>
          this.extractKeywords(t.title),
        );
        const tooSimilarToBatch = batchWords.some(
          (bw) => this.calculateOverlap(titleWords, bw) >= 0.6,
        );
        if (tooSimilarToBatch) continue;

        // Determine relevant keywords for this cluster
        const keywords = this.getKeywordsForCluster(cluster.cluster);

        freshTopics.push({ title, slug, keywords, cluster: cluster.cluster });
        usedSlugs.add(slug);
        usedTitleWords.push(titleWords);

        this.logger.info(
          `TopicEngine: Selected topic — "${title}" [${cluster.cluster}]`,
        );
      }

      clusterIndex++;
      attempts++;
    }

    // Step 3.5: If still need more topics, use AI to generate them
    if (freshTopics.length < count) {
      const remainingCount = count - freshTopics.length;
      this.logger.info(
        `TopicEngine: Static pool exhausted. Using AI to generate ${remainingCount} fresh topics...`,
      );

      try {
        // Pick a random cluster for context
        const randomCluster =
          TOPIC_CLUSTERS[Math.floor(Math.random() * TOPIC_CLUSTERS.length)];
        
        const aiTitles = await this.generateAITopics(
          randomCluster,
          remainingCount,
          Array.from(usedSlugs),
        );

        for (const title of aiTitles) {
          const slug = slugify(title, { lower: true, strict: true });
          
          // Final sanity check for duplicates (though AI is told to avoid them)
          if (usedSlugs.has(slug)) continue;

          const keywords = this.getKeywordsForCluster(randomCluster.cluster);
          freshTopics.push({
            title,
            slug,
            keywords,
            cluster: randomCluster.cluster,
          });
          usedSlugs.add(slug);
          
          this.logger.info(
            `TopicEngine: AI generated topic — "${title}" [${randomCluster.cluster}]`,
          );
        }
      } catch (e) {
        this.logger.error(`TopicEngine: AI generation failed — ${e.message}`);
      }
    }

    // Step 3.6: FINAL FALLBACK — Reuse static topics if still needed
    if (freshTopics.length < count) {
      const remainingCount = count - freshTopics.length;
      this.logger.warn(
        `TopicEngine: CRITICAL FALLBACK — Reusing ${remainingCount} existing topics with unique suffixes.`,
      );

      let reuseAttempts = 0;
      let clusterIdx = Math.floor(Math.random() * TOPIC_CLUSTERS.length);

      while (freshTopics.length < count && reuseAttempts < TOPIC_CLUSTERS.length * 5) {
        const cluster = TOPIC_CLUSTERS[clusterIdx % TOPIC_CLUSTERS.length];
        const topicPool = [cluster.pillar, ...cluster.topics];
        const rawTitle = topicPool[Math.floor(Math.random() * topicPool.length)];
        
        const title = rawTitle.replace(/\{year\}/g, year);
        // Add a random suffix to make it unique in DB and Strapi
        const suffix = Math.random().toString(36).substring(7);
        const slug = `${slugify(title, { lower: true, strict: true })}-${suffix}`;

        if (!usedSlugs.has(slug)) {
          const keywords = this.getKeywordsForCluster(cluster.cluster);
          freshTopics.push({ title, slug, keywords, cluster: cluster.cluster });
          usedSlugs.add(slug);
          this.logger.info(`TopicEngine: REUSED topic — "${title}" (suffix: ${suffix})`);
        }
        
        clusterIdx++;
        reuseAttempts++;
      }
    }

    // Step 4: Persist selected topics to local DB
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

    this.logger.info(
      `TopicEngine: Successfully generated ${freshTopics.length} topics`,
    );
    return freshTopics;
  }

  /**
   * Fetch the last 50 blogs from Strapi and store their titles
   * in the local Topic table to prevent duplicates.
   */
  private async syncStrapiTopics(): Promise<void> {
    try {
      this.logger.info('TopicEngine: Syncing recent topics from Strapi...');
      const recentBlogs = await this.strapiService.fetchRecentBlogs(50);

      for (const blog of recentBlogs) {
        const title = blog.title || '';
        const slug = blog.slug || slugify(title, { lower: true, strict: true });

        // Upsert: only insert if slug doesn't exist yet
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
    } catch (error) {
      this.logger.warn(
        `TopicEngine: Failed to sync from Strapi — ${error.message}. Continuing with local data.`,
      );
    }
  }

  /**
   * Use AI to generate NEW topics for a cluster.
   */
  private async generateAITopics(
    cluster: any,
    count: number,
    usedSlugs: string[],
  ): Promise<string[]> {
    const prompt = `You are a blog topic generator for "Innovaft", a professional IT and Digital Skills agency.
      The cluster is: "${cluster.cluster}".
      Pillar topic: "${cluster.pillar}".
      
      Existing topics in this cluster:
      ${cluster.topics.join('\n')}
      
      Recently used topics (DO NOT DUPLICATE OR BE TOO SIMILAR TO THESE):
      ${usedSlugs.slice(-30).join('\n')}
      
      Generate ${count * 2} (extra for filtering) NEW, unique, and highly engaging blog post titles for this cluster.
      The titles should be SEO-friendly and relevant to modern Indian students, small business owners, and aspiring freelancers.
      IMPORTANT RULES:
      1. DO NOT repeatedly use the word "Haryana" or "Hisar" in every title.
      2. Keep the titles broad, professional, and globally appealing, while still being relevant to an Indian audience.
      
      Output only the titles, one per line. No numbers, no extra text, no markdown fences.`;

    try {
      let text: string;

      if (this.aiProvider === 'nvidia') {
        text = await this.generateAITopicsWithNvidia(prompt);
      } else {
        text = await this.generateAITopicsWithGemini(prompt);
      }

      return text
        .split('\n')
        .map((t) => t.trim())
        .filter((t) => t.length > 10 && t.length < 100)
        .slice(0, count);
    } catch (error) {
      this.logger.error(`TopicEngine: AI topic generation failed using ${this.aiProvider.toUpperCase()} — ${error.message}`);
      return [];
    }
  }

  /**
   * Topics via Gemini
   */
  private async generateAITopicsWithGemini(prompt: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: this.geminiModel });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  /**
   * Topics via NVIDIA
   */
  private async generateAITopicsWithNvidia(prompt: string): Promise<string> {
    const payload: any = {
      model: this.nvidiaModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
      temperature: 0.8,
      top_p: 0.9,
      stream: false,
    };

    // Gemma 4 requires thinking kwargs as per user provided snippet
    if (this.nvidiaModel.includes('gemma-4')) {
      payload.chat_template_kwargs = { enable_thinking: true };
    }

    const response = await axios.post(this.nvidiaEndpoint, payload, {
      headers: {
        Authorization: `Bearer ${this.nvidiaApiKey}`,
        Accept: 'application/json',
      },
    });

    return response.data.choices[0].message.content;
  }

  /**
   * Extract meaningful keywords from a title (lowercased, stopwords removed).
   */
  private extractKeywords(title: string): string[] {
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

  /**
   * Calculate the Jaccard-like overlap between two keyword sets.
   * Returns a value between 0 (no overlap) and 1 (identical).
   */
  private calculateOverlap(wordsA: string[], wordsB: string[]): number {
    if (wordsA.length === 0 || wordsB.length === 0) return 0;

    const setA = new Set(wordsA);
    const setB = new Set(wordsB);
    let intersection = 0;

    for (const word of setA) {
      if (setB.has(word)) intersection++;
    }

    const union = new Set([...setA, ...setB]).size;
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Return relevant SEO keywords for a given cluster.
   */
  private getKeywordsForCluster(cluster: string): string[] {
    const keywordMap: Record<string, string[]> = {
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

    return (
      keywordMap[cluster] || [
        'Website Design',
        'Web Development',
        'Digital skills',
      ]
    );
  }
}
