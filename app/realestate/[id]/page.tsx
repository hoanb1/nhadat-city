import { notFound, permanentRedirect } from 'next/navigation';
import { getRealEstateById } from '@/lib/db/realEstate';
import { getRealEstateUrl } from '@/lib/utils/utils';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OldRealEstateRedirectPage({ params }: Props) {
  const { id } = await params;
  const item = await getRealEstateById(id);

  if (!item) {
    notFound();
  }

  // Redirect permanently (301) to the canonical structure using SSOT helper
  permanentRedirect(`https://nhadat.city${getRealEstateUrl(item)}`);
}
