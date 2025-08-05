import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import { LatLng } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default markers in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapComponentProps {
  center: [number, number];
  zoom?: number;
  onLocationSelect?: (lat: number, lng: number) => void;
  selectedLocation?: [number, number];
  radius?: number;
  onRadiusChange?: (radius: number) => void;
  interactive?: boolean;
}

function LocationMarker({ onLocationSelect, selectedLocation }: {
  onLocationSelect?: (lat: number, lng: number) => void;
  selectedLocation?: [number, number];
}) {
  const [position, setPosition] = useState<LatLng | null>(
    selectedLocation ? new LatLng(selectedLocation[0], selectedLocation[1]) : null
  );

  const map = useMapEvents({
    click(e) {
      if (onLocationSelect) {
        setPosition(e.latlng);
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      }
    },
  });

  useEffect(() => {
    if (selectedLocation) {
      const newPosition = new LatLng(selectedLocation[0], selectedLocation[1]);
      setPosition(newPosition);
      map.setView(newPosition, map.getZoom());
    }
  }, [selectedLocation, map]);

  return position === null ? null : (
    <Marker position={position} />
  );
}

export function MapComponent({
  center,
  zoom = 13,
  onLocationSelect,
  selectedLocation,
  radius = 100,
  onRadiusChange,
  interactive = true,
}: MapComponentProps) {
  const mapRef = useRef<L.Map>(null);

  return (
    <div className="h-[400px] w-full rounded-lg overflow-hidden border">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {interactive && (
          <LocationMarker 
            onLocationSelect={onLocationSelect} 
            selectedLocation={selectedLocation}
          />
        )}
        
        {!interactive && selectedLocation && (
          <Marker position={selectedLocation} />
        )}
        
        {selectedLocation && radius && (
          <Circle
            center={selectedLocation}
            radius={radius}
          />
        )}
      </MapContainer>
    </div>
  );
}