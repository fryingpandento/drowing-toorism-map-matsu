// --- Constants ---
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
        'node["tourism"="viewpoint"]',      // 展望台
        'node["natural"="peak"]',          // 山頂
        'node["waterway"="waterfall"]',     // 滝
        'node["natural"="beach"]',         // ビーチ
        'way["natural"="beach"]',
        'node["leisure"="park"]'           // 公園
    ],
    "⛩️ 歴史・神社仏閣": [
        'node["historic"~"castle|ruins|memorial|monument"]', // 城・遺跡・記念碑
        'way["historic"~"castle|ruins"]',
        'node["amenity"="place_of_worship"]', // 神社・寺院・教会
        'way["amenity"="place_of_worship"]',
        'node["historic"="wayside_shrine"]'   // 道端の祠
    ],
    "🎨 芸術・博物館": [
        'node["tourism"="museum"]',        // 博物館・美術館
        'node["tourism"="artwork"]',       // アート作品・像
        'node["tourism"="gallery"]',
        'way["tourism"="museum"]'
    ],
    "♨️ 温泉・リラックス": [
        'node["amenity"="public_bath"]',   // 銭湯・温泉
        'node["natural"="hot_spring"]',    // 源泉
        'node["tourism"="hotel"]'          // 宿泊
    ],
    "🎡 エンタメ・体験": [
        'node["tourism"="theme_park"]',
        'node["tourism"="zoo"]',
        'node["tourism"="aquarium"]',
        'node["leisure"="resort"]'
    ]
};

// --- State ---
let map;
let currentPolygon = null;
let currentPolyline = null;
let isDrawing = false;
let drawnCoordinates = [];
let allSpots = []; // Store fetched spots for client-side filtering
let currentMarkers = []; // Store map markers

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initUI();
});

function initMap() {
    // Default: Kyoto
    map = L.map('map').setView([34.9858, 135.7588], 13);

    // Use colored OpenStreetMap tiles
    // Use colored OpenStreetMap tiles
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);

    // Drawing Events (Mouse)
    map.on('mousedown', onMapMouseDown);
    map.on('mousemove', onMapMouseMove);
    map.on('mouseup', onMapMouseUp);

    // Drawing Events (Touch for Mobile)
    const mapContainer = map.getContainer();
    mapContainer.addEventListener('touchstart', onTouchStart, { passive: false });
    mapContainer.addEventListener('touchmove', onTouchMove, { passive: false });
    mapContainer.addEventListener('touchend', onTouchEnd);
}

// --- Touch Handling ---
// --- Touch Handling ---
function getLatLngFromTouch(touch) {
    const rect = map.getContainer().getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    return map.containerPointToLatLng(L.point(x, y));
}

function onTouchStart(e) {
    if (mode !== 'draw') return;
    e.preventDefault();
    if (e.touches.length === 0) return;

    isDrawing = true;
    const touch = e.touches[0];
    const latlng = getLatLngFromTouch(touch);

    drawnCoordinates = [latlng];

    // Clear existing
    if (currentPolygon) map.removeLayer(currentPolygon);
    if (currentPolyline) map.removeLayer(currentPolyline);

    currentPolyline = L.polyline(drawnCoordinates, { color: 'red', weight: 3 }).addTo(map);
}

function onTouchMove(e) {
    if (mode !== 'draw' || !isDrawing) return;
    e.preventDefault();
    if (e.touches.length === 0) return;

    const touch = e.touches[0];
    const latlng = getLatLngFromTouch(touch);

    drawnCoordinates.push(latlng);
    currentPolyline.setLatLngs(drawnCoordinates);
}

function onTouchEnd(e) {
    if (mode !== 'draw') return;
    e.preventDefault();
    onMapMouseUp({}); // Logic is state-based, so this is safe
}


// ... (UI Init Code Unchanged) ...

// --- Drawing Logic ---
// ... (Drawing Logic Unchanged) ...

// --- API Logic ---

