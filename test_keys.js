const deepl = require('deepl-node');
const fs = require('fs');

async function testKeys() {
    // Hardcoded keys for testing
    const keys = [
        '8962d0a5-7627-44f4-9aa0-1f7166c31f71',
        'ce1dab28-fd4e-4f57-b08d-8e88e780527d',
        '679da8d3-34a8-42fc-9720-5aa74ce17523',
        '8c434989-a648-40c9-b105-56509a9a0f68',
        '793ace46-1b01-4c15-84aa-15d85d863a76'
    ];
    console.log(`Testing ${keys.length} keys...\n`);

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const translator = new deepl.Translator(key);
        process.stdout.write(`Key #${i + 1} (${key.slice(0, 4)}...${key.slice(-4)}): `);

        try {
            const usage = await translator.getUsage();
            if (usage.character) {
                console.log(`✅ Valid. Usage: ${usage.character.count}/${usage.character.limit} chars.`);
            } else {
                console.log(`✅ Valid. Usage data not available.`);
            }
        } catch (error) {
            console.log(`❌ Failed. Error: ${error.message}`);
        }
    }
}

testKeys();
