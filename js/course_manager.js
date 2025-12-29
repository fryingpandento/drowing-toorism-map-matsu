
let courseLayer;

/**
 * テーマに基づいてコース・スポットを生成する
 * @param {L.Map} map 
 * @param {String} theme 'wiki', 'gourmet', 'toilet', 'roof', 'cafe', 'random'
 */
export async function generateThemedCourse(map, theme = 'random') {
    if (!map) return;
    const center = map.getCenter();
    const lat = center.lat;
    const lon = center.lng;

    console.log(`Generating: ${theme} around ${lat}, ${lon}`);

    // ■ Wikipediaモード
    if (theme === 'wiki') {
        await searchWikipedia(map, lat, lon);
        return;
    }

    // ■ Overpass APIを使うモードのクエリ定義
    let specificQuery = "";
    let titlePrefix = "";
    let iconEmoji = "📍";

    if (theme === 'gourmet') {
        titlePrefix = "🍽️ グルメ探訪";
        iconEmoji = "🍴";
        // レストラン、ファストフード、パン屋など
        specificQuery = `
            node["amenity"~"restaurant|fast_food|food_court|bistro"](around:1000,${lat},${lon});
            node["shop"~"deli|bakery"](around:1000,${lat},${lon});
        `;
    }
    else if (theme === 'toilet') {
        titlePrefix = "🚽 トイレマップ";
        iconEmoji = "🚾";
        specificQuery = `
            node["amenity"="toilets"](around:1000,${lat},${lon});
        `;
    }
    else if (theme === 'roof') {
        titlePrefix = "☔ 雨宿り・屋根あり";
        iconEmoji = "☂️";
        // アーケード、東屋、地下道、屋内通路
        specificQuery = `
            way["covered"="yes"](around:1000,${lat},${lon});
            node["amenity"="shelter"](around:1000,${lat},${lon});
            way["highway"="corridor"](around:1000,${lat},${lon});
            way["tunnel"="yes"]["highway"="footway"](around:1000,${lat},${lon});
        `;
    }
    else if (theme === 'cafe') {
        titlePrefix = "☕ カフェ巡り";
        iconEmoji = "☕";
        specificQuery = `
            node["amenity"~"cafe|ice_cream"](around:2000,${lat},${lon});
            node["shop"~"confectionery|pastry|bakery"](around:2000,${lat},${lon});
        `;
    }
    else {
        // random (デフォルト)
        titlePrefix = "🎲 おまかせ";
        iconEmoji = "🚩";
        specificQuery = `
            node["tourism"="attraction"](around:2000,${lat},${lon});
            node["amenity"="cafe"](around:2000,${lat},${lon});
            way["tourism"="attraction"](around:2000,${lat},${lon});
        `;
    }

    // Overpass API クエリ実行
    const query = `
        [out:json][timeout:25];
        (
          ${specificQuery}
        );
        out center 30; 
    `;

    try {
        // Fix: Clean URL (removed Markdown syntax)
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: query
        });

        if (!response.ok) throw new Error("Overpass API Error");
        const data = await response.json();
        const elements = data.elements;

        if (!elements || elements.length < 1) {
            alert(`「${titlePrefix}」のスポットが見つかりませんでした。`);
            return;
        }

        let picked = [];

        // トイレ・屋根の場合は「全部表示（近い順20件）」
        if (theme === 'toilet' || theme === 'roof') {
            picked = elements.sort((a, b) => {
                // Fix: Correct parenthesis for precedence
                const da = ((a.lat || a.center.lat) - lat) ** 2 + ((a.lon || a.center.lon) - lon) ** 2;
                const db = ((b.lat || b.center.lat) - lat) ** 2 + ((b.lon || b.center.lon) - lon) ** 2;
                return da - db;
            }).slice(0, 20);
        } else {
            // その他はランダムピックアップでルート化
            const shuffled = elements.sort(() => 0.5 - Math.random());
            const count = Math.min(Math.floor(Math.random() * 3) + 3, shuffled.length);
            picked = shuffled.slice(0, count);

            // 距離順ソート
            picked.sort((a, b) => {
                const la = a.lat || a.center.lat; const lo = a.lon || a.center.lon;
                const lb = b.lat || b.center.lat; const lob = b.lon || b.center.lon;
                // Fix: Correct parenthesis
                return ((la - lat) ** 2 + (lo - lon) ** 2) - ((lb - lat) ** 2 + (lob - lon) ** 2);
            });
        }

        const course = {
            title: titlePrefix,
            theme: theme,
            waypoints: picked.map(el => ({
                name: el.tags.name || (theme === 'toilet' ? "公衆トイレ" : "スポット"),
                lat: el.lat || el.center.lat,
                lon: el.lon || el.center.lon,
                tags: el.tags,
                emoji: iconEmoji
            }))
        };

        loadCourseInternal(map, course);

    } catch (err) {
        console.error(err);
        alert("データの取得に失敗しました");
    }
}

