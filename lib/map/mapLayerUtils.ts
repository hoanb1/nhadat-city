import maplibreGl from 'maplibre-gl';
import { LOAI_DAT, LOAI_DAT_COLOR, getMaplibreLabelExpression, CUSTOM_LAND_TYPE_MAPPING, getMaplibreCoalesceExpression, removeAccents } from '@/lib/geo/landTypeLabels';

export const MAP_API_URL = process.env.NEXT_PUBLIC_MAP_API_URL || 'https://map-api.nhadat.city/map-api/v1';
export const DEFAULT_PARCEL_LAYER_ID = process.env.NEXT_PUBLIC_PARCEL_LAYER_ID || 'xai8TeB4v9xHqC3Jw';


/**
 * Returns the paint configuration for a given layer type.
 */
function getLayerPaintConfig(type: string, layer: any) {
    const opacityValue = layer.opacity ? layer.opacity / 100 : 1;
    switch (type) {
        case 'fill':
            return {
                'fill-color': layer.color || '#000000', 
                'fill-opacity': opacityValue
            };
        case 'line':
            return {
                'line-color': layer.color || '#000000', 
                'line-width': layer.lineWidth || 2
            };
        case 'circle':
            return {
                'circle-radius': layer.radius || 5, 
                'circle-color': layer.color || '#000000'
            };
        case 'symbol':
            return {
                'text-field': layer.text || 'Label',
                'text-size': layer.textSize || 12,
                'text-color': layer.color || '#000000'
            };
        case 'heatmap':
            return {
                'heatmap-intensity': layer.intensity || 1, 
                'heatmap-color': layer.color || '#000000'
            };
        case 'background':
            return {
                'background-color': layer.color || '#000000'
            };
        case 'fill-extrusion':
            return {
                'fill-extrusion-height': layer.height || 10, 
                'fill-extrusion-color': layer.color || '#000000'
            };
        default:
            return {};
    }
}

const layerOrderRegistry: Record<string, number> = {};

/**
 * Calculates a rendering order score (0 - 100) for a given layer ID and type.
 * Lower scores render at the bottom (drawn first), higher scores render on top (drawn last).
 */
function getLayerScore(id: string, type: string): number {
    // 1. Solid background (always lowest)
    if (id === 'background') return 0;

    // 2. Real estate overlay and markers (topmost)
    if (id === 'unclustered-count') return 79;
    if (id === 'unclustered-point') return 78;
    if (id === 'cluster-count') return 77;
    if (id === 'clusters') return 76;
    if (id === 'spider-price-label') return 75;
    if (id === 'spider-point') return 74;
    if (id === 'spider-center-label') return 73;
    if (id === 'spider-center') return 72;
    if (id === 'listings-lines') return 71;
    if (id === 'real-estate-heatmap') return 70;

    // 3. Parcel boundaries and highlights (just below real estate)
    if (id === 'parcel-edge-labels') return 66;
    if (id === 'parcel-edges') return 65;
    if (id === 'parcel-highlight-line') return 64;
    if (id === 'parcel-highlight-fill') return 63;
    if (id === 'parcel-layer-label' || id === `${DEFAULT_PARCEL_LAYER_ID}-label`) return 62;
    if (id === 'parcel-layer' || id === DEFAULT_PARCEL_LAYER_ID) return 61;
    if (id === 'parcel-layer-fill' || id === `${DEFAULT_PARCEL_LAYER_ID}-fill`) return 60;

    // 4. Vietnam islands labels
    if (id.startsWith('vietnam-islands-labels')) return 50;

    // Retrieve order if registered (strip suffixes to get the base database layer ID)
    const baseId = id.replace(/-fill$/, '').replace(/-label$/, '');
    const layerOrder = layerOrderRegistry[baseId] || 0;

    // Basemaps (Raster) - 10.xxxx
    if (type === 'raster') {
        return 10 + (layerOrder * 0.0001);
    }
    // Vector fill/planning layers - 20.xxxx
    if (id.endsWith('-fill') || type === 'fill') {
        return 20 + (layerOrder * 0.0001);
    }
    // Vector lines (boundaries, streets, borders) - 30.xxxx
    if (type === 'line') {
        return 30 + (layerOrder * 0.0001);
    }
    // Symbol layers (labels) - 40.xxxx
    if (id.endsWith('-label') || type === 'symbol') {
        return 40 + (layerOrder * 0.0001);
    }

    // Default fallback
    return 35 + (layerOrder * 0.0001);
}

