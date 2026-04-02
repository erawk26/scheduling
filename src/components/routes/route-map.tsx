import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function createNumberedIcon(number: number): L.DivIcon {
  return L.divIcon({
    className: 'route-marker',
    html: `<div style="background:#2d5c3c;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)">${number}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (positions.length === 0) return;
    const bounds = L.latLngBounds(positions.map(([lat, lon]) => [lat, lon]));
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [map, positions]);

  return null;
}

function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

export interface RouteMapStop {
  id: string;
  lat: number;
  lon: number;
  label: string;
  sublabel?: string;
}

interface RouteMapProps {
  stops: RouteMapStop[];
  polyline?: string;
  className?: string;
}

export function RouteMap({ stops, polyline, className }: RouteMapProps) {
  if (stops.length === 0) return null;

  const positions: [number, number][] = stops.map((s) => [s.lat, s.lon]);

  const routeLine: [number, number][] = polyline ? decodePolyline(polyline) : positions;

  const center: [number, number] =
    positions.length === 1
      ? positions[0]!
      : [
          positions.reduce((sum, p) => sum + p[0], 0) / positions.length,
          positions.reduce((sum, p) => sum + p[1], 0) / positions.length,
        ];

  return (
    <div className={className}>
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: '100%', width: '100%', borderRadius: '0.5rem' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds positions={positions} />

        <Polyline positions={routeLine} color="#2d5c3c" weight={4} opacity={0.7} />

        {stops.map((stop, i) => (
          <Marker
            key={stop.id}
            position={[stop.lat, stop.lon]}
            icon={createNumberedIcon(i + 1)}
          >
            <Popup>
              <div>
                <strong>{stop.label}</strong>
                {stop.sublabel && (
                  <div style={{ fontSize: '0.85em', color: '#5a7862' }}>{stop.sublabel}</div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
