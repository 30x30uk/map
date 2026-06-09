#!/usr/bin/env node
// Repairs properties with empty Images arrays by re-fetching from Wikipedia.
//
// Usage:
//   node Data/sources/national-trust/fix-missing-images.js \
//     --data Data/sources/national-trust-england/data/national-trust-properties.json
//
//   node Data/sources/national-trust/fix-missing-images.js \
//     --data Data/sources/national-trust-scotland/data/national-trust-properties.json

const fs    = require('fs');
const path  = require('path');
const axios = require('axios');

// --- CLI args ---
const args = process.argv.slice(2);
let dataFilePath = null;
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--data' && args[i + 1]) { dataFilePath = path.resolve(args[++i]); }
    else if (!args[i].startsWith('--')) { dataFilePath = path.resolve(args[i]); }
}
if (!dataFilePath) {
    console.error('Usage: node fix-missing-images.js --data <path-to-properties.json>');
    process.exit(1);
}

const WIKI_HEADERS = { 'User-Agent': 'NTImageRepairBot/1.0 (contact@30x30project.org.uk)' };
const PHOTO_EXTENSIONS = /\.(jpe?g|png|gif|webp)$/i;
const ICON_PATTERN = /^File:(flag|icon|logo|map|stub|commons|wikimedia|red_pog|blue_pog|green_pog|symbol|arrow|coa_|coat_of|seal_of|badge)/i;
const MAX_IMAGES = 10;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
    return chunks;
}

// Fetch image file titles for a batch of page titles, handling imcontinue pagination
async function fetchImageTitles(titles) {
    const allImages = {}; // title -> [File:xxx, ...]
    titles.forEach(t => allImages[t.toLowerCase()] = []);

    let imcontinue = undefined;
    do {
        const params = {
            action: 'query',
            titles: titles.join('|'),
            prop: 'images',
            imlimit: 500,
            format: 'json',
            redirects: 1,
        };
        if (imcontinue) params.imcontinue = imcontinue;

        const response = await axios.get('https://en.wikipedia.org/w/api.php', { params, headers: WIKI_HEADERS });
        const data = response.data;

        const pages = data?.query?.pages || {};
        for (const id in pages) {
            const page = pages[id];
            const key = page.title.toLowerCase();
            if (!allImages[key]) allImages[key] = [];
            (page.images || []).forEach(img => allImages[key].push(img.title));
        }

        imcontinue = data?.continue?.imcontinue;
    } while (imcontinue);

    return allImages;
}

// Resolve File: titles to actual image URLs via imageinfo API
async function resolveImageUrls(fileTitles) {
    const photoTitles = fileTitles
        .filter(t => PHOTO_EXTENSIONS.test(t) && !ICON_PATTERN.test(t))
        .slice(0, MAX_IMAGES);
    if (photoTitles.length === 0) return [];

    const chunks = chunkArray(photoTitles, 20);
    const urls = [];
    for (const chunk of chunks) {
        try {
            const response = await axios.get('https://en.wikipedia.org/w/api.php', {
                params: { action: 'query', titles: chunk.join('|'), prop: 'imageinfo', iiprop: 'url', format: 'json' },
                headers: WIKI_HEADERS
            });
            const pages = response.data?.query?.pages || {};
            for (const id in pages) {
                const url = pages[id]?.imageinfo?.[0]?.url;
                if (url) urls.push(url);
            }
        } catch (err) {
            console.warn(`  ⚠️  imageinfo failed: ${err.message}`);
        }
    }
    return urls;
}

async function main() {
    console.log(`🔧 NT Image Repair — ${dataFilePath}\n`);

    const properties = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
    const missing = properties.filter(p => !p.Images || p.Images.length === 0);

    if (missing.length === 0) {
        console.log('✅ No properties with missing images — nothing to do.');
        return;
    }

    console.log(`Found ${missing.length} properties with no images (out of ${properties.length} total). Fetching...\n`);

    // Build a name -> property map for easy lookup
    const byName = {};
    properties.forEach(p => byName[p.Name.toLowerCase()] = p);

    // Process in batches of 10 with imcontinue support
    const chunks = chunkArray(missing, 10);
    let fixed = 0;

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const titles = chunk.map(p => p.Name);
        console.log(`📡 Batch ${i + 1}/${chunks.length}: ${titles.join(', ')}`);

        try {
            const imagesByTitle = await fetchImageTitles(titles);

            for (const [titleLower, fileTitles] of Object.entries(imagesByTitle)) {
                const property = byName[titleLower];
                if (!property) continue;

                const urls = await resolveImageUrls(fileTitles);
                if (urls.length > 0) {
                    property.Images = urls;
                    console.log(`  ✅ ${property.Name} — ${urls.length} image(s)`);
                    fixed++;
                } else {
                    console.log(`  ⚪ ${property.Name} — still no photos found`);
                }
            }

            // Save after every batch in case of interruption
            fs.writeFileSync(dataFilePath, JSON.stringify(properties, null, 2));
        } catch (err) {
            console.error(`  ❌ Batch failed: ${err.message}`);
        }

        await sleep(200);
    }

    fs.writeFileSync(dataFilePath, JSON.stringify(properties, null, 2));
    console.log(`\n🎉 Done! Fixed ${fixed} of ${missing.length} properties.`);
    console.log(`   Saved to: ${dataFilePath}`);
}

main();
