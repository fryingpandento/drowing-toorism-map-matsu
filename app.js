// --- Constants (Identical to app.py) ---
const REGIONS = {
    "今いる場所 (デフォルト)": [34.9858, 135.7588, 13],
    "北海道 (札幌)": [43.0618, 141.3545, 10],
    "東北 (仙台)": [38.2682, 140.8694, 10],
    "関東 (東京)": [35.6895, 139.6917, 10],
    "中部 (名古屋)": [35.1815, 136.9066, 10],
    "近畿 (大阪)": [34.6937, 135.5023, 10],
    "中国 (広島)": [34.3853, 132.4553, 10],
    "四国 (高松)": [34.3428, 134.0466, 10],
    "九州 (福岡)": [33.5904, 130.4017, 10],
    "沖縄 (那覇)": [26.2124, 127.6809, 10]
};

const TOURISM_FILTERS = {
    "📸 絶景・自然": [
        'node["tourism"="viewpoint"]',
        'node["natural"="peak"]',
        'node["waterway"="waterfall"]',
        'node["natural"="beach"]',
        'way["natural"="beach"]',
        'node["leisure"="park"]'
    ],
    "⛩️ 歴史・神社仏閣": [
        'node["historic"~"castle|ruins|memorial|monument"]',
        'way["historic"~"castle|ruins"]',
        'node["amenity"="place_of_worship"]',
        'way["amenity"="place_of_worship"]',
        'node["historic"="wayside_shrine"]'
    ],
    "🎨 芸術・博物館": [
        'node["tourism"="museum"]',
        'node["tourism"="artwork"]',
        'node["tourism"="gallery"]',
        'way["tourism"="museum"]'
    ],
    "♨️ 温泉・リラックス": [
        'node["amenity"="public_bath"]',
        'node["natural"="hot_spring"]',
        'node["tourism"="hotel"]'
    ],
    "🎡 エンタメ・体験": [
        'node["tourism"="theme_park"]',
        'node["tourism"="zoo"]',
        'node["tourism"="aquarium"]',
        'node["leisure"="resort"]'
    ]
};

// --- Global State ---
let map;
let drawControl;
let drawnItems;
let allSpots = [];

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initUI();
});

function initMap() {
    // 1. Initialize Map (Kyoto Default)
    map = L.map('map').setView([34.9858, 135.7588], 13);

    // 2. Tile Layer (OSM)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // 3. Initialize Drawing (Leaflet.draw)
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    drawControl = new L.Control.Draw({
        draw: {
            polyline: false,
            polygon: true,
            rectangle: true,
            circle: false,
            marker: false,
            circlemarker: false
        },
        edit: {
            featureGroup: drawnItems,
            remove: true
        }
    });
    map.addControl(drawControl);

    // 4. Event Listeners
    map.on(L.Draw.Event.CREATED, function (e) {
        // Clear previous drawings (User usually wants to search one area)
        drawnItems.clearLayers();

        const layer = e.layer;
        drawnItems.addLayer(layer);

        // Trigger Search immediately (or could be manual, but app.py implies reactive)
        // Let's keep it manual via button or auto? 
        // app.py says "mapの初期位置を更新" etc.
        // Let's do it like app.py: Trigger search when drawing finishes?
        // Actually app.py runs on re-render.
        // Let's add a "Search this area" toast or just run it.
        // For robustness, let's run it.
        searchSpots(layer);
    });
}

function initUI() {
    // Mode Toggle Logic
    document.getElementById('mode-pan').addEventListener('click', () => setMode('pan'));
    document.getElementById('mode-draw').addEventListener('click', () => setMode('draw'));

    // Region Select
    const regionSelect = document.getElementById('region-select');
    Object.keys(REGIONS).forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = key;
        regionSelect.appendChild(option);
    });

    regionSelect.addEventListener('change', (e) => {
        const coords = REGIONS[e.target.value];
        map.setView([coords[0], coords[1]], coords[2]);
    });

    // Categories
    const catList = document.getElementById('category-list');
    Object.keys(TOURISM_FILTERS).forEach(key => {
        const div = document.createElement('div');
        div.className = 'checkbox-item';
        div.innerHTML = `<label><input type="checkbox" value="${key}" checked> ${key}</label>`;
        catList.appendChild(div);
    });

    // Close Results
    document.getElementById('close-results').addEventListener('click', () => {
        document.getElementById('results-panel').classList.add('hidden');
    });

    // Filters (Client-side)
    const applyFiltersBound = () => applyFilters(); // Function defined below
    document.getElementById('filter-text').addEventListener('input', applyFiltersBound);
    document.getElementById('filter-web').addEventListener('change', applyFiltersBound);
    document.getElementById('filter-wiki').addEventListener('change', applyFiltersBound);
    document.getElementById('filter-hours').addEventListener('change', applyFiltersBound);
}

