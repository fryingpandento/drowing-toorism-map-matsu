import { REGIONS, TOURISM_FILTERS } from './config.js';
import { isFavorite, toggleFavorite } from './store.js';
import { generateShareURL } from './share.js';
// applyFilters dynamic import used below
import { setRoutePoint, setExplicitRoutePoint, resetRoutePoints, generateDetourCourse } from './course_manager.js';

let currentMode = 'pan';
let mapInstance = null; // Store map instance

export function initUI(map) {
    mapInstance = map;

    // Map Click Listener for Route Mode
    map.on('click', (e) => {
        if (currentMode === 'route') {
            const status = setRoutePoint(map, e.latlng);
            // We need to call updateRouteStatus but it is defined locally inside initUI block in my previous replace (which works if I define it there)
            // Wait, in my previous replace I defined `updateRouteStatus` INSIDE the block? 
            // The previous replace replaced lines 34-49. It ENDED with the `updateRouteStatus` function definition?
            // No, functions defined inside `initUI` (if I pasted it there) are accessible.
            // But `updateRouteStatus` is needed here.
            // I should define `updateRouteStatus` at module level or hoisting?
            // Function declarations are hoisted if at top level of function.
            // But if I pasted it inside the `if (header)` block?
            // Looking at my replacement content: It ends with `}` of `if (header)`? No.
            // My replacement content in previous step closes `if (header)` then defines `hint` logic, then defines `updateRouteStatus`.
            // So `updateRouteStatus` is inside `initUI` scope? Yes.
            // So it should be fine.
            if (typeof updateRouteStatus === 'function') {
                updateRouteStatus(status);
            } else {
                console.error("updateRouteStatus not found");
            }
        }
    });

    // Sidebar Header: Add Share and Auto Course Buttons
    const header = document.querySelector('#sidebar h1');
    if (header) {
        // Container for action buttons
        const actionContainer = document.createElement('div');
        actionContainer.style.display = 'flex';
        actionContainer.style.gap = '10px';
        actionContainer.style.marginBottom = '15px';

        // Share Button
        const shareBtn = document.createElement('button');
        shareBtn.textContent = "🔗 共有";
        shareBtn.className = "mode-btn";
        shareBtn.style.padding = "5px 10px";
        shareBtn.style.fontSize = "0.9rem";
        shareBtn.onclick = (e) => {
            e.stopPropagation();
            generateShareURL(mapInstance);
        };

        // Route Mode Button (Replaces Auto Course)
        const routeBtn = document.createElement('button');
        routeBtn.textContent = "📍 ルート作成";
        routeBtn.className = "mode-btn";
        routeBtn.style.padding = "5px 10px";
        routeBtn.style.fontSize = "0.9rem";
        routeBtn.style.backgroundColor = "#e0f7fa";
        routeBtn.style.color = "#006064";

        routeBtn.onclick = (e) => {
            e.stopPropagation();
            setMode('route');
        };

        actionContainer.appendChild(shareBtn);
        actionContainer.appendChild(routeBtn);

        header.parentNode.insertBefore(actionContainer, header.nextSibling);
    }

    // Route Control Panel (Hidden by default)
    const hint = document.getElementById('mode-hint');
    if (hint) {
        const routePanel = document.createElement('div');
        routePanel.id = "route-panel";
        routePanel.style.display = "none";
        routePanel.style.padding = "10px";
        routePanel.style.background = "#fff3cd"; // Yellowish
        routePanel.style.border = "1px solid #ffeeba";
        routePanel.style.borderRadius = "5px";
        routePanel.style.marginTop = "10px";
        routePanel.style.marginBottom = "5px";
        routePanel.innerHTML = `
            <div id="route-msg" style="font-weight:bold; margin-bottom:5px; font-size:0.9em;">【手順①】地図をクリックしてスタート地点(S)を選択</div>
            <div style="display:flex; gap:5px;">
                <button id="route-reset" style="flex:1; padding:5px;">リセット</button>
                <button id="route-gen" style="flex:1; padding:5px; font-weight:bold; background:#ccc; color:white; border:none;" disabled>生成</button>
            </div>
        `;
        // Insert after hint
        hint.parentNode.insertBefore(routePanel, hint.nextSibling);

        // Bind Events
        routePanel.querySelector('#route-reset').onclick = () => {
            resetRoutePoints(mapInstance);
            updateRouteStatus('reset');
        };
        routePanel.querySelector('#route-gen').onclick = async function () {
            this.textContent = "生成中...";
            this.disabled = true;
            await generateDetourCourse(mapInstance);
            this.textContent = "生成";
            this.disabled = false;
        };
    }



    // Geocoding Search Box Injection
    if (!document.getElementById('geo-input')) {
        const targetSelect = document.getElementById('region-select');
        if (targetSelect) {
            const regionGroup = targetSelect.closest('.control-group');
            if (regionGroup) {
                const searchContainer = document.createElement('div');
                searchContainer.className = 'control-group';
                searchContainer.innerHTML = `
                    <label>📍 地名・駅名で移動</label>
                    <div style="display:flex; gap:5px;">
                        <input type="text" id="geo-input" placeholder="例: 京都駅, 嵐山" style="flex:1; padding:8px; border:1px solid #ccc; border-radius:4px;">
                        <button id="geo-search-btn" style="padding:8px 12px; cursor:pointer; background:#eee; border:1px solid #ccc; border-radius:4px;">Go</button>
                    </div>
                `;
                regionGroup.parentNode.insertBefore(searchContainer, regionGroup);
            }
        }
    }

    function updateRouteStatus(status) {
        const msg = document.getElementById('route-msg');
        const genBtn = document.getElementById('route-gen');
        if (!msg || !genBtn) return;

        if (status === 'start_set') {
            msg.textContent = "【手順②】次はゴール地点(G)を選択してください";
            msg.style.color = "#d32f2f";
        } else if (status === 'goal_set') {
            msg.textContent = "準備OK！「生成」ボタンを押してください";
            msg.style.color = "#388e3c";
            genBtn.disabled = false;
            genBtn.style.backgroundColor = "#ff4b4b";
            genBtn.style.color = "white";
        } else if (status === 'reset') {
            msg.textContent = "【手順①】地図をクリックしてスタート地点(S)を選択";
            msg.style.color = "black";
            genBtn.disabled = true;
            genBtn.style.backgroundColor = "#ccc";
            genBtn.style.color = "white";
        }
    }

}





