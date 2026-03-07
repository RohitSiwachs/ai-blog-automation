"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildBlogPrompt = buildBlogPrompt;
function buildBlogPrompt(title, keywords) {
    const keywordList = keywords.join(', ');
    const today = new Date().toISOString();
    return `You are an expert SEO content writer for a tech blog (blog.innovaft.com). Write a comprehensive, engaging, and SEO-optimized blog post.

TOPIC: "${title}"
TARGET KEYWORDS: ${keywordList}
TODAY'S DATE: ${today}

=== CONTENT REQUIREMENTS ===
1. Write 1500-2000 words of engaging, highly conversational content.
2. Formatted in MARKDOWN (use #, ##, ###, **bold**, *italic*, bullet lists, etc.).
3. TONE & STYLE: Write like a passionate, experienced human expert talking directly to a friend. Use varied sentence lengths. Ask rhetorical questions. Include brief personal anecdotes or metaphors. 
4. FORBIDDEN AI CLICHÉS: NEVER use phrases like "In today's fast-paced digital world", "Delve into", "Navigating the complexities", "In conclusion", or "A testament to".
5. INLINE IMAGES: You MUST insert exactly 2-3 relevant images inside the body content (not at the very start) using this exact markdown format (keep the styling keywords at the end): 
![Detailed descriptive alt text for UI rendering](https://api.airforce/imagine?prompt={extremely-detailed-visual-prompt-with-words-separated-by-hyphens}-modern-3d-tech-illustration-flat-vector-style-vibrant-colors)
*Example inline image*: ![A futuristic robot doing marketing](https://api.airforce/imagine?prompt=a-futuristic-robot-analyzing-marketing-data-graphs-neon-lights-modern-3d-tech-illustration-flat-vector-style-vibrant-colors)
6. Naturally incorporate the target keywords throughout
7. NO filler content — every paragraph must provide value

=== SEO REQUIREMENTS ===
- seoTitle: Google-optimized, max 60 chars, includes primary keyword
- metaDescription: Compelling, exactly 150-160 chars, includes keyword
- ogTitle: Slightly different from seoTitle, more engaging/clickbait-friendly, max 70 chars
- ogDescription: More conversational than metaDescription, 150-200 chars
- metaKeywords: comma-separated, 6-8 keywords
- description: Short excerpt shown on blog listing, max 180 chars, no HTML

=== TAGS REQUIREMENT ===
Generate EXACTLY 2 short tags relevant to the topic (e.g. "AI", "Web Dev"). No more, no less.

=== OUTPUT FORMAT ===
Respond with ONLY this JSON (no markdown fences, no extra text):
{
  "seoTitle": "Max 60 char SEO title",
  "metaDescription": "150-160 char meta description",
  "ogTitle": "Max 70 char engaging OG title",
  "ogDescription": "150-200 char OG description",
  "metaKeywords": "keyword1, keyword2, keyword3, keyword4, keyword5",
  "description": "Short blog listing excerpt, max 180 chars",
  "tags": ["Tag1", "Tag2", "Tag3"],
  "content": "# Your H1 Title Here\\n\\nFirst paragraph...\\n\\n## Section 1\\n\\nContent...\\n\\n## Section 2\\n\\nContent..."
}

CRITICAL RULES:
- Return ONLY valid JSON. No markdown code fences. No text before or after.
- "content" MUST be in Markdown format (not HTML).
- In JSON strings, escape newlines as \\n and quotes as \\".
- metaDescription MUST be 150-160 characters — count carefully.
- Make content sound human-written, not AI-generated.`;
}
//# sourceMappingURL=prompts.js.map