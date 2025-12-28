import fs from 'fs';

const countries = JSON.parse(fs.readFileSync('countries_list.json', 'utf8'));
const content = `export const COUNTRIES = ${JSON.stringify(countries, null, 2)};`;
fs.writeFileSync('countries.mjs', content);
console.log('countries.mjs created');
