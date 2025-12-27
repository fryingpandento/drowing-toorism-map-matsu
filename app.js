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
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        alert('CRITICAL: Map container element (#map) NOT found in DOM. HTML structure might be broken.');
        console.error('Map container not found');
        return;
    }
    initMap(mapElement);
    initUI();
});

function initMap(mapElement) {
    // 1. Initialize Map (Kanto Default)
    // Pass the element directly to avoid "Map container not found"
    map = L.map(mapElement, {
        dragging: true, // Default enabled
        tap: true
    }).setView([35.6895, 139.6917], 10);

    // 2. Tile Layer (OSM)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // 3. Custom Freehand Drawing Events
    // Mouse Events
    map.on('mousedown', startDraw);
    map.on('mousemove', moveDraw);
    map.on('mouseup', endDraw);
    map.on('click', onPointSearch);

    // Touch Events (for Mobile)
    const mapContainer = map.getContainer();

    mapContainer.addEventListener('touchstart', (e) => {
        if (!isDrawingMode()) return;
        // Don't prevent default everywhere or we can't pan in pan mode.
        // Prevent default only if in Draw Mode
        e.preventDefault();
        startDraw(e);
    }, { passive: false });

    mapContainer.addEventListener('touchmove', (e) => {
        if (!isDrawingMode()) return;
        if (isDrawing) e.preventDefault(); // Stop scroll while drawing
        moveDraw(e);
    }, { passive: false });

    mapContainer.addEventListener('touchend', (e) => {
        if (!isDrawingMode()) return;
        endDraw();
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
        if (key === "関東 (東京)") option.selected = true;
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

    // Radius Slider Listener
    const radiusSlider = document.getElementById('radius-select');
    const radiusVal = document.getElementById('radius-val');
    if (radiusSlider && radiusVal) {
        radiusSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            if (val >= 1000) {
                radiusVal.textContent = (val / 1000) + "km";
            } else {
                radiusVal.textContent = val + "m";
            }
        });
    }

    // Mobile Bottom Sheet Toggle
    const sidebarHandle = document.getElementById('sidebar-handle');
    const sidebar = document.getElementById('sidebar');
    const header = document.querySelector('#sidebar h1'); // Select the H1

    if (sidebar && (sidebarHandle || header)) {
        const toggleSidebar = () => {
            sidebar.classList.toggle('expanded');
        };

        if (sidebarHandle) sidebarHandle.addEventListener('click', toggleSidebar);
        // Also toggle when clicking the title (easier target)
        if (header) header.addEventListener('click', toggleSidebar);
    }
}

// --- Mode Management ---
let currentMode = 'pan';

function setMode(mode) {
    currentMode = mode;
    document.getElementById('mode-pan').classList.toggle('active', mode === 'pan');
    document.getElementById('mode-draw').classList.toggle('active', mode === 'draw');
    document.getElementById('mode-box').classList.toggle('active', mode === 'box');
    document.getElementById('mode-radius').classList.toggle('active', mode === 'radius');

    // Toggle Radius Control
    const radiusCtrl = document.getElementById('radius-control');
    if (radiusCtrl) {
        console.log(`Switching mode to ${mode}. Radius control found.`);
        radiusCtrl.style.display = (mode === 'radius') ? 'block' : 'none';
    } else {
        console.error("Radius control element not found!");
    }

    const hint = document.getElementById('mode-hint');
    if (hint) {
        if (mode === 'pan') {
            hint.textContent = "地図をドラッグして移動します。";
            if (map && map.dragging) map.dragging.enable();
        } else if (mode === 'draw') {
            hint.textContent = "地図上を自由になぞって囲んでください。";
            if (map && map.dragging) map.dragging.disable();
        } else if (mode === 'box') {
            hint.textContent = "ドラッグして四角形で囲んでください。";
            if (map && map.dragging) map.dragging.disable();
        } else if (mode === 'radius') {
            hint.textContent = "地図上の点をクリックすると、周辺を検索します。";
            if (map && map.dragging) map.dragging.enable(); // Allow panning
        }
    }
}

function isDrawingMode() {
    return currentMode === 'draw' || currentMode === 'box';
}

// --- Custom Drawing Logic ---
let isDrawing = false;
let drawnCoordinates = [];
let currentPolyline = null;
let currentRect = null;
let currentPolygon = null;


// Helper to extract LatLng from Mouse or Touch events
function getTouchLatLng(e) {
    if (e.latlng) return e.latlng; // Mouse event from Leaflet

    // Touch event (standard DOM event)
    if (e.touches && e.touches.length > 0) {
        const touch = e.touches[0];
        // Convert client X/Y to Leaflet LatLng
        return map.containerPointToLatLng([touch.clientX, touch.clientY]);
    }
    // Touch event (passed as Leaflet event wraps original)
    if (e.originalEvent && e.originalEvent.touches && e.originalEvent.touches.length > 0) {
        const touch = e.originalEvent.touches[0];
        return map.containerPointToLatLng([touch.clientX, touch.clientY]);
    }
    return null;
}

