import { GEOSERVER_URL, GEOSERVER_PARCEL_LAYER } from '@/lib/config/server';
import { LOAI_DAT } from './landTypeLabels';
import { obfuscateParcelId, deobfuscateParcelId } from '@/lib/utils/idObfuscator';

const PARCEL_LAYERS = [GEOSERVER_PARCEL_LAYER];

export interface ParcelData {
  soTo: string;
  soThua: string;
  dienTich: number | null;
  loaiDat: string;
  loaiDatName: string;
  maXa: string;
  thuaId: string;
  layer: string;
  geometry: any;
}

/**
 * Fetch parcel exact info by its UUID (or obfuscated WFS ID) from GeoServer
 */
export async function getParcelByUuid(uuid: string): Promise<ParcelData | null> {
  const layersToTry = PARCEL_LAYERS;
  const rawId = deobfuscateParcelId(uuid);

  for (const layer of layersToTry) {
    try {
      const isFeatureId = rawId.includes('.') || /^\d+$/.test(rawId);
      const idFilter = isFeatureId
        ? `&FEATUREID=${encodeURIComponent(rawId)}`
        : `&CQL_FILTER=uuid='${encodeURIComponent(rawId)}'`;

      const url = `${GEOSERVER_URL}/wfs?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature` +
        `&TYPENAME=${encodeURIComponent(layer)}&OUTPUTFORMAT=application/json` +
        idFilter + `&MAXFEATURES=1`;

      const res = await fetch(url, { 
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 86400 } // Cache heavily for 1 day to speed up SSR
      });
      if (!res.ok) continue;

      const data = await res.json();
      if (!data?.features?.length) continue;

      const feat = data.features[0];
      const props = feat.properties;

      const loaiDatCode = props.loai_dat || '';
      const loaiDatName = LOAI_DAT[loaiDatCode] || loaiDatCode;

      return {
        soTo: props.so_to,
        soThua: props.so_thua,
        dienTich: props.dien_tich ? Number(props.dien_tich) : null,
        loaiDat: loaiDatCode,
        loaiDatName,
        maXa: props.ma_xa,
        thuaId: obfuscateParcelId(props.uuid || props.thua_id || feat.id),
        layer,
        geometry: feat.geometry,
      };
    } catch (err) {
      // ignore and try next layer
      continue;
    }
  }

  return null;
}
