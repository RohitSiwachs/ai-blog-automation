
const axios = require('axios');
const fs = require('fs');

async function testSimple() {
  const url = 'https://image.pollinations.ai/prompt/nature-landscape?width=100&height=100';
  console.log(`Requesting: ${url}`);
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
    console.log(`Success: ${res.data.length} bytes`);
    fs.writeFileSync('test-simple.jpg', res.data);
  } catch (e) {
    console.log(`Failed: ${e.message}`);
  }
}

testSimple();