// --- Search Logic (Ported from get_specialized_spots) ---
async function searchSpots(layer) {
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

    // Robustness: Always use BBox if possible?
    // app.py logic: if poly -> poly, if rect -> bbox.
    // BUT fallback logic showed bbox.
    // Let's try BBox first as user requested "Python made it work".

    // Get Bounds
    const bounds = layer.getBounds();
    // Overpass BBox: (south, west, north, east)
    areaFilter = `(${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()})`;

    // Note: If we really want Polygon logic for polygons:
    // we could check `if (layer instanceof L.Polygon && !(layer instanceof L.Rectangle))`
    // But for now, BBox is safest.

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
    [out:json][timeout:60];
    (
      ${queryParts}
    );
    // Keep only named items (Strict Port)
    (._; >;);
    out center body;
    `;

    try {
        const response = await fetch("https://overpass.kumi.systems/api/interpreter", {
            method: "POST",
            body: "data=" + encodeURIComponent(overpassQuery)
        });

        if (!response.ok) throw new Error(response.status);

        const data = await response.json();
        const elements = data.elements || [];

        // 4. Client-side Processing (Dedupe & Filter)
        const seen = new Set();
        allSpots = [];

        elements.forEach(el => {
            const tags = el.tags || {};
            const name = tags.name;

            // Strict Port: "name" must exist
            if (!name) return;
            if (seen.has(name)) return; // Simple name deduping

            seen.add(name);

            // Calc lat/lon
            const lat = el.lat || el.center?.lat;
            const lon = el.lon || el.center?.lon;

            if (lat && lon) {
                allSpots.push({ ...el, lat, lon });
            }
        });

        statusMsg.textContent = `完了: ${allSpots.length}件`;
        displayResults(allSpots);

    } catch (e) {
        console.error(e);
        statusMsg.textContent = "エラーが発生しました";
        alert("データ取得に失敗しました");
    }
}

function displayResults(spots) {
    const panel = document.getElementById('results-panel');
    const list = document.getElementById('results-list');
    const countSpan = document.getElementById('result-count');

    panel.classList.remove('hidden');
    list.innerHTML = "";
    countSpan.textContent = spots.length;

    if (spots.length === 0) {
        list.innerHTML = "<p>見つかりませんでした。</p>";
        return;
    }

    spots.forEach(spot => {
        createCard(spot, list);
    });
}

function createCard(spot, container) {
    const tags = spot.tags || {};
    const name = tags.name;

    // Subtype Logic
    let subtype = "スポット";
    if (tags.amenity) subtype = tags.amenity;
    else if (tags.historic) subtype = tags.historic;
    else if (tags.tourism) subtype = tags.tourism;
    else if (tags.natural) subtype = tags.natural;

    // Details String
    const details = [];
    if (tags.wikipedia) details.push("📖 Wiki");
    if (tags.website) details.push("🔗 HP");
    if (tags.opening_hours) details.push("🕒 時間");

    const googleUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + " 観光")}`;

    const card = document.createElement('div');
    card.className = 'spot-card';
    card.innerHTML = `
        <div class="spot-title">${name}</div>
        <div style="margin: 5px 0;">
            <span class="spot-tag">${subtype}</span>
            <span class="spot-details">${details.join(' ')}</span>
        </div>
        <a href="${googleUrl}" target="_blank" class="google-btn">🌏 Googleマップ</a>
    `;

    // Click to pan
    card.addEventListener('click', (e) => {
        if (e.target.tagName === 'A') return;
        map.setView([spot.lat, spot.lon], 16);
        L.popup()
            .setLatLng([spot.lat, spot.lon])
            .setContent(`<b>${name}</b>`)
            .openOn(map);
    });

    container.appendChild(card);
}

// --- Client-side Filtering ---
function applyFilters() {
    const text = document.getElementById('filter-text').value.toLowerCase();
    const useWeb = document.getElementById('filter-web').checked;
    const useWiki = document.getElementById('filter-wiki').checked;
    const useHours = document.getElementById('filter-hours').checked;

    const list = document.getElementById('results-list');
    list.innerHTML = "";

    let count = 0;

    allSpots.forEach(spot => {
        const tags = spot.tags || {};
        const name = tags.name || "";

        // 1. Text Search
        if (text && !name.toLowerCase().includes(text)) return;

        // 2. Attributes
        if (useWeb && !tags.website) return;
        if (useWiki && !tags.wikipedia) return;
        if (useHours && !tags.opening_hours) return;

        createCard(spot, list);
        count++;
    });

    document.getElementById('result-count').textContent = count;
}
