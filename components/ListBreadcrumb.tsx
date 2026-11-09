import Link from 'next/link';

interface Breadcrumb {
  label: string;
  url: string;
}

export function ListBreadcrumb({
  breadcrumbs,
  locationName,
}: {
  breadcrumbs: Breadcrumb[];
  locationName: string;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((b, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: b.label,
      item: `https://nhadat.city${b.url}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav className="breadcrumb" aria-label="Điều hướng">
        <ol itemScope itemType="https://schema.org/BreadcrumbList">
          {breadcrumbs.map((b, i) => (
            <li
              key={i}
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
            >
              <Link href={b.url} itemProp="item">
                <span itemProp="name">{b.label}</span>
              </Link>
              <meta itemProp="position" content={String(i + 1)} />
              {i < breadcrumbs.length - 1 && (
                <span className="breadcrumb-sep" aria-hidden="true"> › </span>
              )}
            </li>
          ))}
          <li aria-current="page">Danh sách</li>
        </ol>
      </nav>
    </>
  );
}