/**
 * Wikipedia API検索
 */
async function searchWikipedia(map, lat, lon) {
    const apiUrl = `https://ja.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=2000&gslimit=10&format=json&origin=*`;
    try {
        const res = await fetch(apiUrl);
        const data = await res.json();
        if (!data.query || !data.query.geosearch || data.query.geosearch.length === 0) {
            alert("近くにWikipedia記事がある場所は見つかりませんでした。");
            return;
        }
        const waypoints = data.query.geosearch.map(page => ({
            name: page.title,
            lat: page.lat,
            lon: page.lon,
            tags: { wikipedia_pageid: page.pageid },
            emoji: "📖"
        }));
        loadCourseInternal(map, { title: "📖 Wiki散歩", theme: 'wiki', waypoints: waypoints });
    } catch (err) {
        console.error(err);
        alert("Wikipediaへの接続に失敗しました");
    }
}

/**
 * 共通描画関数
 */
function loadCourseInternal(map, course) {
    if (courseLayer) map.removeLayer(courseLayer);
    courseLayer = L.featureGroup().addTo(map);

    const isUtilityMode = (course.theme === 'toilet' || course.theme === 'roof');

    if (!isUtilityMode) {
        const latlngs = course.waypoints.map(wp => [wp.lat, wp.lon]);
        L.polyline(latlngs, {
            color: '#ff4b4b', weight: 5, opacity: 0.7, dashArray: '10, 10'
        }).addTo(courseLayer);
    }

    course.waypoints.forEach((wp, index) => {
        const marker = L.marker([wp.lat, wp.lon]).addTo(courseLayer);

        let popupContent = `<b>${wp.name}</b>`;
        if (course.theme === 'wiki' && wp.tags.wikipedia_pageid) {
            popupContent += `<br><a href="https://ja.wikipedia.org/?curid=${wp.tags.wikipedia_pageid}" target="_blank">Wikipediaで読む</a>`;
        } else if (course.theme === 'gourmet') {
            popupContent += `<br><a href="https://www.google.com/search?q=${encodeURIComponent(wp.name + " ランチ")}" target="_blank" style="color:#d35400;">🍽️ お店を検索</a>`;
        } else if (isUtilityMode) {
            popupContent += `<br><span style="color:#666;">${course.title}</span>`;
        }
        marker.bindPopup(popupContent);

        // 色分け
        let color = '#ff4b4b';
        if (course.theme === 'toilet') color = '#54a0ff';
        if (course.theme === 'roof') color = '#576574';
        if (course.theme === 'gourmet') color = '#ff9f43';
        if (course.theme === 'wiki') color = '#333';

        marker.setIcon(L.divIcon({
            className: 'course-icon',
            html: `<div style="background:${color};color:white;border-radius:50%;width:30px;height:30px;text-align:center;line-height:30px;font-size:16px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);">${wp.emoji}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        }));
    });
    map.fitBounds(courseLayer.getBounds().pad(0.2));
}

// Export as loadCourse for compatibility if needed, though generateThemedCourse is the main entry.
export { loadCourseInternal as loadCourse };
