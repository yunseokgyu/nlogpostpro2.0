import { NextResponse } from "next/server";
import { load } from "cheerio";

// --- Constants ---

// Category-specific System Instructions
const CATEGORY_PROMPTS: Record<string, string> = {
    "맛집/여행": `
    - 작성 스타일: 생생한 현장감과 오감을 자극하는 묘사 (맛, 향기, 분위기). 1인칭 후기 시점.
    - 필수 포함: 위치/지도 정보 언급, 주차 여부, 웨이팅 팁, 대표 메뉴의 상세 맛 표현.
    - 구조: 방문 계기 -> 매장 분위기/인테리어 -> 메뉴 주문 및 시식평 -> 총평 및 재방문 의사.
    `,
    "IT/테크": `
    - 작성 스타일: 전문적이고 분석적이며 신뢰감 있는 톤. 객관적인 스펙 비교.
    - 필수 포함: 장점과 단점의 명확한 구분, 결론(이런 분께 추천), 스펙 요약.
    - 구조: 제품 개요/언박싱 -> 주요 기능 및 성능 테스트 -> 장단점 분석 -> 경쟁 제품 비교 -> 결론.
    `,
    "뷰티/패션": `
    - 작성 스타일: 트렌디하고 감성적인 톤. 사용 전후의 변화 강조. 친근한(언니/누나 같은) 어조 가능.
    - 필수 포함: 제형/텍스처 묘사, 착용 샷 느낌, 퍼스널 컬러 언급, 구입처/가격 정보.
    - 구조: 고민(니즈) -> 제품 선택 이유 -> 사용 과정(텍스처/착용감) -> 비포/애프터 -> 추천 대상.
    `,
    "금융/재테크": `
    - 작성 스타일: 논리적이고 쉬운 설명. 신뢰도가 가장 중요하므로 과장 금지.
    - 필수 포함: 정확한 수치나 이율, 리스크 고지, 초보자도 이해할 수 있는 용어 풀이.
    - 구조: 이슈 제기(돈 모으는 고민 등) -> 상품/정보 상세 소개 -> 장점 및 유의사항 -> 실천 방법 요약.
    `,
    "일상/브이로그": `
    - 작성 스타일: 편안하고 친근한 일기장 같은 톤. 감정 표현 중심.
    - 필수 포함: 그 날의 기분, 날씨, 소소한 행복, 개인적인 생각.
    - 구조: 하루의 시작/계기 -> 주요 에피소드 -> 느낀 점 -> 마무리 인사.
    `,
    "건강/운동": `
    - 작성 스타일: 활기차고 동기부여를 주는 톤. 건강 정보는 정확하게.
    - 필수 포함: 운동 방법/섭취 방법, 주의사항, 기대 효과, 꾸준한 실천 강조.
    - 구조: 건강 고민 -> 해결책(운동/영양제) 소개 -> 루틴/방법 -> 실제 변화/후기 -> 독려.
    `,
    "육아/교육": `
    - 작성 스타일: 공감대 형성(엄마/아빠 마음). 따뜻하고 격려하는 톤.
    - 필수 포함: 아이의 반응, 교육 효과, 부모의 팁/노하우, 구매/정보 출처.
    - 구조: 육아 고민/상황 -> 아이템/정보 발견 -> 실제 적용기 -> 아이의 변화 -> 추천 멘트.
    `,
    "리뷰/후기": `
    - 작성 스타일: 솔직하고 가감 없는 "내돈내산" 느낌. 구매 고민 해결에 집중.
    - 필수 포함: 가격 대비 만족도(가성비), 구매 인증(선택), 배송/서비스 경험.
    - 구조: 구매 동기 -> 언박싱/첫인상 -> 실사용 장점 -> 실사용 단점 -> 3줄 요약.
    `
};

// Default Prompt for unknown categories
const DEFAULT_CATEGORY_PROMPT = `
    - 작성 스타일: 자연스럽고 가독성 좋은 블로그 문체.
    - 구조: 도입부(흥미 유발) -> 본론(정보 전달) -> 결론(요약 및 인사).
`;

