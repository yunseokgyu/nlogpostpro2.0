import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        // 1. 스타일(문체/성향) 변수 추출
        const { title, keyword, apiKey, style } = await req.json();

        if (!apiKey?.trim()) {
            return NextResponse.json({ error: "API Key를 입력해주세요" }, { status: 400 });
        }

        if (!title?.trim()) {
            return NextResponse.json({ error: "제목을 입력해주세요" }, { status: 400 });
        }

        if (!keyword?.trim()) {
            return NextResponse.json({ error: "핵심 키워드를 입력해주세요" }, { status: 400 });
        }

        const prompt = `한국어로 블로그 글을 작성해주세요.

제목: ${title}
핵심 키워드: ${keyword}
${style ? `\n작성 성향/문체: ${style}\n` : ''}

중요한 요구사항:
1. "${keyword}" 키워드를 글 전체에서 정확히 10회 사용하세요 (자연스럽게 분산)
2. 전체 글자 수는 띄어쓰기를 제외하고 정확히 1500자여야 합니다
3. ${style ? `위에서 지정한 "작성 성향/문체"를 철저히 반영하여 작성하세요` : '자연스럽고 읽기 쉬운 문체로 작성하세요'}
4. 도입부, 본문, 결론 구조를 갖추세요

글을 작성하세요:`;

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-goog-api-key': apiKey
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json({
                error: `API 오류: ${data.error?.message || '알 수 없는 오류'}`
            }, { status: response.status });
        }

        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!content) {
            return NextResponse.json({
                error: "생성된 내용이 없습니다"
            }, { status: 500 });
        }

        const keywordCount = (content.match(new RegExp(keyword, 'gi')) || []).length;
        const charCount = content.replace(/\s/g, '').length;

        return NextResponse.json({
            content,
            keywordCount,
            charCount
        });

    } catch (error: any) {
        return NextResponse.json({
            error: `오류: ${error.message}`
        }, { status: 500 });
    }
}
