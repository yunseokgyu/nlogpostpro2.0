import https from 'https';

class FiveSimClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://5sim.net/v1';
        this.headers = {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json'
        };
    }

    _request(endpoint, method = 'GET') {
        return new Promise((resolve, reject) => {
            const url = new URL(`${this.baseUrl}${endpoint}`);
            const options = {
                hostname: url.hostname,
                path: url.pathname + url.search,
                method: method,
                headers: this.headers
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            resolve(data); // JSON이 아닌 경우
                        }
                    } else {
                        reject(new Error(`요청 실패 (상태 코드 ${res.statusCode}): ${data}`));
                    }
                });
            });

            req.on('error', (e) => reject(e));
            req.end();
        });
    }

    async getProfile() {
        console.log('사용자 프로필 조회 중...');
        return await this._request('/user/profile');
    }

    async getPrices(country = 'any', product = 'any') {
        console.log(`가격 정보 조회 중 (국가: ${country}, 상품: ${product})...`);
        return await this._request(`/guest/prices?country=${country}&product=${product}`);
    }

    // Uncomment and use with caution - this spends money!
    /*
    async buyNumber(country, operator, product) {
        console.log(`Buying number for ${product} in ${country} (${operator})...`);
        return await this._request(`/user/buy/activation/${country}/${operator}/${product}`);
    }

    async checkOrder(orderId) {
        console.log(`Checking order ${orderId}...`);
        return await this._request(`/user/check/${orderId}`);
    }
    */
}

// --- 메인 실행 ---
// 사용자가 제공한 새 API 키
const API_KEY = process.env.FIVESIM_API_KEY || 'eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3OTcyMzQ1MDcsImlhdCI6MTc2NTY5ODUwNywicmF5IjoiZTE1ZWQ3OTZlNDEyZDMwMjJjZDhlZTFlNzU4YjIwZjYiLCJzdWIiOjM2NjUxNTB9.Sqo0W1kFBzqfk0u6VkztFKEOScKQsjUYJ6dmEy6z2ghQrpw1-JKaLa0zxyZ9uGWG6IScrMHF6cdSNQAwPSppG_OaIe32jPuZW3oP2Hqeh8xdj73rxm1Y2HgqQpspl592XAUgV3VzU1ILXQOKLUqQC5jNDwptAy2K_19-YWwJWQ368qcXptZgx028tIePm-rFWybJZWiF5e1_SjGgLbMlVrtWKGXJ6DHmItp3jQRqfFSx-2GqXYSFJCCabUyNrjXxt6CmdAMOVkyi0oXzFLZfcPRkTS4nsZ94TZMz62XDu8Gky7F1-_2skRbojQKYiUcx5lkDF4YbWTjBZN0BA0s3fQ';

if (API_KEY === 'YOUR_API_KEY_HERE') {
    console.error('오류: 유효한 FIVESIM_API_KEY가 없습니다.');
    console.error('FIVESIM_API_KEY 환경 변수를 설정하거나 파일 내의 키를 수정해주세요.');
    process.exit(1);
}

const client = new FiveSimClient(API_KEY);

(async () => {
    try {
        console.log('--- 5sim API 연동 테스트 ---');

        // 1. 프로필 조회
        try {
            const profile = await client.getProfile();
            console.log('사용자 프로필:', JSON.stringify(profile, null, 2));
        } catch (error) {
            console.error('프로필 조회 실패:', error.message);
        }

        // 2. 가격 조회 (예: USA, Google)
        try {
            const prices = await client.getPrices('usa', 'google');
            console.log('가격 정보 (미국 - 구글):', JSON.stringify(prices, null, 2));
        } catch (error) {
            console.error('가격 조회 실패:', error.message);
        }

    } catch (error) {
        console.error('예기치 않은 오류 발생:', error);
    }
})();
