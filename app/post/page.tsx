'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Check } from 'lucide-react';
import type { AddressResult } from '@/components/AddressPickerMap';
import type { UploadedImage } from '@/components/ImageUploader';

const AddressPickerMap = dynamic(
  () => import('@/components/AddressPickerMap'),
  { ssr: false, loading: () => <div className="map-loading">Đang tải bản đồ...</div> }
);
const ImageUploader = dynamic(
  () => import('@/components/ImageUploader'),
  { ssr: false, loading: () => <div className="map-loading">Đang tải...</div> }
);

const SALE_TYPES = [
  { value: 'nha_pho',      label: 'Nhà phố' },
  { value: 'nha_o',        label: 'Nhà ở' },
  { value: 'can_ho',       label: 'Căn hộ / CC' },
  { value: 'dat_nen',      label: 'Đất nền' },
  { value: 'biet_thu',     label: 'Biệt thự / Villa' },
  { value: 'nha_mat_pho',  label: 'Nhà mặt phố' },
  { value: 'van_phong',    label: 'Văn phòng' },
  { value: 'shophouse',    label: 'Shophouse' },
  { value: 'kho_xuong',    label: 'Kho xưởng' },
];

const RENT_TYPES = [
  { value: 'phong_tro',       label: 'Phòng trọ' },
  { value: 'nha_nguyen_can',  label: 'Nhà nguyên căn' },
  { value: 'can_ho_thue',     label: 'Căn hộ / CC' },
  { value: 'van_phong_thue',  label: 'Văn phòng' },
  { value: 'mat_bang',        label: 'Mặt bằng KD' },
  { value: 'dat_thue',        label: 'Đất cho thuê' },
  { value: 'kho_xuong_thue',  label: 'Kho xưởng' },
  { value: 'biet_thu_thue',   label: 'Biệt thự / Villa' },
];

const PRICE_UNITS = [
  { value: 'thang', label: '/tháng' },
  { value: 'nam',   label: '/năm' },
  { value: 'ngay',  label: '/ngày' },
];

// Amenities shared for both sale & rent
const SURROUNDINGS = [
  { v: 'gan_cho',        l: 'Gần chợ' },
  { v: 'gan_truong',     l: 'Gần trường học' },
  { v: 'gan_benh_vien',  l: 'Gần bệnh viện' },
  { v: 'gan_trung_tam',  l: 'Gần trung tâm' },
  { v: 'gan_metro',      l: 'Gần metro/xe buýt' },
  { v: 'gan_sieu_thi',   l: 'Gần siêu thị' },
  { v: 'gan_cong_vien',  l: 'Gần công viên' },
  { v: 'mat_tien',       l: 'Mặt tiền đường lớn' },
  { v: 'hem_xe_hoi',     l: 'Hẻm xe hơi' },
  { v: 'view_song',      l: 'View sông / hồ' },
  { v: 'view_thanh_pho', l: 'View thành phố' },
  { v: 'gan_san_bay',    l: 'Gần sân bay' },
];

const INTERNAL_FEATURES = [
  { v: 'ho_boi',       l: 'Hồ bơi' },
  { v: 'gym',          l: 'Gym / Fitness' },
  { v: 'thang_may',    l: 'Thang máy' },
  { v: 'bao_ve',       l: 'Bảo vệ 24/7' },
  { v: 'ham_xe',       l: 'Hầm để xe' },
  { v: 'san_vuon',     l: 'Sân vườn' },
  { v: 'san_thuong',   l: 'Sân thượng' },
  { v: 'camera',       l: 'Camera an ninh' },
  { v: 'dieu_hoa',     l: 'Điều hòa' },
  { v: 'may_giat',     l: 'Máy giặt' },
  { v: 'bep',          l: 'Bếp / bếp từ' },
  { v: 'wifi',         l: 'Internet / WiFi' },
  { v: 'tu_lanh',      l: 'Tủ lạnh' },
  { v: 'nong_lanh',    l: 'Nóng lạnh' },
  { v: 'ban_cong',     l: 'Ban công' },
  { v: 'cho_de_xe',    l: 'Chỗ để xe' },
];

const RENT_AMENITIES_EXTRA = [
  { v: 'toilet_rieng', l: 'Toilet riêng' },
  { v: 'pet_friendly', l: 'Pet friendly' },
];

