import https from 'https';
import { COUNTRIES } from './countries.mjs';

// ==========================================
// 사용자 설정 (USER CONFIGURATION)
// ==========================================

// 1. 국가 선택 (countries.mjs 파일 참고)
// 예: 'usa', 'vietnam', 'russia', 'korea' (한국)
const TARGET_COUNTRY = 'usa';

// 2. 상품(서비스) 선택
// 예: 'google', 'telegram', 'facebook', 'kakao'
const TARGET_PRODUCT = 'google';

// 3. 최대 구매 가격 (이 가격 이하일 때만 구매)
const MAX_PRICE = 50;

// 4. 통신사 (선택 사항, 없으면 'any')
const TARGET_OPERATOR = 'any';

// ==========================================
// 시스템 설정 (건드리지 마세요)
// ==========================================
const API_KEY = process.env.FIVESIM_API_KEY || 'eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3OTcyMzQ1MDcsImlhdCI6MTc2NTY5ODUwNywicmF5IjoiZTE1ZWQ3OTZlNDEyZDMwMjJjZDhlZTFlNzU4YjIwZjYiLCJzdWIiOjM2NjUxNTB9.Sqo0W1kFBzqfk0u6VkztFKEOScKQsjUYJ6dmEy6z2ghQrpw1-JKaLa0zxyZ9uGWG6IScrMHF6cdSNQAwPSppG_OaIe32jPuZW3oP2Hqeh8xdj73rxm1Y2HgqQpspl592XAUgV3VzU1ILXQOKLUqQC5jNDwptAy2K_19-YWwJWQ368qcXptZgx028tIePm-rFWybJZWiF5e1_SjGgLbMlVrtWKGXJ6DHmItp3jQRqfFSx-2GqXYSFJCCabUyNrjXxt6CmdAMOVkyi0oXzFLZfcPRkTS4nsZ94TZMz62XDu8Gky7F1-_2skRbojQKYiUcx5lkDF4YbWTjBZN0BA0s3fQ';
const BASE_URL = 'https://5sim.net/v1';

class FiveSimBot {
    constructor() {
        this.headers = {
            'Authorization': `Bearer ${API_KEY}`,
            'Accept': 'application/json'
        };
    }

