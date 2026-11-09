import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { put, type Doc } from '@/lib/db/pgUtil';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Active layer types / layers, ordered by `order` desc (as before)
    const typeRows = await sql`
      SELECT * FROM map_layer_types WHERE active IS TRUE ORDER BY sort_order DESC, id`;
    const layerRows = await sql`
      SELECT * FROM planning_layers WHERE active IS TRUE ORDER BY sort_order DESC, id`;

    const types = typeRows.map((r) => {
      const d: Doc = { _id: r.mongo_id };
      put(d, 'name', r.name);
      put(d, 'order', r.sort_order);
      put(d, 'parentId', r.parent_id);
      put(d, 'active', r.active);
      put(d, 'autoShow', r.auto_show);
      put(d, 'createdAt', r.created_at);
      return d;
    });

    const layers = layerRows.map((r) => {
      const d: Doc = r.extra && typeof r.extra === 'object' ? { ...r.extra } : {};
      d._id = r.mongo_id ?? r.id;
      put(d, 'name', r.name);
      put(d, 'type', r.type_id);
      put(d, 'description', r.description);
      put(d, 'order', r.sort_order);
      put(d, 'opacity', r.opacity);
      put(d, 'saturation', r.saturation);
      put(d, 'color', r.color);
      put(d, 'geoServerLayer', r.geoserver_layer);
      put(d, 'autoLoad', r.auto_load);
      put(d, 'visible', r.visible);
      put(d, 'active', r.active);
      put(d, 'activeType', r.active_type);
      put(d, 'zoomMin', r.min_zoom);
      put(d, 'zoomMax', r.max_zoom);
      if (r.bbox && typeof r.bbox === 'object' && Object.keys(r.bbox).length) d.boundingBox = r.bbox;
      put(d, 'createdAt', r.created_at);
      put(d, 'updatedAt', r.updated_at);
      return d;
    });

    return NextResponse.json({
      success: true,
      data: {
        types,
        layers
      }
    });

  } catch (error) {
    console.error(`Map Layers API error:`, error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
