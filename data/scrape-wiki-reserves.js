const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const cheerio = require('cheerio');

// --- CONFIGURATION ---
const OUTPUT_FILE = path.join(process.cwd(), 'data', 'wiki-reserves.json');
const CACHE_DIR = path.join(process.cwd(), 'data', 'wiki-cache');

// Wikipedia API requires a descriptive User-Agent header with contact info to prevent 403 Forbidden blocks
const WIKI_HEADERS = {
    'User-Agent': 'WildlifeTrustReservesBot/1.0 (contact@30x30project.org.uk; Academic/Environmental research crawler)'
};

// Fallback list of Trust pages in case the dynamic index crawler fails
const FALLBACK_TRUST_PAGES = [
    "Leicestershire_and_Rutland_Wildlife_Trust",
    "Derbyshire_Wildlife_Trust",
    "Nottinghamshire_Wildlife_Trust",
    "Staffordshire_Wildlife_Trust",
    "Warwickshire_Wildlife_Trust"
];

// Helper to pause execution to respect Wikipedia's API limits
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Splits an array into smaller chunks of a specific size
 */
function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

/**
 * Normalizes and filters out non-nature-reserve page links from Wikipedia lists.
 */
function isValidReservePageTitle(title) {
    if (!title) return false;
    const decoded = decodeURIComponent(title).replace(/_/g, ' ');
    const lower = decoded.toLowerCase();
    
    // Admin / wiki metadata filters
    if (title.includes(':')) return false; 
    
    // Exact match filters to prevent generic wiki pages 
    // (Crucial Fix: Removed .includes() so it doesn't kill pages like "College Lake Nature Reserve")
    const exactIgnores = [
        "wildlife trust", "natural england", "nature reserve", 
        "local nature reserve", "national nature reserve", 
        "site of special scientific interest", "ancient woodland", 
        "trust for nature conservation", "england", "scotland", 
        "wales", "northern ireland", "united kingdom", "list of", 
        "wayback machine", "wikipedia", "facebook", "twitter", "bbc"
    ];
    if (exactIgnores.includes(lower)) return false;
    
    // Geographic and administrative filters
    const wordIgnores = [
        "county", "district", "borough", "town", "city", "village", "parish"
    ];
    
    if (wordIgnores.some(item => lower === item || lower.endsWith(' ' + item) || lower.startsWith(item + ' '))) {
        return false;
    }

    if (/^\d{1,4}$/.test(lower)) return false; // Ignore pages that are just years
    
    return true;
}

/**
 * Natural Language Regex to extract area in hectares from Wikipedia intro text.
 */
function extractAreaFromText(text) {
    if (!text) return null;
    
    // 1. Check for hectare/ha values (e.g. "104.5-hectare", "5.7 hectare", "4.0 ha")
    const hectareRegex = /([\d.,]+)\s*(?:-|–|\s)*(?:hectare|ha)\b/i;
    const hectMatch = text.match(hectareRegex);
    if (hectMatch) {
        const val = parseFloat(hectMatch[1].replace(/,/g, ''));
        if (!isNaN(val)) return parseFloat(val.toFixed(2));
    }
    
    // 2. Fallback to acre values and convert to hectares (approx 0.4047)
    const acreRegex = /([\d.,]+)\s*(?:-|–|\s)*(?:acre)\b/i;
    const acreMatch = text.match(acreRegex);
    if (acreMatch) {
        const val = parseFloat(acreMatch[1].replace(/,/g, ''));
        if (!isNaN(val)) return parseFloat((val * 0.4047).toFixed(2));
    }
    
    return null;
}

/**
 * Caching Core: Standardized cache filename creator using MD5 key generation
 */
function getCacheFilename(action, key) {
    const safeKey = key.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 100);
    const hash = crypto.createHash('md5').update(key).digest('hex');
    return path.join(CACHE_DIR, `${action}_${safeKey}_${hash}.json`);
}

/**
 * Fetch Wrapper: Wraps async routines inside a local JSON disk cache
 */