// Mode Toggle Logic
document.getElementById('mode-pan').addEventListener('click', () => setMode('pan'));
document.getElementById('mode-draw').addEventListener('click', () => setMode('draw'));
document.getElementById('mode-box').addEventListener('click', () => setMode('box'));
document.getElementById('mode-radius').addEventListener('click', () => setMode('radius'));

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

// Filters (Client-side)
// We need to import applyFilters from api.js. 
// To avoid top-level await or cycle issues, we can just bind it inside a lambda if imported.
const handleFilter = () => {
    import('./api.js').then(module => module.applyFilters());
    // Dynamic import or standard import? Standard import is circular. 
    // Let's try standard import at top.
}
document.getElementById('filter-text').addEventListener('input', handleFilter);
document.getElementById('filter-web').addEventListener('change', handleFilter);
document.getElementById('filter-wiki').addEventListener('change', handleFilter);
document.getElementById('filter-hours').addEventListener('change', handleFilter);

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
const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
const sidebar = document.getElementById('sidebar');

if (sidebar) {
    if (sidebarCloseBtn) {
        sidebarCloseBtn.addEventListener('click', (e) => {
            sidebar.classList.remove('expanded');
            e.stopPropagation();
        });
    }

    sidebar.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.tagName === 'LABEL') {
            return;
        }
        if (sidebar.classList.contains('expanded')) {
            const isHandle = e.target === sidebarHandle || e.target.closest('#sidebar-handle');
            const isHeader = e.target.tagName === 'H1' || e.target.closest('h1');
            if (isHandle || isHeader) {
                sidebar.classList.remove('expanded');
            }
        } else {
            sidebar.classList.add('expanded');
        }
    });
}

