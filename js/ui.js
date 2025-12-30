import { REGIONS, TOURISM_FILTERS } from './config.js?v=3.5';
import { isFavorite, toggleFavorite, clearAllFavorites } from './store.js?v=3.5';
import { generateShareURL } from './share.js?v=3.5';
// applyFilters dynamic import used below
// applyFilters dynamic import used below
import { generateThemedCourse } from './course_manager.js?v=3.5';
import { getWikipediaSummary, getWikivoyageSummary } from './api.js?v=3.5';
import { reverseGeocode } from './geocoder.js?v=3.5';

let currentMode = 'pan';
let mapInstance = null; // Store map instance
let fetchQueue = [];
let isProcessingQueue = false;

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
            e.stopPropagation();
            generateShareURL(mapInstance);
        };

        actionContainer.appendChild(shareBtn);

        // Clear All Button
        const clearBtn = document.createElement('button');
        clearBtn.textContent = "🗑 全解除";
        clearBtn.className = "mode-btn";
        clearBtn.style.padding = "5px 10px";
        clearBtn.style.fontSize = "0.9rem";
        clearBtn.style.color = "#d32f2f";
        clearBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm("すべてのピン留め（共有されたものを含む）を解除しますか？")) {
                clearAllFavorites();
            }
        };
        actionContainer.appendChild(clearBtn);

        header.parentNode.insertBefore(actionContainer, header.nextSibling);
    }





    // Locate Button
    const locateBtn = document.getElementById('locate-btn');
    if (locateBtn) {
        locateBtn.addEventListener('click', () => {
            locateBtn.textContent = "⌛ 取得中...";
            map.locate({ setView: true, maxZoom: 16 });
        });

        // Map events for location
        map.on('locationfound', (e) => {
            locateBtn.textContent = "📍 現在地";

            // Show accuracy circle?
            const radius = e.accuracy / 2;
            L.circle(e.latlng, radius).addTo(map).bindPopup("現在地 (精度 " + Math.round(radius * 2) + "m)").openPopup();
        });

        map.on('locationerror', (e) => {
            locateBtn.textContent = "📍 現在地";
            alert("現在地の取得に失敗しました: " + e.message);
        });
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



    // Region Select Listener (Moved here to access map instance)
    const regionSelect = document.getElementById('region-select');
    if (regionSelect) {
        regionSelect.addEventListener('change', (e) => {
            const coords = REGIONS[e.target.value];
            if (map) map.setView([coords[0], coords[1]], coords[2]);
        });
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

// Categories
const catList = document.getElementById('category-list');
if (catList) catList.innerHTML = ""; // Clear existing to prevent duplicates
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
    import('./api.js?v=3.5').then(module => module.applyFilters());
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

    // Clear Queue
    fetchQueue = [];

    spots.forEach(spot => {
        createCard(spot, list);
    });

    // Start processing queue
    processFetchQueue();

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
        // Format: replace semicolons with space for better inline display
        // Example: "Mo-Fr 09:00-17:00; Sa 10:00-12:00" -> "Mo-Fr 09:00-17:00 Sa 10:00-12:00"
        const hours = tags.opening_hours.replace(/;/g, ' / ');
        detailsHtml.push(`<span style="font-size:0.85em; color:#444;" title="${tags.opening_hours}">🕒 ${hours}</span>`);
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

    // Address Logic
    let addressText = "";
    if (tags['addr:full']) {
        addressText = tags['addr:full'];
    } else {
        const province = tags['addr:province'] || "";
        const city = tags['addr:city'] || "";
        const suburb = tags['addr:suburb'] || "";
        const block = tags['addr:block'] || "";
        const housenumber = tags['addr:housenumber'] || "";

        if (province || city || suburb) {
            addressText = `${province}${city}${suburb}${block}${housenumber}`;
        }
    }

    const card = document.createElement('div');
    card.className = 'spot-card';
    card.innerHTML = `
        <div class="spot-title">
            ${name} <span style="font-size:0.8em; color:#ff4b4b; margin-left:5px;">📍${distText}</span>
        </div>
        ${addressText
            ? `<div style="font-size:0.85em; color:#555; margin-bottom:4px;">🏠 ${addressText}</div>`
            : `<div class="addr-placeholder" style="font-size:0.85em; color:#888; margin-bottom:4px;">🏠 読み込み中...</div>`
        }
        <div style="margin: 5px 0;">
            <span class="spot-tag ${tagClass}">${subtype}</span>
            <span class="spot-details">${detailsHtml.join(' ')}</span>
        </div>
        <div style="display:flex; gap:10px; margin-top:8px; flex-wrap:wrap;">
            <a href="${googleUrl}" target="_blank" class="google-btn" style="flex:1; text-align:center;">🌏 Map</a>
            <button class="${pinBtnClass} pin-action-btn" style="flex:1;">
                ${pinBtnText}
            </button>
        </div>
    `;

    // Attach Pin Button Listener
    const pinBtn = card.querySelector('.pin-action-btn');
    if (pinBtn) {
        pinBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card click
            toggleFavorite(name, spot.lat, spot.lon, pinBtn, markerClass, tags);
        });
    }


    // Add to Queue if address missing
    if (!addressText) {
        const placeholder = card.querySelector('.addr-placeholder');
        if (placeholder) {
            fetchQueue.push({
                lat: spot.lat,
                lon: spot.lon,
                element: placeholder,
                spot: spot
            });
        }
    }


    card.addEventListener('click', async (e) => {
        if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON' || e.target.closest('a') || e.target.closest('button')) return;

        if (mapInstance) mapInstance.setView([spot.lat, spot.lon], 16);

        let popupContent = `
            <div style="font-size:1.1em; font-weight:bold; margin-bottom:5px;">${name}</div>
            <div style="font-size:0.9em; margin-bottom:5px;">
                <span style="color:#ff4b4b;">📍 ${distText}</span>
                <span class="spot-tag ${tagClass}" style="margin-left:5px;">${subtype}</span>
            </div>
            ${(spot.tags['addr:full'] || addressText)
                ? `<div style="font-size:0.85em; color:#555; margin-bottom:4px;">🏠 ${spot.tags['addr:full'] || addressText}</div>`
                : `<div style="font-size:0.85em; color:#888; margin-bottom:4px; display:flex; align-items:center;">🏠 <button onclick="window.fetchAddress(this, ${spot.lat}, ${spot.lon})" style="border:none; background:none; color:#007bff; cursor:pointer; padding:0; text-decoration:underline;">住所を取得</button></div>`
            }
        `;

        // Add Wiki placeholder if tag exists
        const wikiTag = tags.wikipedia;
        let wikiPlaceholderId = null;
        if (wikiTag) {
            wikiPlaceholderId = `wiki-summary-${Date.now()}`;
            popupContent += `<div id="${wikiPlaceholderId}" style="margin-top:10px; padding:10px; background:#f9f9f9; border-radius:5px; font-size:0.9em; color:#666;">Wiki情報読み込み中...</div>`;
        }

        const safeName = name.replace(/'/g, "\\'");
        if (isFavorite(name)) {
            popupContent += `
                <div style="margin-top:10px; border-top:1px solid #eee; padding-top:5px; text-align:center;">
                    <span style="color:#ffd700; font-weight:bold;">★ お気に入り</span>
                    <button onclick="window.removeFavorite('${safeName}'); this.closest('.leaflet-popup').remove();" style="margin-left:10px; padding:2px 8px; cursor:pointer;">解除</button>
                </div>
             `;
        }

        // Add Links
        popupContent += `<div style="margin-top:10px;">${detailsHtml.join(' ')}</div>`;

        // Async Fetch Wiki & Wikivoyage Data
        if (wikiTag || name) {
            // Placeholder for Wikivoyage
            const voyagePlaceholderId = `voyage-summary-${Date.now()}`;
            // Insert placeholder for Voyage BEFORE Wiki if we want it prioritized, or AFTER.
            // Let's put it at the top of info if available because it's "Travel Guide".
            const voyageDiv = document.createElement('div');
            voyageDiv.id = voyagePlaceholderId;
            voyageDiv.style.marginTop = "10px";

            // Find the placeholder container in popupContent (it's a string currently, so we can't append easily until opened)
            // Actually, we can just edit the popup content string before opening, or update DOM after.
            // Updating DOM after open is easier for async.

            // We need to inject the placeholder into the popup content string constructed above.
            // Let's modify the popupContent string construction in the previous lines? 
            // Better: just append the placeholder string.
        }

        // We'll handle the async logic properly inside the click handler context

        // Define placeholders
        let voyagePlaceholderId = null;
        if (wikiTag || name) { // Try voyage for anything with a name
            voyagePlaceholderId = `voyage-summary-${Date.now()}`;
            // Show initially to prove it's trying
            popupContent += `<div id="${voyagePlaceholderId}" style="margin-top:10px; padding:10px; background:#e0f7fa; border-radius:5px; font-size:0.9em; color:#006064;"><strong>🧳 旅行ガイド</strong><br>読み込み中...</div>`;
        }

        const popup = L.popup()
            .setLatLng([spot.lat, spot.lon])
            .setContent(popupContent)
            .openOn(mapInstance);

        // 1. Wikipedia Fetch (Existing)
        if (wikiTag && wikiPlaceholderId) {
            getWikipediaSummary(wikiTag).then(summary => {
                const el = document.getElementById(wikiPlaceholderId);
                if (el && summary) {
                    let html = "";
                    if (summary.thumbnail) {
                        html += `<img src="${summary.thumbnail}" style="width:100%; height:auto; border-radius:4px; margin-bottom:5px;">`;
                    }
                    html += `<div>${summary.extract}</div>`;
                    html += `<div style="text-align:right; margin-top:5px;"><a href="${summary.url}" target="_blank" style="font-size:0.8em;">...Wikipediaで読む</a></div>`;
                    el.innerHTML = html;
                } else if (el) {
                    el.style.display = 'none';
                }
            }).catch(e => console.warn(e));
        }

        // 2. Wikivoyage Fetch (New)
        if (voyagePlaceholderId) {
            // Determine title to search: tag > name
            let searchTitle = name;
            if (wikiTag && wikiTag.includes(':')) {
                searchTitle = wikiTag.split(':')[1];
            } else if (wikiTag) {
                searchTitle = wikiTag;
            }

            getWikivoyageSummary(searchTitle).then(summary => {
                const el = document.getElementById(voyagePlaceholderId);
                if (el && summary) {
                    // Success
                    el.style.display = 'block';
                    let html = `<strong>🧳 旅行ガイド (${summary.title})</strong><br>`;
                    if (summary.thumbnail) {
                        html += `<img src="${summary.thumbnail}" style="width:100%; height:auto; border-radius:4px; margin:5px 0;">`;
                    }
                    html += `<div>${summary.extract}</div>`;
                    html += `<div style="text-align:right; margin-top:5px;"><a href="${summary.url}" target="_blank" style="font-size:0.8em;">...Wikivoyageで見る</a></div>`;
                    el.innerHTML = html;
                } else if (el) {
                    // No data found
                    el.style.display = 'none';
                }
            }).catch(e => {
                console.warn("Voyage fetch error:", e);
                const el = document.getElementById(voyagePlaceholderId);
                if (el) el.style.display = 'none'; // Hide on error
            });
        }

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
window.fetchAddress = async (btn, lat, lon) => {
    btn.textContent = "取得中...";
    btn.disabled = true;
    const fetchedAddress = await reverseGeocode(lat, lon);
    if (fetchedAddress) {
        const container = btn.parentNode;
        container.innerHTML = `🏠 ${fetchedAddress}`;
        container.style.color = "#555";
    } else {
        btn.textContent = "取得失敗";
        btn.disabled = false;
    }
};

window.createCard = createCard;

// Queue Processor
async function processFetchQueue() {
    if (isProcessingQueue) return;
    isProcessingQueue = true;

    let delay = 2000; // Increased base delay to 2 seconds

    while (fetchQueue.length > 0) {
        // Peek instead of shift first, to keep item if we need to backoff
        // But simpler: just put back if failed? Or shift and define `item`.
        const item = fetchQueue.shift();

        try {
            const fetchedAddress = await reverseGeocode(item.lat, item.lon);

            if (fetchedAddress) {
                if (item.element) {
                    item.element.innerHTML = `🏠 ${fetchedAddress}`;
                    item.element.style.color = "#555";
                    item.element.classList.remove('addr-placeholder');
                }
                item.spot.tags['addr:full'] = fetchedAddress;

                // Success: reduce delay slowly back to base
                delay = Math.max(2000, delay * 0.9);
            } else {
                if (item.element) item.element.textContent = "";
            }
        } catch (e) {
            if (e.message && e.message.includes('429')) {
                console.warn("Rate limited (429). Backing off...");
                // Put item back at front
                fetchQueue.unshift(item);

                // Increase delay exponentially (max 30s)
                delay = Math.min(30000, delay * 2);

                // Wait extra long before *next* attempt
                await new Promise(r => setTimeout(r, delay));
                continue; // Iterate
            } else {
                console.warn("Queue fetch error", e);
                // Non-retryable error, just move on
            }
        }

        // Wait standard delay
        await new Promise(r => setTimeout(r, delay));
    }

    isProcessingQueue = false;
}
