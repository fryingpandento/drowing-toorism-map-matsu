import { initMap, triggerRadiusSearch } from './map.js?v=3.5';
import { initUI, setMode } from './ui.js?v=3.5';
import { initFavorites, toggleFavorite, removeFavorite } from './store.js?v=3.5';
import { parseURLParams } from './share.js?v=3.5';
import { searchLocation } from './geocoder.js?v=3.5';

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
    window.triggerRadiusSearch = triggerRadiusSearch;

    console.log("App initialized via ES Modules");
});
