
import fs from 'fs';
import https from 'https';

// Load credentials
let env = "";
try {
    env = fs.readFileSync('.env.temp', 'utf-8');
    env = env.replace(/[^\x20-\x7E\n\r]/g, '');
} catch (e) { process.exit(1); }

const tokenMatch = env.match(/FIGMA_ACCESS_TOKEN=(.*)/);
const keyMatch = env.match(/FIGMA_FILE_KEY=(.*)/);
const token = tokenMatch ? tokenMatch[1].trim() : '';
const key = keyMatch ? keyMatch[1].trim() : '';

if (!token || !key) { console.error("Missing creds"); process.exit(1); }

const options = {
    hostname: 'api.figma.com',
    path: `/v1/files/${key}?depth=1`, // Just depth 1 to test
    method: 'GET',
    headers: {
        'X-Figma-Token': token
    }
};

const req = https.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        if (res.statusCode === 200) {
            console.log("Success! Name:", JSON.parse(data).name);
            console.log("Full Key:", key);
        } else {
            console.error("Failed:", data);
        }
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.end();
