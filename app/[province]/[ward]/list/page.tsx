import { permanentRedirect } from 'next/navigation';

interface Props {
  params: Promise<{ province: string; ward: string }>;
}

export default async function WardRedirectPage({ params }: Props) {
  const { province, ward } = await params;
  
  // SEO optimization: 308 Permanent Redirect for canonical structure
  permanentRedirect(`/${province}/${ward}`);
}