async function searchSpots() {
    // Check if we have a valid search area
    if (!currentPolygon) return;

    const loader = document.getElementById('loader');
    loader.classList.remove('hidden');

    // 1. Get Selected Categories
    const checkboxes = document.querySelectorAll('#category-list input:checked');
    const selectedCats = Array.from(checkboxes).map(cb => cb.value);

    if (selectedCats.length === 0) {
        alert("カテゴリを選択してください");
        loader.classList.add('hidden');
        return;
    }

    // 2. Build Query
    let queryParts = "";

    try {
        // Simplify polygon for performance
        const rawLatLngs = currentPolygon.getLatLngs()[0];
        if (!rawLatLngs || rawLatLngs.length === 0) throw new Error("無効なエリアです");

        const simplifiedLatLngs = simplifyLatLngs(rawLatLngs, 0.0001); // Approx 10m
        const polyStr = simplifiedLatLngs.map(ll => `${ll.lat} ${ll.lng}`).join(' ');

        selectedCats.forEach(cat => {
            if (TOURISM_FILTERS[cat]) {
                TOURISM_FILTERS[cat].forEach(q => {
                    // Polygon Search
                    queryParts += `${q}(poly:"${polyStr}");\n`;
                });
            }
        });

        const overpassQuery = `
        [out:json][timeout:30];
        (
          ${queryParts}
        );
        // Keep only named items
        (._; >;);
        out center body;
        `;

        // 15 sec timeout for fetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch("https://overpass.kumi.systems/api/interpreter", {
            method: "POST",
            body: "data=" + encodeURIComponent(overpassQuery),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error("API Error: " + response.status);

        const data = await response.json();
        const elements = data.elements || [];

        // Deduplicate and process
        const seen = new Set();
        allSpots = [];

        elements.forEach(el => {
            if (el.tags && el.tags.name && !seen.has(el.tags.name)) {
                seen.add(el.tags.name);
                // Center calculation for ways/relations
                const lat = el.lat || el.center?.lat;
                const lon = el.lon || el.center?.lon;

                if (lat && lon) {
                    allSpots.push({
                        ...el,
                        lat: lat,
                        lon: lon
                    });
                }
            }
        });

        displayResults(allSpots);
        document.getElementById('results-panel').classList.remove('hidden');

    } catch (e) {
        console.error(e);
        if (e.name === 'AbortError') {
            alert("検索がタイムアウトしました。範囲を狭めて試してください。");
        } else {
            alert("データ取得に失敗しました: " + e.message);
        }
    } finally {
        loader.classList.add('hidden');
    }
}

function initUI() {
    // Populate Region Select
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

    // Populate Category Checkboxes
    const categoryList = document.getElementById('category-list');
    Object.keys(TOURISM_FILTERS).forEach(key => {
        const div = document.createElement('div');
        div.className = 'checkbox-item';
        div.innerHTML = `<input type="checkbox" value="${key}" checked> <label>${key}</label>`;
        categoryList.appendChild(div);
    });

    // Mode Toggles
    document.getElementById('mode-pan').addEventListener('click', () => setMode('pan'));
    document.getElementById('mode-draw').addEventListener('click', () => setMode('draw'));

    // Mobile Menu Toggle
    document.getElementById('mobile-menu-btn').addEventListener('click', () => {
        document.querySelector('.sidebar').classList.toggle('open');
    });

    // Search Button
    document.getElementById('search-btn').addEventListener('click', searchSpots);

    // Filtering inputs
    document.getElementById('filter-text').addEventListener('input', applyFilters);
    document.getElementById('filter-web').addEventListener('change', applyFilters);
    document.getElementById('filter-wiki').addEventListener('change', applyFilters);

    // Close panel
    document.getElementById('close-results').addEventListener('click', () => {
        document.getElementById('results-panel').classList.add('hidden');
    });
}

let mode = 'pan'; // 'pan' or 'draw'

