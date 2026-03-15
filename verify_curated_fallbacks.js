
const axios = require('axios');
const fs = require('fs');

async function testFinalPipeline() {
  const fallbacks = [
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200&h=630&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200&h=630&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?q=80&w=1200&h=630&auto=format&fit=crop'
  ];
  
  for (let i = 0; i < fallbacks.length; i++) {
    console.log(`Testing Curated Fallback ${i+1}...`);
    try {
      const res = await axios.get(fallbacks[i], { responseType: 'arraybuffer', timeout: 15000 });
      fs.writeFileSync(`final-fallback-${i+1}.jpg`, Buffer.from(res.data));
      console.log(`  Success! saved final-fallback-${i+1}.jpg`);
    } catch (e) {
      console.log(`  Failed: ${e.message}`);
    }
  }
}

testFinalPipeline();
