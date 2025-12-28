
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import * as cheerio from 'cheerio';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
    try {
        const { prompt, url, image } = await req.json();

        if (!prompt && !image && !url) {
            return NextResponse.json(
                { error: "Please provide a prompt, URL, or image." },
                { status: 400 }
            );
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        let contextData = "";

        // FETCH URL CONTENT IF PROVIDED
        if (url) {
            try {
                const response = await fetch(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
                });
                const html = await response.text();
                const $ = cheerio.load(html);

                // Remove scripts/styles for cleaner context
                $('script').remove();
                $('style').remove();

                const title = $('title').text() || "";
                const metaDesc = $('meta[name="description"]').attr('content') || "";
                // Get text, collapse whitespace, limit to 20k chars
                const initialText = $('body').text().replace(/\s+/g, ' ').substring(0, 20000);

                contextData += `\n[REFERENCE WEBSITE DATA]\nURL: ${url}\nTitle: ${title}\nDescription: ${metaDesc}\nContent Snippet: ${initialText}\n`;
            } catch (e) {
                console.error("Failed to fetch URL:", e);
                contextData += `\n[REFERENCE WEBSITE ERROR] Could not fetch content from ${url}. Use the URL itself as a style hint.`;
            }
        }

        let systemPrompt = `
      You are an expert web developer and UI designer.
      Your task is to generate a fully functional, premium-looking single-page website.
      
      RULES:
      1. RETURN ONLY JSON. No markdown, no code blocks.
      2. The JSON must have exactly two fields: "html" and "css".
      3. "html": semantic HTML5 body content (no <html>/head tags).
      4. "css": complete premium CSS (no external frameworks, use Flexbox/Grid).
      5. Use clean class names.
      6. Use 'https://placehold.co/600x400' for placeholders.
      
      CONTEXT:
      User Request: "${prompt || "Recreate the style/content of the provided reference."}"
      ${contextData}
    `;

        const parts: any[] = [{ text: systemPrompt }];

        if (image) {
            // Expect base64 data URL
            const matches = image.match(/^data:(.+);base64,(.+)$/);
            if (matches) {
                parts.push({
                    inlineData: {
                        data: matches[2],
                        mimeType: matches[1]
                    }
                });
            }
        }

        const result = await model.generateContent({
            contents: [{ role: "user", parts: parts }],
            generationConfig: {
                responseMimeType: "application/json",
            },
        });

        const output = result.response.text();
        let jsonResponse;
        try {
            jsonResponse = JSON.parse(output);
        } catch (e) {
            console.error("Failed to parse JSON:", output);
            // Attempt manual extraction if JSON parse fails
            const jsonMatch = output.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try { jsonResponse = JSON.parse(jsonMatch[0]); } catch (e2) { }
            }
            if (!jsonResponse) {
                return NextResponse.json(
                    { error: "Failed to generate valid JSON" },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json(jsonResponse);

    } catch (error) {
        console.error("Generation error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