async function fetchWithCache(action, key, fetchFn) {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    
    const cacheFile = getCacheFilename(action, key);
    
    if (fs.existsSync(cacheFile)) {
        try {
            const raw = fs.readFileSync(cacheFile, 'utf8');
            return JSON.parse(raw);
        } catch (e) {
            // Proceed to network fetch if local file is unreadable or corrupted
        }
    }
    
    const data = await fetchFn();
    
    // Prevent caching Wikipedia API errors (which return 200 OK but with an "error" property)
    if (data && !data.error) {
        try {
            fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2));
        } catch (e) {
            // Ignore filesystem write errors
        }
    }
    
    return data;
}

/**
 * Parses coordinates from standard Wikipedia GeoHack URLs.
 */
function parseGeoHackCoords(href) {
    if (!href) return null;
    try {
        const urlParams = new URLSearchParams(href.split('?')[1]);
        const paramsVal = urlParams.get('params');
        if (!paramsVal) return null;

        // Matches coordinates like 52.736_N_1.312_W
        const regex = /^([\d.]+)_([NS])_([\d.]+)_([EW])/i;
        const match = paramsVal.match(regex);
        if (match) {
            let lat = parseFloat(match[1]);
            let lon = parseFloat(match[3]);
            
            if (match[2].toUpperCase() === 'S') lat = -lat;
            if (match[4].toUpperCase() === 'W') lon = -lon;
            
            return { lat: parseFloat(lat.toFixed(6)), lon: parseFloat(lon.toFixed(6)) };
        }
    } catch (e) {
        // Silently skip malformed URLs
    }
    return null;
}

/**
 * Discover all regional Wildlife Trusts from the central list.
 */
async function discoverTrustPages() {
    console.log("⏳ Discovering regional Wildlife Trust Wikipedia pages from index...");
    const apiUrl = `https://en.wikipedia.org/w/api.php`;
    const params = {
        action: 'parse',
        page: 'The_Wildlife_Trusts', 
        format: 'json',
        prop: 'text',
        redirects: 1
    };

    try {
        const responseData = await fetchWithCache('discover', 'The_Wildlife_Trusts', async () => {
            const response = await axios.get(apiUrl, { params, headers: WIKI_HEADERS });
            return response.data;
        });

        const htmlContent = responseData.parse?.text?.['*'];
        if (!htmlContent) {
            console.log("⚠️ Could not fetch index page. Falling back to default list.");
            return FALLBACK_TRUST_PAGES;
        }

        const $ = cheerio.load(htmlContent);
        const discovered = new Set();

        $('a').each((_, a) => {
            const href = $(a).attr('href');
            if (href && href.startsWith('/wiki/')) {
                const pageTitle = href.replace('/wiki/', '');
                const decoded = decodeURIComponent(pageTitle);
                
                if (
                    decoded.includes('Wildlife_Trust') && 
                    decoded !== 'The_Wildlife_Trusts' &&
                    decoded !== 'List_of_Wildlife_Trusts_in_the_United_Kingdom' &&
                    !decoded.includes(':')
                ) {
                    discovered.add(decoded);
                }
            }
        });

        const list = Array.from(discovered);
        console.log(`🎯 Discovered ${list.length} regional Wildlife Trust pages!`);
        return list.length > 0 ? list : FALLBACK_TRUST_PAGES;
    } catch (err) {
        console.error("❌ Error discovering trust pages:", err.message);
        return FALLBACK_TRUST_PAGES;
    }
}

/**
 * Query Wikipedia Batch API to get details and coordinates for multiple titles at once.
 */
