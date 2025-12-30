import { isDrawingMode, getCurrentMode } from './ui.js';
import { searchSpots } from './api.js';

let map;
let currentPolyline = null;
let currentRect = null;
let currentPolygon = null;
let isDrawing = false;
let drawnCoordinates = [];

export function initMap(mapElement) {
    if (!mapElement) {
        console.error('Map container not found');
        return null;
    }

    // 1. Initialize Map
    map = L.map(mapElement, {
        dragging: true,
        tap: true
    }).setView([35.6895, 139.6917], 10);

    // 2. Tile Layer
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Add Scale Control (Metric only)
    L.control.scale({ imperial: false }).addTo(map);

    // 3. Custom Events
    map.on('mousedown', (e) => startDraw(e, map));
    map.on('mousemove', (e) => moveDraw(e, map));
    map.on('mouseup', () => endDraw(map));
    map.on('click', (e) => onPointSearch(e, map));

    // Touch Events
    const mapContainer = map.getContainer();
    mapContainer.addEventListener('touchstart', (e) => {
        if (!isDrawingMode()) return;
        e.preventDefault();
        startDraw(e, map);
    }, { passive: false });

    mapContainer.addEventListener('touchmove', (e) => {
        if (!isDrawingMode()) return;
        if (isDrawing) e.preventDefault();
        moveDraw(e, map);
    }, { passive: false });

    mapContainer.addEventListener('touchend', (e) => {
        if (!isDrawingMode()) return;
        endDraw(map);
    });

    return map;
}

function getTouchLatLng(e, mapInstance) {
    if (e.latlng) return e.latlng;
    if (e.touches && e.touches.length > 0) {
        const touch = e.touches[0];
        return mapInstance.containerPointToLatLng([touch.clientX, touch.clientY]);
    }
    if (e.originalEvent && e.originalEvent.touches && e.originalEvent.touches.length > 0) {
        const touch = e.originalEvent.touches[0];
        return mapInstance.containerPointToLatLng([touch.clientX, touch.clientY]);
    }
    return null;
}

function startDraw(e, mapInstance) {
    if (!isDrawingMode()) return;
    isDrawing = true;

    const latlng = getTouchLatLng(e, mapInstance);
    if (!latlng) return;

    drawnCoordinates = [latlng];

    if (currentPolyline) mapInstance.removeLayer(currentPolyline);
    if (currentPolygon) mapInstance.removeLayer(currentPolygon);
    if (currentRect) mapInstance.removeLayer(currentRect);

    const mode = getCurrentMode();
    if (mode === 'draw') {
        currentPolyline = L.polyline(drawnCoordinates, { color: 'red' }).addTo(mapInstance);
    } else if (mode === 'box') {
        currentRect = L.rectangle([latlng, latlng], { color: 'red' }).addTo(mapInstance);
    }
}

function moveDraw(e, mapInstance) {
    if (!isDrawing || !isDrawingMode()) return;

    const latlng = getTouchLatLng(e, mapInstance);
    if (!latlng) return;

    const mode = getCurrentMode();
    if (mode === 'draw') {
        drawnCoordinates.push(latlng);
        currentPolyline.setLatLngs(drawnCoordinates);
    } else if (mode === 'box') {
        currentRect.setBounds([drawnCoordinates[0], latlng]);
    }
}

function endDraw(mapInstance) {
    if (!isDrawing) return;
    isDrawing = false;

    const mode = getCurrentMode();
    if (mode === 'draw') {
        if (currentPolyline) mapInstance.removeLayer(currentPolyline);
        currentPolygon = L.polygon(drawnCoordinates, {
            color: '#ff4b4b',
            fillColor: '#ff4b4b',
            fillOpacity: 0.2
        }).addTo(mapInstance);
        searchSpots(currentPolygon);
    } else if (mode === 'box') {
        const bounds = currentRect.getBounds();
        if (currentRect) mapInstance.removeLayer(currentRect);
        currentPolygon = L.rectangle(bounds, {
            color: '#ff4b4b',
            fillColor: '#ff4b4b',
            fillOpacity: 0.2
        }).addTo(mapInstance);
        searchSpots(currentPolygon);
    }
}

export function triggerRadiusSearch(lat, lon) {
    const mode = getCurrentMode();
    // Force radius mode if not already (Optional, but user intent is clear)
    // For now, let's respect the mode check or force it?
    // User requested "Search around this pin", implies an explicit action.
    // So we should probably allow it even if mode is not 'radius', OR switch mode found in UI.
    // Let's force it for this specific action:

    // Remove existing polygon
    if (currentPolygon) map.removeLayer(currentPolygon);

    // Get radius from UI (or default)
    const radiusSelect = document.getElementById('radius-select');
    const radiusMeters = radiusSelect ? parseInt(radiusSelect.value, 10) : 3000;

    const center = [lat, lon];
    const circle = L.circle(center, {
        radius: radiusMeters,
        color: '#ff4b4b',
        fillColor: '#ff4b4b',
        fillOpacity: 0.2
    }).addTo(map);

    currentPolygon = circle;
    searchSpots(circle);
}

function onPointSearch(e, mapInstance) {
    const mode = getCurrentMode();
    if (mode !== 'radius') return;
    triggerRadiusSearch(e.latlng.lat, e.latlng.lng);
}
