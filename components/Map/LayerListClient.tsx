'use client';

import React, { useEffect, useState } from 'react';
import useSWR from 'swr';
import { useMapContext } from './MapContext';
import { addLayerToMap, hideLayerOnMap } from '@/lib/map/mapLayerUtils';

// Types
type LayerType = {
  _id: string;
  name: string;
  parentId: string;
  order: number;
};

type MapLayer = {
  _id: string;
  name: string;
  type: string;
  autoLoad: boolean;
  order: number;
  [key: string]: any;
};

// Fetcher
const fetcher = (url: string) => fetch(url).then(res => res.json());

// TreeNode Component (Recursive)
const TreeNode = ({ 
  node, 
  allTypes, 
  allLayers, 
  autoLoadStates, 
  handleCheckboxChange 
}: {
  node: LayerType;
  allTypes: LayerType[];
  allLayers: MapLayer[];
  autoLoadStates: Record<string, boolean>;
  handleCheckboxChange: (layer: MapLayer, isChecked: boolean) => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Find children types and layers for this node
  const childTypes = allTypes.filter(t => t.parentId === node._id).sort((a, b) => b.order - a.order);
  const myLayers = allLayers.filter(l => l.type === node._id).sort((a, b) => b.order - a.order);

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="tree-node" style={{ marginBottom: '8px' }}>
      <div 
        className="dropdown-header-x" 
        onClick={toggleExpand} 
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontWeight: '500' }}
      >
        <span>{node.name}</span>
        <span className="dropdown-icon">
          <i className={`ti ${isExpanded ? 'ti-chevron-up' : 'ti-chevron-down'}`}></i>
        </span>
      </div>
      
      {isExpanded && (
        <div className="layer-child" style={{ marginLeft: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* Render Layers */}
          {myLayers.map(layer => {
            const isChecked = autoLoadStates[layer._id] !== undefined 
                ? autoLoadStates[layer._id] 
                : layer.autoLoad;

            return (
              <label key={layer._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                <input 
                  type="checkbox" 
                  checked={!!isChecked}
                  onChange={(e) => handleCheckboxChange(layer, e.target.checked)}
                />
                {layer.name}
              </label>
            );
          })}

          {/* Render Child Types (Recursive) */}
          {childTypes.map(childNode => (
            <TreeNode 
              key={childNode._id} 
              node={childNode} 
              allTypes={allTypes} 
              allLayers={allLayers} 
              autoLoadStates={autoLoadStates}
              handleCheckboxChange={handleCheckboxChange}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function LayerListClient() {
  const { data, error, isLoading } = useSWR('/api/map-layers', fetcher);
  const { map, showHeatmap, setShowHeatmap } = useMapContext();
  const [autoLoadStates, setAutoLoadStates] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('autoLoadStates');
        if (stored) return JSON.parse(stored);
      } catch (e) {}
    }
    return {};
  });
  const [initializedMap, setInitializedMap] = useState(false);
  const initializingRef = React.useRef(false);

  // Handle map loading and initial layer injection
  useEffect(() => {
    if (!map || !data?.success || initializedMap || initializingRef.current) return;
    initializingRef.current = true;

    const handleMapLoad = () => {
      // Wait until initMapLayers has run (signaled by 'clusters' layer existing)
      // isStyleLoaded() can stay false for a long time while fonts/tiles load,
      // causing this to loop endlessly without ever adding base layers.
      if (!map.getLayer('clusters')) {
        setTimeout(handleMapLoad, 100);
        return;
      }

      const allLayers: MapLayer[] = data.data.layers;
      const initialStates = { ...autoLoadStates };
      let stateChanged = false;

      // Reverse to match legacy loading order
      const orderedLayers = [...allLayers].reverse();

      orderedLayers.forEach(layer => {
        const isChecked = autoLoadStates[layer._id] !== undefined 
            ? autoLoadStates[layer._id] 
            : layer.autoLoad;
        
        if (isChecked && autoLoadStates[layer._id] === undefined) {
          initialStates[layer._id] = true;
          stateChanged = true;
        }

        if (isChecked) {
          addLayerToMap(map, layer);
        }
      });

      if (stateChanged) {
        setAutoLoadStates(initialStates);
        localStorage.setItem('autoLoadStates', JSON.stringify(initialStates));
      }

      setInitializedMap(true);
    };

    handleMapLoad();
  }, [map, data, initializedMap]);

  if (isLoading) return <div style={{ padding: '16px' }}>Đang tải danh sách bản đồ...</div>;
  if (error || !data?.success) return <div style={{ padding: '16px', color: 'red' }}>Lỗi tải danh sách bản đồ</div>;

  const allTypes: LayerType[] = data.data.types;
  const allLayers: MapLayer[] = data.data.layers;

  // Root nodes have empty parentId
  const parentTypes = allTypes.filter(t => !t.parentId).sort((a, b) => b.order - a.order);

  const handleCheckboxChange = (layer: MapLayer, isChecked: boolean) => {
    const newStates = { ...autoLoadStates, [layer._id]: isChecked };
    setAutoLoadStates(newStates);
    localStorage.setItem('autoLoadStates', JSON.stringify(newStates));

    if (map) {
      if (isChecked) {
        addLayerToMap(map, layer);
      } else {
        hideLayerOnMap(map, layer._id);
      }
    }
  };

  return (
    <div className="layer-list-container" style={{ padding: '16px', background: '#fff', borderRadius: '8px', minWidth: '250px', maxHeight: '400px', overflowY: 'auto' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Lớp bản đồ</h3>
      
      <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
         <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', color: '#e53e3e' }}>
            <input 
              type="checkbox" 
              className="w-4 h-4 accent-red-600"
              checked={showHeatmap} 
              onChange={(e) => setShowHeatmap(e.target.checked)} 
            />
            Bản đồ nhiệt (Heatmap)
         </label>
      </div>

      {parentTypes.map(node => (
        <TreeNode 
          key={node._id} 
          node={node} 
          allTypes={allTypes} 
          allLayers={allLayers} 
          autoLoadStates={autoLoadStates}
          handleCheckboxChange={handleCheckboxChange}
        />
      ))}
    </div>
  );
}