async function fetchBatchCoordsAndDetails(titles) {
    if (titles.length === 0) return [];
    
    const apiUrl = `https://en.wikipedia.org/w/api.php`;
    const params = {
        action: 'query',
        titles: titles.join('|'),
        prop: 'coordinates|extracts',
        exintro: 1,
        explaintext: 1,
        format: 'json'
    };

    try {
        const responseData = await fetchWithCache('query', titles.join('|'), async () => {
            const response = await axios.get(apiUrl, { params, headers: WIKI_HEADERS });
            return response.data;
        });

        const pages = responseData?.query?.pages;
        if (!pages) return [];

        const results = [];
        for (let id in pages) {
            const page = pages[id];
            let lat = null;
            let lon = null;
            const area = extractAreaFromText(page.extract);
            
            // Standard coordinate check
            if (page.coordinates && page.coordinates.length > 0) {
                const coord = page.coordinates[0];
                lat = parseFloat(coord.lat.toFixed(6));
                lon = parseFloat(coord.lon.toFixed(6));
            }

            if (lat !== null && lon !== null) {
                // Formulate description to the nearest whole hectare
                let descriptionText = "A local nature reserve.";
                if (area !== null) {
                    const roundedHectares = Math.round(area);
                    if (roundedHectares === 0) {
                        descriptionText = "A local nature reserve of less than 1 hectare.";
                    } else if (roundedHectares === 1) {
                        descriptionText = "A local nature reserve of approximately 1 hectare.";
                    } else {
                        descriptionText = `A local nature reserve of approximately ${roundedHectares} hectares.`;
                    }
                } else if (page.extract) {
                    const sentences = page.extract.split(/[.!?]/);
                    if (sentences[0]) {
                        descriptionText = sentences[0].trim() + ".";
                    }
                }

                results.push({
                    Name: page.title,
                    Lat: lat,
                    Long: lon,
                    Area: area,
                    Description: descriptionText
                });
            }
        }
        return results;
    } catch (err) {
        console.error(`   ❌ Error querying batch details:`, err.message);
        return [];
    }
}

/**
 * Scrapes a single Wildlife Trust Wikipedia page for its nature reserves.
 */