function setMode(newMode) {
    mode = newMode;
    document.getElementById('mode-pan').classList.toggle('active', mode === 'pan');
    document.getElementById('mode-draw').classList.toggle('active', mode === 'draw');

    // Update hint text
    const hint = document.getElementById('mode-hint');
    if (hint) {
        if (mode === 'pan') hint.textContent = "「移動」モード：地図をドラッグして移動します。";
        if (mode === 'draw') hint.textContent = "「描く」モード：地図上をドラッグしてエリアを囲んでください。";
    }

    document.body.classList.remove('drawing-mode', 'pin-mode');

    if (mode === 'draw') {
        document.body.classList.add('drawing-mode');
        map.dragging.disable();
    } else {
        map.dragging.enable();
    }
}

function onMapMouseDown(e) {
    if (mode !== 'draw') return;

    isDrawing = true;
    drawnCoordinates = [e.latlng]; // Start new line

    // Remove existing shape if any
    if (currentPolygon) map.removeLayer(currentPolygon);
    if (currentPolyline) map.removeLayer(currentPolyline);

    currentPolyline = L.polyline(drawnCoordinates, { color: 'red', weight: 3 }).addTo(map);
}

function onMapMouseMove(e) {
    if (!isDrawing) return;

    drawnCoordinates.push(e.latlng);
    currentPolyline.setLatLngs(drawnCoordinates);
}

function onMapMouseUp(e) {
    if (!isDrawing) return;

    isDrawing = false;

    // Convert polyline to polygon
    if (currentPolyline) map.removeLayer(currentPolyline);

    // Simplify? Leaflet doesn't have built-in simplify usually, but we can just use the points.
    // Close the loop
    currentPolygon = L.polygon(drawnCoordinates, {
        color: '#ff4b4b',
        fillColor: '#ff4b4b',
        fillOpacity: 0.2
    }).addTo(map);

    // Enable search button (just in case)
    document.getElementById('search-btn').disabled = false;

    // Auto-search for better UX (especially on mobile where sidebar is hidden)
    searchSpots();
}

// --- API Logic ---

async function searchSpots(centerLatLng = null) {
    // Check if we have a valid search area
    if (!currentPolygon && !currentPin && !centerLatLng) return;

    const loader = document.getElementById('loader');
    loader.classList.remove('hidden');

    // 1. Get Selected Categories
    const checkboxes = document.querySelectorAll('#category-list input:checked');
    const selectedCats = Array.from(checkboxes).map(cb => cb.value);

    if (selectedCats.length === 0) {
        alert("カテゴリを選択してください");
        loader.classList.add('hidden');
        return;
    }

    // 2. Build Query
    let queryParts = "";

    selectedCats.forEach(cat => {
        if (TOURISM_FILTERS[cat]) {
            TOURISM_FILTERS[cat].forEach(q => {
                // Add spatial filter
                const target = centerLatLng || currentPin;

                if (target) {
                    // Radius Search (around:1000, lat, lon)
                    let lat, lng;
                    if (typeof target.getLatLng === 'function') {
                        const ll = target.getLatLng();
                        lat = ll.lat;
                        lng = ll.lng;
                    } else {
                        lat = target.lat;
                        lng = target.lng;
                    }
                    queryParts += `${q}(around:1000,${lat},${lng});\n`;
                } else if (currentPolygon) {
                    // Polygon Search
                    const latlngs = currentPolygon.getLatLngs()[0];
                    const polyStr = latlngs.map(ll => `${ll.lat} ${ll.lng}`).join(' ');
                    queryParts += `${q}(poly:"${polyStr}");\n`;
                }
            });
        }
    });

    const overpassQuery = `
    [out:json][timeout:60];
    (
      ${queryParts}
    );
    // Keep only named items
    (._; >;);
    out center body;
    `;

    try {
        const response = await fetch("https://overpass.kumi.systems/api/interpreter", {
            method: "POST",
            body: "data=" + encodeURIComponent(overpassQuery)
        });

        if (!response.ok) throw new Error("API Error");

        const data = await response.json();
        const elements = data.elements || [];

        // Deduplicate and process
        const seen = new Set();
        allSpots = [];

        elements.forEach(el => {
            if (el.tags && el.tags.name && !seen.has(el.tags.name)) {
                seen.add(el.tags.name);
                // Center calculation for ways/relations
                const lat = el.lat || el.center?.lat;
                const lon = el.lon || el.center?.lon;

                if (lat && lon) {
                    allSpots.push({
                        ...el,
                        lat: lat,
                        lon: lon
                    });
                }
            }
        });

        displayResults(allSpots);
        document.getElementById('results-panel').classList.remove('hidden');

    } catch (e) {
        console.error(e);
        alert("データ取得に失敗しました。");
    } finally {
        loader.classList.add('hidden');
    }
}

