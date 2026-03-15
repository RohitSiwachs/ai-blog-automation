
const axios = require('axios');
const fs = require('fs');

const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;

async function testTurbo() {
  const title = "Digital Literacy Students Hisar";
  const pathPart = title.toLowerCase().replace(/ /g, '-');
  const styleParams = 'photorealistic, professional photography, 8k';
  const fullPrompt = encodeURIComponent(`${title}. ${styleParams}`);
  const seed = Math.floor(Math.random() * 90000000) + 10000000;
  
  const turboUrl = `https://image.pollinations.ai/prompt/${pathPart}?prompt=${fullPrompt}&width=${IMAGE_WIDTH}&height=${IMAGE_HEIGHT}&nologo=true&seed=${seed}&model=turbo`;

  console.log(`Verifying Turbo Model (Fallback) URL: ${turboUrl}`);
  
  try {
    const start = Date.now();
    const response = await axios.get(turboUrl, { 
      responseType: 'arraybuffer',
      timeout: 20000, 
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    const bytes = Buffer.from(response.data);
    console.log(`Success! Received ${bytes.length} bytes in ${Date.now() - start}ms`);
    fs.writeFileSync('verified-turbo-banner.jpg', bytes);
  } catch (e) {
    console.error(`Turbo Verification Failed: ${e.message}`);
  }
}

testTurbo();
