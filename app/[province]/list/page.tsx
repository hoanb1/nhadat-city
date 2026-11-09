import { permanentRedirect } from 'next/navigation';

interface Props {
  params: Promise<{ province: string }>;
}

export default async function ProvinceRedirectPage({ params }: Props) {
  const { province } = await params;
  
  // SEO optimization: 308 Permanent Redirect for canonical structure
  permanentRedirect(`/${province}`);
}
