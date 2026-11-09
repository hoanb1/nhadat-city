import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';
import { NOMINATIM_URL } from '@/lib/config/server';
export const runtime = 'nodejs';

// Category configs for Nominatim search
const SEARCH_CATEGORIES = [
  { key: 'school', query: 'trường học', keywords: ['school', 'university', 'college', 'kindergarten', 'trường'], icon: 'school', label: 'Trường học' },
  { key: 'hospital', query: 'bệnh viện phòng khám', keywords: ['hospital', 'clinic', 'pharmacy', 'bệnh viện', 'phòng khám'], icon: 'hospital', label: 'Y tế' },
  { key: 'shopping', query: 'siêu thị chợ', keywords: ['market', 'supermarket', 'mall', 'siêu thị', 'chợ'], icon: 'shopping', label: 'Mua sắm' },
  { key: 'bank', query: 'ngân hàng ATM', keywords: ['bank', 'atm', 'ngân hàng'], icon: 'bank', label: 'Ngân hàng' },
  { key: 'park', query: 'công viên', keywords: ['park', 'garden', 'playground', 'công viên'], icon: 'park', label: 'Công viên' },
  { key: 'restaurant', query: 'nhà hàng quán ăn', keywords: ['restaurant', 'cafe', 'nhà hàng', 'quán'], icon: 'restaurant', label: 'Ẩm thực' },
];

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  category: string;
  address?: Record<string, string>;
  extratags?: Record<string, string>;
  namedetails?: Record<string, string>;
}