// Default Mobile Mode
if (window.innerWidth <= 768) {
    setMode('radius');
}


export function setMode(mode) {
    currentMode = mode;
    document.getElementById('mode-pan').classList.toggle('active', mode === 'pan');
    document.getElementById('mode-draw').classList.toggle('active', mode === 'draw');
    document.getElementById('mode-box').classList.toggle('active', mode === 'box');
    document.getElementById('mode-radius').classList.toggle('active', mode === 'radius');

    const routeBtn = document.getElementById('mode-route');
    if (routeBtn) routeBtn.classList.toggle('active', mode === 'route');

    const routePanel = document.getElementById('route-panel');
    if (routePanel) routePanel.style.display = (mode === 'route') ? 'block' : 'none';

    const radiusCtrl = document.getElementById('radius-control');
    if (radiusCtrl) {
        radiusCtrl.style.display = (mode === 'radius') ? 'block' : 'none';
    }

    const hint = document.getElementById('mode-hint');
    const mapContainer = document.getElementById('map'); // Get map container for cursor

    if (hint) {
        // Reset Cursor first
        if (mapContainer) mapContainer.style.cursor = '';

        if (mode === 'pan') {
            hint.textContent = "地図をドラッグして移動します。";
            if (mapInstance && mapInstance.dragging) mapInstance.dragging.enable();
            if (mapContainer) mapContainer.style.cursor = 'grab';
        } else if (mode === 'draw') {
            hint.textContent = "地図上を自由になぞって囲んでください。";
            if (mapInstance && mapInstance.dragging) mapInstance.dragging.disable();
            if (mapContainer) mapContainer.style.cursor = 'crosshair';
        } else if (mode === 'box') {
            hint.textContent = "ドラッグして四角形で囲んでください。";
            if (mapInstance && mapInstance.dragging) mapInstance.dragging.disable();
            if (mapContainer) mapContainer.style.cursor = 'crosshair';
        } else if (mode === 'radius') {
            hint.textContent = "地図上の点をクリックすると、周辺を検索します。";
            if (mapInstance && mapInstance.dragging) mapInstance.dragging.enable();
            if (mapContainer) mapContainer.style.cursor = 'pointer';
        } else if (mode === 'route') {
            hint.textContent = "地図を2箇所クリックして、スタートとゴールを決めてください。";
            if (mapInstance && mapInstance.dragging) mapInstance.dragging.enable();
            if (mapContainer) mapContainer.style.cursor = 'crosshair'; // Change to crosshair
        }
    }
}

export function isDrawingMode() {
    return currentMode === 'draw' || currentMode === 'box';
}

export function getCurrentMode() {
    return currentMode;
}

export function displayResults(spots) {
    const list = document.getElementById('results-list');
    const countSpan = document.getElementById('result-count');

    list.innerHTML = "";
    countSpan.textContent = spots.length;

    if (spots.length === 0) {
        list.className = "";
        list.innerHTML = "<p>見つかりませんでした。</p>";
        return;
    }

    spots.forEach(spot => {
        createCard(spot, list);
    });

    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        const resultsSection = document.getElementById('results-section');

        if (sidebar) {
            if (!sidebar.classList.contains('expanded')) {
                sidebar.classList.add('expanded');
            }
            if (resultsSection) {
                setTimeout(() => {
                    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 300);
            }
        }
    }
}

