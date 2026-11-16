'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Map as LMap, Marker } from 'leaflet';

// Drop a pin for where the idea will happen. Click or tap the map, drag the pin, or use your location.
// Only the innovator, reviewers and CEDA staff ever see the exact pin.
const IN_BW = (lat: number, lng: number) => lat >= -27 && lat <= -17.6 && lng >= 19.8 && lng <= 29.5;

export default function PinPicker({ lat, lng, onChange }: { lat: number | null; lng: number | null; onChange: (lat: number, lng: number) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const pin = useRef<Marker | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let off = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (off || !el.current || map.current) return;
      const m = L.map(el.current, { maxBounds: [[-27.5, 19], [-17, 30]], minZoom: 5 }).setView(lat != null && lng != null ? [lat, lng] : [-22.3, 24.7], lat != null ? 12 : 5);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap contributors' }).addTo(m);
      const icon = L.divIcon({ className: 'pin-icon', iconSize: [26, 34], iconAnchor: [13, 29] });
      const place = (la: number, lo: number) => {
        if (!IN_BW(la, lo)) { setMsg('Place the pin inside Botswana.'); return; }
        setMsg(null);
        if (!pin.current) {
          pin.current = L.marker([la, lo], { icon, draggable: true, keyboard: true, title: 'Idea location' }).addTo(m);
          pin.current.on('dragend', () => { const p = pin.current!.getLatLng(); place(p.lat, p.lng); });
        } else pin.current.setLatLng([la, lo]);
        cb.current(la, lo);
      };
      if (lat != null && lng != null) {
        pin.current = L.marker([lat, lng], { icon, draggable: true, keyboard: true, title: 'Idea location' }).addTo(m);
        pin.current.on('dragend', () => { const p = pin.current!.getLatLng(); place(p.lat, p.lng); });
      }
      m.on('click', (e) => place(e.latlng.lat, e.latlng.lng));
      map.current = m;
      (el.current as HTMLDivElement & { place?: typeof place }).place = place;
    })();
    return () => { off = true; map.current?.remove(); map.current = null; pin.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function locate() {
    if (!navigator.geolocation) return setMsg('Your browser cannot share its location. Tap the map instead.');
    setMsg('Finding you...');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const place = (el.current as (HTMLDivElement & { place?: (a: number, b: number) => void }) | null)?.place;
        place?.(p.coords.latitude, p.coords.longitude);
        map.current?.setView([p.coords.latitude, p.coords.longitude], 13);
      },
      () => setMsg('Location was not shared. Tap the map instead.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="pin-picker">
      <div ref={el} className="pin-map" role="application" aria-label="Map of Botswana. Click or tap to place the pin for your idea." />
      <div className="row between">
        <span className="muted" role="status">{msg ?? (lat != null ? `Pinned at ${lat.toFixed(4)}, ${lng!.toFixed(4)}. Drag the pin to adjust.` : 'Tap the map where the idea will happen.')}</span>
        <button type="button" className="btn ghost small" onClick={locate}>Use my location</button>
      </div>
    </div>
  );
}