    _request(endpoint, method = 'GET') {
        return new Promise((resolve, reject) => {
            const url = new URL(`${BASE_URL}${endpoint}`);
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
                            resolve(data);
                        }
                    } else {
                        // 400 Errors are often "no free numbers"
                        resolve({ error: true, code: res.statusCode, message: data });
                    }
                });
            });

            req.on('error', (e) => reject(e));
            req.end();
        });
    }

    async checkBalance() {
        const profile = await this._request('/user/profile');
        if (profile.error) throw new Error(`프로필 로드 실패: ${profile.message}`);
        return profile.balance;
    }

    async getProductPrice(country, product) {
        const prices = await this._request(`/guest/prices?country=${country}&product=${product}`);
        if (prices.error) return null;

        // Structure: { country: { product: { operator: { cost: X, count: Y, ... } } } }
        if (!prices[country] || !prices[country][product]) return null;

        const offers = prices[country][product];
        let bestOffer = null;

        // Find best offer (cheapest available)
        for (const op in offers) {
            const offer = offers[op];
            if (offer.count > 0) {
                if (!bestOffer || offer.cost < bestOffer.cost) {
                    bestOffer = { operator: op, ...offer };
                }
            }
        }
        return bestOffer;
    }

    async buyNumber(country, product, operator) {
        return await this._request(`/user/buy/activation/${country}/${operator}/${product}`);
    }

    async checkOrder(orderId) {
        return await this._request(`/user/check/${orderId}`);
    }

    async finishOrder(orderId) {
        return await this._request(`/user/finish/${orderId}`);
    }

    async cancelOrder(orderId) {
        return await this._request(`/user/cancel/${orderId}`);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// --- Main Loop ---
(async () => {
    const bot = new FiveSimBot();

    console.log('=============================================');
    console.log('       5sim 자동 구매 봇 (Auto Buy Bot)       ');
    console.log('=============================================');

    // 1. Validate Country
    const validCountry = COUNTRIES.find(c => c.id === TARGET_COUNTRY);
    if (!validCountry) {
        console.error(`[오류] 잘못된 국가 코드입니다: ${TARGET_COUNTRY}`);
        console.log('countries.mjs 파일에서 정확한 ID를 확인해주세요.');
        process.exit(1);
    }
    console.log(`[설정] 국가: ${validCountry.name} (${TARGET_COUNTRY})`);
    console.log(`[설정] 상품: ${TARGET_PRODUCT}`);
    console.log(`[설정] 최대 가격: ${MAX_PRICE}`);
    console.log('---------------------------------------------');

    try {
        // 2. Check Balance
        const balance = await bot.checkBalance();
        console.log(`[내 정보] 현재 잔액: ${balance}`);
        if (balance < MAX_PRICE) {
            console.error('[오류] 잔액이 부족합니다.');
            process.exit(1);
        }

        console.log('[시작] 번호 탐색 및 구매 시도 중...');

        // 3. Search and Buy Loop
        let order = null;
        while (!order) {
            const priceInfo = await bot.getProductPrice(TARGET_COUNTRY, TARGET_PRODUCT);

            if (priceInfo) {
                console.log(`[탐색] 발견! 통신사: ${priceInfo.operator}, 가격: ${priceInfo.cost}, 재고: ${priceInfo.count}`);

                if (priceInfo.cost <= MAX_PRICE) {
                    console.log(`[구매] 조건 만족! 구매 시도 중...`);
                    const result = await bot.buyNumber(TARGET_COUNTRY, TARGET_PRODUCT, priceInfo.operator);

                    if (result.error) {
                        console.log(`[실패] 구매 요청 실패: ${result.message} - 다시 시도합니다.`);
                    } else if (result.id) {
                        order = result;
                        console.log(`[성공] 번호 구매 완료!`);
                        console.log(` > 전화번호: ${result.phone}`);
                        console.log(` > ID: ${result.id}`);
                        console.log(` > 만료 시간: ${result.expires}`);
                    }
                } else {
                    console.log(`[스킵] 가격이 너무 비쌉니다. (현재: ${priceInfo.cost} > 최대: ${MAX_PRICE})`);
                }
            } else {
                console.log(`[탐색] ${TARGET_COUNTRY} - ${TARGET_PRODUCT} 재고 없음. 5초 후 재시도...`);
            }

            if (!order) await bot.sleep(5000);
        }

        // 4. Wait for SMS Loop
        if (order) {
            console.log('---------------------------------------------');
            console.log(`[대기] SMS 수신 대기 중... (Ctrl+C로 중단 가능)`);

            let smsReceived = false;
            while (!smsReceived) {
                const check = await bot.checkOrder(order.id);

                if (check.sms && check.sms.length > 0) {
                    const sms = check.sms[0];
                    console.log('\n#############################################');
                    console.log(`[수신] SMS 도착!`);
                    console.log(`[코드] >> ${sms.code} <<`);
                    console.log(`[내용] ${sms.text}`);
                    console.log('#############################################\n');

                    // console.log('[완료] 주문을 완료 처리합니다...');
                    // await bot.finishOrder(order.id); 
                    // Note: Often better to let user manually finish or auto-finish after usage. 
                    // Keeping it open allows them to see it in dashboard too. 

                    smsReceived = true;
                    // Optional: Beep or Notify
                } else if (check.status === 'CANCELED' || check.status === 'TIMEOUT') {
                    console.log(`[종료] 주문이 취소되거나 만료되었습니다. 상태: ${check.status}`);
                    break;
                } else {
                    process.stdout.write('.'); // Waiting indicator
                    await bot.sleep(3000);
                }
            }
        }

    } catch (e) {
        console.error(`[치명적 오류] ${e.message}`);
    }

})();
