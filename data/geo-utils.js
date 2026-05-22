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

function extractGridRef(text, isStrict = false) {
    if (!text) return null;
    
    // 1. Always look for standard Wikipedia coordinates/mapping templates first
    const templateRegex = /\{\{(?:grid reference|oscoor|gbmapping)\|([A-Z]{2})\|(\d{2,5})\|(\d{2,5})/i;
    const tMatch = text.match(templateRegex);
    if (tMatch) {
        return tMatch[1].toUpperCase() + tMatch[2] + tMatch[3];
    }

    // 2. Strict Mode: If parsing a massive page of text, ONLY accept obvious Grid Refs 
    // to prevent hallucinating coordinates from random ISBNs or page numbers
    if (isStrict) {
        const strictRegex = /(?:grid\s*ref|os\s*grid|osgb)[^\w]*([HNOST][A-HJ-Z])\s*(\d{4,10})\b/i;
        const sMatch = text.match(strictRegex);
        if (sMatch) {
            if (sMatch[2].length % 2 === 0) return sMatch[1].toUpperCase() + sMatch[2];
        }
        return null;
    }

    // 3. Loose Mode: For highly targeted table cells where we expect bare coordinates
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

module.exports = {
    gridRefToLatLon,
    extractGridRef,
    parseGeoHackCoords
};