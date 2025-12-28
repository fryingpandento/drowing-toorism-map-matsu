import { initMap } from './map.js';
import { initUI, setMode } from './ui.js';
import { initFavorites, toggleFavorite, removeFavorite } from './store.js';
import { parseURLParams } from './share.js';
import { searchLocation } from './geocoder.js';

document.addEventListener('DOMContentLoaded', () => {
    const mapElement = document.getElementById('map');

    // 1. Initialize Map
    const map = initMap(mapElement);
    if (!map) return;

    // 2. Initialize Favorites (needs map)
    initFavorites(map);

    // 3. Initialize UI (needs map)
    initUI(map); // UI elements (Search Box) created here

    // 4. Geocoding Event Listeners
    const searchBtn = document.getElementById('geo-search-btn');
    const searchInput = document.getElementById('geo-input');

    if (searchBtn && searchInput) {
        const performSearch = async () => {
            const query = searchInput.value;
            if (!query) return;

            // Optional: User Feedback (Loading)
            searchBtn.textContent = "⏳";
            searchBtn.disabled = true;

            const result = await searchLocation(query);

            searchBtn.textContent = "Go";
            searchBtn.disabled = false;

            if (result) {
                // Fly to location
                map.flyTo([result.lat, result.lon], 14, {
                    animate: true,
                    duration: 1.5
                });
                console.log(`Jumping to: ${result.name}`);
            } else {
                alert(`「${query}」が見つかりませんでした。`);
            }
        };

        searchBtn.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch();
        });
    }

    // 5. Parse URL Params to Restore State
    parseURLParams(map);

    // 6. Expose Global Functions
    window.toggleFavorite = toggleFavorite;
    window.removeFavorite = removeFavorite;
    window.setMode = setMode;

    console.log("App initialized via ES Modules");
});
