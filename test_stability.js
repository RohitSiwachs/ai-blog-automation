
const axios = require('axios');

async function test(name, url) {
  console.log(`Testing ${name}: ${url}`);
  try {
    const res = await axios.get(url, { timeout: 10000 });
    console.log(`${name} Success: ${res.status}`);
  } catch (e) {
    console.log(`${name} Failed: ${e.message}`);
    if (e.response) console.log(`Status: ${e.response.status}`);
  }
}

async function run() {
  await test('No params', 'https://image.pollinations.ai/prompt/modern-office');
  await test('With Width/Height', 'https://image.pollinations.ai/prompt/modern-office?width=1024&height=1024');
  await test('With Model=Turbo', 'https://image.pollinations.ai/prompt/modern-office?model=turbo');
  await test('With Model=Flux', 'https://image.pollinations.ai/prompt/modern-office?model=flux');
  await test('With Model=Search', 'https://image.pollinations.ai/prompt/modern-office?model=search');
}

run();
