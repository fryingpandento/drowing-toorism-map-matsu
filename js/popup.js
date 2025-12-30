import { getWikipediaSummary, getWikivoyageSummary } from './api.js';
import { triggerRadiusSearch } from './map.js';

console.log("Popup.js v3.4 loaded");

/**
 * Creates the DOM Element for a spot popup with async content.
 * @param {Object} spot - Spot data object (tags, distance, etc.)
 * @param {Boolean} isFav - True if this is a pinned favorite
 * @param {Function} [removeCallback] - Optional callback for "Remove Favorite" button
 * @returns {HTMLElement} The popup content container
 */
export function createPopupContent(spot, isFav, removeCallback) {
    const tags = spot.tags || {};
    const name = tags.name || "Unknown";

    // Container
    const container = document.createElement('div');
    container.className = 'custom-popup-content';

    // 1. Header (Title)
    const titleDiv = document.createElement('div');
    titleDiv.style.fontSize = '1.1em';
    titleDiv.style.fontWeight = 'bold';
    titleDiv.style.marginBottom = '5px';
    titleDiv.textContent = name;
    container.appendChild(titleDiv);

    // 2. Info Row (Distance, Subtype, Links)
    const infoDiv = document.createElement('div');
    infoDiv.style.fontSize = '0.9em';
    infoDiv.style.marginBottom = '8px';

    let infoHtml = [];

    // Distance
    if (spot.distance !== undefined) {
        let distText = (spot.distance >= 1000)
            ? (spot.distance / 1000).toFixed(1) + "km"
            : Math.round(spot.distance) + "m";
        infoHtml.push(`<span style="color:#ff4b4b; margin-right:8px;">📍 ${distText}</span>`);
    }

    // Links
    if (tags.wikipedia) {
        let w = tags.wikipedia;
        if (!w.startsWith('http')) {
            const parts = w.split(':');
            w = (parts.length === 2) ? `https://${parts[0]}.wikipedia.org/wiki/${parts[1]}` : `https://ja.wikipedia.org/wiki/${w}`;
        }
        infoHtml.push(`<a href="${w}" target="_blank" style="margin-right:5px; text-decoration:none;">📖 Wiki</a>`);
    }
    if (tags.website) {
        infoHtml.push(`<a href="${tags.website}" target="_blank" style="margin-right:5px; text-decoration:none;">🔗 HP</a>`);
    }

    // Opening Hours
    if (tags.opening_hours) {
        const h = tags.opening_hours.replace(/;/g, ' / ');
        infoHtml.push(`<br><span style="color:#444; font-size:0.9em; display:inline-block; margin-top:3px;">🕒 ${h}</span>`);
    }

    infoDiv.innerHTML = infoHtml.join('');
    container.appendChild(infoDiv);

    // 3. Favorite Controls (If Pinned)
    if (isFav) {
        const favDiv = document.createElement('div');
        favDiv.style.marginTop = '10px';
        favDiv.style.paddingTop = '5px';
        favDiv.style.borderTop = '1px solid #eee';
        favDiv.style.textAlign = 'center';

        const label = document.createElement('span');
        label.textContent = "★ お気に入り";
        label.style.color = "#ffd700";
        label.style.fontWeight = "bold";
        favDiv.appendChild(label);

        if (removeCallback) {
            const btn = document.createElement('button');
            btn.textContent = "解除";
            btn.style.marginLeft = "10px";
            btn.style.padding = "2px 8px";
            btn.style.cursor = "pointer";
            btn.onclick = (e) => {
                if (e) e.stopPropagation();
                removeCallback();
            };
            favDiv.appendChild(btn);
        }

        // Add "Search Around" Button
        const searchBtn = document.createElement('button');
        searchBtn.textContent = "📍 この周辺を探索";
        searchBtn.style.marginTop = "5px";
        searchBtn.style.display = "block";
        searchBtn.style.width = "100%";
        searchBtn.style.padding = "4px";
        searchBtn.style.cursor = "pointer";
        searchBtn.style.background = "#fff3e0";
        searchBtn.style.border = "1px solid #ffcc80";
        searchBtn.style.borderRadius = "4px";
        searchBtn.onclick = (e) => {
            if (e) e.stopPropagation();
            // Call the map function
            triggerRadiusSearch(spot.lat, spot.lon);
        };
        favDiv.appendChild(searchBtn);

        container.appendChild(favDiv);
    }

    // 4. Wikivoyage Loader
    // Logic: Always try to load if there's a name or wiki tag.
    if (name || tags.wikipedia) {
        const voyageDiv = document.createElement('div');
        voyageDiv.style.marginTop = "10px";
        voyageDiv.style.padding = "10px";
        voyageDiv.style.background = "#e0f7fa";
        voyageDiv.style.borderRadius = "5px";
        voyageDiv.style.fontSize = "0.9em";
        voyageDiv.style.color = "#006064";
        voyageDiv.innerHTML = `<strong>🧳 旅行ガイド</strong><br>読み込み中...`;
        container.appendChild(voyageDiv);

        let searchKey = name;
        if (tags.wikipedia && tags.wikipedia.includes(':')) {
            searchKey = tags.wikipedia.split(':')[1];
        } else if (tags.wikipedia) {
            searchKey = tags.wikipedia;
        }

        getWikivoyageSummary(searchKey).then(summary => {
            if (summary) {
                let h = `<strong>🧳 旅行ガイド (${summary.title})</strong><br>`;
                if (summary.thumbnail) h += `<img src="${summary.thumbnail}" style="width:100%; height:auto; margin:5px 0;">`;
                h += `<div>${summary.extract}</div>`;
                h += `<div style="text-align:right;"><a href="${summary.url}" target="_blank">...Wikivoyage</a></div>`;
                voyageDiv.innerHTML = h;
            } else {
                voyageDiv.style.display = 'none';
            }
        }).catch(() => { voyageDiv.style.display = 'none'; });
    }

    // 5. Wikipedia Loader
    if (tags.wikipedia) {
        const wikiDiv = document.createElement('div');
        wikiDiv.style.marginTop = "10px";
        wikiDiv.style.padding = "10px";
        wikiDiv.style.background = "#f9f9f9";
        wikiDiv.style.borderRadius = "5px";
        wikiDiv.style.fontSize = "0.9em";
        wikiDiv.style.color = "#666";
        wikiDiv.innerHTML = `Wiki情報読み込み中...`;
        container.appendChild(wikiDiv);

        getWikipediaSummary(tags.wikipedia).then(summary => {
            if (summary) {
                let h = "";
                if (summary.thumbnail) h += `<img src="${summary.thumbnail}" style="width:100%; height:auto; margin-bottom:5px;">`;
                h += `<div>${summary.extract}</div>`;
                h += `<div style="text-align:right;"><a href="${summary.url}" target="_blank">...Wikipedia</a></div>`;
                wikiDiv.innerHTML = h;
            } else {
                wikiDiv.style.display = 'none';
            }
        }).catch(() => { wikiDiv.style.display = 'none'; });
    }

    return container;
}
