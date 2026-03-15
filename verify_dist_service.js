
const { ImageGeneratorService } = require('./dist/src/modules/image-generator/image-generator.service');
const { Logger } = require('@nestjs/common');

// Mock dependencies
const mockLogger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  warn: (msg) => console.log(`[WARN] ${msg}`),
  error: (msg) => console.log(`[ERROR] ${msg}`),
};

const mockConfig = {
  get: (key) => {
    if (key === 'OPENAI_API_KEY') return 'sk-placeholder';
    return null;
  }
};

const mockOpenAI = {
  images: {
    generate: async () => { throw new Error('Simulated Quota Limit'); }
  }
};

async function testTier5() {
  console.log("Starting Tier 5 Verification...");
  const service = new ImageGeneratorService(mockConfig, mockLogger);
  
  // Override openai to force fallbacks
  service.openai = mockOpenAI;
  
  try {
    const result = await service.generateBannerImage("Test Blog Title for Better Rankings");
    console.log("Success! Image generated (Buffer length):", result.length);
  } catch (e) {
    console.error("Test Failed:", e);
  }
}

testTier5().catch(console.error);
