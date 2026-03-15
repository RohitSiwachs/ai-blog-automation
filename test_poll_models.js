
const axios = require('axios');
const fs = require('fs');

async function testPollinations() {
  const models = ['flux', 'turbo', 'unity'];
  const title = "WordPress Security";
  
  for (const model of models) {
    console.log(`Testing model: ${model}`);
    const prompt = encodeURIComponent(`${title}, professional technology background, cinematic lighting, 4k`);
    const url = `https://image.pollinations.ai/prompt/wp-sec?prompt=${prompt}&width=1200&height=630&nologo=true&seed=${Math.floor(Math.random()*1000)}&model=${model}`;
    
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
      console.log(`  Success! ${model} returned ${response.data.length} bytes`);
      fs.writeFileSync(`test-${model}.jpg`, Buffer.from(response.data));
    } catch (e) {
      console.log(`  Failed! ${model} error: ${e.message}`);
      if (e.response) console.log(`    Status: ${e.response.status}`);
    }
  }
}

testPollinations();
