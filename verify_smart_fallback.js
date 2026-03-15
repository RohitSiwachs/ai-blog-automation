
const OpenAI = require('openai');
const axios = require('axios');
const fs = require('fs');

async function testSmartFallback() {
  const apiKey = "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";
  const openai = new OpenAI({ apiKey });

  const title = "Future of Smart Cities and IoT";
  console.log(`Testing Smart Fallback for title: "${title}"`);

  // Stage 1: Attempt OpenAI
  let buffer;
  let method = "OpenAI DALL-E 3";
  
  try {
    console.log("Tier 1 - Attempting OpenAI...");
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: `A professional, high-quality, photorealistic cinematic background for a blog post titled "${title}". 8k resolution.`,
      n: 1, size: "1024x1024"
    });
    const imgResp = await axios.get(response.data[0].url, { responseType: 'arraybuffer' });
    buffer = Buffer.from(imgResp.data);
    console.log("Tier 1 Success (OpenAI)");
  } catch (e) {
    console.warn(`Tier 1 Failed: ${e.message}. Falling back to Tier 2 (Flux)...`);
    
  // Stage 2: Attempt Flux
  if (!buffer) {
    method = "Pollinations Flux";
    try {
      console.log("Tier 2 - Attempting Flux...");
      const fullPrompt = encodeURIComponent(`${title}. photorealistic, high dynamic range, 8k, cinematic`);
      const fluxUrl = `https://image.pollinations.ai/prompt/smart-cities?prompt=${fullPrompt}&width=1200&height=630&nologo=true&seed=12345678&model=flux`;
      const response = await axios.get(fluxUrl, { responseType: 'arraybuffer', timeout: 30000 });
      buffer = Buffer.from(response.data);
      console.log("Tier 2 Success (Flux)");
    } catch (e) {
      console.warn(`Tier 2 Failed: ${e.message}. Falling back to Tier 3 (Turbo)...`);
    }
  }

  // Stage 3: Attempt Turbo
  if (!buffer) {
    method = "Pollinations Turbo";
    try {
      console.log("Tier 3 - Attempting Turbo...");
      const turboUrl = `https://image.pollinations.ai/prompt/smart-cities?prompt=${encodeURIComponent(title)}&width=1200&height=630&nologo=true&seed=12345678&model=turbo`;
      const response = await axios.get(turboUrl, { responseType: 'arraybuffer', timeout: 20000 });
      buffer = Buffer.from(response.data);
      console.log("Tier 3 Success (Turbo)");
    } catch (e) {
      console.warn(`Tier 3 Failed: ${e.message}. Falling back to Tier 4 (LoremFlickr)...`);
    }
  }

  // Stage 4: Attempt LoremFlickr
  if (!buffer) {
    method = "LoremFlickr";
    try {
      console.log("Tier 4 - Attempting LoremFlickr...");
      const lfUrl = `https://loremflickr.com/1200/630/technology?random=123`;
      const response = await axios.get(lfUrl, { responseType: 'arraybuffer', timeout: 15000 });
      buffer = Buffer.from(response.data);
      console.log("Tier 4 Success (LoremFlickr)");
    } catch (e) {
      console.error(`Tier 4 Failed: ${e.message}`);
    }
  }
  }

  if (buffer && buffer.length > 5000) {
    fs.writeFileSync('smart-fallback-test.jpg', buffer);
    console.log(`Success! Image saved using ${method} (${(buffer.length / 1024).toFixed(1)} KB)`);
  } else {
    console.error("All tiers failed to return a valid image.");
  }
}

testSmartFallback();
