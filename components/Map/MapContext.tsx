'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import maplibreGl from 'maplibre-gl';

export interface MapFilters {
  propertyType?: string[];
  direction?: string[];
  minPrice?: number | null;
  maxPrice?: number | null;
  minArea?: number | null;
  maxArea?: number | null;
  minPricePerM2?: number | null;
  maxPricePerM2?: number | null;
  dateRange?: number | null; // days
}

interface MapContextType {
  map: maplibreGl.Map | null;
  setMap: (map: maplibreGl.Map | null) => void;
  listings: any[];
  setListings: (listings: any[]) => void;
  filters: MapFilters;
  setFilters: (filters: MapFilters) => void;
  selectedListingId: string | null;
  setSelectedListingId: (id: string | null) => void;
  selectedUserId: string | null;
  setSelectedUserId: (id: string | null) => void;
  selectedListing: any | null;
  setSelectedListing: (listing: any | null) => void;
  selectedParcel: any | null;
  setSelectedParcel: (parcel: any | null) => void;
  highlightedListingId: string | null;
  setHighlightedListingId: (id: string | null) => void;
  highlightedListingCoords: [number, number] | null;
  setHighlightedListingCoords: (coords: [number, number] | null) => void;
  isMapFullscreen: boolean;
  setIsMapFullscreen: React.Dispatch<React.SetStateAction<boolean>>;
  showHeatmap: boolean;
  setShowHeatmap: (show: boolean) => void;
  page: number;
  setPage: (page: number) => void;
  province: string;
  ward: string;
  locationName: string;
  breadcrumbs: any[];
  initialCenter?: [number, number];
  initialZoom?: number;
  initialPolygon?: any;
  initialParcelId?: string | null;
}

const MapContext = createContext<MapContextType | undefined>(undefined);

interface MapProviderProps {
  children: ReactNode;
  initialListingId?: string | null;
  initialUserId?: string | null;
  initialParcelId?: string | null;
  initialListings?: any[];
  initialListing?: any | null;
  initialProvince?: string;
  initialWard?: string;
  initialLocationName?: string;
  initialBreadcrumbs?: any[];
  initialCenter?: [number, number];
  initialZoom?: number;
  initialPolygon?: any;
}

export function MapProvider({ 
  children, 
  initialListingId,
  initialUserId,
  initialParcelId,
  initialListings = [],
  initialListing = null,
  initialProvince = '',
  initialWard = '',
  initialLocationName = '',
  initialBreadcrumbs = [],
  initialCenter,
  initialZoom,
  initialPolygon
}: MapProviderProps) {
  const [map, setMap] = useState<maplibreGl.Map | null>(null);
  const [listings, setListings] = useState<any[]>(initialListings);
  const [filters, setFilters] = useState<MapFilters>({ dateRange: 60 });
  const [selectedListingId, setSelectedListingId] = useState<string | null>(initialListingId || null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(initialUserId || null);
  const [selectedListing, setSelectedListing] = useState<any | null>(initialListing);
  const [selectedParcel, setSelectedParcel] = useState<any | null>(null);
  const [highlightedListingId, setHighlightedListingId] = useState<string | null>(null);
  const [highlightedListingCoords, setHighlightedListingCoords] = useState<[number, number] | null>(null);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [page, setPage] = useState(1);

  return (
    <MapContext.Provider value={{ 
      map, setMap, 
      listings, setListings, 
      filters, setFilters,
      selectedListingId, setSelectedListingId,
      selectedUserId, setSelectedUserId,
      selectedListing, setSelectedListing,
      selectedParcel, setSelectedParcel,
      highlightedListingId, setHighlightedListingId,
      highlightedListingCoords, setHighlightedListingCoords,
      isMapFullscreen, setIsMapFullscreen,
      showHeatmap, setShowHeatmap,
      page, setPage,
      province: initialProvince,
      ward: initialWard,
      locationName: initialLocationName,
      breadcrumbs: initialBreadcrumbs,
      initialCenter,
      initialZoom,
      initialPolygon,
      initialParcelId
    }}>
      {children}
    </MapContext.Provider>
  );
}

export function useMapContext() {
  const context = useContext(MapContext);
  if (context === undefined) {
    throw new Error('useMapContext must be used within a MapProvider');
  }
  return context;
}
