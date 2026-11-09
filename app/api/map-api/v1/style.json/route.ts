import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  const style = {
    version: 8,
    name: "Default Style",
    sources: {
      "osm": {
        "type": "raster",
        "tiles": [
          "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png"
        ],
        "tileSize": 256,
        "attribution": "&copy; OpenStreetMap Contributors",
        "maxzoom": 19
      }
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: {
          "background-color": "#f8f9fa"
        }
      },
      {
        "id": "osm-tiles",
        "type": "raster",
        "source": "osm",
        "minzoom": 0,
        "maxzoom": 22
      }
    ]
  };

  return NextResponse.json(style, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
