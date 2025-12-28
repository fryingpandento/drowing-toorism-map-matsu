import { REGIONS, TOURISM_FILTERS } from './config.js';
import { isFavorite, toggleFavorite } from './store.js';
import { generateShareURL } from './share.js';
// applyFilters dynamic import used below
import { generateCourseFromLocation } from './course_manager.js';

let currentMode = 'pan';
let mapInstance = null; // Store map instance

export function initUI(map) {
    mapInstance = map;

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
            e.stopPropagation(); // Prevent sidebar toggle
            generateShareURL(mapInstance);
        };

        header.appendChild(shareBtn);
    }


    // Add Geocoding Search Box (Dynamically injected)
    // Insert after the description or before Region Select
    const description = document.querySelector('.description');
    if (description) {
        const searchContainer = document.createElement('div');
        searchContainer.className = 'control-group';
        searchContainer.style.marginBottom = '10px';
        searchContainer.innerHTML = `
            <label style="display:flex; justify-content:space-between; align-items:center;">
                地名検索
                <span style="font-size:0.8em; color:#666; font-weight:normal;">(例: 東京駅)</span>
            </label>
            <div style="display:flex; gap:5px;">
                <input type="text" id="geo-input" placeholder="地名を入力..." style="flex:1; padding:5px;">
                <button id="geo-search-btn" style="padding:5px 10px; cursor:pointer;">🔍</button>
            </div>
        `;
        // Insert after description
        description.parentNode.insertBefore(searchContainer, description.nextSibling);
        // Actually, maybe better BEFORE description or Region select?
        // Let's put it BEFORE the Region Select (which is after description usually? check HTML)
        // HTML: .description is after Region Select? No.
        // Let's check HTML.
        // <div class="control-group">Region</div> -> <p class="description">
        // So maybe BEFORE Region select is better for visibility.
    } else {
        // Fallback: prepend to sidebar content container
        // But let's verify HTML structure first? 
        // I'll just append to .control-group container if I can find it.
        // Or simpler: Insert before region-select wrapper.
    }

    // Better Strategy: Insert before #region-select's parent .control-group
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

}


export function setMode(mode) {
    currentMode = mode;
    document.getElementById('mode-pan').classList.toggle('active', mode === 'pan');
    document.getElementById('mode-draw').classList.toggle('active', mode === 'draw');
    document.getElementById('mode-box').classList.toggle('active', mode === 'box');
    document.getElementById('mode-radius').classList.toggle('active', mode === 'radius');

    const radiusCtrl = document.getElementById('radius-control');
    if (radiusCtrl) {
        radiusCtrl.style.display = (mode === 'radius') ? 'block' : 'none';
    }

    const hint = document.getElementById('mode-hint');
    if (hint) {
        if (mode === 'pan') {
            hint.textContent = "地図をドラッグして移動します。";
            if (mapInstance && mapInstance.dragging) mapInstance.dragging.enable();
        } else if (mode === 'draw') {
            hint.textContent = "地図上を自由になぞって囲んでください。";
            if (mapInstance && mapInstance.dragging) mapInstance.dragging.disable();
        } else if (mode === 'box') {
            hint.textContent = "ドラッグして四角形で囲んでください。";
            if (mapInstance && mapInstance.dragging) mapInstance.dragging.disable();
        } else if (mode === 'radius') {
            hint.textContent = "地図上の点をクリックすると、周辺を検索します。";
            if (mapInstance && mapInstance.dragging) mapInstance.dragging.enable();
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
        <div style="display:flex; gap:10px; margin-top:8px;">
            <a href="${googleUrl}" target="_blank" class="google-btn">🌏 Googleマップ</a>
            <button class="${pinBtnClass}" onclick="window.toggleFavorite('${name.replace(/'/g, "\\'")}', ${spot.lat}, ${spot.lon}, this, '${markerClass}')">
                ${pinBtnText}
            </button>
        </div>
    `;

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
