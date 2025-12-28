
let courseLayer;

/**
 * Generate a random course from the current map center.
 * @param {L.Map} map 
 */
export async function generateCourseFromLocation(map) {
    if (!map) return;
    const center = map.getCenter();
    const lat = center.lat;
    const lon = center.lng;

    console.log(`Generating course around ${lat}, ${lon}`);

    // Overpass API Query
    // Search for tourism spots and cafes within 2km
    const query = `
        [out:json][timeout:25];
        (
          node["tourism"="attraction"](around:2000,${lat},${lon});
          node["amenity"="cafe"](around:2000,${lat},${lon});
          way["tourism"="attraction"](around:2000,${lat},${lon});
        );
        out center 20;
    `;

    try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: query
        });

        if (!response.ok) throw new Error("Overpass API Error");

        const data = await response.json();
        const elements = data.elements;

        if (!elements || elements.length < 3) {
            alert("近くにスポットが少なすぎてコースを作れませんでした (3箇所以下)");
            return;
        }

        // Shuffle and Pick 3-5 spots
        const shuffled = elements.sort(() => 0.5 - Math.random());
        const count = Math.min(Math.floor(Math.random() * 3) + 3, shuffled.length); // 3 to 5
        const picked = shuffled.slice(0, count);

        // Sort by distance from start (simple optimization) to avoid zigzag
        // Simplest: just keep random for "adventure", or sort by latitude?
        // Let's sort by distance from current center to make a sequence
        picked.sort((a, b) => {
            const distA = Math.pow(a.lat - lat, 2) + Math.pow(a.lon - lon, 2);
            const distB = Math.pow(b.lat - lat, 2) + Math.pow(b.lon - lon, 2);
            return distA - distB;
        });

        // Construct Course Object
        const course = {
            title: "🎲 おまかせ散策コース",
            waypoints: picked.map(el => {
                return {
                    name: el.tags.name || el.tags.amenity || "観光スポット",
                    lat: el.lat || el.center.lat,
                    lon: el.lon || el.center.lon,
                    tags: el.tags
                };
            })
        };

        loadCourse(map, course);
        alert(`「${course.title}」を生成しました！(${count}箇所)`);

    } catch (err) {
        console.error(err);
        alert("コース生成に失敗しました");
    }
}

/**
 * Render the course on the map.
 * @param {L.Map} map
 * @param {Object} course { title, waypoints: [{lat, lon, name}, ...] }
 */