const LEGAL_DOCS = [
  { value: 'so_do',              label: 'Sổ đỏ (GCNQSDĐ)' },
  { value: 'so_hong',            label: 'Sổ hồng' },
  { value: 'hop_dong',           label: 'HĐ mua bán' },
  { value: 'giay_to_hop_le',     label: 'Giấy tờ hợp lệ' },
  { value: 'khong_co_giay_to',   label: 'Không có GT' },
];

const DIRECTIONS = [
  { value: 'dong', label: 'Đông' }, { value: 'tay', label: 'Tây' },
  { value: 'nam', label: 'Nam' }, { value: 'bac', label: 'Bắc' },
  { value: 'dong_nam', label: 'Đông Nam' }, { value: 'dong_bac', label: 'Đông Bắc' },
  { value: 'tay_nam', label: 'Tây Nam' }, { value: 'tay_bac', label: 'Tây Bắc' },
];

function parseNum(v: string) { return Number(String(v).replace(/\D/g, '')) || 0; }
function moneyLabel(v: number) {
  if (!v) return '';
  if (v >= 1e9) return `${(v / 1e9).toFixed(2).replace(/\.?0+$/, '')} tỷ`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)} triệu`;
  return v.toLocaleString('vi-VN') + ' đ';
}

export default function PostListingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [listingMode, setListingMode] = useState<'ban'|'cho_thue'>('ban');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [propertyType, setPropertyType] = useState('nha_o');
  const [area, setArea] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  // Rental-specific
  const [priceUnit, setPriceUnit] = useState('thang');
  const [deposit, setDeposit] = useState('');
  const [furnished, setFurnished] = useState<'full'|'partial'|'none'>('none');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [legalDocs, setLegalDocs] = useState('so_do');
  // Shared amenities (both modes)
  const [surroundings, setSurroundings] = useState<string[]>([]);
  const [internalFeatures, setInternalFeatures] = useState<string[]>([]);
  // Images
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [videoUrl, setVideoUrl] = useState('');

  const toggleItem = (list: string[], setList: (v: string[]) => void, v: string) =>
    setList(list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

  const toggleAmenity = (a: string) =>
    setSelectedAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  const [direction, setDirection] = useState('nam');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [floors, setFloors] = useState('');
  const [facade, setFacade] = useState('');
  const [projectName, setProjectName] = useState('');
  const [isProject, setIsProject] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [location, setLocation] = useState<AddressResult | null>(null);


  const PROPERTY_TYPES = listingMode === 'ban' ? SALE_TYPES : RENT_TYPES;
  // Cadastral parcel info (auto-filled from map click, editable)
  const [soTo, setSoTo] = useState('');
  const [soThua, setSoThua] = useState('');
  const [dienTichThua, setDienTichThua] = useState('');

  // Auto-fill parcel when location changes
  const handleLocationChange = (r: AddressResult) => {
    setLocation(r);
    if (r.parcel) {
      if (r.parcel.soTo != null) setSoTo(String(r.parcel.soTo));
      if (r.parcel.soThua != null) setSoThua(String(r.parcel.soThua));
      if (r.parcel.dienTich != null) setDienTichThua(String(r.parcel.dienTich));
    }
  };

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login?callbackUrl=/post');
    if (session?.user) {
      setContactName((session.user as any).name || '');
      setContactEmail((session.user as any).email || '');
    }
  }, [status, session, router]);

  const price = parseNum(totalPrice);
  const areaNum = parseNum(area);
  const pricePerM2 = areaNum > 0 && price > 0 ? Math.round(price / areaNum) : 0;

  const validate = () => {
    if (!title.trim()) return 'Vui lòng nhập tiêu đề';
    if (areaNum <= 0) return 'Vui lòng nhập diện tích';
    if (price <= 0) return 'Vui lòng nhập giá';
    if (step === 3 && !contactName.trim()) return 'Vui lòng nhập tên liên hệ';
    if (step === 3 && !contactPhone.trim()) return 'Vui lòng nhập số điện thoại';
    return '';
  };

  const goNext = () => {
    const e = validate();
    if (e) { setError(e); return; }
    setError('');
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    const e = validate();
    if (e) { setError(e); return; }
    setSubmitting(true); setError('');
    try {
      const isRent = listingMode === 'cho_thue';
      const body = {
        title: title.trim(),
        description: description.trim(),
        listingMode,
        propertyType,
        area: areaNum,
        totalPrice: price,
        ...(isRent ? {
          priceUnit,
          deposit: parseNum(deposit),
          furnished,
          amenities: selectedAmenities,
        } : { legalDocs }),
        direction,
        address: location?.address || '',
        adminunit: {
          province: location?.province || '',
          district: location?.district || '',
          ward: location?.ward || '',
          provinceName: location?.provinceName || '',
          districtName: location?.districtName || '',
          wardName: location?.wardName || '',
        },
        coordinates: location ? [location.lng, location.lat] : [],
        projectName: isProject ? projectName.trim() : '',
        cadastral: {
          soTo: soTo ? Number(soTo) : null,
          soThua: soThua ? Number(soThua) : null,
          dienTichThua: dienTichThua ? parseFloat(dienTichThua) : null,
          loaiDat: location?.parcel?.loaiDat || null,
          loaiDatName: location?.parcel?.loaiDatName || null,
        },
        dynamicFields: [
          { _id: 'bedrooms',  value: parseNum(bedrooms) },
          { _id: 'bathrooms', value: parseNum(bathrooms) },
          { _id: 'floor',     value: parseNum(floors) },
          { _id: 'facade',    value: parseNum(facade) },
        ].filter(f => f.value > 0),
        contact: {
          name: contactName.trim(),
          phone: contactPhone.trim(),
          email: contactEmail.trim(),
        },
      };
      const res = await fetch('/api/user/post-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (j.success) {
        setSuccess('Đăng tin thành công! Tin đang chờ duyệt.');
        setTimeout(() => router.push('/manage-listings'), 2000);
      } else {
        setError(j.error || 'Lỗi đăng tin');
      }
    } catch {
      setError('Lỗi kết nối, vui lòng thử lại');
    } finally {
      setSubmitting(false);
    }
  };

  const STEPS = ['Thông tin cơ bản', 'Vị trí', 'Chi tiết', 'Tiện ích & Ảnh', 'Liên hệ'];

  return (
    <div className="min-h-dvh bg-slate-50 font-sans">
      <header className="bg-white border-b border-slate-200 py-3.5 px-5 sticky top-0 z-10">
        <div className="max-w-[760px] mx-auto flex items-center gap-4">
          <Link href="/profile" className="text-slate-500 no-underline text-[0.9rem] font-semibold transition-colors duration-200 hover:text-blue-600">← Hồ sơ</Link>
          <h1 className="text-[1.1rem] font-extrabold text-slate-800 m-0">{listingMode === 'ban' ? 'Đăng tin bán BĐS' : 'Đăng tin cho thuê BĐS'}</h1>
        </div>
      </header>
      {/* Mode toggle */}
      <div className="bg-white border-b-2 border-slate-200 px-5 flex max-w-full">
        <button className={`mode-btn ${listingMode==='ban'?'active':''}`} onClick={()=>{setListingMode('ban');setPropertyType('nha_o');}}>Bán bất động sản</button>
        <button className={`mode-btn ${listingMode==='cho_thue'?'active':''}`} onClick={()=>{setListingMode('cho_thue');setPropertyType('phong_tro');}}>Cho thuê</button>
      </div>

      {/* Step bar */}
      <div className="bg-white border-b border-slate-200 px-5">
        <div className="max-w-[760px] mx-auto flex">
          {STEPS.map((s, i) => (
            <div key={i} className={`step ${step > i + 1 ? 'done' : step === i + 1 ? 'active' : ''}`}
                 onClick={() => step > i + 1 && setStep(i + 1)} style={{ cursor: step > i + 1 ? 'pointer' : 'default' }}>
              <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[0.72rem] font-extrabold shrink-0 group-[.active]:bg-blue-600 group-[.active]:text-white group-[.done]:bg-green-600 group-[.done]:text-white group-[.done]:text-[0.85rem] bg-slate-200">{step > i + 1 ? <Check size={13} strokeWidth={2.5} /> : i + 1}</div>
              <span>{s}</span>
            </div>
          ))}
        </div>
      </div>

      <main className="max-w-[760px] mx-auto pt-6 px-5 pb-15">
        {success && <div className="py-[13px] px-4 rounded-xl text-[0.88rem] font-semibold mb-4 bg-green-50 text-green-600 border border-green-200">{success}</div>}
        {error && <div className="py-[13px] px-4 rounded-xl text-[0.88rem] font-semibold mb-4 bg-red-50 text-red-600 border border-red-200">{error}</div>}

        {/* ── Step 1: Basic info ── */}
        {step === 1 && (
          <div className="bg-white rounded-[20px] border border-slate-200 p-7">
            <h2 className="text-[1.05rem] font-extrabold text-slate-800 m-0 mb-1.5">Thông tin cơ bản</h2>

            <div className="mb-4.5 flex flex-col gap-1.5">
              <label className="text-[0.83rem] font-bold text-slate-700">Tiêu đề *</label>
              <input className="py-2.5 px-[13px] border-[1.5px] border-slate-200 rounded-lg text-[0.88rem] outline-none transition-colors duration-200 font-inherit focus:border-blue-300" placeholder="VD: Bán nhà phố Đống Đa 5 tầng sổ đỏ, giá tốt" value={title} onChange={e => setTitle(e.target.value)} maxLength={150} />
              <span className="text-[0.7rem] text-slate-400 text-right">{title.length}/150</span>
            </div>

            <div className="mb-4.5 flex flex-col gap-1.5">
              <label className="text-[0.83rem] font-bold text-slate-700">Loại bất động sản *</label>
              <div className="flex flex-wrap gap-[7px]">
                {PROPERTY_TYPES.map(t => (
                  <button key={t.value} type="button" className={`py-[7px] px-[13px] rounded-full border-[1.5px] border-slate-200 bg-white text-[0.78rem] font-semibold text-slate-600 cursor-pointer transition-all duration-150 ${propertyType === t.value ? '!bg-blue-600 !text-white !border-blue-600' : ''}`} onClick={() => setPropertyType(t.value)}>{t.label}</button>
                ))}
              </div>
            </div>

            {/* Project toggle */}
            <div className="mb-4.5 flex flex-col gap-1.5">
              <label className="flex items-center gap-2.5 cursor-pointer text-[0.85rem] font-semibold text-slate-700">
                <input type="checkbox" checked={isProject} onChange={e => setIsProject(e.target.checked)} className="hidden peer" />
                <span className="w-[38px] h-[22px] rounded-full bg-slate-200 relative transition-colors duration-200 shrink-0 peer-checked:bg-blue-600 after:content-[''] after:absolute after:w-[18px] after:h-[18px] after:rounded-full after:bg-white after:top-[2px] after:left-[2px] after:transition-all after:duration-200 after:shadow-[0_1px_3px_rgba(0,0,0,0.2)] peer-checked:after:left-[18px]" />
                <span>Bất động sản thuộc dự án</span>
              </label>
              {isProject && (
                <input className="py-2.5 px-[13px] border-[1.5px] border-slate-200 rounded-lg text-[0.88rem] outline-none transition-colors duration-200 font-inherit focus:border-blue-300" style={{ marginTop: 10 }} placeholder="Tên dự án (VD: Vinhomes Ocean Park, Times City...)" value={projectName} onChange={e => setProjectName(e.target.value)} />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="mb-4.5 flex flex-col gap-1.5">
                <label className="text-[0.83rem] font-bold text-slate-700">Diện tích (m²) *</label>
                <input className="py-2.5 px-[13px] border-[1.5px] border-slate-200 rounded-lg text-[0.88rem] outline-none transition-colors duration-200 font-inherit focus:border-blue-300" placeholder="50" value={area} onChange={e => setArea(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
              </div>
              <div className="mb-4.5 flex flex-col gap-1.5">
                <label className="text-[0.83rem] font-bold text-slate-700">{listingMode==='ban' ? 'Giá bán (VNĐ) *' : 'Giá thuê *'}</label>
                <div style={{display:'flex',gap:8}}>
                  <input className="py-2.5 px-[13px] border-[1.5px] border-slate-200 rounded-lg text-[0.88rem] outline-none transition-colors duration-200 font-inherit focus:border-blue-300" style={{flex:1}}
                    placeholder={listingMode==='ban' ? '8,000,000,000' : '5,000,000'}
                    value={price > 0 ? price.toLocaleString('vi-VN') : ''}
                    onChange={e => setTotalPrice(String(parseNum(e.target.value)))}
                    inputMode="numeric"
                  />
                  {listingMode==='cho_thue' && (
                    <select className="py-2.5 px-[13px] border-[1.5px] border-slate-200 rounded-lg text-[0.88rem] outline-none transition-colors duration-200 font-inherit focus:border-blue-300" style={{width:110,flexShrink:0}} value={priceUnit} onChange={e=>setPriceUnit(e.target.value)}>
                      {PRICE_UNITS.map(u=><option key={u.value} value={u.value}>{u.label}</option>)}
                    </select>
                  )}
                </div>
                {price > 0 && <span className="text-[0.75rem] text-blue-600 font-semibold">{moneyLabel(price)}{listingMode==='ban' && pricePerM2 > 0 ? ` · ${moneyLabel(pricePerM2)}/m²` : ''}</span>}
              </div>
            </div>
            {listingMode==='cho_thue' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="mb-4.5 flex flex-col gap-1.5">
                  <label className="text-[0.83rem] font-bold text-slate-700">Tiền cọc</label>
                  <input className="py-2.5 px-[13px] border-[1.5px] border-slate-200 rounded-lg text-[0.88rem] outline-none transition-colors duration-200 font-inherit focus:border-blue-300" placeholder="VD: 2 tháng tiền cọc" value={deposit} onChange={e=>setDeposit(e.target.value.replace(/\D/g,''))} inputMode="numeric" />
                  {parseNum(deposit)>0 && <span className="text-[0.75rem] text-blue-600 font-semibold">{moneyLabel(parseNum(deposit))}</span>}
                </div>
                <div className="mb-4.5 flex flex-col gap-1.5">
                  <label className="text-[0.83rem] font-bold text-slate-700">Tình trạng nội thất</label>
                  <div className="flex flex-wrap gap-[7px]">
                    {[{v:'full',l:'Đầy đủ'},{v:'partial',l:'Cơ bản'},{v:'none',l:'Không có'}].map(f=>(
                      <button key={f.v} type="button" className={`chip ${furnished===f.v?'active':''}`} onClick={()=>setFurnished(f.v as any)}>{f.l}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="mb-4.5 flex flex-col gap-1.5">
              <label className="text-[0.83rem] font-bold text-slate-700">Mô tả chi tiết</label>
              <textarea className="py-2.5 px-[13px] border-[1.5px] border-slate-200 rounded-lg text-[0.88rem] outline-none resize-y font-inherit leading-relaxed transition-colors duration-200 focus:border-blue-300" placeholder="Mô tả vị trí, tiện ích, tình trạng pháp lý, ưu điểm nổi bật..." value={description} onChange={e => setDescription(e.target.value)} rows={5} maxLength={5000} />
              <span className="text-[0.7rem] text-slate-400 text-right">{description.length}/5000</span>
            </div>

            <div className="flex justify-between gap-3 mt-2">
              <button className="py-2.5 px-6 rounded-lg border-none bg-blue-600 text-[0.88rem] font-bold text-white cursor-pointer ml-auto hover:bg-blue-700" onClick={goNext}>Tiếp theo →</button>
            </div>
          </div>
        )}

        {/* ── Step 2: Location + Details ── */}
        {step === 2 && (
          <div className="bg-white rounded-[20px] border border-slate-200 p-7">
            <h2 className="text-[1.05rem] font-extrabold text-slate-800 m-0 mb-1.5">Vị trí bất động sản</h2>
            <p className="text-[0.82rem] text-slate-500 m-0 mb-5">Tìm kiếm địa chỉ hoặc <strong>click trực tiếp lên bản đồ</strong> để xác định vị trí và tự động tra thông tin thửa đất</p>

            <div className="mb-4.5 flex flex-col gap-1.5">
              <AddressPickerMap value={location} onChange={handleLocationChange} />
              {!location && <span className="text-[0.75rem] text-amber-600 font-semibold">Chưa xác định vị trí — tin sẽ không hiển thị trên bản đồ</span>}
            </div>

            {/* Parcel fields — auto-filled but editable */}
            <div className="bg-slate-50 border-[1.5px] border-slate-200 rounded-xl p-4 mb-4">
              <div className="text-[0.88rem] font-extrabold text-slate-800 mb-3.5">Thông tin thửa đất <span className="text-[0.75rem] text-slate-400 font-medium ml-1.5">(tự động điền, có thể chỉnh sửa)</span></div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                <div className="mb-4.5 flex flex-col gap-1.5">
                  <label className="text-[0.83rem] font-bold text-slate-700">Số tờ (tờ bản đồ)</label>
                  <input className="py-2.5 px-[13px] border-[1.5px] border-slate-200 rounded-lg text-[0.88rem] outline-none transition-colors duration-200 font-inherit focus:border-blue-300" placeholder="VD: 34" value={soTo} onChange={e => setSoTo(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
                </div>
                <div className="mb-4.5 flex flex-col gap-1.5">
                  <label className="text-[0.83rem] font-bold text-slate-700">Số thửa</label>
                  <input className="py-2.5 px-[13px] border-[1.5px] border-slate-200 rounded-lg text-[0.88rem] outline-none transition-colors duration-200 font-inherit focus:border-blue-300" placeholder="VD: 56" value={soThua} onChange={e => setSoThua(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
                </div>
                <div className="mb-4.5 flex flex-col gap-1.5">
                  <label className="text-[0.83rem] font-bold text-slate-700">Diện tích thửa (m²)</label>
                  <input className="py-2.5 px-[13px] border-[1.5px] border-slate-200 rounded-lg text-[0.88rem] outline-none transition-colors duration-200 font-inherit focus:border-blue-300" placeholder="VD: 45.5" value={dienTichThua} onChange={e => setDienTichThua(e.target.value)} inputMode="decimal" />
                </div>
              </div>
              {location?.parcel?.loaiDatName && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg py-2 px-3 mt-2.5 text-[0.82rem]">
                  <strong>Loại đất:</strong>
                  <span style={{ color: '#2563eb' }}>{location.parcel.loaiDat} — {location.parcel.loaiDatName}</span>
                </div>
              )}
            </div>

            {/* Parsed location tags */}
            {location && (
              <div className="flex flex-wrap gap-[7px] mb-1">
                {location.provinceName && <span className="bg-green-50 text-green-600 border border-green-200 rounded-full py-1 px-[11px] text-[0.75rem] font-semibold">{location.provinceName}</span>}
                {location.districtName && <span className="bg-green-50 text-green-600 border border-green-200 rounded-full py-1 px-[11px] text-[0.75rem] font-semibold">{location.districtName}</span>}
                {location.wardName && <span className="bg-green-50 text-green-600 border border-green-200 rounded-full py-1 px-[11px] text-[0.75rem] font-semibold">{location.wardName}</span>}
                <span className="bg-blue-50 text-blue-600 border border-blue-200 rounded-full py-1 px-[11px] text-[0.75rem] font-semibold">{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</span>
              </div>
            )}

            <hr className="border-none border-t border-slate-100 my-6" />
            <h2 className="text-[1.05rem] font-extrabold text-slate-800 m-0 mb-1.5">Chi tiết</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="mb-4.5 flex flex-col gap-1.5"><label className="text-[0.83rem] font-bold text-slate-700">Số phòng ngủ</label><input className="py-2.5 px-[13px] border-[1.5px] border-slate-200 rounded-lg text-[0.88rem] outline-none transition-colors duration-200 font-inherit focus:border-blue-300" placeholder="0" value={bedrooms} onChange={e => setBedrooms(e.target.value.replace(/\D/g, ''))} inputMode="numeric" /></div>
              <div className="mb-4.5 flex flex-col gap-1.5"><label className="text-[0.83rem] font-bold text-slate-700">Số WC</label><input className="py-2.5 px-[13px] border-[1.5px] border-slate-200 rounded-lg text-[0.88rem] outline-none transition-colors duration-200 font-inherit focus:border-blue-300" placeholder="0" value={bathrooms} onChange={e => setBathrooms(e.target.value.replace(/\D/g, ''))} inputMode="numeric" /></div>
              <div className="mb-4.5 flex flex-col gap-1.5"><label className="text-[0.83rem] font-bold text-slate-700">Số tầng</label><input className="py-2.5 px-[13px] border-[1.5px] border-slate-200 rounded-lg text-[0.88rem] outline-none transition-colors duration-200 font-inherit focus:border-blue-300" placeholder="0" value={floors} onChange={e => setFloors(e.target.value.replace(/\D/g, ''))} inputMode="numeric" /></div>
              <div className="mb-4.5 flex flex-col gap-1.5"><label className="text-[0.83rem] font-bold text-slate-700">Mặt tiền (m)</label><input className="py-2.5 px-[13px] border-[1.5px] border-slate-200 rounded-lg text-[0.88rem] outline-none transition-colors duration-200 font-inherit focus:border-blue-300" placeholder="0" value={facade} onChange={e => setFacade(e.target.value.replace(/\D/g, ''))} inputMode="numeric" /></div>
            </div>

            {listingMode==='cho_thue' && (
              <div className="mb-4.5 flex flex-col gap-1.5">
                <label className="text-[0.83rem] font-bold text-slate-700">Tiện ích đi kèm</label>
                <div className="flex flex-wrap gap-[7px]">
                  {[...INTERNAL_FEATURES, ...RENT_AMENITIES_EXTRA].map(a=>(
                    <button key={a.v} type="button" className={`chip ${selectedAmenities.includes(a.v)?'active':''}`} onClick={()=>toggleAmenity(a.v)}>{a.l}</button>
                  ))}
                </div>
              </div>
            )}

            {listingMode==='ban' && (
              <div className="mb-4.5 flex flex-col gap-1.5">
                <label className="text-[0.83rem] font-bold text-slate-700">Pháp lý</label>
                <div className="flex flex-wrap gap-[7px]">
                  {LEGAL_DOCS.map(d => (
                    <label key={d.value} className={`chip ${legalDocs === d.value ? 'active' : ''}`}>
                      <input type="radio" name="legal" value={d.value} checked={legalDocs === d.value} onChange={e => setLegalDocs(e.target.value)} hidden />
                      {d.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4.5 flex flex-col gap-1.5">
              <label className="text-[0.83rem] font-bold text-slate-700">Hướng nhà</label>
              <div className="flex flex-wrap gap-[7px]">
                {DIRECTIONS.map(d => (
                  <label key={d.value} className={`chip ${direction === d.value ? 'active' : ''}`}>
                    <input type="radio" name="dir" value={d.value} checked={direction === d.value} onChange={e => setDirection(e.target.value)} hidden />
                    {d.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-between gap-3 mt-2">
              <button className="py-2.5 px-5 rounded-lg border-[1.5px] border-slate-200 bg-white text-[0.88rem] font-bold text-slate-500 cursor-pointer hover:border-slate-400" onClick={() => setStep(1)}>← Quay lại</button>
              <button className="py-2.5 px-6 rounded-lg border-none bg-blue-600 text-[0.88rem] font-bold text-white cursor-pointer ml-auto hover:bg-blue-700" onClick={goNext}>Tiếp theo →</button>
            </div>
          </div>
        )}

        {/* ── Step 3: Contact + Submit ── */}
        {step === 3 && (
          <div className="bg-white rounded-[20px] border border-slate-200 p-7">
            <h2 className="text-[1.05rem] font-extrabold text-slate-800 m-0 mb-1.5">Thông tin liên hệ</h2>

            <div className="mb-4.5 flex flex-col gap-1.5">
              <label className="text-[0.83rem] font-bold text-slate-700">Tên người liên hệ *</label>
              <input className="py-2.5 px-[13px] border-[1.5px] border-slate-200 rounded-lg text-[0.88rem] outline-none transition-colors duration-200 font-inherit focus:border-blue-300" placeholder="Họ tên đầy đủ" value={contactName} onChange={e => setContactName(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="mb-4.5 flex flex-col gap-1.5">
                <label className="text-[0.83rem] font-bold text-slate-700">Số điện thoại *</label>
                <input className="py-2.5 px-[13px] border-[1.5px] border-slate-200 rounded-lg text-[0.88rem] outline-none transition-colors duration-200 font-inherit focus:border-blue-300" placeholder="09xxxxxxxx" value={contactPhone} onChange={e => setContactPhone(e.target.value)} inputMode="tel" />
              </div>
              <div className="mb-4.5 flex flex-col gap-1.5">
                <label className="text-[0.83rem] font-bold text-slate-700">Email</label>
                <input className="py-2.5 px-[13px] border-[1.5px] border-slate-200 rounded-lg text-[0.88rem] outline-none transition-colors duration-200 font-inherit focus:border-blue-300" placeholder="email@example.com" value={contactEmail} onChange={e => setContactEmail(e.target.value)} type="email" />
              </div>
            </div>

            {/* Summary */}
            <div className="bg-slate-50 rounded-xl p-4.5 mb-4 border border-slate-200">
              <h3 className="text-[0.9rem] font-extrabold text-slate-800 m-0 mb-3">Tóm tắt</h3>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-[0.82rem] gap-3"><span className="text-slate-500 shrink-0">Hình thức</span><strong className="text-right" style={{color:listingMode==='ban'?'#2563eb':'#16a34a'}}>{listingMode==='ban'?'Bán':'Cho thuê'}</strong></div>
                <div className="flex justify-between text-[0.82rem] gap-3"><span className="text-slate-500 shrink-0">Tiêu đề</span><strong className="text-slate-800 text-right">{title || '—'}</strong></div>
                <div className="flex justify-between text-[0.82rem] gap-3"><span className="text-slate-500 shrink-0">Loại</span><strong className="text-slate-800 text-right">{PROPERTY_TYPES.find(t => t.value === propertyType)?.label}</strong></div>
                {isProject && projectName && <div className="flex justify-between text-[0.82rem] gap-3"><span className="text-slate-500 shrink-0">Dự án</span><strong className="text-slate-800 text-right">{projectName}</strong></div>}
                <div className="flex justify-between text-[0.82rem] gap-3"><span className="text-slate-500 shrink-0">Diện tích</span><strong className="text-slate-800 text-right">{areaNum > 0 ? `${areaNum} m²` : '—'}</strong></div>
                <div className="flex justify-between text-[0.82rem] gap-3"><span className="text-slate-500 shrink-0">{listingMode==='ban'?'Giá bán':'Giá thuê'}</span><strong className="text-right" style={{color:'#dc2626'}}>{price > 0 ? `${moneyLabel(price)}${listingMode==='cho_thue'?'/'+priceUnit:''}` : '—'}</strong></div>
                {listingMode==='cho_thue' && parseNum(deposit)>0 && <div className="flex justify-between text-[0.82rem] gap-3"><span className="text-slate-500 shrink-0">Tiền cọc</span><strong className="text-slate-800 text-right">{moneyLabel(parseNum(deposit))}</strong></div>}
                {listingMode==='cho_thue' && selectedAmenities.length>0 && <div className="flex justify-between text-[0.82rem] gap-3"><span className="text-slate-500 shrink-0">Tiện ích</span><strong className="text-slate-800 text-right">{selectedAmenities.slice(0,3).join(', ')}{selectedAmenities.length>3?'...':''}</strong></div>}
                {location && <div className="flex justify-between text-[0.82rem] gap-3"><span className="text-slate-500 shrink-0">Vị trí</span><strong className="text-slate-800 text-right">{location.wardName ? `${location.wardName}, ${location.districtName}` : location.address}</strong></div>}
              </div>
            </div>

            <p className="text-[0.77rem] text-slate-400 leading-relaxed mb-4">Khi đăng tin, bạn đồng ý với <Link href="/terms" className="text-blue-600 no-underline hover:underline">Điều khoản</Link> của NhaDat.City. Tin sẽ được kiểm duyệt trước khi hiển thị.</p>

            <div className="flex justify-between gap-3 mt-2">
              <button className="py-2.5 px-5 rounded-lg border-[1.5px] border-slate-200 bg-white text-[0.88rem] font-bold text-slate-500 cursor-pointer hover:border-slate-400" onClick={() => setStep(2)}>← Quay lại</button>
              <button className="py-3 px-[30px] rounded-xl border-none bg-gradient-to-br from-blue-600 to-purple-600 text-[0.95rem] font-extrabold text-white cursor-pointer shadow-[0_4px_16px_rgba(37,99,235,0.3)] hover:not(:disabled):opacity-90 disabled:opacity-60 disabled:cursor-not-allowed" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Đang đăng...' : 'Đăng tin ngay'}
              </button>
            </div>
          </div>
        )}
      </main>

      
    </div>
  );
}
