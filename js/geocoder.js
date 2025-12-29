export async function searchLocation(query) {
    if (!query || query.trim() === "") return null;

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'DeepTourismMap/1.0' // Polite User-Agent
            }
        });

        if (!response.ok) {
            throw new Error(`Geocoding error: ${response.status}`);
        }

        const data = await response.json();

        if (data && data.length > 0) {
            // Return top result
            const top = data[0];
            return {
                lat: parseFloat(top.lat),
                lon: parseFloat(top.lon),
                name: top.display_name
            };
        } else {
            return null;
        }
    } catch (e) {
        console.error("Geocoding failed:", e);
        return null; // Handle error gracefully
    }
}

export async function reverseGeocode(lat, lon) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'DeepTourismMap/1.0'
            }
        });

        if (!response.ok) throw new Error(`Reverse Geocoding error: ${response.status}`);

        const data = await response.json();
        if (data && data.address) {
            const addr = data.address;
            const province = addr.province || addr.state || "";
            const city = addr.city || addr.town || addr.village || "";
            // User requested city level only
            return `${province}${city}` || data.display_name;
        }
        return null;
    } catch (e) {
        if (e.message.includes('429')) throw e; // Re-throw 429 for backoff handling
        console.error("Reverse geocoding failed:", e);
        return null;
    }
}