// --- Utils ---
function simplifyLatLngs(latlngs, tolerance) {
    if (latlngs.length <= 2) return latlngs;

    const simplified = [latlngs[0]];
    let lastPoint = latlngs[0];

    for (let i = 1; i < latlngs.length; i++) {
        const point = latlngs[i];
        // Simple distance check (squared Euclidean distance for speed)
        const dx = point.lat - lastPoint.lat;
        const dy = point.lng - lastPoint.lng;
        // 0.0001 degrees is roughly 11 meters. tolerance squared.
        if ((dx * dx + dy * dy) > (tolerance * tolerance)) {
            simplified.push(point);
            lastPoint = point;
        }
    }
    // Always include the last point to close the polygon correctly (or nearly correctly)
    simplified.push(latlngs[latlngs.length - 1]);

    return simplified;
}

function displayResults(spots) {
    const list = document.getElementById('results-list');
    list.innerHTML = "";

    document.getElementById('result-count').textContent = spots.length;

    if (spots.length === 0) {
        list.innerHTML = "<p style='text-align:center; padding:20px; color:#666;'>見つかりませんでした。</p>";
        return;
    }

    // Clear existing markers
    currentMarkers.forEach(m => map.removeLayer(m));
    currentMarkers = [];

    spots.forEach((spot, index) => {
        const name = spot.tags.name;
        // Determine subtype
        let subtype = "スポット";
        if (spot.tags.amenity) subtype = spot.tags.amenity;
        else if (spot.tags.historic) subtype = spot.tags.historic;
        else if (spot.tags.tourism) subtype = spot.tags.tourism;

        // Details
        const details = [];
        if (spot.tags.wikipedia) details.push("📖 Wiki");
        if (spot.tags.website) details.push("🔗 HP");
        if (spot.tags.opening_hours) details.push("🕒 時間");

        const googleUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + " 観光")}`;

        // Create Card
        const card = document.createElement('div');
        card.className = "spot-card";
        card.id = `card-${index}`;
        card.innerHTML = `
            <div class="spot-title">${name}</div>
            <div class="spot-meta">
                <span class="spot-tag">${subtype}</span>
                <span class="spot-details">${details.join(' ')}</span>
            </div>
            <a href="${googleUrl}" target="_blank" class="google-btn">🌏 GoogleMap</a>
        `;

        // Interaction: Click card to pan to map
        card.addEventListener('click', (e) => {
            if (e.target.tagName === 'A') return; // Ignore link clicks

            // Highlight card
            document.querySelectorAll('.spot-card').forEach(c => c.style.borderLeftColor = '#ff4b4b');
            card.style.borderLeftColor = '#0066ff';

            // Move map and open popup
            const marker = currentMarkers[index];
            if (marker) {
                map.setView(marker.getLatLng(), 16);
                marker.openPopup();
            }
        });

        list.appendChild(card);

        // Add marker to map
        const marker = L.marker([spot.lat, spot.lon])
            .addTo(map)
            .bindPopup(`<b>${name}</b><br>${subtype}`);

        currentMarkers.push(marker);
    });
}

function applyFilters() {
    const textInfo = document.getElementById('filter-text').value.toLowerCase();
    const checkWeb = document.getElementById('filter-web').checked;
    const checkWiki = document.getElementById('filter-wiki').checked;

    const filtered = allSpots.filter(spot => {
        const t = spot.tags;
        if (textInfo && !t.name.toLowerCase().includes(textInfo)) return false;
        if (checkWeb && !t.website) return false;
        if (checkWiki && !t.wikipedia) return false;
        return true;
    });

    displayResults(filtered);
}
