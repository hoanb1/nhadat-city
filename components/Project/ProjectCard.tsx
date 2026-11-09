import Image from 'next/image';
import Link from 'next/link';
import { makeUrlSlug } from '@/lib/utils/utils';

export default function ProjectCard({ project }: { project: any }) {
  const imageUrl = project.images && project.images.length > 0 
    ? project.images[0] 
    : 'https://nhadat.city/images/placeholder.jpg';
    
  const idToUse = project.shortId || project._id?.toString() || '';
  const slug = makeUrlSlug(project.title || 'du-an');
  const projectLink = `/du-an/${idToUse}/${slug}`;

  // Helper to determine status text
  const getStatusText = (status: number) => {
    switch(status) {
      case 1: return "Sắp mở bán";
      case 2: return "Đang mở bán";
      case 3: return "Đã bàn giao";
      default: return "Cập nhật mới";
    }
  };

  return (
    <Link href={projectLink} className="group block h-full">
      <div className="flex flex-col h-full bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
          <Image
            src={imageUrl}
            alt={project.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-110"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          {/* Badge */}
          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-bold text-gray-800 shadow-sm border border-white/20">
            {getStatusText(project.status)}
          </div>
          {/* Gradient Overlay for bottom text readibility if needed */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>
        <div className="p-5 flex flex-col flex-grow">
          <h3 className="font-bold text-lg text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors leading-tight">
            {project.title}
          </h3>
          <p className="text-gray-500 text-sm mt-2 line-clamp-1 flex items-center gap-1">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="truncate">{project.address || "Đang cập nhật"}</span>
          </p>
        </div>
      </div>
    </Link>
  );
}
