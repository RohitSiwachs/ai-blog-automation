
const axios = require('axios');
const fs = require('fs');

async function testPollinations() {
  const title = "Digital Literacy for Students in Hisar Haryana";
  const pathPart = title.toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join('-');
    
  // Flux generally likes descriptive prompts. 
  // Pollinations Flux often works best if we put the style and prompt together.
  const styleParams = 'photorealistic, high quality, 8k, cinematic lighting, professional photography';
  const fullPrompt = encodeURIComponent(`${title}. ${styleParams}`);
  const seed = Math.floor(Math.random() * 90000000) + 10000000;
  
  const fluxUrl = `https://image.pollinations.ai/prompt/${pathPart}?prompt=${fullPrompt}&width=1200&height=630&nologo=true&seed=${seed}&model=flux`;

  console.log(`Testing Flux: ${fluxUrl}`);
  try {
    const start = Date.now();
    const res = await axios.get(fluxUrl, { responseType: 'arraybuffer', timeout: 45000 });
    console.log(`Flux Success: ${res.data.length} bytes in ${Date.now() - start}ms`);
    fs.writeFileSync('test-flux.jpg', res.data);
  } catch (e) {
    console.log(`Flux Failed: ${e.message}`);
    if (e.response) {
       console.log(`Status: ${e.response.status}`);
       console.log(`Data: ${e.response.data.toString()}`);
    }
  }
}

testPollinations();
