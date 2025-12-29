import { TOURISM_FILTERS } from './config.js';
import { displayResults } from './ui.js';

let allSpots = [];

export async function searchSpots(layer) {
    const statusMsg = document.getElementById('status-msg');
    statusMsg.textContent = "検索中...";

    // 1. Get Selected Categories
    const checkboxes = document.querySelectorAll('#category-list input:checked');
    const selectedCats = Array.from(checkboxes).map(cb => cb.value);

    if (selectedCats.length === 0) {
        alert("カテゴリを選択してください");
        statusMsg.textContent = "";
        return;
    }

    // 2. Build Area Filter
    let areaFilter = "";

    // Always use BBox
    const bounds = layer.getBounds();
    const searchCenter = bounds.getCenter(); // Center for distance calc

    // Overpass BBox: (south, west, north, east)
    areaFilter = `(${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()})`;

    // 3. Build Query
    let queryParts = "";
    selectedCats.forEach(cat => {
        if (TOURISM_FILTERS[cat]) {
            TOURISM_FILTERS[cat].forEach(q => {
                queryParts += `${q}${areaFilter};\n`;
            });
        }
    });

    const overpassQuery = `
    [out:json][timeout:180];
    (
      ${queryParts}
    );
    // Keep only named items
    (._; >;);
    out center body;
    `;

    try {
        // Retry Logic
        let attempts = 0;
        const maxAttempts = 4; // Increased to 4 retries for persistence
        let delay = 2000; // Start with 2s delay

        while (attempts < maxAttempts) {
            try {
                // Signal user if retrying
                if (attempts > 0) {
                    statusMsg.textContent = `混雑中... 再試行 ${attempts}/${maxAttempts}`;
                }

                response = await fetch("https://overpass-api.de/api/interpreter", {
                    method: "POST",
                    body: "data=" + encodeURIComponent(overpassQuery)
                });

                if (response.ok) break; // Success

                // Handle 429 (Too Many Requests) and 5xx (Server Errors like 504 Gateway Timeout)
                if (response.status === 429 || response.status >= 500) {
                    attempts++;
                    console.warn(`API Error ${response.status}. Retrying (${attempts}/${maxAttempts}) in ${delay}ms...`);

                    if (attempts >= maxAttempts) throw new Error(`Server Error: ${response.status}`);

                    await new Promise(r => setTimeout(r, delay));
                    delay *= 2; // Exponential backoff: 2s -> 4s -> 8s -> 16s
                } else {
                    // Client errors (400, etc) should not be retried
                    throw new Error(`API Error: ${response.status} ${response.statusText}`);
                }
            } catch (err) {
                // Network errors (fetch failed)
                attempts++;
                console.warn(`Fetch connection error. Retrying (${attempts}/${maxAttempts})...`, err);

                if (attempts >= maxAttempts) throw err;

                await new Promise(r => setTimeout(r, delay));
                delay *= 2;
            }
        }

        if (!response || !response.ok) {
            throw new Error(`API Error: ${response ? response.status : 'Network Error'}`);
        }

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error("JSON Parse Error. Response was:", text);
            throw new Error("Invalid JSON response from API");
        }

        const elements = data.elements || [];

        // 4. Client-side Processing
        const seen = new Set();
        allSpots = [];

        elements.forEach(el => {
            const tags = el.tags || {};
            const name = tags.name;

            if (!name) return;
            if (seen.has(name)) return;

            seen.add(name);

            // Calc lat/lon
            const lat = el.lat || (el.center && el.center.lat);
            const lon = el.lon || (el.center && el.center.lon);

            if (lat && lon) {
                try {
                    const latNum = Number(lat);
                    const lonNum = Number(lon);
                    const point = L.latLng(latNum, lonNum);
                    const dist = searchCenter.distanceTo(point);

                    allSpots.push({ ...el, lat: latNum, lon: lonNum, distance: dist });
                } catch (err) {
                    console.warn("Skipping invalid spot:", err);
                }
            }
        });

        // Sort by Distance
        allSpots.sort((a, b) => a.distance - b.distance);

        statusMsg.textContent = `完了: ${allSpots.length}件`;

        // --- Client-side Filtering based on Input ---
        applyFilters();

    } catch (e) {
        console.error("Search failed:", e);
        statusMsg.textContent = "エラーが発生しました: " + e.message;
        alert("データ取得に失敗しました: " + e.message);
    }
}

export function applyFilters() {
    const text = document.getElementById('filter-text').value.toLowerCase();
    const web = document.getElementById('filter-web').checked;
    const wiki = document.getElementById('filter-wiki').checked;
    const hours = document.getElementById('filter-hours').checked;

    const filtered = allSpots.filter(spot => {
        const tags = spot.tags || {};
        const name = tags.name || "";

        // Tag Search: Check if name matches OR any tag value matches
        let nameMatch = true;
        if (text) {
            const nameHit = name.toLowerCase().includes(text);
            const tagHit = Object.values(tags).some(val =>
                String(val).toLowerCase().includes(text)
            );
            if (!nameHit && !tagHit) return false;
        }

        if (web && !tags.website) return false;
        if (wiki && !tags.wikipedia) return false;
        if (hours && !tags.opening_hours) return false;

        return true;
    });

    displayResults(filtered);
}

/**
 * Wikipediaの要約を取得する
 * @param {String} wikiTag Value of 'wikipedia' tag (e.g. "ja:金閣寺" or "Mount_Fuji")
 */
export async function getWikipediaSummary(wikiTag) {
    if (!wikiTag) return null;

    let lang = 'ja';
    let title = wikiTag;

    // Handle "ja:Title" format
    if (wikiTag.includes(':')) {
        const parts = wikiTag.split(':');
        if (parts.length === 2 && parts[0].length === 2) {
            lang = parts[0];
            title = parts[1];
        }
    }

    // Clean title (spaces to underscores, though API handles spaces often)
    const apiUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;

    try {
        const res = await fetch(apiUrl);
        if (!res.ok) return null;
        const data = await res.json();

        return {
            title: data.title,
            extract: data.extract,
            thumbnail: data.thumbnail ? data.thumbnail.source : null,
            url: data.content_urls.desktop.page
        };
    } catch (e) {
        console.warn("Wiki summary fetch failed:", e);
        return null;
    }
}

/**
 * Wikivoyageの要約を取得する
 * @param {String} title Title to search (e.g. "京都駅")
 */
export async function getWikivoyageSummary(title) {
    if (!title) return null;

    // Wikivoyage API (Japanese)
    const apiUrl = `https://ja.wikivoyage.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;

    try {
        const res = await fetch(apiUrl);
        if (!res.ok) return null; // 404 if no travel guide exists
        const data = await res.json();

        return {
            title: data.title,
            extract: data.extract,
            thumbnail: data.thumbnail ? data.thumbnail.source : null,
            url: data.content_urls.desktop.page
        };
    } catch (e) {
        // Silent fail is fine, not all places have guides
        return null;
    }
}