async function scrapeTrustPage(pageTitle) {
    const cleanTitle = pageTitle.replace(/_/g, ' ');
    console.log(`\n⏳ Processing Wildlife Trust: "${cleanTitle}"...`);
    
    const apiUrl = `https://en.wikipedia.org/w/api.php`;
    const params = {
        action: 'parse',
        page: pageTitle,
        format: 'json',
        prop: 'text',
        redirects: 1
    };

    try {
        const responseData = await fetchWithCache('parse', pageTitle, async () => {
            const response = await axios.get(apiUrl, { params, headers: WIKI_HEADERS });
            return response.data;
        });

        const htmlContent = responseData.parse?.text?.['*'];
        if (!htmlContent) {
            console.log(`   ⚠️ Could not find parseable content for ${pageTitle}`);
            return [];
        }

        const $ = cheerio.load(htmlContent);
        const reserves = [];
        const candidateTitles = new Set(); // Holds subpage links to process

        // --- METHOD 1: PARSE STRUCTURED TABLES ---
        const tables = $('table.wikitable');
        
        tables.each((_, table) => {
            const headers = [];
            $(table).find('tr').first().find('th, td').each((_, cell) => {
                headers.push($(cell).text().trim().toLowerCase());
            });

            const nameIdx = headers.findIndex(h => h.includes('reserve') || h.includes('name') || h.includes('site'));
            const areaIdx = headers.findIndex(h => h.includes('area') || h.includes('size') || h.includes('ha') || h.includes('hectares'));
            const coordIdx = headers.findIndex(h => h.includes('coordinate') || h.includes('location') || h.includes('grid ref'));

            if (nameIdx === -1) return; // Skip non-reserve tables

            $(table).find('tr').slice(1).each((_, row) => {
                const cols = $(row).find('td');
                if (cols.length === 0) return;

                const nameText = $(cols[nameIdx]).text().trim().replace(/\s+/g, ' ');
                if (!nameText) return;

                // Resolve Area (Hectares)
                let areaValue = null;
                let descriptionText = "A local nature reserve.";
                if (areaIdx !== -1) {
                    const areaText = $(cols[areaIdx]).text().trim().toLowerCase();
                    const areaMatch = areaText.match(/([\d.,]+)\s*(?:ha|hectare|acres)?/);
                    if (areaMatch) {
                        const parsedArea = parseFloat(areaMatch[1].replace(/,/g, ''));
                        if (!isNaN(parsedArea)) {
                            const isAcres = areaText.includes('acres') && !areaText.includes('ha') && !areaText.includes('hectare');
                            areaValue = isAcres ? parseFloat((parsedArea * 0.4047).toFixed(2)) : parseFloat(parsedArea.toFixed(2));
                        }
                    }
                }

                // Resolve Coordinates from GeoHack links
                let coords = null;
                if (coordIdx !== -1) {
                    const coordLink = $(cols[coordIdx]).find('a[href*="geohack"]').first().attr('href');
                    if (coordLink) coords = parseGeoHackCoords(coordLink);
                }

                // Fallback inside row
                if (!coords) {
                    const fallbackLink = $(row).find('a[href*="geohack"]').first().attr('href');
                    if (fallbackLink) coords = parseGeoHackCoords(fallbackLink);
                }

                // ALWAYS harvest subpage links from the table Name column to guarantee robust batch extraction later
                const nameCellLink = $(cols[nameIdx]).find('a').first().attr('href');
                if (nameCellLink && nameCellLink.startsWith('/wiki/')) {
                    const subTitle = nameCellLink.replace('/wiki/', '');
                    if (isValidReservePageTitle(subTitle)) {
                        candidateTitles.add(decodeURIComponent(subTitle));
                    }
                    // If it lacks coordinates, bail out here and let the subpage batch query handle it!
                    if (!coords) return; 
                }

                // Construct Description to the nearest hectare
                if (areaValue !== null) {
                    const roundedHectares = Math.round(areaValue);
                    if (roundedHectares === 0) {
                        descriptionText = "A local nature reserve of less than 1 hectare.";
                    } else if (roundedHectares === 1) {
                        descriptionText = "A local nature reserve of approximately 1 hectare.";
                    } else {
                        descriptionText = `A local nature reserve of approximately ${roundedHectares} hectares.`;
                    }
                }

                if (coords) {
                    reserves.push({
                        Name: nameText,
                        Lat: coords.lat,
                        Long: coords.lon,
                        Area: areaValue,
                        Description: descriptionText,
                        "Suggestion-Tags": ["Wikipedia Import"],
                        "AI-Notes": `[Wiki Table Scraped]: Programmatically parsed from Wikipedia page: "${cleanTitle}". Coordinates resolved using standard geo-mapping lookup.`
                    });
                }
            });
        });

        // --- METHOD 2: PARSE LINKED SUBPAGES ---
        // ALWAYS scan for subpages, ignoring previous limits, to ensure comprehensive coverage
        console.log(`   🔍 Scanning page sections for linked subpages...`);

        // Target links inside sections containing reserves/places/sites/woods
        const reserveHeadings = $('h1, h2, h3, h4, h5').filter((_, el) => {
            const text = $(el).text().toLowerCase();
            return text.includes('reserve') || text.includes('site') || 
                   text.includes('protected') || text.includes('places') || 
                   text.includes('list') || text.includes('property') ||
                   text.includes('locations') || text.includes('wood') ||
                   text.includes('meadow') || text.includes('marsh') || text.includes('fen');
        });

        if (reserveHeadings.length > 0) {
            reserveHeadings.each((_, heading) => {
                let sibling = $(heading).next();
                const headingLevel = parseInt(heading.tagName.substring(1), 10);
                
                while (sibling.length > 0) {
                    const nextTagName = sibling[0].tagName.toLowerCase();
                    if (nextTagName.match(/^h[1-6]$/)) {
                        const nextLevel = parseInt(nextTagName.substring(1), 10);
                        if (nextLevel <= headingLevel) break; // Stop sibling search on equal/higher heading
                    }
                    
                    // Safely extract all embedded links, regardless of list or div formatting
                    sibling.find('a').addBack('a').each((_, a) => {
                        const href = $(a).attr('href');
                        const title = $(a).attr('title');
                        if (href && href.startsWith('/wiki/') && title) {
                            const subTitle = href.replace('/wiki/', '');
                            if (isValidReservePageTitle(subTitle)) {
                                candidateTitles.add(decodeURIComponent(subTitle));
                            }
                        }
                    });
                    sibling = sibling.next();
                }
            });
        }

        // Fallback: If no headings matched or very few candidates were found, do a broader list scan
        if (candidateTitles.size < 5) {
            $('li a, td a, .div-col a, div.columns a').each((_, a) => {
                const href = $(a).attr('href');
                const title = $(a).attr('title');
                if (href && href.startsWith('/wiki/') && title) {
                    const subTitle = href.replace('/wiki/', '');
                    if (isValidReservePageTitle(subTitle)) {
                        candidateTitles.add(decodeURIComponent(subTitle));
                    }
                }
            });
        }

        // Process all gathered candidate links (from empty table rows AND list items)
        const titlesArray = Array.from(candidateTitles);
        if (titlesArray.length > 0) {
            console.log(`   📡 Batch querying ${titlesArray.length} candidate subpage links...`);
            const titleChunks = chunkArray(titlesArray, 50);
            
            for (let chunk of titleChunks) {
                const batchReserves = await fetchBatchCoordsAndDetails(chunk);
                for (let r of batchReserves) {
                    const existingIdx = reserves.findIndex(existing => existing.Name.toLowerCase() === r.Name.toLowerCase());
                    
                    if (existingIdx === -1) {
                        // Add new reserve
                        reserves.push({
                            Name: r.Name,
                            Lat: r.Lat,
                            Long: r.Long,
                            Area: r.Area,
                            Description: r.Description,
                            "Suggestion-Tags": ["Wikipedia Import"],
                            "AI-Notes": `[Wiki Subpage Scraped]: Programmatically parsed from subpage linked in: "${cleanTitle}". Details resolved using Wikipedia Query API (coordinates and extracts).`
                        });
                    } else {
                        // Update existing table reserve if the subpage yielded a better area
                        if (r.Area !== null && reserves[existingIdx].Area === null) {
                            reserves[existingIdx].Area = r.Area;
                            reserves[existingIdx].Description = r.Description;
                        }
                    }
                }
                await sleep(100); // Polite rate limit
            }
        }

        console.log(`   🎯 Extracted ${reserves.length} reserves with valid coordinates.`);
        return reserves;

    } catch (err) {
        console.error(`   ❌ Error querying ${pageTitle}:`, err.message);
        return [];
    }
}

async function main() {
    console.log("🌐 Initializing Wikipedia Nature Reserve Scraper...");
    let allReserves = [];

    // Ensure target folder exists
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Step 1: Discover all 46 regional trust pages dynamically
    const trustPages = await discoverTrustPages();

    // Step 2: Sequentially process each Trust page
    for (let i = 0; i < trustPages.length; i++) {
        const page = trustPages[i];
        console.log(`\n💼 [Trust ${i + 1}/${trustPages.length}]`);
        const pageReserves = await scrapeTrustPage(page);
        allReserves = allReserves.concat(pageReserves);
        await sleep(500); // Polite rate-limiting between Trusts
    }

    // Step 3: Global deduplication based on clean reserve name
    const uniqueReserves = [];
    const seenNames = new Set();
    for (let res of allReserves) {
        const key = res.Name.toLowerCase().trim();
        if (!seenNames.has(key)) {
            seenNames.add(key);
            uniqueReserves.push(res);
        }
    }

    // Save final outputs
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(uniqueReserves, null, 2));
    
    console.log(`\n🎉 Process Complete!`);
    console.log(`💾 Saved ${uniqueReserves.length} unique reserves across ${trustPages.length} trusts to: ${OUTPUT_FILE}`);
}

main();