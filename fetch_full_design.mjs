
import fs from 'fs';
import https from 'https';

// Load credentials from .env.temp
let env = "";
try {
    env = fs.readFileSync('.env.temp', 'utf-8');
    env = env.replace(/[^\x20-\x7E\n\r]/g, '');
} catch (e) { process.exit(1); }

const tokenMatch = env.match(/FIGMA_ACCESS_TOKEN=(.*)/);
const keyMatch = env.match(/FIGMA_FILE_KEY=(.*)/);
const token = tokenMatch ? tokenMatch[1].trim() : '';
const key = keyMatch ? keyMatch[1].trim() : '';

if (!token || !key) { console.error("Missing credentials"); process.exit(1); }

console.log("Fetching full design for:", key);

const options = {
    hostname: 'api.figma.com',
    path: `/v1/files/${key}`,
    method: 'GET',
    headers: { 'X-Figma-Token': token }
};

const req = https.request(options, (res) => {
    if (res.statusCode !== 200) {
        console.error(`Request Failed. Status Code: ${res.statusCode}`);
        res.resume();
        return;
    }

    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        try {
            // Validate JSON
            const parsed = JSON.parse(rawData);
            console.log("Download complete. Document name:", parsed.name);
            fs.writeFileSync('figma_design.json', rawData);
            console.log("Saved to figma_design.json");
        } catch (e) {
            console.error(e.message);
        }
    });
});

req.on('error', (e) => {
    console.error(`Result error: ${e.message}`);
});

req.end();