export async function POST(req: Request) {
    try {
        const { title, keywords, apiKey, style, category, refUrl } = await req.json();

        // --- Validation ---
        if (!apiKey?.trim()) return NextResponse.json({ error: "API Key가 필요합니다" }, { status: 400 });
        if (!title?.trim()) return NextResponse.json({ error: "제목을 입력해주세요" }, { status: 400 });
        if (!keywords || !Array.isArray(keywords) || keywords.length === 0) return NextResponse.json({ error: "키워드를 1개 이상 입력해주세요" }, { status: 400 });

        let referenceContent = "";

        // --- Scraping Logic (Cheerio) ---
        if (refUrl?.trim()) {
            try {
                // Fetch the URL with a timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

                const fetchRes = await fetch(refUrl, {
                    signal: controller.signal,
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
                });
                clearTimeout(timeoutId);

                if (fetchRes.ok) {
                    const html = await fetchRes.text();
                    const $ = load(html);

                    // Remove scripts, styles, etc.
                    $('script, style, noscript, header, footer, nav, iframe, svg').remove();

                    // Extract text from common blog content areas
                    // Naive attempt to find main content: look for article, main, or divs with 'content'/'post' class
                    let text = $('article').text() || $('main').text() || $('.post-content').text() || $('.entry-content').text() || $('body').text();

                    // Clean up whitespace
                    text = text.replace(/\s+/g, ' ').trim();

                    // Truncate to ~1000 chars to serve as a style sample
                    referenceContent = text.slice(0, 1500);
                }
            } catch (err) {
                console.error("Scraping failed:", err);
                // Continue without reference if scraping fails
            }
        }

        // --- Prompt Engineering ---

        const categoryInstruction = CATEGORY_PROMPTS[category] || DEFAULT_CATEGORY_PROMPT;

        // Ensure keywords are valid strings
        const safeKeywords = keywords.map(k => String(k).trim()).filter(Boolean);
        const keywordInstruction = safeKeywords.map(k => `"${k}"`).join(', ');

        const prompt = `
당신은 네이버 블로그 마케팅 전문가이자 전문 작가입니다. 아래 요청사항에 맞춰 완벽한 블로그 포스팅을 작성하세요.

[기본 설정]
- 주제(제목): ${title}
- 카테고리: ${category}
- 핵심 키워드 리스트: [${keywordInstruction}]

[작성 가이드라인]
${categoryInstruction}

[필수 요구사항 (매우 중요)]
1. **키워드 반복**: 위 "핵심 키워드 리스트"에 있는 단어들을 본문 내에 **각각 최소 10회 이상** 자연스럽게 녹여내세요. (단순 나열 금지, 문맥에 맞게 포함)
2. **글자 수**: 띄어쓰기를 제외한 순수 글자 수가 **정확히 1500자 ~ 1800자** 사이가 되도록 아주 길고 상세하게 작성하세요. 내용이 짧으면 절대 안됩니다.
3. **가독성**: 문단 사이에는 충분한 줄바꿈을 넣고, 중간중간 소제목(##)이나 이모지(😊)를 적절히 활용하여 지루하지 않게 하세요.

${style ? `
[추가 스타일 요청]
- 사용자가 지정한 스타일: "${style}" (이 분위기를 최대한 살려주세요)
` : ''}

${referenceContent ? `
[스타일 참고 자료 (Reference)]
- 사용자가 제공한 아래 블로그 글의 문체, 어조, 줄바꿈 방식을 분석하여 이와 유사한 스타일로 작성하세요. (내용을 베끼지는 말고 '스타일'만 모방하세요):
"""
${referenceContent}
...
"""
` : ''}

[작업 시작]
위 모든 지침을 숙지했으면, 이제 포스팅 본문을 작성해주세요. 서론-본론-결론을 명확히 하고, 바로 글 내용을 출력하세요.
`;

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

        // --- Post-Processing Stats ---
        const charCount = content.replace(/\s/g, '').length;
        const keywordCounts: Record<string, number> = {};

        safeKeywords.forEach(k => {
            // Case-insensitive count
            const regex = new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            keywordCounts[k] = (content.match(regex) || []).length;
        });

        return NextResponse.json({
            content,
            charCount,
            keywordCounts
        });

    } catch (error: any) {
        console.error(error);
        return NextResponse.json({
            error: `서버 오류: ${error.message}`
        }, { status: 500 });
    }
}