export function createCard(spot, container) {
    const tags = spot.tags || {};
    const name = tags.name;

    // Subtype Logic
    let subtype = "スポット";
    let tagClass = "";

    // Detailed Category Logic (Same as recent update)
    // --- 絶景・自然 (Green) ---
    if (tags.tourism === 'viewpoint') { subtype = "📸 展望台"; tagClass = "tag-nature"; }
    else if (tags.natural === 'peak') { subtype = "⛰️ 山"; tagClass = "tag-nature"; }
    else if (tags.waterway === 'waterfall') { subtype = "💧 滝"; tagClass = "tag-nature"; }
    else if (tags.natural === 'beach') { subtype = "🏖️ 海・ビーチ"; tagClass = "tag-nature"; }

    // --- 歴史 (Brown) ---
    else if (tags.historic === 'castle' || tags.castle_type) { subtype = "🏯 城・城跡"; tagClass = "tag-history"; }
    else if (tags.amenity === 'place_of_worship') {
        if (tags.religion === 'shinto') subtype = "⛩️ 神社";
        else if (tags.religion === 'buddhist') subtype = "🙏 寺院";
        else subtype = "⛩️ 寺社・宗教";
        tagClass = "tag-history";
    }
    else if (tags.historic) { subtype = "📜 史跡・旧跡"; tagClass = "tag-history"; }

    // --- 芸術 (Purple) ---
    else if (tags.tourism === 'museum') { subtype = "🏛️ 博物館"; tagClass = "tag-art"; }
    else if (tags.tourism === 'artwork') { subtype = "🎨 アート"; tagClass = "tag-art"; }
    else if (tags.tourism === 'gallery') { subtype = "🖼️ ギャラリー"; tagClass = "tag-art"; }

    // --- 温泉 (Cyan) ---
    else if (tags.amenity === 'public_bath' || tags.natural === 'hot_spring' || tags.nmt === 'onsen') { subtype = "♨️ 温泉"; tagClass = "tag-relax"; }
    else if (tags.tourism === 'hotel' || tags.tourism === 'hostel' || tags.tourism === 'guest_house') { subtype = "🏨 宿泊"; tagClass = "tag-relax"; }

    // --- エンタメ (Orange) ---
    else if (tags.tourism === 'theme_park') { subtype = "🎡 テーマパーク"; tagClass = "tag-entertainment"; }
    else if (tags.tourism === 'zoo') { subtype = "🦁 動物園"; tagClass = "tag-entertainment"; }
    else if (tags.tourism === 'aquarium') { subtype = "🐬 水族館"; tagClass = "tag-entertainment"; }
    else if (tags.leisure === 'park') { subtype = "🌳 公園"; tagClass = "tag-entertainment"; }

    // --- 食事 (Pink) ---
    else if (tags.amenity === 'restaurant') {
        if (tags.cuisine === 'ramen') subtype = "🍜 ラーメン";
        else if (tags.cuisine === 'japanese' || tags.cuisine === 'sushi') subtype = "🍱 日本料理";
        else if (tags.cuisine === 'italian') subtype = "🍝 イタリアン";
        else subtype = "🍽️ レストラン";
        tagClass = "tag-food";
    }
    else if (tags.amenity === 'cafe') { subtype = "☕ カフェ"; tagClass = "tag-food"; }
    else if (tags.amenity === 'fast_food') { subtype = "🍔 ファストフード"; tagClass = "tag-food"; }
    else if (tags.amenity === 'food_court') { subtype = "🍴 フードコート"; tagClass = "tag-food"; }

    // Fallback
    else if (tags.amenity) { subtype = tags.amenity; }
    else if (tags.historic) { subtype = tags.historic; tagClass = "tag-history"; }
    else if (tags.tourism) { subtype = tags.tourism; }
    else if (tags.natural) { subtype = tags.natural; tagClass = "tag-nature"; }

    // Details Elements
    const detailsHtml = [];
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
    if (tags.website) {
        detailsHtml.push(`<a href="${tags.website}" target="_blank" style="margin-right:5px; text-decoration:none;">🔗 HP</a>`);
    }
    if (tags.opening_hours) {
        detailsHtml.push(`<span title="${tags.opening_hours}" style="cursor:help;">🕒 時間</span>`);
    }

    let distText = "";
    if (spot.distance !== undefined) {
        if (spot.distance >= 1000) {
            distText = (spot.distance / 1000).toFixed(1) + "km";
        } else {
            distText = Math.round(spot.distance) + "m";
        }
    }

    const googleUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + " 観光")}`;

    // Favorite Logic
    const isFav = isFavorite(name);
    const pinBtnText = isFav ? "★ ピン留め済" : "☆ ピン留め";
    const pinBtnClass = isFav ? "pin-btn active" : "pin-btn";
    const markerClass = tagClass.replace('tag-', 'marker-');

    const card = document.createElement('div');
    card.className = 'spot-card';
    card.innerHTML = `
        <div class="spot-title">
            ${name} <span style="font-size:0.8em; color:#ff4b4b; margin-left:5px;">📍${distText}</span>
        </div>
        <div style="margin: 5px 0;">
            <span class="spot-tag ${tagClass}">${subtype}</span>
            <span class="spot-details">${detailsHtml.join(' ')}</span>
        </div>
        <div style="display:flex; gap:10px; margin-top:8px; flex-wrap:wrap;">
            <a href="${googleUrl}" target="_blank" class="google-btn" style="flex:1; text-align:center;">🌏 Map</a>
            <button class="${pinBtnClass}" onclick="window.toggleFavorite('${name.replace(/'/g, "\\'")}', ${spot.lat}, ${spot.lon}, this, '${markerClass}')" style="flex:1;">
                ${pinBtnText}
            </button>
        </div>
        <div style="display:flex; gap:5px; margin-top:5px;">
            <button class="route-set-btn start" style="flex:1; background:#e8f5e9; color:#2e7d32; border:1px solid #c8e6c9;" data-role="start">S スタート</button>
            <button class="route-set-btn goal" style="flex:1; background:#ffebee; color:#c62828; border:1px solid #ffcdd2;" data-role="end">G ゴール</button>
        </div>
    `;

    // Bind Route Buttons
    card.querySelectorAll('.route-set-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            try {
                const role = btn.dataset.role; // 'start' or 'end'

                // Check dependencies
                if (!mapInstance) throw new Error("Map instance is missing");
                if (typeof setExplicitRoutePoint !== 'function') throw new Error("setExplicitRoutePoint is not a function");

                // Switch to Route Mode if not active
                if (currentMode !== 'route') {
                    setMode('route');
                }

                // Set Point
                const latlng = { lat: spot.lat, lng: spot.lon };
                const status = setExplicitRoutePoint(mapInstance, latlng, role);

                // Update Status UI
                const msg = document.getElementById('route-msg');
                const genBtn = document.getElementById('route-gen');
                if (msg && genBtn) {
                    if (status === 'start_set') {
                        msg.textContent = "【手順②】次はゴール地点(G)を選択してください";
                        msg.style.color = "#d32f2f";
                    } else if (status === 'goal_set') {
                        msg.textContent = "準備OK！「生成」ボタンを押してください";
                        msg.style.color = "#388e3c";
                        genBtn.disabled = false;
                        genBtn.style.backgroundColor = "#ff4b4b";
                        genBtn.style.color = "white";
                    }
                }
            } catch (err) {
                console.error("Route Button Error:", err);
                alert("エラーが発生しました: " + err.message);
            }
        });
    });

    card.addEventListener('click', (e) => {
        if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON' || e.target.closest('a') || e.target.closest('button')) return;

        if (mapInstance) mapInstance.setView([spot.lat, spot.lon], 16);

        let popupContent = `<b>${name}</b><br>📍${distText}`;
        const safeName = name.replace(/'/g, "\\'");

        if (isFavorite(name)) {
            popupContent += `
                <br><span style="color:#ffd700;">★ お気に入り</span><br>
                <div style="text-align:center;">
                    <button onclick="window.removeFavorite('${safeName}'); this.closest('.leaflet-popup').remove();" style="margin-top:5px; padding:3px 8px; cursor:pointer;">
                        解除
                    </button>
                </div>
             `;
        }

        L.popup()
            .setLatLng([spot.lat, spot.lon])
            .setContent(popupContent)
            .openOn(mapInstance);

        if (window.innerWidth <= 768) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.remove('expanded');
            e.stopPropagation();
        }
    });

    container.appendChild(card);
}

// Global Registration for Compatibility
window.initUI = initUI;
window.setMode = setMode;
window.isDrawingMode = isDrawingMode;
window.getCurrentMode = getCurrentMode;
window.displayResults = displayResults;
window.createCard = createCard;
