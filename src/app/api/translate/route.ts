import { NextRequest, NextResponse } from 'next/server';
import * as deepl from 'deepl-node';
import fs from 'fs';
import path from 'path';
import os from 'os';

// V1: Single Key
const authKey = process.env.DEEPL_API_KEY;
let translator: deepl.Translator | null = null;

if (authKey) {
    translator = new deepl.Translator(authKey);
}

// Allow longer execution time for large files (5 minutes)
export const maxDuration = 300;

export async function POST(req: NextRequest) {
    if (!translator) {
        return NextResponse.json(
            { error: 'DeepL API Key is not configured.' },
            { status: 500 }
        );
    }

    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const targetLang = formData.get('targetLang') as deepl.TargetLanguageCode || 'ko';

        if (!file) {
            return NextResponse.json(
                { error: 'No file uploaded.' },
                { status: 400 }
            );
        }

        // Log request details
        console.log(`[Start] Translating '${file.name}' (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

        // Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Workaround: Write to /tmp (standard for serverless)
        const tmpDir = os.tmpdir();
        const inputPath = path.join(tmpDir, file.name);
        const outputPath = path.join(tmpDir, `translated_${file.name}`);

        fs.writeFileSync(inputPath, buffer);

        // Translate the document
        await translator.translateDocument(
            inputPath,
            outputPath,
            null, // Source language (null = auto-detect)
            targetLang
        );

        console.log(`[Success] Translation complete for '${file.name}'`);

        const translatedFileBuffer = fs.readFileSync(outputPath);

        // Cleanup
        try {
            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);
        } catch (e) {
            console.warn('Failed to cleanup temp files:', e);
        }

        return new NextResponse(translatedFileBuffer, {
            status: 200,
            headers: {
                'Content-Disposition': `attachment; filename="translated_${file.name}"`,
                'Content-Type': file.type,
            },
        });

    } catch (error: any) {
        console.error('[Error] Translation failed:', error);
        // Check for common DeepL errors
        if (error.message && error.message.includes('Authorization failure')) {
            console.error('Possible cause: Invalid API Key. If using DeepL Free, ensure key ends with ":fx".');
        }
        return NextResponse.json(
            { error: 'Translation failed.', details: error.message },
            { status: 500 }
        );
    }
}
