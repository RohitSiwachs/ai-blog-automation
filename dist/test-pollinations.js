"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
async function test() {
    const title = "Testing blog banner with modern 3d tech illustration";
    const prompt = encodeURIComponent(title);
    const url = `https://image.pollinations.ai/prompt/${prompt}?width=1200&height=630&nologo=true`;
    console.log("Fetching URL:", url);
    try {
        const response = await axios_1.default.get(url, { responseType: 'arraybuffer' });
        console.log("Success! Image size:", response.data.length);
    }
    catch (error) {
        console.error("Failed to fetch image:", error.message);
    }
}
test();
//# sourceMappingURL=test-pollinations.js.map