/**
 * Finds the correct layer ID in the map style stack to insert the new layer before.
 * This guarantees proper layering of basemaps, fills, lines, symbols, and markers.
 */
export function getBeforeIdForLayer(map: maplibreGl.Map, newLayerId: string, newLayerType: string, newLayerOrder: number): string | undefined {
    const baseId = newLayerId.replace(/-fill$/, '').replace(/-label$/, '');
    layerOrderRegistry[baseId] = newLayerOrder;

    const newScore = getLayerScore(newLayerId, newLayerType);

    const layers = map.getStyle().layers;
    if (!layers) return undefined;

    // Find the first layer in the current style stack that has a higher score
    for (const layer of layers) {
        if (layer.id !== newLayerId) {
            const score = getLayerScore(layer.id, layer.type);
            if (score > newScore) {
                return layer.id;
            }
        }
    }

    return undefined;
}

function shouldLoadAsVectorTile(layer: any): boolean {
    return !!layer.geoServerLayer;
}

/**
 * Adds or restores a layer to the map.
 */
export function addLayerToMap(map: maplibreGl.Map, layer: any) {
    if (!map) return;

    const opacityValue = layer.opacity ? layer.opacity / 100 : 1;
    const saturationValue = layer.saturation ? layer.saturation / 100 : 0;
    const zoomMin = layer.zoomMin !== undefined ? Number(layer.zoomMin) : 0;
    const zoomMax = layer.zoomMax !== undefined ? Number(layer.zoomMax) : 22;

    const bounds = layer.boundingBox ? [
        Number(layer.boundingBox.minX),
        Number(layer.boundingBox.minY),
        Number(layer.boundingBox.maxX),
        Number(layer.boundingBox.maxY)
    ] as [number, number, number, number] : undefined;

    let url = layer.url;
    if (!url || url === 'undefined') {
        console.error(`Cannot add layer ${layer.name} (${layer._id}) because url is missing.`);
        return;
    }

    let isVector = layer.format === 'vector' || (shouldLoadAsVectorTile(layer) && layer.format !== 'raster');

    // Force client to request raster WebP for known raster-only/protected layers
    const CLIENT_RASTER_ONLY_LAYERS = ['xai8TeB4v9xHqC3Jw', 'vM6kHqC3JwXyZaBcd', 'tY939dPWjrap3f9zm', 'tY939dPWjrap3f9zk'];
    if (CLIENT_RASTER_ONLY_LAYERS.includes(layer._id)) {
        isVector = false;
    }

    if (!url.includes('http')) {
        const ext = isVector ? 'pbf' : 'webp';
        const baseUrl = MAP_API_URL;
        url = `${baseUrl}/${layer._id}/{z}/{x}/{y}.${ext}`;
    } else if (isVector) {
        url = url.replace(/\.(png|webp)$/, '.pbf');
    }

    const layerType = isVector ? 'vector' : (layer.format || 'raster');

    // Check if layer already exists on map
    if (map.getLayer(layer._id)) {
        const visibility = map.getLayoutProperty(layer._id, 'visibility');
        if (visibility !== 'visible') {
            map.setLayoutProperty(layer._id, 'visibility', 'visible');
        }
        if (map.getLayer(`${layer._id}-fill`)) {
            map.setLayoutProperty(`${layer._id}-fill`, 'visibility', 'visible');
        }
        if (map.getLayer(`${layer._id}-label`)) {
            map.setLayoutProperty(`${layer._id}-label`, 'visibility', 'visible');
        }
        if (map.getLayer(`${layer._id}-center`)) {
            map.setLayoutProperty(`${layer._id}-center`, 'visibility', 'visible');
        }
        return;
    }

    const commonLayerConfig: any = {
        id: layer._id,
        minzoom: zoomMin,
        maxzoom: zoomMax,
        layout: {
            visibility: 'visible'
        }
    };

    try {
        switch (layerType) {
            case 'raster': {
                const beforeId = getBeforeIdForLayer(map, layer._id, 'raster', layer.order);
                map.addLayer({
                    ...commonLayerConfig,
                    type: 'raster',
                    source: {
                        type: 'raster',
                        tiles: [url],
                        tileSize: 256,
                        ...(bounds ? { bounds } : {})
                    },
                    paint: {
                        'raster-saturation': saturationValue,
                        'raster-opacity': opacityValue
                    }
                }, beforeId);
                break;
            }
            case 'vector': {
                const sourceId = layer._id;

                const isPlanning = layer.geoServerLayer && (
                    layer.geoServerLayer.toLowerCase().includes('planning:') ||
                    layer.geoServerLayer.toLowerCase().includes('hientrang') ||
                    layer.geoServerLayer.toLowerCase().includes('hien-trang') ||
                    layer.geoServerLayer.toLowerCase().includes('goon') ||
                    layer.geoServerLayer.toLowerCase().includes('quyhoach') ||
                    layer.geoServerLayer.toLowerCase().includes('quy-hoach') ||
                    layer.geoServerLayer.toLowerCase().includes('qh')
                );
                
                const isBasemap = !!(layer.geoServerLayer && layer.geoServerLayer.toLowerCase().includes('basemap'));

                const isAdministrative = (layer.geoServerLayer && layer.geoServerLayer.toLowerCase().startsWith('adminunit:')) ||
                    ((layer.name?.toLowerCase().includes('địa giới') || layer.name?.toLowerCase().includes('hành chính') || layer.name?.toLowerCase().includes('ranh giới')) && !isPlanning && !isBasemap);

                const isProvince = layer.name?.toLowerCase().includes('tỉnh') || 
                                   layer.geoServerLayer?.toLowerCase().includes('tinh');
                const isDistrict = layer.name?.toLowerCase().includes('huyện') || 
                                   layer.name?.toLowerCase().includes('quận') || 
                                   layer.geoServerLayer?.toLowerCase().includes('huyen');
                const isCommune = layer.name?.toLowerCase().includes('xã') || 
                                  layer.name?.toLowerCase().includes('phường') || 
                                  layer.name?.toLowerCase().includes('thị trấn') || 
                                  layer.geoServerLayer?.toLowerCase().includes('xa');

                if (!map.getSource(sourceId)) {
                    map.addSource(sourceId, {
                        type: 'vector',
                        tiles: [url],
                        minzoom: zoomMin,
                        maxzoom: 24,
                        ...(bounds ? { bounds } : {})
                    });
                }
                
                const sourceLayerName = layer.geoServerLayer ? (layer.geoServerLayer.split(':')[1] || layer.geoServerLayer) : layer._id;



                let fillColor: any = layer.color || '#ef4444';
                let fillOpacity: any = 0.0;
                let lineColor = layer.color || '#ef4444';
                let lineWidth: any = layer.lineWidth || 1.5;
                let lineOpacity: any = opacityValue;
                let lineDasharray: any = undefined;

                if (isPlanning) {
                    // Build a dynamic Match Expression for land-use colors using the shared SSOT coalesce expression
                    const matchExpression: any[] = [
                        'match',
                        ['upcase', ['string', getMaplibreCoalesceExpression()]]
                    ];

                    const addedColorKeys = new Set<string>();
                    const addColorBranch = (key: string, color: string) => {
                        const upperKey = key.toUpperCase();
                        if (!addedColorKeys.has(upperKey)) {
                            addedColorKeys.add(upperKey);
                            matchExpression.push(upperKey);
                            matchExpression.push(color);
                        }
                    };

                    // 1. Add standard codes (e.g. ODT -> color)
                    for (const [code, color] of Object.entries(LOAI_DAT_COLOR)) {
                        addColorBranch(code, color);
                    }

                    // 1b. Add standard descriptions (accented & accentless) -> color
                    for (const [code, color] of Object.entries(LOAI_DAT_COLOR)) {
                        const fullName = LOAI_DAT[code];
                        if (fullName) {
                            addColorBranch(fullName, color);
                            
                            const noAccent = removeAccents(fullName);
                            addColorBranch(noAccent, color);
                        }
                    }

                    // 2. Add custom mapped strings and numeric keys from SSOT
                    for (const [key, code] of Object.entries(CUSTOM_LAND_TYPE_MAPPING)) {
                        const color = LOAI_DAT_COLOR[code];
                        if (color) {
                            addColorBranch(key, color);
                            
                            const noAccent = removeAccents(key);
                            addColorBranch(noAccent, color);
                        }
                    }

                    // Fallback to the layer's primary color or neutral gray
                    matchExpression.push(layer.color || '#cbd5e1');

                    fillColor = matchExpression;
                    fillOpacity = layer.fillOpacity !== undefined ? Number(layer.fillOpacity) / 100 : (opacityValue * 0.6);
                    lineColor = layer.color || '#475569';
                    
                    const baseLineWidth = layer.lineWidth || 1.0;
                    lineWidth = [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        10, 0.15,
                        13, 0.4,
                        15, baseLineWidth
                    ];

                    lineOpacity = [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        10, 0.01 * opacityValue,
                        13, 0.05 * opacityValue,
                        15, 0.12 * opacityValue
                    ];
                } else if (isAdministrative) {
                    fillOpacity = 0.0;

                    
                    if (isProvince) {
                        lineColor = (layer.color && layer.color !== '#000000') ? layer.color : '#7c3aed'; // Deep violet-purple for provinces (stands out clearly)
                        lineWidth = layer.lineWidth || [
                            'interpolate',
                            ['linear'],
                            ['zoom'],
                            2, 0.4,
                            6, 0.8,
                            10, 1.2
                        ];
                        lineDasharray = undefined; // Solid line for maximum clarity without increasing thickness
                        lineOpacity = Math.min(1.0, opacityValue * 2.5); // Boosted opacity for clearer province border
                    } else if (isDistrict) {
                        lineColor = (layer.color && layer.color !== '#000000') ? layer.color : '#4f46e5'; // Indigo for districts
                        lineWidth = layer.lineWidth || [
                            'interpolate',
                            ['linear'],
                            ['zoom'],
                            5, 0.5,
                            10, 1.2
                        ];
                        lineDasharray = [4, 2]; // dashed
                    } else {
                        // Commune/Ward
                        lineColor = (layer.color && layer.color !== '#000000') ? layer.color : '#475569'; // Darker slate gray for communes/wards
                        lineWidth = layer.lineWidth || [
                            'interpolate',
                            ['linear'],
                            ['zoom'],
                            9, 0.6,
                            14, 1.4
                        ];
                        lineDasharray = [4, 2]; // clearer dash pattern
                        lineOpacity = Math.min(1.0, opacityValue * 2.0); // Clearer commune border (0.6 opacity instead of 0.3)
                    }
                } else if (isBasemap) {
                    fillColor = [
                        'match',
                        ['get', '_layer'],
                        'water', '#c4e3ff',
                        'park', '#d1ebb8',
                        'landcover', '#d1ebb8',
                        'landuse', '#f0f0f0',
                        'building', '#e6e1dc',
                        '#e2e8f0'
                    ];
                    fillOpacity = [
                        'match',
                        ['get', '_layer'],
                        'water', 0.8 * opacityValue,
                        'park', 0.6 * opacityValue,
                        'landcover', 0.6 * opacityValue,
                        'landuse', 0.5 * opacityValue,
                        'building', 0.8 * opacityValue,
                        0.3 * opacityValue
                    ];
                    lineColor = [
                        'match',
                        ['get', '_layer'],
                        'water', '#a5d8ff',
                        'transportation', '#ccd4db',
                        '#94a3b8'
                    ];
                    lineWidth = [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        10, [
                            'match',
                            ['get', '_layer'],
                            'transportation', 0.4,
                            'water', 0.5,
                            0.2
                        ],
                        13, [
                            'match',
                            ['get', '_layer'],
                            'transportation', 0.8,
                            'water', 0.5,
                            0.2
                        ],
                        15, [
                            'match',
                            ['get', '_layer'],
                            'transportation', 1.8,
                            'water', 0.5,
                            0.2
                        ],
                        18, [
                            'match',
                            ['get', '_layer'],
                            'transportation', 3.5,
                            'water', 0.5,
                            0.2
                        ]
                    ];
                    lineOpacity = [
                        'match',
                        ['get', '_layer'],
                        'transportation', 0.9 * opacityValue,
                        'water', 0.6 * opacityValue,
                        0.3 * opacityValue
                    ];
                } else {
                    // Cadastral boundaries or other vector features
                    fillOpacity = layer.fillOpacity !== undefined ? Number(layer.fillOpacity) / 100 : 0.0;
                }

                // Add fill layer (for color fill on planning layers, or transparent hover areas on boundaries)
                const fillBeforeId = getBeforeIdForLayer(map, `${layer._id}-fill`, 'fill', layer.order);
                map.addLayer({
                    id: `${layer._id}-fill`,
                    type: 'fill',
                    source: sourceId,
                    'source-layer': sourceLayerName,
                    minzoom: zoomMin,
                    layout: {
                        visibility: 'visible'
                    },
                    paint: {
                        'fill-color': fillColor,
                        'fill-opacity': fillOpacity
                    }
                }, fillBeforeId);

                // Add line layer (borders)
                const lineBeforeId = getBeforeIdForLayer(map, layer._id, 'line', layer.order);
                const linePaintConfig: any = {
                    'line-color': lineColor,
                    'line-width': lineWidth,
                    'line-opacity': lineOpacity
                };
                if (lineDasharray) {
                    linePaintConfig['line-dasharray'] = lineDasharray;
                }
                map.addLayer({
                    id: layer._id,
                    type: 'line',
                    source: sourceId,
                    'source-layer': sourceLayerName,
                    minzoom: zoomMin,
                    layout: {
                        'visibility': 'visible'
                    },
                    paint: linePaintConfig
                }, lineBeforeId);

                // Add symbol layer (text labels) for land types or parcel numbers
                let labelExpression: any;
                let textSize: any = isPlanning ? 10 : 9;
                let textColor = isPlanning ? '#1e293b' : '#475569';
                let textPadding = isPlanning ? 35 : 15;

                if (isPlanning) {
                    labelExpression = getMaplibreLabelExpression();
                } else if (isAdministrative) {
                    labelExpression = [
                        'coalesce',
                        ['get', 'tenXa'], ['get', 'ten_xa'], ['get', 'TEN_XA'],
                        ['get', 'tenHuyen'], ['get', 'ten_huyen'], ['get', 'TEN_HUYEN'],
                        ['get', 'tenTinh'], ['get', 'ten_tinh'], ['get', 'TEN_TINH'],
                        ['get', 'name'], ['get', 'NAME'],
                        ['get', 'ten'], ['get', 'TEN'],
                        ''
                    ];
                    

                                       
                    textSize = isProvince ? 12 : (isDistrict ? 11 : 10);
                    textColor = isProvince ? '#5b21b6' : '#334155'; // Deep violet-purple or dark gray-slate
                    textPadding = isProvince ? 15 : (isDistrict ? 12 : 5);
                } else if (isBasemap) {
                    labelExpression = [
                        'coalesce',
                        ['get', 'name'], ['get', 'ten'], ['get', 'ten_tieng_viet'],
                        ''
                    ];
                    textSize = [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        10, 8,
                        14, 11,
                        17, 13
                    ];
                    textColor = '#334155';
                    textPadding = 10;
                } else {
                    labelExpression = [
                        'step',
                        ['zoom'],
                        '',
                        20,
                        [
                          'case',
                          ['!=', ['coalesce', ['get', 'dien_tich'], ['get', 'DIEN_TICH'], ''], ''],
                          ['concat', ['to-string', ['coalesce', ['get', 'dien_tich'], ['get', 'DIEN_TICH']]], ' m²'],
                          ''
                        ]
                      ];
                }
                if (isAdministrative) {
                    // Client-side GeoJSON source for administrative center points
                    const geojsonSourceId = `${layer._id}-centers-geojson`;
                    if (!map.getSource(geojsonSourceId)) {
                        map.addSource(geojsonSourceId, {
                            type: 'geojson',
                            data: { type: 'FeatureCollection', features: [] }
                        });
                    }

                    const updateCentroids = () => {
                        if (!map.getSource(geojsonSourceId)) return;
                        
                        const features = map.querySourceFeatures(sourceId, {
                            sourceLayer: sourceLayerName
                        });
                        
                        // Group features by region ID
                        const groups = new Map<string, any[]>();
                        
                        features.forEach((f: any) => {
                            const props = f.properties || {};
                            const rid = props.maXa || props.ma_xa || props.MA_XA || props.maxa ||
                                        props.maTinh || props.ma_tinh || props.MA_TINH || props.matinh ||
                                        props.maHuyen || props.ma_huyen || props.MA_HUYEN || props.mahuyen ||
                                        props.fid || props.FID || f.id;
                            if (!rid) return;
                            
                            const key = String(rid);
                            if (!groups.has(key)) {
                                groups.set(key, []);
                            }
                            groups.get(key)!.push(f);
                        });
                        
                        const centerFeatures: any[] = [];
                        
                        groups.forEach((featuresList) => {
                            // Find the best feature in this group
                            // Best: has lat_cen and long_cen
                            // Second best: has lat and lon
                            // Third: just any feature
                            let bestFeature = featuresList.find((f: any) => 
                                f.properties.lat_cen !== undefined && f.properties.lat_cen !== null &&
                                f.properties.long_cen !== undefined && f.properties.long_cen !== null
                            );
                            
                            if (!bestFeature) {
                                bestFeature = featuresList.find((f: any) => 
                                    f.properties.lat !== undefined && f.properties.lat !== null &&
                                    f.properties.lon !== undefined && f.properties.lon !== null
                                );
                            }
                            
                            if (!bestFeature) {
                                bestFeature = featuresList[0];
                            }
                            
                            const lat = bestFeature.properties.lat_cen ?? bestFeature.properties.lat;
                            const lon = bestFeature.properties.long_cen ?? bestFeature.properties.lon;
                            
                            if (lat !== undefined && lon !== undefined && lat !== null && lon !== null) {
                                centerFeatures.push({
                                    type: 'Feature',
                                    geometry: {
                                        type: 'Point',
                                        coordinates: [Number(lon), Number(lat)]
                                    },
                                    properties: {
                                        ...bestFeature.properties
                                    }
                                });
                            }
                        });
                        
                        const source: any = map.getSource(geojsonSourceId);
                        if (source) {
                            source.setData({
                                type: 'FeatureCollection',
                                features: centerFeatures
                            });
                        }
                    };

                    // Listen to events to update point positions dynamically
                    map.on('sourcedata', (e) => {
                        if (e.sourceId === sourceId) {
                            updateCentroids();
                        }
                    });
                    
                    map.on('moveend', updateCentroids);
                    
                    // Initial load trigger
                    setTimeout(updateCentroids, 300);

                    const centerBeforeId = getBeforeIdForLayer(map, `${layer._id}-center`, 'circle', layer.order);
                    map.addLayer({
                        id: `${layer._id}-center`,
                        type: 'circle',
                        source: geojsonSourceId,
                        minzoom: zoomMin,
                        maxzoom: zoomMax,
                        paint: {
                            'circle-radius': 3.5, // Same dot size as commune
                            'circle-color': lineColor,
                            'circle-stroke-color': '#ffffff',
                            'circle-stroke-width': isProvince ? 0 : 1.0, // Remove stroke border of the province center dot ("bỏ strock border tỉnh đi")
                            'circle-opacity': 0.9
                        }
                    }, centerBeforeId);
                }

                const labelBeforeId = getBeforeIdForLayer(map, `${layer._id}-label`, 'symbol', layer.order);
                map.addLayer({
                    id: `${layer._id}-label`,
                    type: 'symbol',
                    source: isAdministrative ? `${layer._id}-centers-geojson` : sourceId,
                    ...(isAdministrative ? {} : { 'source-layer': sourceLayerName }),
                    minzoom: isAdministrative ? zoomMin : (isPlanning ? 13 : (isBasemap ? 14 : zoomMin)),
                    maxzoom: zoomMax,
                    layout: {
                        'visibility': 'visible',
                        'symbol-placement': 'point',
                        'text-field': labelExpression as any,
                        'text-size': textSize,
                        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                        'text-allow-overlap': false,
                        'text-ignore-placement': false,
                        'text-padding': textPadding,
                        ...(isAdministrative ? {
                            'text-anchor': 'top',
                            'text-offset': [0, 0.5]
                        } : {})
                    },
                    paint: {
                        'text-color': textColor,
                        'text-halo-color': '#ffffff',
                        'text-halo-width': 1.5,
                        'text-halo-blur': 0.5
                    }
                }, labelBeforeId);;
                break;
            }
            case 'fill':
            case 'line':
            case 'circle':
            case 'symbol':
            case 'hillshade':
            case 'heatmap':
            case 'background':
            case 'fill-extrusion': {
                const beforeId = getBeforeIdForLayer(map, layer._id, layerType, layer.order);
                map.addLayer({
                    ...commonLayerConfig,
                    type: layerType,
                    source: {
                        type: 'geojson',
                        data: url
                    },
                    paint: getLayerPaintConfig(layerType, layer)
                }, beforeId);
                break;
            }
            default:
                console.error(`Unsupported layer format: ${layerType}`);
                break;
        }
    } catch (err) {
        console.error(`Error adding layer ${layer.name}:`, err);
    }
}

/**
 * Hides an existing layer on the map.
 */
export function hideLayerOnMap(map: maplibreGl.Map, layerId: string) {
    if (!map) return;
    
    if (map.getLayer(layerId)) {
        const visibility = map.getLayoutProperty(layerId, 'visibility');
        if (visibility !== 'none') {
            map.setLayoutProperty(layerId, 'visibility', 'none');
        }
    }
    if (map.getLayer(`${layerId}-fill`)) {
        const visibility = map.getLayoutProperty(`${layerId}-fill`, 'visibility');
        if (visibility !== 'none') {
            map.setLayoutProperty(`${layerId}-fill`, 'visibility', 'none');
        }
    }
    if (map.getLayer(`${layerId}-label`)) {
        const visibility = map.getLayoutProperty(`${layerId}-label`, 'visibility');
        if (visibility !== 'none') {
            map.setLayoutProperty(`${layerId}-label`, 'visibility', 'none');
        }
    }
    if (map.getLayer(`${layerId}-center`)) {
        const visibility = map.getLayoutProperty(`${layerId}-center`, 'visibility');
        if (visibility !== 'none') {
            map.setLayoutProperty(`${layerId}-center`, 'visibility', 'none');
        }
    }
}
