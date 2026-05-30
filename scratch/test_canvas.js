const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

async function testCanvas() {
  const IMAGE_WIDTH = 1200;
  const IMAGE_HEIGHT = 630;
  
  console.log('Simulating canvas rendering of background image...');

  try {
    const inputImagePath = path.join(__dirname, 'test_image.png');
    if (!fs.existsSync(inputImagePath)) {
      console.error('Error: scratch/test_image.png does not exist. Run test_nvidia_image.js first.');
      return;
    }

    const imageBuffer = fs.readFileSync(inputImagePath);
    const canvas = createCanvas(IMAGE_WIDTH, IMAGE_HEIGHT);
    const ctx = canvas.getContext('2d');

    const bgImage = await loadImage(imageBuffer);
    console.log('Loaded bgImage metadata — Width:', bgImage.width, 'Height:', bgImage.height);

    const scale = Math.max(IMAGE_WIDTH / bgImage.width, IMAGE_HEIGHT / bgImage.height);
    const x = (IMAGE_WIDTH / 2) - (bgImage.width / 2) * scale;
    const y = (IMAGE_HEIGHT / 2) - (bgImage.height / 2) * scale;
    console.log(`Calculated drawing params — Scale: ${scale}, X: ${x}, Y: ${y}`);

    ctx.drawImage(bgImage, x, y, bgImage.width * scale, bgImage.height * scale);

    const outputBuffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });
    const outputPath = path.join(__dirname, 'test_canvas_output.jpg');
    fs.writeFileSync(outputPath, outputBuffer);

    console.log('--- Success ---');
    console.log('Output image saved to:', outputPath);
    console.log('Output image size (bytes):', outputBuffer.length);
  } catch (error) {
    console.error('--- Failed ---');
    console.error(error);
  }
}

testCanvas();
