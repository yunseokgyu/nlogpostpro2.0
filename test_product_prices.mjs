import https from 'https';

const API_KEY = process.env.FIVESIM_API_KEY || 'eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3OTcyMzQ1MDcsImlhdCI6MTc2NTY5ODUwNywicmF5IjoiZTE1ZWQ3OTZlNDEyZDMwMjJjZDhlZTFlNzU4YjIwZjYiLCJzdWIiOjM2NjUxNTB9.Sqo0W1kFBzqfk0u6VkztFKEOScKQsjUYJ6dmEy6z2ghQrpw1-JKaLa0zxyZ9uGWG6IScrMHF6cdSNQAwPSppG_OaIe32jPuZW3oP2Hqeh8xdj73rxm1Y2HgqQpspl592XAUgV3VzU1ILXQOKLUqQC5jNDwptAy2K_19-YWwJWQ368qcXptZgx028tIePm-rFWybJZWiF5e1_SjGgLbMlVrtWKGXJ6DHmItp3jQRqfFSx-2GqXYSFJCCabUyNrjXxt6CmdAMOVkyi0oXzFLZfcPRkTS4nsZ94TZMz62XDu8Gky7F1-_2skRbojQKYiUcx5lkDF4YbWTjBZN0BA0s3fQ';

function getProductPrices(product) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: '5sim.net',
            path: `/v1/guest/prices?product=${product}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Accept': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

(async () => {
    try {
        console.log('Fetching prices for "google" (no country param)...');
        const data = await getProductPrices('google');

        console.log('--- Response Inspection ---');
        // If it's a map of countries, Object.keys will show country codes
        const keys = Object.keys(data);
        console.log(`Keys found: ${keys.slice(0, 10).join(', ')}...`);

        if (keys.length > 0) {
            console.log(`Example (${keys[0]}):`);
            console.log(JSON.stringify(data[keys[0]], null, 2));
        }
    } catch (e) {
        console.error(e);
    }
})();
