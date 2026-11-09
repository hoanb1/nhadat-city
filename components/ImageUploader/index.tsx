'use client';

import { useState, useRef, useCallback } from 'react';
import { Camera, Loader2, X } from 'lucide-react';

export interface UploadedImage {
  id: string;
  url: string;
  localUrl: string; // blob URL for preview
  name: string;
}

interface Props {
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  maxImages?: number;
}

export default function ImageUploader({ images, onChange, maxImages = 20 }: Props) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!arr.length) return;
    const remaining = maxImages - images.length;
    if (remaining <= 0) { setError(`Tối đa ${maxImages} ảnh`); return; }
    const toUpload = arr.slice(0, remaining);

    setUploading(true); setError('');

    // Local preview immediately
    const previews: UploadedImage[] = toUpload.map(f => ({
      id: '',
      url: '',
      localUrl: URL.createObjectURL(f),
      name: f.name,
    }));
    onChange([...images, ...previews]);

    // Upload to server
    const fd = new FormData();
    toUpload.forEach(f => fd.append('images', f));

    try {
      const res = await fetch('/api/user/upload-images', { method: 'POST', body: fd });
      const json = await res.json();
      if (json.success) {
        // Replace previews with real IDs
        const updated = [...images];
        json.images.forEach((img: { id: string; url: string }, i: number) => {
          previews[i].id = img.id;
          previews[i].url = img.url;
          updated.push(previews[i]);
        });
        onChange(updated);
      } else {
        setError(json.error || 'Upload thất bại');
        onChange(images); // revert
      }
    } catch {
      setError('Lỗi kết nối');
      onChange(images);
    }
    setUploading(false);
  }, [images, onChange, maxImages]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(e.dataTransfer.files);
  }, [uploadFiles]);

  const removeImage = (idx: number) => {
    const updated = [...images];
    URL.revokeObjectURL(updated[idx].localUrl);
    updated.splice(idx, 1);
    onChange(updated);
  };

  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const updated = [...images];
    [updated[from], updated[to]] = [updated[to], updated[from]];
    onChange(updated);
  };

  return (
    <div className="flex flex-col gap-2.5">
      {error && <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg py-2 px-3 text-[0.82rem]">{error}</div>}

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-[14px] py-7 px-5 cursor-pointer transition-all duration-200 text-center ${dragOver ? 'border-blue-600 bg-blue-50' : 'border-blue-200 bg-blue-50/50 hover:border-blue-600 hover:bg-blue-50'} ${uploading ? 'pointer-events-none opacity-70' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => e.target.files && uploadFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" strokeWidth={1.5} />
            <span className="text-[0.75rem] text-slate-500">Đang tải ảnh lên...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Camera className="w-8 h-8 text-blue-500" strokeWidth={1.5} />
            <strong className="text-[0.9rem] text-slate-800">Kéo thả ảnh vào đây hoặc nhấp để chọn</strong>
            <span className="text-[0.75rem] text-slate-500">Tối đa {maxImages} ảnh · JPG, PNG · Mỗi ảnh ≤ 20MB</span>
            <span className="font-bold text-blue-600 text-[0.75rem]">{images.length}/{maxImages} ảnh</span>
          </div>
        )}
      </div>

      {/* Preview grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
          {images.map((img, i) => (
            <div key={i} className={`relative rounded-lg overflow-hidden aspect-[4/3] border-2 bg-slate-100 group ${i === 0 ? 'border-blue-600' : 'border-slate-200'}`}>
              <img src={img.localUrl || img.url} alt={img.name} className="w-full h-full object-cover block" />
              {i === 0 && <span className="absolute top-[5px] left-[5px] bg-blue-600 text-white text-[0.65rem] font-bold py-[2px] px-[7px] rounded-md">Ảnh bìa</span>}
              {!img.id && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Loader2 className="w-6 h-6 text-white animate-spin" strokeWidth={1.5} /></div>}
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 flex justify-around p-[3px] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <button type="button" onClick={() => moveImage(i, i - 1)} disabled={i === 0} className="bg-white/20 border-none text-white text-[0.85rem] cursor-pointer rounded px-1.5 font-bold disabled:opacity-30 disabled:cursor-not-allowed" title="Trái">‹</button>
                <button type="button" onClick={() => moveImage(i, i + 1)} disabled={i === images.length - 1} className="bg-white/20 border-none text-white text-[0.85rem] cursor-pointer rounded px-1.5 font-bold disabled:opacity-30 disabled:cursor-not-allowed" title="Phải">›</button>
                <button type="button" onClick={() => removeImage(i)} className="bg-white/20 border-none text-red-300 text-[0.85rem] cursor-pointer rounded px-1.5 font-bold disabled:opacity-30 disabled:cursor-not-allowed" title="Xóa"><X className="w-3.5 h-3.5 inline" strokeWidth={2} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
