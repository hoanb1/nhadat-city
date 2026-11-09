// lib/config/server.ts
/**
 * Centralized server-side configuration — Single Source of Truth.
 * All values are read from environment variables with safe fallback defaults.
 * No other file may re-declare or re-read these variables directly.
 */

// ── AI / ML Microservice ──────────────────────────────────────────────────────
export const ML_API_URL = process.env.ML_API_URL || 'http://localhost:8001';

// ── GeoServer (WMS / WFS parcel layers) ──────────────────────────────────────
export const GEOSERVER_URL      = process.env.GEOSERVER_URL      || 'http://internal.example:8080/geoserver';
export const GEOSERVER_WORKSPACE = process.env.GEOSERVER_WORKSPACE || 'usermap';
export const GEOSERVER_PARCEL_LAYER = process.env.NEXT_PUBLIC_GEOSERVER_PARCEL_LAYER || 'current:ranhthua';

// ── Protected Map Layers Policies ───────────────────────────────────────────
export const TOKEN_REQUIRED_LAYERS = (process.env.TOKEN_REQUIRED_LAYERS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

export const RASTER_ONLY_LAYERS = (process.env.RASTER_ONLY_LAYERS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// ── Geocoding (Nominatim) ─────────────────────────────────────────────────────
export const NOMINATIM_URL = process.env.NOMINATIM_URL || 'http://internal.example/nominatim';

export const DB_CONFIG = {
  MAX_POOL_SIZE:      Number(process.env.DB_MAX_POOL_SIZE)      || 50,
  MIN_POOL_SIZE:      Number(process.env.DB_MIN_POOL_SIZE)      || 5,
  SOCKET_TIMEOUT_MS:  Number(process.env.DB_SOCKET_TIMEOUT_MS)  || 15_000,
  CONNECT_TIMEOUT_MS: Number(process.env.DB_CONNECT_TIMEOUT_MS) || 5_000,
};

// ── Public CDN / Base URL (also usable server-side) ──────────────────────────
export const CDN_URL  = process.env.NEXT_PUBLIC_CDN_URL  || 'https://cdn.nhadat.city';
export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://nhadat.city';

// ── Map API ───────────────────────────────────────────────────────────────────
export const MAP_API_URL         = process.env.NEXT_PUBLIC_MAP_API_URL         || 'https://map-api.nhadat.city/map-api/v1';
export const MAP_API_COMMUNE_URL = process.env.NEXT_PUBLIC_MAP_API_COMMUNE_URL || 'https://map-api.nhadat.city/map-api/commune';