export function loadCourse(map, course) {
    if (courseLayer) {
        map.removeLayer(courseLayer);
    }
    courseLayer = L.featureGroup().addTo(map);

    const latlngs = course.waypoints.map(wp => [wp.lat, wp.lon]);

    // Draw Line (Polyline)
    L.polyline(latlngs, {
        color: '#ff4b4b',
        weight: 5,
        opacity: 0.7,
        dashArray: '10, 10'
    }).addTo(courseLayer);

    // Draw Markers
    course.waypoints.forEach((wp, index) => {
        const marker = L.marker([wp.lat, wp.lon]).addTo(courseLayer);
        const indexBadge = index + 1; // 1-based index

        // Simple Popup
        marker.bindPopup(`
            <b>${indexBadge}. ${wp.name}</b><br>
            <span style="font-size:0.9em; color:#666;">コース地点</span>
        `);

        // Optional: Custom Icon with Number
        const numberIcon = L.divIcon({
            className: 'course-marker-icon',
            html: `<div style="background:#ff4b4b; color:white; border-radius:50%; width:24px; height:24px; text-align:center; line-height:24px; font-weight:bold; border:2px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.3);">${indexBadge}</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
        marker.setIcon(numberIcon);
    });

    // Fit Bounds
    map.fitBounds(courseLayer.getBounds().pad(0.2));
}

// --- Detour Course Logic (Start -> Goal) ---

let routeLayer; // Layer for Start/End points
let startMarker = null;
let endMarker = null;
let startPoint = null;
let endPoint = null;

/**
 * Reset start/end points and clear markers.
 * @param {L.Map} map
 */
export function resetRoutePoints(map) {
    if (routeLayer) {
        map.removeLayer(routeLayer);
    }
    routeLayer = L.layerGroup().addTo(map);
    startMarker = null;
    endMarker = null;
    startPoint = null;
    endPoint = null;
    if (courseLayer) {
        map.removeLayer(courseLayer);
    }
}

/**
 * Set a specific route point (Start or End) explicitly.
 * @param {L.Map} map 
 * @param {Object} latlng {lat, lng}
 * @param {String} type 'start' or 'end'
 * @returns {String} Status
 */
export function setExplicitRoutePoint(map, latlng, type) {
    if (!routeLayer) {
        routeLayer = L.layerGroup().addTo(map);
    }

    if (type === 'start') {
        if (startMarker) routeLayer.removeLayer(startMarker);
        startPoint = latlng;
        startMarker = L.marker([latlng.lat, latlng.lng], {
            icon: L.divIcon({
                className: 'custom-marker marker-start',
                html: '<div style="background:#4caf50; color:white; border-radius:50%; width:24px; height:24px; text-align:center; line-height:24px; font-weight:bold; border:2px solid white;">S</div>',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            })
        }).addTo(routeLayer).bindPopup("<b>スタート</b>").openPopup();
    } else if (type === 'end') {
        if (endMarker) routeLayer.removeLayer(endMarker);
        endPoint = latlng;
        endMarker = L.marker([latlng.lat, latlng.lng], {
            icon: L.divIcon({
                className: 'custom-marker marker-end',
                html: '<div style="background:#f44336; color:white; border-radius:50%; width:24px; height:24px; text-align:center; line-height:24px; font-weight:bold; border:2px solid white;">G</div>',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            })
        }).addTo(routeLayer).bindPopup("<b>ゴール</b>").openPopup();
    }

    if (startPoint && endPoint) return "goal_set"; // Ready
    if (startPoint) return "start_set";
    return "reset";
}

/**
 * Handle map click to set Start or End point (Sequential).
 * @param {L.Map} map
 * @param {Object} latlng {lat, lng}
 * @returns {String} Status message
 */
export function setRoutePoint(map, latlng) {
    if (!startPoint) {
        return setExplicitRoutePoint(map, latlng, 'start');
    } else if (!endPoint) {
        return setExplicitRoutePoint(map, latlng, 'end');
    } else {
        return "full";
    }
}

/**
 * Generate a detour course between Start and End.
 * @param {L.Map} map 
 */
export async function generateDetourCourse(map) {
    if (!startPoint || !endPoint) {
        alert("スタートとゴールを設定してください！");
        return;
    }

    // Midpoint
    const midLat = (startPoint.lat + endPoint.lat) / 2;
    const midLon = (startPoint.lng + endPoint.lng) / 2;

    // Radius: Distance / 2 * 1.5 (buffer)
    const dLat = startPoint.lat - endPoint.lat;
    const dLon = startPoint.lng - endPoint.lng;
    const distDeg = Math.sqrt(dLat * dLat + dLon * dLon);
    const radiusMeters = Math.max(1000, (distDeg * 111000) / 2 * 1.5);

    console.log(`Searching detour around ${midLat}, ${midLon} r=${radiusMeters}m`);

    const query = `
        [out:json][timeout:25];
        (
          node["tourism"="attraction"](around:${radiusMeters},${midLat},${midLon});
          node["amenity"="cafe"](around:${radiusMeters},${midLat},${midLon});
          way["tourism"="attraction"](around:${radiusMeters},${midLat},${midLon});
        );
        out center 20;
    `;

    try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: query
        });

        if (!response.ok) throw new Error("Overpass API Error");

        const data = await response.json();
        const elements = data.elements;

        if (!elements || elements.length === 0) {
            alert("経由できるスポットが見つかりませんでした。");
            return;
        }

        // Pick 2-3 spots
        const shuffled = elements.sort(() => 0.5 - Math.random());
        const count = Math.min(Math.floor(Math.random() * 2) + 2, shuffled.length); // 2 to 3
        const picked = shuffled.slice(0, count);

        // Sort: Start -> Spot 1 -> Spot 2 -> End
        let currentPos = startPoint;
        const sortedWaypoints = [];
        const toSort = [...picked];

        while (toSort.length > 0) {
            let nearestIdx = -1;
            let minDist = Infinity;

            toSort.forEach((pt, idx) => {
                const ptLat = pt.lat || pt.center.lat;
                const ptLon = pt.lon || pt.center.lon;
                const d = Math.pow(ptLat - currentPos.lat, 2) + Math.pow(ptLon - currentPos.lng, 2);
                if (d < minDist) {
                    minDist = d;
                    nearestIdx = idx;
                }
            });

            if (nearestIdx !== -1) {
                const p = toSort.splice(nearestIdx, 1)[0];
                sortedWaypoints.push({
                    name: p.tags.name || p.tags.amenity || "経由地",
                    lat: p.lat || p.center.lat,
                    lon: p.lon || p.center.lon,
                    tags: p.tags
                });
                currentPos = { lat: sortedWaypoints[sortedWaypoints.length - 1].lat, lng: sortedWaypoints[sortedWaypoints.length - 1].lon };
            }
        }

        const coursePoints = [
            { name: "スタート", lat: startPoint.lat, lon: startPoint.lng },
            ...sortedWaypoints,
            { name: "ゴール", lat: endPoint.lat, lon: endPoint.lng }
        ];

        const course = {
            title: "🛤️ 寄り道コース",
            waypoints: coursePoints
        };

        loadCourse(map, course);
        alert(`コース生成完了！経由地: ${sortedWaypoints.length}箇所`);

    } catch (err) {
        console.error(err);
        alert("コース生成に失敗しました");
    }
}