async function searchCategory(lat: number, lng: number, radius: number, cat: typeof SEARCH_CATEGORIES[0]): Promise<any[]> {
  try {
    // Use Nominatim search with viewbox to constrain results near the coordinates
    const delta = radius / 111000; // approximate degrees
    const viewbox = `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`;

    const params = new URLSearchParams({
      q: cat.query,
      format: 'json',
      limit: '10',
      viewbox,
      bounded: '1',
      addressdetails: '1',
      extratags: '1',
      namedetails: '1',
      'accept-language': 'vi',
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${NOMINATIM_URL}/search?${params}`, {
      headers: { 'User-Agent': 'NhaDat.City/1.0 (https://nhadat.city)' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return [];

    const results: NominatimResult[] = await res.json();

    return results
      .map(r => ({
        name: r.namedetails?.['name:vi'] || r.namedetails?.name || r.display_name.split(',')[0],
        fullAddress: r.display_name,
        distance: haversine(lat, lng, parseFloat(r.lat), parseFloat(r.lon)),
        type: r.type || r.category,
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
        phone: r.extratags?.phone || r.extratags?.['contact:phone'] || '',
        website: r.extratags?.website || r.extratags?.['contact:website'] || '',
        openingHours: r.extratags?.opening_hours || '',
      }))
      .filter(r => r.distance <= radius / 1000)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 8);
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') || '');
    const lng = parseFloat(searchParams.get('lng') || '');
    const radius = parseInt(searchParams.get('radius') || '2000');

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ success: false, error: 'lat and lng required' }, { status: 400 });
    }

    const cacheKey = `nearby_${lat.toFixed(4)}_${lng.toFixed(4)}_${radius}`;
    
    // Check cache (valid for 30 days)
    try {
      const rows = await sql`
        SELECT data FROM api_cache
        WHERE key = ${cacheKey} AND updated_at > NOW() - INTERVAL '30 days' LIMIT 1`;
      if (rows.length) {
        return NextResponse.json(
          { success: true, data: rows[0].data },
          { headers: { 'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=1209600' } }
        );
      }
    } catch (e) {
      console.error('[API Cache Error]', e);
    }

    // Step 1: Reverse geocode to get detailed address context
    const reverseParams = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: 'json',
      addressdetails: '1',
      extratags: '1',
      namedetails: '1',
      zoom: '18',
      'accept-language': 'vi',
    });

    const reverseController = new AbortController();
    const reverseTimeout = setTimeout(() => reverseController.abort(), 8000);

    let locationContext: any = null;
    try {
      const reverseRes = await fetch(`${NOMINATIM_URL}/reverse?${reverseParams}`, {
        headers: { 'User-Agent': 'NhaDat.City/1.0 (https://nhadat.city)' },
        signal: reverseController.signal,
      });
      clearTimeout(reverseTimeout);
      if (reverseRes.ok) {
        const reverseData = await reverseRes.json();
        locationContext = {
          fullAddress: reverseData.display_name,
          road: reverseData.address?.road || '',
          suburb: reverseData.address?.suburb || reverseData.address?.quarter || '',
          ward: reverseData.address?.ward || reverseData.address?.village || '',
          district: reverseData.address?.city_district || reverseData.address?.county || reverseData.address?.town || '',
          city: reverseData.address?.city || reverseData.address?.state || '',
          country: reverseData.address?.country || 'Việt Nam',
          postcode: reverseData.address?.postcode || '',
        };
      }
    } catch {
      clearTimeout(reverseTimeout);
    }

    // Step 2: Search for POIs in each category
    // Rate limit: 1 request per second for Nominatim
    const categories: Record<string, any[]> = {};
    const labels: Record<string, string> = {};

    for (const cat of SEARCH_CATEGORIES) {
      categories[cat.key] = await searchCategory(lat, lng, radius, cat);
      labels[cat.key] = cat.label;
      // Nominatim usage policy: max 1 req/sec
      await new Promise(resolve => setTimeout(resolve, 1100));
    }

    const totalPOIs = Object.values(categories).reduce((sum, arr) => sum + arr.length, 0);

    // Step 3: Generate SEO-friendly summary
    const nearbySchools = categories.school?.slice(0, 3).map(s => s.name) || [];
    const nearbyHospitals = categories.hospital?.slice(0, 3).map(s => s.name) || [];
    const nearbyShopping = categories.shopping?.slice(0, 3).map(s => s.name) || [];

    const seoSummary = [
      locationContext?.road ? `Tọa lạc trên ${locationContext.road}` : '',
      locationContext?.suburb ? `thuộc ${locationContext.suburb}` : '',
      locationContext?.district ? `${locationContext.district}` : '',
      nearbySchools.length > 0 ? `Gần ${nearbySchools.join(', ')}` : '',
      nearbyHospitals.length > 0 ? `Cơ sở y tế gần: ${nearbyHospitals.join(', ')}` : '',
      nearbyShopping.length > 0 ? `Tiện ích mua sắm: ${nearbyShopping.join(', ')}` : '',
    ].filter(Boolean).join('. ') + '.';

    // AI context: structured data for AI consulting
    const aiContext = {
      location: locationContext,
      nearbyHighlights: {
        schools: categories.school?.slice(0, 3).map(s => `${s.name} (${s.distance < 1 ? Math.round(s.distance * 1000) + 'm' : s.distance.toFixed(1) + 'km'})`) || [],
        hospitals: categories.hospital?.slice(0, 3).map(s => `${s.name} (${s.distance < 1 ? Math.round(s.distance * 1000) + 'm' : s.distance.toFixed(1) + 'km'})`) || [],
        shopping: categories.shopping?.slice(0, 3).map(s => `${s.name} (${s.distance < 1 ? Math.round(s.distance * 1000) + 'm' : s.distance.toFixed(1) + 'km'})`) || [],
        parks: categories.park?.slice(0, 3).map(s => `${s.name} (${s.distance < 1 ? Math.round(s.distance * 1000) + 'm' : s.distance.toFixed(1) + 'km'})`) || [],
      },
      totalAmenities: totalPOIs,
      seoSummary,
    };

    const responseData = { categories, labels, total: totalPOIs, locationContext, seoSummary, aiContext };

    // Save to Postgres cache
    try {
      await sql`
        INSERT INTO api_cache (key, data, updated_at) VALUES (${cacheKey}, ${sql.json(responseData)}, NOW())
        ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`;
    } catch (e) {
      console.error('[API Cache Save Error]', e);
    }

    return NextResponse.json(
      { success: true, data: responseData },
      { headers: { 'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=1209600' } } // 7 day cache
    );
  } catch (error: any) {
    console.error('[API] nearby error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
