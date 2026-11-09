import { permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import WardListingPage from '@/app/[province]/[ward]/page';
import { getParcelByUuid } from '@/lib/geo/parcelService';
import { getAdminUnit } from '@/lib/geo/geoService';

interface Props {
  params: Promise<{ slug?: string[] }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  
  if (slug && slug.length >= 3) {
    const province = slug[0];
    const ward = slug[1];
    const parcelId = slug[2];

    const [adminUnit, parcelData] = await Promise.all([
      getAdminUnit(province, ward),
      getParcelByUuid(parcelId)
    ]);

    const provinceName = adminUnit?.province?.Name || province;
    const wardName = adminUnit?.ward?.Name || '';
    const locationName = wardName ? `${wardName}, ${provinceName}` : provinceName;

    if (parcelData) {
      const title = `Thửa đất số ${parcelData.soThua || '?'}, Tờ ${parcelData.soTo || '?'} tại ${locationName} | NhaDat.City`;
      const description = `Bản đồ và thông tin chi tiết Thửa đất số ${parcelData.soThua || '?'}, Tờ bản đồ số ${parcelData.soTo || '?'}. Diện tích: ${parcelData.dienTich ? parcelData.dienTich + 'm2' : 'Đang cập nhật'}. Loại đất: ${parcelData.loaiDatName}.`;
      
      return {
        title,
        description,
        alternates: {
          canonical: `https://nhadat.city/parcel-boundary/${province}/${ward}/${parcelId}`,
        },
        openGraph: {
          title,
          description,
          url: `https://nhadat.city/parcel-boundary/${province}/${ward}/${parcelId}`,
          siteName: 'NhaDat.City',
          locale: 'vi_VN',
          type: 'website',
        },
      };
    }
  }

  // Fallback metadata
  return {
    title: 'Bản đồ Thửa đất | NhaDat.City',
  };
}

export default async function ParcelBoundaryPage({ params }: Props) {
  const { slug } = await params;
  
  if (slug && slug.length >= 3) {
    const province = slug[0];
    const ward = slug[1];
    let parcelId = slug[2];

    // Some legacy URLs might have the ID in the 2nd slug if ward is missing
    if (!ward.includes('-') && ward.length > 11 && slug.length === 2) {
      parcelId = ward;
      return <WardListingPage params={Promise.resolve({ province, ward: 'undefined' })} searchParams={Promise.resolve({ parcelId })} />;
    }

    // Server-side deobfuscation check: if the URL contains a raw sequential ID, redirect permanently to the obfuscated version
    const parcelData = await getParcelByUuid(parcelId);
    if (parcelData && parcelId !== parcelData.thuaId) {
      permanentRedirect(`/parcel-boundary/${province}/${ward}/${parcelData.thuaId}`);
    }

    // Reuse the exact WardListingPage component but pass parcelId as a search param!
    return <WardListingPage params={Promise.resolve({ province, ward })} searchParams={Promise.resolve({ parcelId })} />;
  }

  // If not a full parcel URL, redirect back to province/ward or home
  if (slug && slug.length === 2) {
    const province = slug[0];
    const ward = slug[1];
    if (!ward.includes('-') && ward.length > 11) {
      permanentRedirect(`/${province}?parcelId=${ward}`);
    }
    permanentRedirect(`/${province}/${ward}`);
  } else if (slug && slug.length === 1) {
    permanentRedirect(`/${slug[0]}`);
  }

  permanentRedirect('/');
}
