import { getFavorites, addToFavoritesLayer } from './store.js';
import { createPopupContent } from './popup.js';

export function generateShareURL(map) {
    if (!map) return;

    const center = map.getCenter();
    const zoom = map.getZoom();

    // Get Selected Categories
    const checkboxes = document.querySelectorAll('#category-list input:checked');
    const selectedCats = Array.from(checkboxes).map(cb => cb.value);

    // Build URL Params
    const params = new URLSearchParams();

    // 1. Add Favorites (pins)
    const favorites = getFavorites();
    if (favorites.length > 0) {
        const pinsStr = favorites.map(fav => {
            const cls = fav.markerClass || '';
            // Compress tags: minimal set to save URL length? or full?
            // Let's use full tags but encoded simply.
            // We use JSON.stringify + encodeURIComponent.
            // To save space, we might only want relevant tags, but 'tags' object is usually small enough for modern browsers.
            const tagsJson = encodeURIComponent(JSON.stringify(fav.tags || {}));

            // Format: lat,lon,name,markerClass,tagsJson
            return `${fav.lat.toFixed(5)},${fav.lon.toFixed(5)},${encodeURIComponent(fav.name)},${encodeURIComponent(cls)},${tagsJson}`;
        }).join('|');

        params.set('pins', pinsStr);
    } else {
        // Fallback to center if no pins
        params.set('lat', center.lat.toFixed(5));
        params.set('lon', center.lng.toFixed(5));
        params.set('z', zoom);
    }

    if (selectedCats.length > 0) {
        params.set('cats', selectedCats.join(','));
    }

    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;

    // Copy to Clipboard
    navigator.clipboard.writeText(url).then(() => {
        alert("URLをコピーしました！\n(詳細情報も含めて共有されます)\n" + url);
    }).catch(err => {
        console.error('Failed to copy: ', err);
        prompt("URLをコピーしてください:", url);
    });
}

export function parseURLParams(map) {
    if (!map) return;

    const params = new URLSearchParams(window.location.search);
    const pins = params.get('pins');
    const lat = params.get('lat');
    const lon = params.get('lon');
    const zoom = params.get('z');
    const cats = params.get('cats');

    let hasPins = false;

    // 1. Restore Pins (Multiple)
    if (pins) {
        const pinList = pins.split('|');
        const latlngs = []; // To fit bounds

        pinList.forEach(pinStr => {
            const parts = pinStr.split(',');
            if (parts.length >= 3) {
                const pLat = parseFloat(parts[0]);
                const pLon = parseFloat(parts[1]);
                const pName = decodeURIComponent(parts[2]);
                const pClass = parts.length >= 4 ? decodeURIComponent(parts[3]) : '';
                let pTags = {};

                if (parts.length >= 5 && parts[4]) {
                    try {
                        pTags = JSON.parse(decodeURIComponent(parts[4]));
                    } catch (e) {
                        console.warn("Failed to parse tags for pin", pName);
                    }
                }
                if (!pTags.name) pTags.name = pName;

                // Add to central layer as shared (isShared=true)
                addToFavoritesLayer(pName, pLat, pLon, pClass, pTags, true);

                latlngs.push([pLat, pLon]);
            }
        });

        if (latlngs.length > 0) {
            map.fitBounds(L.latLngBounds(latlngs).pad(0.1));
            hasPins = true;
        }
    }

    // 2. Restore Map View (Fallback if no pins or explicit lat/lon provided)
    if (!hasPins && lat && lon && zoom) {
        const latNum = parseFloat(lat);
        const lonNum = parseFloat(lon);
        map.setView([latNum, lonNum], parseInt(zoom));

        // Add Marker for SINGLE Shared Location (Legacy/Simple)
        // Only if it's NOT a pin list url
        if (params.has('name')) {
            const marker = L.marker([latNum, lonNum]).addTo(map);
            marker.bindPopup(params.get('name')).openPopup();
        }
    }

    // 3. Restore Categories
    if (cats) {
        const catList = cats.split(',');
        const checkboxes = document.querySelectorAll('#category-list input');

        checkboxes.forEach(cb => {
            if (catList.includes(cb.value)) {
                cb.checked = true;
            } else {
                cb.checked = false;
            }
        });
    }

    return hasPins || (lat && lon);
}
