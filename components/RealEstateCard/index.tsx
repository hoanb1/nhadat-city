import { getImageUrl, makeUrlSlug, formatMoney, formatArea, getRelativeTime, IMAGE_SIZES, getRealEstateUrl } from '@/lib/utils/utils';
import Image from 'next/image';
import Link from 'next/link';
import { IconMapPin, IconMap2 } from '@tabler/icons-react';
interface RealEstate {
  _id: string;
  title: string;
  totalPrice?: number;
  area?: number;
  address?: string;
  images?: string[];
  adminunit?: { province?: string; ward?: string };
  contact?: { name?: string; phone?: string };
  createdAt?: string | Date;
  propertyType?: string;
}

interface Props {
  item: RealEstate;
  priority?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onLocationClick?: (e: React.MouseEvent) => void;
  onClick?: (item: RealEstate) => void;
}

export function RealEstateCard({ 
  item, 
  priority = false, 
  onMouseEnter, 
  onMouseLeave,
  onLocationClick,
  onClick
}: Props) {
  const imageUrl = getImageUrl(item.images?.[0], item._id, IMAGE_SIZES.CAROUSEL.width, IMAGE_SIZES.CAROUSEL.height);
  const price = formatMoney(item.totalPrice || 0);
  const area = item.area ? formatArea(item.area) : '';
  const timeAgo = item.createdAt ? getRelativeTime(item.createdAt) : '';

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onClick) onClick(item);
  };

  return (
    <article 
      className="group relative flex flex-col bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={handleClick}
    >
      <Link href={getRealEstateUrl(item)} className="absolute inset-0 z-0 opacity-0 pointer-events-none" aria-label={item.title}>
        {item.title}
      </Link>

      {imageUrl ? (
        <div className="relative w-full h-[190px] shrink-0 bg-slate-100 z-10 border-b border-slate-100">
          <Image
            unoptimized
            src={imageUrl}
            alt={item.title}
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            priority={priority}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => { 
              const img = e.target as HTMLImageElement;
              img.srcset = '';
              img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            }}
          />
          {item.images && item.images.length > 1 && (
            <div className="absolute bottom-2 right-2 bg-slate-900/80 text-white text-[0.7rem] font-bold px-2 py-0.5 rounded-[4px] backdrop-blur-sm">
              {item.images.length} ảnh
            </div>
          )}
        </div>
      ) : (
        <div className="relative w-full h-[190px] shrink-0 bg-slate-100 flex items-center justify-center text-slate-400 font-semibold text-[0.85rem] z-10 border-b border-slate-100">
          Không có ảnh
        </div>
      )}

      <div className="flex flex-col p-3.5 z-10">
        <div className="flex items-center flex-wrap gap-x-1.5 mb-2 leading-none">
          <span className="font-extrabold text-red-600 text-[1.05rem]">
            {price}
          </span>
          {area && (
            <span className="font-semibold text-slate-500 text-[0.85rem]">
              · {area}
            </span>
          )}
        </div>

        <h3 className="m-0 text-[0.9rem] font-medium text-slate-700 leading-[1.45] line-clamp-2 transition-colors group-hover:text-indigo-700" title={item.title}>
          {item.title}
        </h3>

        <div className="mt-3 flex items-center justify-between text-[0.75rem] text-slate-500 gap-2">
          {item.address ? (
            <div 
              className="flex items-center gap-1.5 flex-1 min-w-0 group/loc cursor-pointer hover:text-indigo-600 transition-colors py-1 -my-1 rounded"
              onClick={(e) => {
                e.stopPropagation();
                if (onLocationClick) onLocationClick(e);
              }}
              title="Xem vị trí trên bản đồ"
            >
              <span className="truncate max-w-[85%] flex items-center">
                <IconMapPin width="1.2em" height="1.2em" className="mr-1 text-slate-400 shrink-0 group-hover/loc:text-indigo-500"  />
                {item.address.split(',').slice(-2).join(', ')}
              </span>
              <div className="bg-slate-50 text-slate-400 border border-slate-100 w-6 h-6 rounded-sm flex items-center justify-center transition-colors group-hover/loc:bg-indigo-50 group-hover/loc:text-indigo-600 group-hover/loc:border-indigo-200 shrink-0">
                <IconMap2 width="1.1em" height="1.1em"  />
              </div>
            </div>
          ) : <div className="flex-1" />}
          {timeAgo && <span className="font-medium text-slate-400 shrink-0 ml-auto">{timeAgo}</span>}
        </div>
      </div>
    </article>
  );
}
