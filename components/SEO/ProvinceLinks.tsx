import { PROVINCES } from '@/lib/utils/province';
import { listWardsByProvince } from '@/lib/db/repo/publicGeo';

interface ProvinceLinksProps {
  currentProvince?: string;
  className?: string;
}

export default async function ProvinceLinks({ currentProvince, className }: ProvinceLinksProps) {
  const entries = Object.entries(PROVINCES).filter(([slug]) => slug !== currentProvince);

  let localWards: Array<{ CodeName: string; Name: string; DistrictName: string }> = [];
  let provinceName = '';

  if (currentProvince) {
    provinceName = PROVINCES[currentProvince] || currentProvince;
    try {
      const wards = await listWardsByProvince(currentProvince);
      
      localWards = (wards || []).map(w => ({
        CodeName: w.CodeName,
        Name: w.Name,
        DistrictName: w.DistrictName || 'Khu vực khác'
      }));
    } catch (err) {
      console.error('Failed to load local wards for SEO linking:', err);
    }
  }

  // Group wards by district
  const wardsByDistrict: Record<string, typeof localWards> = {};
  for (const ward of localWards) {
    if (!wardsByDistrict[ward.DistrictName]) {
      wardsByDistrict[ward.DistrictName] = [];
    }
    wardsByDistrict[ward.DistrictName].push(ward);
  }

  return (
    <nav
      aria-label="Mua bán nhà đất theo khu vực"
      className={className}
      style={{
        borderTop: '1px solid #e2e8f0',
        padding: '1.5rem',
        background: '#f8fafc',
      }}
    >
      {/* Local Linking Matrix */}
      {currentProvince && localWards.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.875rem', color: '#1e293b', margin: '0 0 0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Nhà đất tại {provinceName} theo xã phường
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {Object.entries(wardsByDistrict).map(([district, districtWards]) => (
              <div key={district} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>{district}</span>
                <ul
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.25rem 0.75rem',
                    padding: 0,
                    margin: 0,
                    listStyle: 'none',
                  }}
                >
                  {districtWards.slice(0, 15).map((ward) => (
                    <li key={ward.CodeName}>
                      <a
                        href={`/${currentProvince}/${ward.CodeName}`}
                        style={{ fontSize: '0.75rem', color: '#64748b', textDecoration: 'none' }}
                        title={`Mua bán nhà đất tại ${ward.Name}, ${district}`}
                      >
                        Nhà đất {ward.Name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* General Provinces Links */}
      <div>
        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Mua bán nhà đất các tỉnh thành khác
        </p>
        <ul
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.25rem 0.75rem',
            padding: 0,
            margin: 0,
            listStyle: 'none',
          }}
        >
          {entries.map(([slug, name]) => (
            <li key={slug}>
              <a
                href={`/${slug}`}
                style={{ fontSize: '0.75rem', color: '#475569', textDecoration: 'none', fontWeight: 500 }}
                title={`Mua bán nhà đất tại ${name}`}
              >
                Nhà đất {name}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
