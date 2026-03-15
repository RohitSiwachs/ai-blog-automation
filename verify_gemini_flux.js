
const { ImageGeneratorService } = require('./dist/src/modules/image-generator/image-generator.service');

// Mock dependencies
const mockLogger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  warn: (msg) => console.log(`[WARN] ${msg}`),
  error: (msg) => console.log(`[ERROR] ${msg}`),
};

const mockConfig = {
  get: (key) => {
    if (key === 'OPENAI_API_KEY') return 'sk-placeholder';
    if (key === 'gemini.apiKey') return process.env.GEMINI_API_KEY;
    if (key === 'brand.name') return 'TechBlog';
    return null;
  }
};

const mockOpenAI = {
  images: {
    generate: async () => { 
      console.log("[MOCK] Simulating DALL-E Billing Limit...");
      throw new Error('Billing hard limit reached'); 
    }
  }
};

async function verifyGeminiPrompting() {
  console.log("Starting Gemini-Enhanced Fallback Verification...");
  const service = new ImageGeneratorService(mockConfig, mockLogger);
  
  // Override openai to force fallbacks
  service.openai = mockOpenAI;
  
  try {
    const result = await service.generateBannerImage("Cybersecurity Trends 2026: Why WordPress Users Should Worry");
    console.log("Success! Image generated with Gemini + Flux (Buffer length):", result.length);
  } catch (e) {
    console.error("Verification Failed:", e);
  }
}

verifyGeminiPrompting().catch(console.error);
