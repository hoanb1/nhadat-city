import { Metadata } from 'next';
import { getPublicUserByMongoId, getActiveListingsByIds, getLatestActiveListings } from '@/lib/db/repo/publicUser';
import { notFound, permanentRedirect } from 'next/navigation';
import Link from 'next/link';
import { MapProvider } from '@/components/Map/MapContext';
import MapOverlayUI from '@/components/Map/MapOverlayUI';
import MainMapClientDeferred from '@/components/Map/MainMapClientDeferred';
import { makeUrlSlug, formatMoney, getImageUrl, IMAGE_SIZES } from '@/lib/utils/utils';
import { JsonLd } from '@/components/JsonLd';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const parts = id.split('-');
  const actualId = parts[0];

  const user = await getPublicUserByMongoId(actualId);
  if (!user) {
    notFound();
  }

  const userName = user.profile?.name || 'Thành viên';
  const correctSlug = makeUrlSlug(userName);
  const canonicalUrl = `https://nhadat.city/user/${actualId}-${correctSlug}`;

  return {
    title: `${userName} – Danh sách tin đăng bất động sản | NhaDat.City`,
    description: `Xem thông tin liên hệ và toàn bộ danh sách bất động sản, nhà đất đang giao dịch của ${userName} trên bản đồ quy hoạch NhaDat.City.`,
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${userName} – Tin đăng BĐS | NhaDat.City`,
      description: `Hồ sơ môi giới và danh sách bất động sản của ${userName} trên bản đồ NhaDat.City.`,
      url: canonicalUrl,
      type: 'profile',
    },
  };
}

export default async function UserProfilePage({ params }: Props) {
  const { id } = await params;

  // Parse ID and slug
  const parts = id.split('-');
  const actualId = parts[0];
  const requestedSlug = parts.slice(1).join('-');

  const user = await getPublicUserByMongoId(actualId);

  if (!user) {
    notFound();
  }

  const userName = user.profile?.name || 'Thành viên';
  const correctSlug = makeUrlSlug(userName);

  // Redirect if slug is missing or incorrect
  if (!requestedSlug || requestedSlug !== correctSlug) {
    permanentRedirect(`https://nhadat.city/user/${actualId}-${correctSlug}`);
  }

  const avatarUrl = user.image || user.profile?.image || user.profile?.avatar;
  const userEmail = user.emails?.[0]?.address;

  // Fetch relevant or active listings for this broker/user
  let listings: any[] = [];
  try {
    const favoriteIds = Array.isArray(user.profile?.favorites) ? user.profile.favorites : [];
    if (favoriteIds.length > 0) {
      listings = await getActiveListingsByIds(favoriteIds, 12);
    }
    if (listings.length === 0) {
      listings = await getLatestActiveListings(8);
    }
  } catch (err) {
    console.error('[User Profile Error] Failed to load listings:', err);
  }

  // JSON-LD Schema
  const personJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: userName,
    url: `https://nhadat.city/user/${actualId}-${correctSlug}`,
    image: avatarUrl,
    email: userEmail,
    description: `Hồ sơ nhà môi giới bất động sản ${userName} trên NhaDat.City`,
  };

  return (
    <main style={{ width: '100vw', height: '100dvh', overflow: 'hidden', position: 'relative' }}>
      <JsonLd data={personJsonLd} />

      {/* SSR Preview & Organic SEO Listing Container */}
      <div
        id="listing-ssr-preview"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '24px 16px',
          overflowY: 'auto',
        }}
      >
        {/* Header Profile Box */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(12px)',
            borderRadius: 20,
            padding: '28px 24px',
            maxWidth: 640,
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            textAlign: 'center',
            marginBottom: 24,
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={userName}
              style={{
                width: 88,
                height: 88,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '4px solid #6366f1',
                boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
                margin: '0 auto 12px',
              }}
            />
          ) : (
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.25rem',
                fontWeight: 800,
                margin: '0 auto 12px',
              }}
            >
              {userName.charAt(0)}
            </div>
          )}

          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0f172a', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            {userName}
          </h1>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ecfdf5', color: '#059669', padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
            Thành viên BĐS xác thực
          </div>

          {userEmail && (
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 16px' }}>
              {userEmail}
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
            <Link href="/" style={{ fontSize: 13, fontWeight: 700, color: '#4f46e5', textDecoration: 'none' }}>
              Mở bản đồ quy hoạch
            </Link>
            <span style={{ color: '#cbd5e1' }}>•</span>
            <Link href="/blog" style={{ fontSize: 13, fontWeight: 700, color: '#4f46e5', textDecoration: 'none' }}>
              Cẩm nang quy hoạch
            </Link>
          </div>
        </div>

        {/* Featured Real Estate Listings Grid */}
        <div style={{ maxWidth: 840, width: '100%' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            Danh sách bất động sản đang giao dịch
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {listings.map((item: any) => {
              const itemSlug = makeUrlSlug(item.title);
              const itemId = item.shortId || item._id;
              const provinceSlug = item.adminunit?.province || 'ha-noi';
              const wardSlug = item.adminunit?.ward || 'all';
              const listingUrl = `/${provinceSlug}/${wardSlug}/${itemId}/${itemSlug}`;
              const img = getImageUrl(item.images?.[0], String(item._id), IMAGE_SIZES.LIST.width, IMAGE_SIZES.LIST.height);

              return (
                <article
                  key={String(item._id)}
                  style={{
                    background: '#ffffff',
                    borderRadius: 14,
                    overflow: 'hidden',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <Link href={listingUrl} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                    <div style={{ height: 140, background: '#f1f5f9', position: 'relative', overflow: 'hidden' }}>
                      <img
                        src={img}
                        alt={item.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        loading="lazy"
                      />
                      {item.totalPrice && (
                        <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(15, 23, 42, 0.85)', color: '#38bdf8', padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 800 }}>
                          {formatMoney(item.totalPrice)}
                        </div>
                      )}
                    </div>
                  </Link>

                  <div style={{ padding: 12, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <Link href={listingUrl} style={{ textDecoration: 'none', color: '#0f172a' }}>
                      <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 6px', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {item.title}
                      </h3>
                    </Link>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginTop: 8 }}>
                      <span>{item.area ? `${item.area} m²` : 'Đang cập nhật'}</span>
                      <Link href={listingUrl} style={{ color: '#4f46e5', fontWeight: 700, textDecoration: 'none' }}>
                        Xem tin ›
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      <MapProvider initialUserId={actualId}>
        <MapOverlayUI />
        <MainMapClientDeferred />
      </MapProvider>
    </main>
  );
}
