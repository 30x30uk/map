const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const cheerio = require('cheerio');

// --- CONFIGURATION ---
// Reads from CLI environment variable. Example: TEST_MODE_ONLY=true node data/scrape-wiki-reserves.js
const TEST_MODE_ONLY = process.env.TEST_MODE_ONLY === 'true'; 
const OUTPUT_FILE = path.join(process.cwd(), 'data', 'wiki-reserves.json');
const CACHE_DIR = path.join(process.cwd(), 'data', 'wiki-cache');
const TEST_DIR = path.join(process.cwd(), 'data', 'wildlife-trust-test-pages'); // Local HTML testing directory

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
 * Safely decodes URI components, preventing crashes on malformed raw strings.
 */
function normalizeTitle(title) {
    if (!title) return '';
    try {
        return decodeURIComponent(title).replace(/_/g, ' ');
    } catch (e) {
        return title.replace(/_/g, ' ');
    }
}

/**
 * Normalizes and filters out non-nature-reserve page links from Wikipedia lists.
 */
function isValidReservePageTitle(title) {
    if (!title) return false;
    const decoded = normalizeTitle(title);
    const lower = decoded.toLowerCase();
    
    // Admin / wiki metadata filters
    if (title.includes(':')) return false; 
    
    const exactIgnores = [
        "wildlife trust", "natural england", "nature reserve", 
        "local nature reserve", "national nature reserve", 
        "site of special scientific interest", "ancient woodland", 
        "trust for nature conservation", "england", "scotland", 
        "wales", "northern ireland", "united kingdom", "list of", 
        "wayback machine", "wikipedia", "facebook", "twitter", "bbc",
        "flora", "fauna", "species"
    ];
    if (exactIgnores.includes(lower)) return false;
    
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
 * Natural Language Regex to extract area in hectares from Wikipedia intro text or raw wikitext.
 */
function extractAreaFromText(text) {
    if (!text) return null;
    
    // 1. Check for Infobox definitions (Wikitext): area = 15.5 or area = {{convert|15|ha}}
    const infoboxRegex = /area\s*=\s*(?:\{\{convert\|)?([\d.,]+)\s*(?:\|)?\s*(ha|hectare|acre)/i;
    const infoMatch = text.match(infoboxRegex);
    if (infoMatch) {
        const val = parseFloat(infoMatch[1].replace(/,/g, ''));
        if (!isNaN(val)) {
            if (infoMatch[2].toLowerCase().startsWith('acre')) {
                return parseFloat((val * 0.4047).toFixed(2));
            }
            return parseFloat(val.toFixed(2));
        }
    }

    // 2. Check for standard text descriptions
    const hectareRegex = /([\d.,]+)\s*(?:-|–|\s)*(?:hectare|ha)\b/i;
    const hectMatch = text.match(hectareRegex);
    if (hectMatch) {
        const val = parseFloat(hectMatch[1].replace(/,/g, ''));
        if (!isNaN(val)) return parseFloat(val.toFixed(2));
    }
    
    const acreRegex = /([\d.,]+)\s*(?:-|–|\s)*(?:acre)\b/i;
    const acreMatch = text.match(acreRegex);
    if (acreMatch) {
        const val = parseFloat(acreMatch[1].replace(/,/g, ''));
        if (!isNaN(val)) return parseFloat((val * 0.4047).toFixed(2));
    }
    
    return null;
}

/**
 * Converts standard OS Grid Reference strings (e.g., "SU104245", "SU 104 245", or "{{grid reference|SU|123|456}}")
 * into high-precision Latitude and Longitude using the Helmert transform.
 */
function gridRefToLatLon(gridRef) {
    if (!gridRef) return null;
    
    const cleanRef = gridRef.replace(/\s+/g, '').toUpperCase();
    const match = cleanRef.match(/^([A-HJ-Z])([A-HJ-Z])(\d{2,10})$/);
    if (!match) return null;
    
    const char1 = match[1];
    const char2 = match[2];
    const digits = match[3];
    
    if (digits.length % 2 !== 0) return null;
    
    const halfLen = digits.length / 2;
    const eastingStr = digits.substring(0, halfLen);
    const northingStr = digits.substring(halfLen);
    
    const getPos = (char) => {
        let val = char.charCodeAt(0) - 65;
        if (char.charCodeAt(0) > 73) val--;
        return { col: val % 5, row: 4 - Math.floor(val / 5) };
    };
    
    const pos1 = getPos(char1);
    const pos2 = getPos(char2);
    
    const gridEasting = (pos1.col - 2) * 500000 + pos2.col * 100000;
    const gridNorthing = (pos1.row - 1) * 500000 + pos2.row * 100000;
    
    const power = 5 - halfLen;
    const easting = gridEasting + parseInt(eastingStr, 10) * Math.pow(10, power) + Math.pow(10, power) / 2;
    const northing = gridNorthing + parseInt(northingStr, 10) * Math.pow(10, power) + Math.pow(10, power) / 2;
    
    return osgbToWgs84(easting, northing);
}

function osgbToWgs84(E, N) {
    const a = 6377563.396;
    const b = 6356256.909;
    const F0 = 0.9996012717; 
    const lat0 = 49 * Math.PI / 180;
    const lon0 = -2 * Math.PI / 180;
    const N0 = -100000;
    const E0 = 400000;
    
    const e2 = (a*a - b*b) / (a*a);
    const n = (a - b) / (a + b);
    const n2 = n * n;
    const n3 = n * n * n;
    
    let lat = lat0;
    let M = 0;
    
    do {
        lat = (N - N0 - M) / (a * F0) + lat;
        const ma = (1 + n + 1.25*n2 + 1.25*n3) * (lat - lat0);
        const mb = (3*n + 3*n2 + 2.625*n3) * Math.sin(lat - lat0) * Math.cos(lat + lat0);
        const mc = (1.875*n2 + 1.875*n3) * Math.sin(2*(lat - lat0)) * Math.cos(2*(lat + lat0));
        const md = (35/24)*n3 * Math.sin(3*(lat - lat0)) * Math.cos(3*(lat + lat0));
        M = b * F0 * (ma - mb + mc - md);
    } while (Math.abs(N - N0 - M) > 0.00001);
    
    const secLat = 1 / Math.cos(lat);
    const tanLat = Math.tan(lat);
    const tan2Lat = tanLat * tanLat;
    const tan4Lat = tan2Lat * tan2Lat;
    const tan6Lat = tan4Lat * tan2Lat;
    
    const nu = a * F0 / Math.sqrt(1 - e2 * Math.sin(lat) * Math.sin(lat));
    const rho = a * F0 * (1 - e2) / Math.pow(1 - e2 * Math.sin(lat) * Math.sin(lat), 1.5);
    const eta2 = nu / rho - 1;
    
    const VII = secLat / (2 * nu * rho);
    const VIII = secLat / (24 * rho * Math.pow(nu, 3)) * (5 + 3*tan2Lat + eta2 - 9*tan2Lat*eta2);
    const IX = secLat / (720 * rho * Math.pow(nu, 5)) * (61 + 90*tan2Lat + 45*tan4Lat);
    const X = secLat / nu;
    const XI = secLat / (6 * Math.pow(nu, 3)) * (secLat*secLat + 2*tan2Lat);
    const XII = secLat / (120 * Math.pow(nu, 5)) * (5 + 28*tan2Lat + 24*tan4Lat);
    const XIIA = secLat / (5040 * Math.pow(nu, 7)) * (61 + 662*tan2Lat + 1320*tan4Lat + 720*tan6Lat);
    
    const dE = E - E0;
    const dE2 = dE * dE;
    const dE3 = dE2 * dE;
    const dE4 = dE2 * dE2;
    const dE5 = dE4 * dE;
    const dE6 = dE4 * dE2;
    const dE7 = dE6 * dE;
    
    const latOSGB = lat - VII*dE2 + VIII*dE4 - IX*dE6;
    const lonOSGB = lon0 + X*dE - XI*dE3 + XII*dE5 - XIIA*dE7;
    
    return helmertOSGB36toWGS84(latOSGB, lonOSGB);
}

function helmertOSGB36toWGS84(lat, lon) {
    const a = 6377563.396;
    const b = 6356256.909;
    const e2 = (a*a - b*b) / (a*a);
    
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);
    const cosLon = Math.cos(lon);
    const sinLon = Math.sin(lon);
    
    const nu = a / Math.sqrt(1 - e2 * sinLat * sinLat);
    const x1 = nu * cosLat * cosLon;
    const y1 = nu * cosLat * sinLon;
    const z1 = nu * (1 - e2) * sinLat;
    
    const tx = 446.448;
    const ty = -125.157;
    const tz = 542.060;
    const s  = -20.4894 / 1000000;
    const rx = (0.1502 / 3600) * Math.PI / 180;
    const ry = (0.2470 / 3600) * Math.PI / 180;
    const rz = (0.8421 / 3600) * Math.PI / 180;
    
    const xWGS = (1 + s)*x1 - rz*y1 + ry*z1 + tx;
    const yWGS = rz*x1 + (1 + s)*y1 - rx*z1 + ty;
    const zWGS = -ry*x1 + rx*y1 + (1 + s)*z1 + tz;
    
    const aWGS = 6378137.0;
    const bWGS = 6356752.314245;
    const e2WGS = (aWGS*aWGS - bWGS*bWGS) / (aWGS*aWGS);
    
    const p = Math.sqrt(xWGS*xWGS + yWGS*yWGS);
    let latWGS = Math.atan2(zWGS, p * (1 - e2WGS));
    let nuWGS = 0;
    
    for (let i = 0; i < 10; i++) {
        const sinLatWGS = Math.sin(latWGS);
        nuWGS = aWGS / Math.sqrt(1 - e2WGS * sinLatWGS * sinLatWGS);
        latWGS = Math.atan2(zWGS + e2WGS * nuWGS * sinLatWGS, p);
    }
    
    const lonWGS = Math.atan2(yWGS, xWGS);
    
    return {
        lat: parseFloat((latWGS * 180 / Math.PI).toFixed(6)),
        lon: parseFloat((lonWGS * 180 / Math.PI).toFixed(6))
    };
}

function extractGridRef(text) {
    if (!text) return null;
    
    // 1. Template format: {{grid reference|SU|123|456}} found in Raw Wikitext
    const templateRegex = /\{\{grid reference\|([A-Z]{2})\|(\d{2,5})\|(\d{2,5})/i;
    const tMatch = text.match(templateRegex);
    if (tMatch) {
        return tMatch[1].toUpperCase() + tMatch[2] + tMatch[3];
    }

    // 2. Standard Spaced Format
    const regexSpaced = /\b([HNOST][A-HJ-Z])\s*(\d{1,5})\s*(\d{1,5})\b/i;
    const matchSpaced = text.match(regexSpaced);
    if (matchSpaced) {
        const prefix = matchSpaced[1].toUpperCase();
        const eastingPart = matchSpaced[2];
        const northingPart = matchSpaced[3];
        if (eastingPart.length === northingPart.length) {
            return prefix + eastingPart + northingPart;
        }
    }
    
    // 3. Contiguous Format
    const regexContiguous = /\b([HNOST][A-HJ-Z])\s*(\d{2,10})\b/i;
    const matchCont = text.match(regexContiguous);
    if (matchCont) {
        const prefix = matchCont[1].toUpperCase();
        const digits = matchCont[2];
        if (digits.length % 2 === 0 && digits.length >= 2 && digits.length <= 10) {
            return prefix + digits;
        }
    }
    
    return null;
}

/**
 * Caching Core
 */
function getCacheFilename(action, key) {
    const safeKey = key.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 100);
    const hash = crypto.createHash('md5').update(key).digest('hex');
    return path.join(CACHE_DIR, `${action}_${safeKey}_${hash}.json`);
}

async function fetchWithCache(action, key, fetchFn) {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    
    const cacheFile = getCacheFilename(action, key);
    
    if (fs.existsSync(cacheFile)) {
        try { return JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch (e) {}
    }
    
    const data = await fetchFn();
    
    if (data && !data.error) {
        try { fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2)); } catch (e) {}
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

        const regex = /^([\d.]+)_([NS])_([\d.]+)_([EW])/i;
        const match = paramsVal.match(regex);
        if (match) {
            let lat = parseFloat(match[1]);
            let lon = parseFloat(match[3]);
            
            if (match[2].toUpperCase() === 'S') lat = -lat;
            if (match[4].toUpperCase() === 'W') lon = -lon;
            
            return { lat: parseFloat(lat.toFixed(6)), lon: parseFloat(lon.toFixed(6)) };
        }
    } catch (e) {}
    return null;
}

/**
 * Highly robust link extractor that works on both live Wikipedia HTML
 * and HTML saved locally by a web browser (which often mangles hrefs).
 */
function extractPageTitleFromElement($el) {
    const href = $el.attr('href');
    const title = $el.attr('title');
    
    if (!href) return null;
    if (href.startsWith('#')) return null; // Skip local anchor links
    
    // 1. Standard Wikipedia path extraction (Live web or absolute URLs)
    const match = href.match(/\/wiki\/([^#?]+)/);
    if (match) return match[1];
    
    // 2. Local Save Fallback: If href is mangled (e.g., file://.../Graig_Wood.html)
    // Rely on the title attribute, which Wikipedia sets perfectly on almost all links.
    if (title) {
        // Ignore standard wiki UI titles that might pollute searches
        const ignoreTitles = ["Edit section", "Enlarge", "Wikipedia", "Wikimedia"];
        if (ignoreTitles.some(t => title.includes(t))) return null;
        return title.replace(/ /g, '_');
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
 * Query Wikipedia Batch API to get details, coordinates, and raw wikitext for multiple titles at once.
 */
async function fetchBatchCoordsAndDetails(titles) {
    if (titles.length === 0) return [];
    
    const apiUrl = `https://en.wikipedia.org/w/api.php`;
    const params = {
        action: 'query',
        titles: titles.join('|'),
        prop: 'coordinates|extracts|revisions',
        rvprop: 'content',
        rvslots: 'main',
        exintro: 1,
        explaintext: 1,
        format: 'json'
    };

    try {
        const responseData = await fetchWithCache('query_v2', titles.join('|'), async () => {
            const response = await axios.get(apiUrl, { params, headers: WIKI_HEADERS });
            return response.data;
        });

        const pages = responseData?.query?.pages;
        if (!pages) return [];

        const results = [];
        for (let id in pages) {
            const page = pages[id];
            
            // Extract raw wikitext for deep searching hidden infobox attributes
            let wikitext = "";
            if (page.revisions && page.revisions.length > 0) {
                wikitext = page.revisions[0].slots?.main?.['*'] || page.revisions[0]['*'] || "";
            }

            let lat = null;
            let lon = null;
            
            // Check for area in plain extract first, then fallback to deep wikitext search
            let area = extractAreaFromText(page.extract);
            if (area === null) area = extractAreaFromText(wikitext);
            
            // Standard coordinate check
            if (page.coordinates && page.coordinates.length > 0) {
                const coord = page.coordinates[0];
                lat = parseFloat(coord.lat.toFixed(6));
                lon = parseFloat(coord.lon.toFixed(6));
            } else {
                // FALLBACK: Look for OS Grid Reference inside page intro text OR raw wikitext infoboxes
                let gridRef = extractGridRef(page.extract);
                if (!gridRef) gridRef = extractGridRef(wikitext);

                if (gridRef) {
                    const coords = gridRefToLatLon(gridRef);
                    if (coords) {
                        lat = coords.lat;
                        lon = coords.lon;
                    }
                }
            }

            if (lat !== null && lon !== null) {
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
 * Core parsing logic decoupled so it can process both local HTML files and Wikipedia API responses.
 */
async function extractReservesFromHtml(htmlContent, cleanTitle) {
    const $ = cheerio.load(htmlContent);
    const reserves = [];
    const candidateTitles = new Set(); 

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

        if (nameIdx === -1) return;

        $(table).find('tr').slice(1).each((_, row) => {
            // FIX: Some tables use <th> for the Name column instead of <td>! We must search both.
            const cols = $(row).find('td, th'); 
            if (cols.length === 0) return;

            // Remove citations like [1] before extracting text to ensure clean names
            const nameTextRaw = $(cols[nameIdx]).text();
            const nameText = nameTextRaw.replace(/\[\d+\]/g, '').trim().replace(/\s+/g, ' ');
            if (!nameText) return;

            let areaValue = null;
            let descriptionText = "A local nature reserve.";
            if (areaIdx !== -1 && cols[areaIdx]) {
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

            let coords = null;
            if (coordIdx !== -1 && cols[coordIdx]) {
                const coordLink = $(cols[coordIdx]).find('a[href*="geohack"]').first().attr('href');
                if (coordLink) coords = parseGeoHackCoords(coordLink);
            }

            if (!coords) {
                const fallbackLink = $(row).find('a[href*="geohack"]').first().attr('href');
                if (fallbackLink) coords = parseGeoHackCoords(fallbackLink);
            }

            if (!coords) {
                const rowText = $(row).text();
                const gridRef = extractGridRef(rowText);
                if (gridRef) {
                    coords = gridRefToLatLon(gridRef);
                }
            }

            // Extract the subpage link from the Name column (whether it's a TH or TD)
            let subPageTitle = null;
            const $nameCellLink = $(cols[nameIdx]).find('a').first();
            const rawSubTitle = extractPageTitleFromElement($nameCellLink);
            
            if (rawSubTitle && isValidReservePageTitle(rawSubTitle)) {
                subPageTitle = normalizeTitle(rawSubTitle);
                candidateTitles.add(subPageTitle);
            }

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

            // MERGE STRATEGY: Even if coords are null, we push the row from the table!
            // We use `_subPageTitle` as an internal tracker so the batch query can populate the coords later.
            reserves.push({
                Name: nameText,
                Lat: coords ? coords.lat : null,
                Long: coords ? coords.lon : null,
                Area: areaValue,
                Description: descriptionText,
                "Suggestion-Tags": ["Wikipedia Import"],
                "AI-Notes": coords 
                    ? `[Wiki Table Scraped]: Programmatically parsed from Wikipedia page: "${cleanTitle}". Coordinates resolved using standard geo-mapping lookup.` 
                    : `[Wiki Table + Subpage Merge]: Name parsed from table on "${cleanTitle}". Attempting to merge coordinates from subpage.`,
                _subPageTitle: subPageTitle
            });
        });
    });

    // --- METHOD 2: PARSE LINKED SUBPAGES ---
    console.log(`   🔍 Scanning page sections for linked subpages...`);

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
            let container = $(heading).closest('.mw-heading');
            if (container.length === 0) container = $(heading);
            
            let sibling = container.next();
            // FIX: heading is a raw element, use .tagName or .name safely
            const tagStr = heading.tagName || heading.name || 'h2';
            const headingLevel = parseInt(tagStr.substring(1), 10);
            
            while (sibling.length > 0) {
                // FIX: safely get the sibling's tag name
                let nextTagName = (sibling[0].tagName || sibling[0].name || '').toLowerCase();
                let nextLevel = 99;
                if (nextTagName.match(/^h[1-6]$/)) {
                    nextLevel = parseInt(nextTagName.substring(1), 10);
                } else if (sibling.hasClass('mw-heading')) {
                    const hTag = sibling.find('h1, h2, h3, h4, h5, h6').first();
                    if (hTag.length > 0) {
                        const innerTagStr = hTag[0].tagName || hTag[0].name || 'h2';
                        nextLevel = parseInt(innerTagStr.substring(1), 10);
                    }
                }

                if (nextLevel <= headingLevel) break; 
                
                sibling.find('a').addBack('a').each((_, a) => {
                    const rawSubTitle = extractPageTitleFromElement($(a));
                    if (rawSubTitle && isValidReservePageTitle(rawSubTitle)) {
                        candidateTitles.add(normalizeTitle(rawSubTitle));
                    }
                });
                sibling = sibling.next();
            }
        });
    }

    if (candidateTitles.size < 5) {
        $('li a, td a, th a, .div-col a, div.columns a').each((_, a) => {
            const rawSubTitle = extractPageTitleFromElement($(a));
            if (rawSubTitle && isValidReservePageTitle(rawSubTitle)) {
                candidateTitles.add(normalizeTitle(rawSubTitle));
            }
        });
    }

    const titlesArray = Array.from(candidateTitles);
    if (titlesArray.length > 0) {
        console.log(`   📡 Batch querying ${titlesArray.length} candidate subpage links...`);
        const titleChunks = chunkArray(titlesArray, 50);
        
        for (let chunk of titleChunks) {
            const batchReserves = await fetchBatchCoordsAndDetails(chunk);
            for (let r of batchReserves) {
                
                // MERGE EXECUTION: Look for a table reserve that matches the subpage title OR exact name
                const existingIdx = reserves.findIndex(existing => 
                    (existing._subPageTitle && existing._subPageTitle.toLowerCase() === r.Name.toLowerCase()) || 
                    (existing.Name.toLowerCase() === r.Name.toLowerCase())
                );
                
                if (existingIdx !== -1) {
                    // Update the placeholder table entry with the actual coordinates from the subpage!
                    if (reserves[existingIdx].Lat === null && r.Lat !== null) {
                        reserves[existingIdx].Lat = r.Lat;
                        reserves[existingIdx].Long = r.Long;
                        reserves[existingIdx].Description = r.Description; // The subpage description is usually richer
                    }
                    if (r.Area !== null && reserves[existingIdx].Area === null) {
                        reserves[existingIdx].Area = r.Area;
                    }
                } else {
                    // If it wasn't in a table, just add it as a new reserve
                    reserves.push({
                        Name: r.Name,
                        Lat: r.Lat,
                        Long: r.Long,
                        Area: r.Area,
                        Description: r.Description,
                        "Suggestion-Tags": ["Wikipedia Import"],
                        "AI-Notes": `[Wiki Subpage Scraped]: Programmatically parsed from subpage linked in: "${cleanTitle}". Details resolved using Wikipedia Query API (coordinates and extracts).`
                    });
                }
            }
            await sleep(100);
        }
    }

    // FINAL SAFETY FILTER: Drop any reserves that STILL have no coordinates (e.g., table placeholders where the subpage also had no coordinates)
    const validReserves = reserves.filter(r => r.Lat !== null && r.Long !== null);
    
    // Clean up internal tracking keys before exporting to JSON
    validReserves.forEach(r => delete r._subPageTitle);

    console.log(`   🎯 Extracted ${validReserves.length} reserves with valid coordinates.`);
    return validReserves;
}

/**
 * Wrapper for Live Wikipedia Scraping
 */
async function scrapeTrustPage(pageTitle) {
    const cleanTitle = pageTitle.replace(/_/g, ' ');
    console.log(`\n⏳ Fetching Wikipedia Page: "${cleanTitle}"...`);
    
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

        return await extractReservesFromHtml(htmlContent, cleanTitle);
    } catch (err) {
        console.error(`   ❌ Error querying ${pageTitle}:`, err.message);
        return [];
    }
}

/**
 * Wrapper for Local HTML Testing
 */
async function scrapeLocalPage(filePath) {
    const fileName = path.basename(filePath);
    const cleanTitle = fileName.replace(/\.html?$/, '').replace(/_/g, ' ');
    console.log(`\n🧪 Processing Local Test Page: "${cleanTitle}"...`);
    
    try {
        const htmlContent = fs.readFileSync(filePath, 'utf8');
        return await extractReservesFromHtml(htmlContent, cleanTitle);
    } catch (err) {
        console.error(`   ❌ Error reading local file ${fileName}:`, err.message);
        return [];
    }
}

async function main() {
    console.log("🌐 Initializing Wikipedia Nature Reserve Scraper...");
    let allReserves = [];

    // Ensure necessary folders exist
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    if (!fs.existsSync(TEST_DIR)) {
        fs.mkdirSync(TEST_DIR, { recursive: true });
        console.log(`📁 Created test directory: ${TEST_DIR}`);
        console.log(`💡 You can drop .html files in here to test the parser before querying the web.`);
    }

    // ==========================================
    // STEP 0: Process Local Test Pages (If Any)
    // ==========================================
    const testFiles = fs.readdirSync(TEST_DIR).filter(f => f.endsWith('.htm') || f.endsWith('.html'));
    if (testFiles.length > 0) {
        console.log(`\n🛠️ Found ${testFiles.length} local test pages. Processing these first...`);
        for (let file of testFiles) {
            const filePath = path.join(TEST_DIR, file);
            const testReserves = await scrapeLocalPage(filePath);
            allReserves = allReserves.concat(testReserves);
        }

        // ==========================================
        // AUTOMATED TEST SUITE: Verify against expected.json
        // ==========================================
        const expectedPath = path.join(TEST_DIR, 'expected.json');
        if (fs.existsSync(expectedPath)) {
            console.log(`\n🧪 Running Automated Tests against expected.json...`);
            try {
                const expectedData = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
                let passed = 0;
                let failed = 0;

                for (let testCase of expectedData) {
                    const expected = testCase.expectedReserve;
                    if (!expected || !expected.Name) {
                        console.warn(`   ⚠️ Invalid test case found (missing expectedReserve.Name)`);
                        continue;
                    }

                    const found = allReserves.find(r => r.Name.toLowerCase() === expected.Name.toLowerCase());

                    if (!found) {
                        console.error(`   ❌ FAIL: Could not find reserve named "${expected.Name}"`);
                        failed++;
                        continue;
                    }

                    let match = true;
                    let errors = [];

                    for (let key in expected) {
                        if (Array.isArray(expected[key])) {
                            if (JSON.stringify(found[key]) !== JSON.stringify(expected[key])) {
                                match = false;
                                errors.push(`Mismatched ${key}: Expected ${JSON.stringify(expected[key])}, got ${JSON.stringify(found[key])}`);
                            }
                        } else if (found[key] !== expected[key]) {
                            match = false;
                            errors.push(`Mismatched ${key}: Expected ${expected[key]}, got ${found[key]}`);
                        }
                    }

                    if (match) {
                        console.log(`   ✅ PASS: "${expected.Name}" successfully extracted and verified.`);
                        passed++;
                    } else {
                        console.error(`   ❌ FAIL: Data mismatch for "${expected.Name}".`);
                        errors.forEach(err => console.error(`       - ${err}`));
                        failed++;
                    }
                }

                console.log(`\n📊 Test Summary: ${passed} passed, ${failed} failed.`);
                
                if (failed > 0 && TEST_MODE_ONLY) {
                    console.log(`🛑 TEST_MODE_ONLY is active. Stopping execution due to test failures.`);
                    process.exit(1);
                }

            } catch (err) {
                console.error(`   ❌ Error running tests: ${err.message}`);
            }
        }
    } else {
        console.log(`\n(No local HTML files found in ${TEST_DIR}.)`);
    }

    // ==========================================
    // STEP 1: Discover all 46 regional trusts
    // ==========================================
    if (!TEST_MODE_ONLY) {
        const trustPages = await discoverTrustPages();

        // ==========================================
        // STEP 2: Process each Trust page
        // ==========================================
        for (let i = 0; i < trustPages.length; i++) {
            const page = trustPages[i];
            console.log(`\n💼 [Trust ${i + 1}/${trustPages.length}]`);
            const pageReserves = await scrapeTrustPage(page);
            allReserves = allReserves.concat(pageReserves);
            await sleep(500); // Polite rate-limiting between Trusts
        }
    } else {
        console.log(`\n⚠️ TEST_MODE_ONLY is set to true. Skipping the live UK index crawl.`);
    }

    // ==========================================
    // STEP 3: Global Deduplication
    // ==========================================
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
    console.log(`💾 Saved ${uniqueReserves.length} unique reserves to: ${OUTPUT_FILE}`);
}

main();