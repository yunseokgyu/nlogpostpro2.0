import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

// Allow longer execution time (5 minutes)
export const maxDuration = 300;

export async function POST(req: NextRequest) {
    if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json(
            { error: 'Gemini API Key is not configured.' },
            { status: 500 }
        );
    }

    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const targetLang = formData.get('targetLang') as string || 'ko';

        if (!file) {
            return NextResponse.json(
                { error: 'No file uploaded.' },
                { status: 400 }
            );
        }

        console.log(`[Start] Translating '${file.name}' (${(file.size / 1024 / 1024).toFixed(2)} MB) with Gemini`);

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        let translatedText = '';

        // Handle different file types
        if (file.type === 'application/pdf') {
            // For PDF, send as inline data (Base64)
            const base64Data = buffer.toString('base64');
            const prompt = `Translate the following PDF document into Korean. Maintain the original tone and formatting as much as possible. Output ONLY the translated text.`;

            const result = await model.generateContent([
                prompt,
                {
                    inlineData: {
                        data: base64Data,
                        mimeType: 'application/pdf',
                    },
                },
            ]);
            translatedText = result.response.text();

        } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
            // For Text, send as prompt
            const textContent = buffer.toString('utf-8');
            const prompt = `Translate the following text into Korean. Maintain the original tone. Output ONLY the translated text:\n\n${textContent}`;

            const result = await model.generateContent(prompt);
            translatedText = result.response.text();
        } else {
            return NextResponse.json(
                { error: 'Unsupported file type for Gemini MVP. Please upload PDF or TXT.' },
                { status: 400 }
            );
        }

        console.log(`[Success] Translation complete for '${file.name}'`);

        // Return as a downloadable text file
        // Add BOM for Windows compatibility
        const responseBuffer = Buffer.from('\uFEFF' + translatedText, 'utf-8');

        // Clean filename: replace original extension with .txt
        const originalName = file.name;
        const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
        const newFilename = `${baseName}_translated.txt`;

        return new NextResponse(responseBuffer, {
            status: 200,
            headers: {
                'Content-Disposition': `attachment; filename="${encodeURIComponent(newFilename)}"`,
                'Content-Type': 'text/plain; charset=utf-8',
            },
        });

    } catch (error: any) {
        console.error('[Error] Translation failed:', error);
        return NextResponse.json(
            { error: 'Translation failed.', details: error.message },
            { status: 500 }
        );
    }
}
