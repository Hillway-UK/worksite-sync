import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in Leaflet with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface LeafletMapProps {
  center: [number, number];
  zoom: number;
  selectedLocation: [number, number] | null;
  radius: number;
  onLocationSelect: (lat: number, lng: number) => void;
  className?: string;
}

export function LeafletMap({ 
  center, 
  zoom, 
  selectedLocation, 
  radius, 
  onLocationSelect,
  className = "h-64 w-full rounded-lg"
}: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current).setView(center, zoom);
    mapInstanceRef.current = map;

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Handle map click to set location
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      onLocationSelect(lat, lng);
    });

    // Map is ready
    map.whenReady(() => {
      setIsLoading(false);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update map view when center or zoom changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(center, zoom);
    }
  }, [center, zoom]);

  // Update marker and circle when location or radius changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Remove existing marker and circle
    if (markerRef.current) {
      map.removeLayer(markerRef.current);
    }
    if (circleRef.current) {
      map.removeLayer(circleRef.current);
    }

    if (selectedLocation) {
      // Add marker
      const marker = L.marker(selectedLocation, {
        draggable: true,
      }).addTo(map);
      
      markerRef.current = marker;

      // Handle marker drag
      marker.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        onLocationSelect(lat, lng);
      });

      // Add geofence circle
      const circle = L.circle(selectedLocation, {
        radius: radius,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.1,
        weight: 2,
      }).addTo(map);
      
      circleRef.current = circle;

      // Center map on marker if it's far from current view
      const mapBounds = map.getBounds();
      if (!mapBounds.contains(selectedLocation)) {
        map.setView(selectedLocation, Math.max(map.getZoom(), 15));
      }
    }
  }, [selectedLocation, radius, onLocationSelect]);

  return (
    <div className={`relative ${className}`}>
      <div ref={mapRef} className="h-full w-full rounded-lg" />
      {isLoading && (
        <div className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 bg-white/90 rounded px-2 py-1 text-xs text-muted-foreground">
        Click to set location • Drag marker to adjust
      </div>
    </div>
  );
}