function startDraw(e) {
    if (!isDrawingMode()) return;
    isDrawing = true;

    // Support both mouse and touch events
    const latlng = getTouchLatLng(e);

    if (!latlng) return;

    drawnCoordinates = [latlng];

    // Clear previous
    if (currentPolyline) map.removeLayer(currentPolyline);
    if (currentPolygon) map.removeLayer(currentPolygon);
    if (currentRect) map.removeLayer(currentRect);

    if (currentMode === 'draw') {
        currentPolyline = L.polyline(drawnCoordinates, { color: 'red' }).addTo(map);
    } else if (currentMode === 'box') {
        currentRect = L.rectangle([latlng, latlng], { color: 'red' }).addTo(map);
    }
}

function moveDraw(e) {
    if (!isDrawing || !isDrawingMode()) return;

    const latlng = getTouchLatLng(e);

    if (!latlng) return;

    if (currentMode === 'draw') {
        drawnCoordinates.push(latlng);
        currentPolyline.setLatLngs(drawnCoordinates);
    } else if (currentMode === 'box') {
        currentRect.setBounds([drawnCoordinates[0], latlng]);
    }
}

function endDraw() {
    if (!isDrawing) return;
    isDrawing = false;

    // Convert to Polygon for visualization
    if (currentMode === 'draw') {
        if (currentPolyline) map.removeLayer(currentPolyline);
        currentPolygon = L.polygon(drawnCoordinates, {
            color: '#ff4b4b',
            fillColor: '#ff4b4b',
            fillOpacity: 0.2
        }).addTo(map);
        searchSpots(currentPolygon);
    } else if (currentMode === 'box') {
        const bounds = currentRect.getBounds();
        if (currentRect) map.removeLayer(currentRect);

        currentPolygon = L.rectangle(bounds, {
            color: '#ff4b4b',
            fillColor: '#ff4b4b',
            fillOpacity: 0.2
        }).addTo(map);
        searchSpots(currentPolygon);
    }
}

// Point Search handler (called by initMap click/tap)
function onPointSearch(e) {
    if (currentMode !== 'radius') return;

    const center = e.latlng;

    // Clear previous
    if (currentPolygon) map.removeLayer(currentPolygon);

    // Get selected radius or default to 3km
    const radiusSelect = document.getElementById('radius-select');
    const radiusMeters = radiusSelect ? parseInt(radiusSelect.value, 10) : 3000;

    const circle = L.circle(center, {
        radius: radiusMeters,
        color: '#ff4b4b',
        fillColor: '#ff4b4b',
        fillOpacity: 0.2
    }).addTo(map);

    currentPolygon = circle; // Track it to remove later

    // Circle support in searchSpots needs to just grab BBox (which works for all layers)
    searchSpots(circle);
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
            const lat = el.lat || (el.center && el.center.lat);
            const lon = el.lon || (el.center && el.center.lon);

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

    // Details Elements
    const detailsHtml = [];

    // Wikipedia Link
    if (tags.wikipedia) {
        let wikiUrl = tags.wikipedia;
        if (!wikiUrl.startsWith('http')) {
            const parts = wikiUrl.split(':');
            if (parts.length === 2) {
                wikiUrl = `https://${parts[0]}.wikipedia.org/wiki/${parts[1]}`;
            } else {
                wikiUrl = `https://ja.wikipedia.org/wiki/${wikiUrl}`;
            }
        }
        detailsHtml.push(`<a href="${wikiUrl}" target="_blank" style="margin-right:5px; text-decoration:none;">📖 Wiki</a>`);
    }

    // Website Link
    if (tags.website) {
        detailsHtml.push(`<a href="${tags.website}" target="_blank" style="margin-right:5px; text-decoration:none;">🔗 HP</a>`);
    }

    // Hours (Tooltip)
    if (tags.opening_hours) {
        detailsHtml.push(`<span title="${tags.opening_hours}" style="cursor:help;">🕒 時間</span>`);
    }

    const googleUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + " 観光")}`;

    const card = document.createElement('div');
    card.className = 'spot-card';
    card.innerHTML = `
        <div class="spot-title">${name}</div>
        <div style="margin: 5px 0;">
            <span class="spot-tag">${subtype}</span>
            <span class="spot-details">${detailsHtml.join(' ')}</span>
        </div>
        <a href="${googleUrl}" target="_blank" class="google-btn">🌏 Googleマップ</a>
    `;

    // Click to pan
    card.addEventListener('click', (e) => {
        // Prevent pan if clicking a link or the Google Map button (which also has tag A or class google-btn)
        if (e.target.tagName === 'A' || e.target.closest('a')) return;
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
