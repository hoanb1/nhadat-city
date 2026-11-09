import { spawn } from 'child_process';
import { GEOSERVER_URL, GEOSERVER_WORKSPACE } from '@/lib/config/server';

export const mapProxyService = {
  getTileUrl(layerName: string, z: number, x: number, y: number, format = 'png') {
    const workspace = layerName.split(':')[0] || GEOSERVER_WORKSPACE;

    if (format === 'webp') {
      // Calculate BBOX in EPSG:3857 (Web Mercator)
      const R = 6378137;
      const circumference = 2 * Math.PI * R;
      const originShift = circumference / 2;
      const n = Math.pow(2, z);
      const tileSize = circumference / n;
      const minx = x * tileSize - originShift;
      const maxy = originShift - y * tileSize;
      const maxx = (x + 1) * tileSize - originShift;
      const miny = originShift - (y + 1) * tileSize;

      return `${GEOSERVER_URL}/${workspace}/wms?service=WMS&version=1.1.1&request=GetMap&layers=${layerName}&bbox=${minx},${miny},${maxx},${maxy}&width=256&height=256&srs=EPSG:3857&styles=&format=image/webp&transparent=true`;
    }

    const geoServerUrl = `${GEOSERVER_URL}/${workspace}/gwc/service/wmts`;
    const tileMatrixSet = 'EPSG:900913';

    let mimeType = `image/${format}`;
    if (format === 'pbf') {
      mimeType = 'application/vnd.mapbox-vector-tile';
    } else if (format === 'geojson') {
      mimeType = 'application/json;type=geojson';
    } else if (format === 'topojson') {
      mimeType = 'application/json;type=topojson';
    }

    return `${geoServerUrl}?layer=${layerName}&style=&tilematrixset=${tileMatrixSet}&Service=WMTS&Request=GetTile&Version=1.0.0&Format=${encodeURIComponent(mimeType)}&TileMatrix=${tileMatrixSet}:${z}&TileCol=${x}&TileRow=${y}`;
  },

  async fetchWMSTile(layerName: string, z: number, x: number, y: number, format = 'png'): Promise<Buffer | null> {
    const tileUrl = this.getTileUrl(layerName, z, x, y, format);
    try {
      const res = await fetch(tileUrl);
      if (!res.ok) {
        return null;
      }
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error(`Error fetching WMS tile: ${error}`);
      return null;
    }
  },

  async fetchWMSImage({ layer, bbox, width = 711, height = 768, format = 'png', cqlFilter = '' }: { layer: string, bbox: number[], width?: number, height?: number, format?: string, cqlFilter?: string }): Promise<Buffer | null> {
    const bboxStr = bbox.join(',');
    const filterParam = cqlFilter ? `&CQL_FILTER=${encodeURIComponent(cqlFilter)}` : '';
    const url = `${GEOSERVER_URL}/adminunit/wms?service=WMS&version=1.1.0&request=GetMap&layers=${layer}&bbox=${bboxStr}&width=${width}&height=${height}&srs=EPSG:4326&styles=&format=image/${format}&transparent=true${filterParam}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        return null;
      }
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error(`Error fetching WMS image: ${error}`);
      return null;
    }
  },

  convertToWebP(imageBuffer: Buffer, quality = 80): Promise<Buffer | null> {
    if (!imageBuffer || !imageBuffer.length) {
      return Promise.resolve(null);
    }

    const isJPEG = imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8 && imageBuffer[2] === 0xFF;
    const isPNG = imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && imageBuffer[2] === 0x4E && imageBuffer[3] === 0x47;

    if (!isJPEG && !isPNG) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      const convert = spawn('convert', [
        '-',                  // auto detect input from stdin
        '-quality', quality.toString(),
        'webp:-',             // output webp to stdout
      ]);

      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];

      convert.stdout.on('data', data => stdout.push(data));
      convert.stderr.on('data', data => stderr.push(data));

      convert.on('error', err => {
        console.error(`Failed to start convert process: ${err.message}`);
        resolve(null);
      });

      convert.on('close', code => {
        if (code !== 0) {
          const errMsg = Buffer.concat(stderr).toString() || `convert exited with code ${code}`;
          console.error(`Convert failed: ${errMsg}`);
          resolve(null);
        } else {
          resolve(Buffer.concat(stdout));
        }
      });

      try {
        convert.stdin.write(imageBuffer);
        convert.stdin.end();
      } catch (e: any) {
        console.error(`Error writing to convert stdin: ${e.message}`);
        resolve(null);
      }
    });
  }
};
