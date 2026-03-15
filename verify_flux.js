
const axios = require('axios');
const fs = require('fs');

async function testFluxFallback() {
  const title = "Digital Future in Hisar Haryana";
  console.log(`Testing Flux Fallback for title: "${title}"`);

  const pathPart = title.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().split(/\s+/).slice(0, 5).join('-');
  const styleParams = 'photorealistic, professional photography, real life scene, 8k, cinematic lighting';
  const fullPrompt = encodeURIComponent(`${title}. ${styleParams}`);
  const seed = Math.floor(Math.random() * 90000000) + 10000000;
  
  const fluxUrl = `https://image.pollinations.ai/prompt/${pathPart}?prompt=${fullPrompt}&width=1200&height=630&nologo=true&seed=${seed}&model=flux`;
  
  console.log(`Flux URL: ${fluxUrl}`);

  try {
    const start = Date.now();
    const response = await axios.get(fluxUrl, { 
      responseType: 'arraybuffer',
      timeout: 45000, 
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    const buffer = Buffer.from(response.data);
    
    if (buffer.length > 5000) {
      fs.writeFileSync('verified-flux-fallback.jpg', buffer);
      console.log(`Success! Flux fallback image saved (${(buffer.length / 1024).toFixed(1)} KB)`);
    } else {
      console.log('Error: Flux returned small/empty image');
    }
    console.log(`Time taken: ${((Date.now() - start) / 1000).toFixed(1)}s`);
  } catch (e) {
    console.error(`Flux Failed: ${e.message}`);
  }
}

testFluxFallback();
