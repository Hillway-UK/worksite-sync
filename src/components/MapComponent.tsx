import React from 'react';

interface MapComponentProps {
  center: [number, number];
  zoom: number;
  selectedLocation: [number, number] | null;
  radius: number;
  onLocationSelect: (lat: number, lng: number) => void;
}

export function MapComponent({ center, zoom, selectedLocation, radius, onLocationSelect }: MapComponentProps) {
  return (
    <div className="h-full w-full bg-gray-100 rounded-lg flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600">Map Component</p>
        <p className="text-sm text-gray-500">Lat: {selectedLocation?.[0] || center[0]}</p>
        <p className="text-sm text-gray-500">Lng: {selectedLocation?.[1] || center[1]}</p>
        <p className="text-sm text-gray-500">Radius: {radius}m</p>
        <button
          onClick={() => onLocationSelect(center[0], center[1])}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
        >
          Set Location
        </button>
      </div>
    </div>
  );
}