import { createPopupContent } from './popup.js';

let favoritesLayer; // Layer Group for favorites
let favoriteIds = new Set(); // Set of IDs

export function initFavorites(map) {
    favoritesLayer = L.layerGroup().addTo(map);
    loadFavorites();
}

export function isFavorite(name) {
    return favoriteIds.has(name);
}

// Updated to accept TAGS
export function toggleFavorite(name, lat, lon, btn, markerClass, tags = {}) {
    const safeName = name.replace(/'/g, "\\'");
    if (favoriteIds.has(name)) {
        // Remove
        favoriteIds.delete(name);
        removeFromFavoritesLayer(name);
        if (btn) {
            btn.textContent = "☆ ピン留め";
            btn.classList.remove('active');
        }
    } else {
        // Add
        favoriteIds.add(name);
        // We pass tags now
        addToFavoritesLayer(name, lat, lon, markerClass, tags);
        if (btn) {
            btn.textContent = "★ ピン留め済";
            btn.classList.add('active');
        }
    }
    saveFavorites();
}

export function removeFavorite(name) {
    if (favoriteIds.has(name)) {
        favoriteIds.delete(name);
        removeFromFavoritesLayer(name);
        saveFavorites();

        // Update UI buttons if present
        const buttons = document.querySelectorAll('.pin-btn.active');
        buttons.forEach(btn => {
            const onClick = btn.getAttribute('onclick');
            if (onClick && onClick.includes(name.replace(/'/g, "\\'"))) {
                btn.textContent = "☆ ピン留め";
                btn.classList.remove('active');
            }
        });
    }
}

export function addToFavoritesLayer(name, lat, lon, markerClass, tags = {}, isShared = false) {
    // Ensure markerClass isn't undefined or null string
    const cls = markerClass || '';

    // Create Custom Icon
    const icon = L.divIcon({
        className: `custom-marker ${cls}`,
        iconSize: [20, 20],
        iconAnchor: [10, 10], // Center it
        popupAnchor: [0, -10]
    });

    const marker = L.marker([lat, lon], { title: name, icon: icon }).addTo(favoritesLayer);
    marker.customId = name;
    marker.customClass = cls;
    marker.customTags = tags; // Store tags for popup
    marker.isShared = isShared; // Flag for shared pins

    // Bind using shared Popup Logic
    const spotData = {
        lat: lat,
        lon: lon,
        tags: tags,
        // Distance is unknown/variable here, usually we don't store it.
        distance: undefined
    };

    // We pass a callback for the 'Remove' button inside the popup
    const removeCb = () => {
        try {
            console.log("Attempting to remove pin:", name, "IsShared:", isShared);
            // If shared, we just remove layer. If favorite, we remove from storage too.
            if (isShared) {
                if (favoritesLayer.hasLayer(marker)) {
                    favoritesLayer.removeLayer(marker);
                    console.log("Shared pin removed from layer.");
                } else {
                    console.warn("Shared pin not found in layer (already removed?)");
                }
            } else {
                removeFavorite(name);
            }
            // Map will likely close popup automatically if layer is removed
        } catch (e) {
            console.error("Error removing pin:", e);
        }
    };

    const popupContent = createPopupContent(spotData, true, removeCb);
    marker.bindPopup(popupContent);
}

export function removeFromFavoritesLayer(name) {
    favoritesLayer.eachLayer(layer => {
        if (layer.customId === name) {
            favoritesLayer.removeLayer(layer);
        }
    });
}

export function saveFavorites() {
    const favs = [];
    favoritesLayer.eachLayer(layer => {
        if (layer.isShared) return; // Skip shared pins
        const latlng = layer.getLatLng();
        favs.push({
            name: layer.customId,
            lat: latlng.lat,
            lon: latlng.lng,
            markerClass: layer.customClass,
            tags: layer.customTags || {} // Save tags
        });
    });
    localStorage.setItem('map_favorites', JSON.stringify(favs));
}

export function loadFavorites() {
    try {
        const saved = localStorage.getItem('map_favorites');
        if (saved) {
            const favs = JSON.parse(saved);
            favs.forEach(f => {
                favoriteIds.add(f.name);
                // Check if tags exist (legacy support)
                const tags = f.tags || { name: f.name };
                addToFavoritesLayer(f.name, f.lat, f.lon, f.markerClass, tags);
            });
        }
    } catch (e) {
        console.error("Failed to load favorites", e);
    }
}

export function getFavorites() {
    const favs = [];
    if (favoritesLayer) {
        favoritesLayer.eachLayer(layer => {
            const latlng = layer.getLatLng();
            favs.push({
                name: layer.customId,
                lat: latlng.lat,
                lon: latlng.lng,
                markerClass: layer.customClass,
                tags: layer.customTags
            });
        });
    }
    return favs;
}

export function clearAllFavorites() {
    // 1. Clear Layer
    if (favoritesLayer) {
        favoritesLayer.clearLayers();
    }

    // 2. Clear Set
    favoriteIds.clear();

    // 3. Clear Storage
    localStorage.removeItem('map_favorites');

    // 4. Update UI Buttons
    const buttons = document.querySelectorAll('.pin-btn.active');
    buttons.forEach(btn => {
        btn.textContent = "☆ ピン留め";
        btn.classList.remove('active');
    });
}
