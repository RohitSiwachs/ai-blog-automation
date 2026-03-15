
const axios = require('axios');
const fs = require('fs');

async function test(name, url) {
  console.log(`\nTesting ${name}: ${url}`);
  try {
    const start = Date.now();
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
    console.log(`${name} Success: ${res.data.length} bytes in ${Date.now() - start}ms`);
    fs.writeFileSync(`test-${name}.jpg`, res.data);
    return true;
  } catch (e) {
    console.log(`${name} Failed: ${e.message}`);
    return false;
  }
}

async function run() {
  const seed = Math.floor(Math.random() * 90000000) + 10000000;
  
  // 1. Simple No Model (Default)
  await test('default', `https://image.pollinations.ai/prompt/digital-literacy-students?width=1200&height=630&nologo=true&seed=${seed}`);
  
  // 2. Turbo
  await test('turbo', `https://image.pollinations.ai/prompt/digital-literacy-students?width=1200&height=630&nologo=true&seed=${seed}&model=turbo`);
  
  // 3. Search Model
  await test('search', `https://image.pollinations.ai/prompt/digital-literacy-students?width=1200&height=630&nologo=true&seed=${seed}&model=search`);
}

run();
