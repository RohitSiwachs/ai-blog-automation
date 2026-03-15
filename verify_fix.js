
const axios = require('axios');
const fs = require('fs');

// Mocking some dependencies to test the logic
const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;

async function testGeneration() {
  const title = "Digital Literacy for Students in Hisar";
  const pathPart = title.toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join('-');
    
  const styleParams = 'photorealistic, professional photography, real life scene, 8k, cinematic lighting';
  const fullPrompt = encodeURIComponent(`${title}. ${styleParams}`);
  const seed = Math.floor(Math.random() * 90000000) + 10000000;
  
  const fluxUrl = `https://image.pollinations.ai/prompt/${pathPart}?prompt=${fullPrompt}&width=${IMAGE_WIDTH}&height=${IMAGE_HEIGHT}&nologo=true&seed=${seed}&model=flux`;

  console.log(`Verifying Flux Model URL: ${fluxUrl}`);
  
  try {
    const start = Date.now();
    const response = await axios.get(fluxUrl, { 
      responseType: 'arraybuffer',
      timeout: 45000, 
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    const bytes = Buffer.from(response.data);
    console.log(`Success! Received ${bytes.length} bytes in ${Date.now() - start}ms`);
    
    if (bytes.length > 5000) {
      fs.writeFileSync('verified-flux-banner.jpg', bytes);
      console.log('Image saved to verified-flux-banner.jpg');
    } else {
      console.log('Warning: Image size is suspicious');
    }
  } catch (e) {
    console.error(`Verification Failed: ${e.message}`);
  }
}

testGeneration();
