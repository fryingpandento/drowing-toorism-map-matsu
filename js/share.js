import { getFavorites } from './store.js';

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
    // We need to access the favorites data. Since store.js exports getFavorites (assuming based on task), we use it.
    // If getFavorites returns an array of objects {name, lat, lon}:
    const favorites = getFavorites();
    if (favorites.length > 0) {
        const pinsStr = favorites.map(fav => {
            // Encode name to be safe
            return `${fav.lat.toFixed(5)},${fav.lon.toFixed(5)},${encodeURIComponent(fav.name)}`;
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
        alert("URLをコピーしました！\n(お気に入りピンも含めて共有されます)\n" + url);
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
        const markerGroup = L.featureGroup();
        const pinList = pins.split('|');

        pinList.forEach(pinStr => {
            const parts = pinStr.split(',');
            if (parts.length >= 3) {
                const pLat = parseFloat(parts[0]);
                const pLon = parseFloat(parts[1]);
                const pName = decodeURIComponent(parts[2]);

                const marker = L.marker([pLat, pLon]).bindPopup(pName);
                marker.addTo(map);
                markerGroup.addLayer(marker);
            }
        });

        if (markerGroup.getLayers().length > 0) {
            map.addLayer(markerGroup);
            map.fitBounds(markerGroup.getBounds().pad(0.1));
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
