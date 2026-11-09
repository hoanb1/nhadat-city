/**
 * Mapping loại đất codes (Vietnamese land type) to human-readable names.
 * Source: Luật đất đai Việt Nam — used by parcel-info API and chat context.
 */
export const LOAI_DAT: Record<string, string> = {
  ODT: 'Đất ở đô thị',
  ONT: 'Đất ở nông thôn',
  CLN: 'Đất cây lâu năm',
  LUC: 'Đất lúa nước còn lại',
  LUA: 'Đất chuyên trồng lúa nước',
  BHK: 'Đất bằng trồng cây hàng năm khác',
  NKH: 'Đất nương rẫy trồng cây hàng năm',
  RSX: 'Đất rừng sản xuất',
  RPH: 'Đất rừng phòng hộ',
  RDD: 'Đất rừng đặc dụng',
  NTS: 'Đất nuôi trồng thủy sản',
  LMU: 'Đất làm muối',
  NCC: 'Đất nông nghiệp khác',
  TSC: 'Đất trụ sở cơ quan',
  DTS: 'Đất công trình sự nghiệp',
  CQP: 'Đất quốc phòng',
  CAN: 'Đất an ninh',
  SKK: 'Đất khu công nghiệp',
  SKT: 'Đất khu chế xuất',
  SKN: 'Đất cụm công nghiệp',
  TMD: 'Đất thương mại, dịch vụ',
  SKC: 'Đất cơ sở sản xuất phi nông nghiệp',
  SKS: 'Đất sử dụng cho hoạt động khoáng sản',
  SKX: 'Đất sản xuất vật liệu xây dựng, gốm sứ',
  DRA: 'Đất di tích lịch sử - văn hóa',
  DSH: 'Đất sinh hoạt cộng đồng',
  DKV: 'Đất khu vui chơi, giải trí công cộng',
  CSD: 'Đất cơ sở tôn giáo',
  LDG: 'Đất tín ngưỡng',
  NTD: 'Đất nghĩa trang, nghĩa địa',
  BCS: 'Đất có mặt nước chuyên dùng',
  PNK: 'Đất phi nông nghiệp khác',
  SON: 'Đất sông, suối',
  MNC: 'Đất có mặt nước ven biển',
  DCS: 'Đất chưa sử dụng',
  CSD_DAT_CHUA_SU_DUNG: 'Đất chưa sử dụng',
  DGT: 'Đất giao thông',
  DGD: 'Đất xây dựng cơ sở giáo dục và đào tạo',
  DTT: 'Đất xây dựng cơ sở thể dục thể thao',
  DVH: 'Đất xây dựng cơ sở văn hóa',
  DDT: 'Đất bãi thải, xử lý chất thải',
  TON: 'Đất cơ sở tôn giáo',
  TIN: 'Đất cơ sở tín ngưỡng',
  DYT: 'Đất y tế',
  DNL: 'Đất công trình năng lượng',
  DBV: 'Đất bưu chính viễn thông',
  DXH: 'Đất cơ sở dịch vụ xã hội',
  DCH: 'Đất chợ',
  DKH: 'Đất khoa học công nghệ',
  DSN: 'Đất di tích danh lam thắng cảnh',
  DNG: 'Đất ngoại giao',
};

export const LOAI_DAT_COLOR: Record<string, string> = {
  ODT: '#ff5c5c', // Đất ở đô thị - Hồng sẫm/Đỏ nhạt cao cấp
  ONT: '#ffa3a3', // Đất ở nông thôn - Hồng phấn mềm mại
  CLN: '#d2f5b0', // Đất cây lâu năm - Xanh lá mạ
  LUC: '#fef08a', // Đất lúa nước còn lại - Vàng chanh
  LUA: '#fde047', // Đất chuyên trồng lúa nước - Vàng đậm
  BHK: '#fef9c3', // Đất bằng trồng cây hàng năm khác - Vàng nhạt
  NKH: '#f5f5dc', // Đất nương rẫy trồng cây hàng năm - Vàng kem
  RSX: '#86efac', // Đất rừng sản xuất - Xanh lá nhạt
  RPH: '#34d399', // Đất rừng phòng hộ - Xanh lá trung bình
  RDD: '#059669', // Đất rừng đặc dụng - Xanh lá đậm
  NTS: '#7dd3fc', // Đất nuôi trồng thủy sản - Xanh dương nhạt
  LMU: '#e2e8f0', // Đất làm muối - Xám sáng
  NCC: '#dcfce7', // Đất nông nghiệp khác - Xanh lá mạ cực nhạt
  TSC: '#93c5fd', // Đất trụ sở cơ quan - Xanh biển
  DTS: '#a7f3d0', // Đất công trình sự nghiệp - Xanh ngọc
  CQP: '#b91c1c', // Đất quốc phòng - Đỏ sẫm
  CAN: '#dc2626', // Đất an ninh - Đỏ tươi
  SKK: '#c084fc', // Đất khu công nghiệp - Tím
  SKT: '#e9d5ff', // Đất khu chế xuất - Tím nhạt
  SKN: '#d8b4fe', // Đất cụm công nghiệp - Tím vừa
  TMD: '#f97316', // Đất thương mại, dịch vụ - Cam
  SKC: '#f472b6', // Đất cơ sở sản xuất phi nông nghiệp - Hồng sẫm
  SKS: '#a8a29e', // Đất sử dụng cho hoạt động khoáng sản - Xám nâu
  SKX: '#b45309', // Đất sản xuất vật liệu xây dựng - Nâu đỏ
  DRA: '#d97706', // Đất di tích lịch sử - Vàng đất
  DSH: '#38bdf8', // Đất sinh hoạt cộng đồng - Xanh da trời
  DKV: '#4ade80', // Đất khu vui chơi, giải trí công cộng - Xanh lá công viên tươi tắn
  CSD: '#fbbf24', // Đất cơ sở tôn giáo - Vàng nghệ
  LDG: '#f59e0b', // Đất tín ngưỡng - Vàng cam
  NTD: '#78716c', // Đất nghĩa trang, nghĩa địa - Xám đất
  BCS: '#bae6fd', // Đất có mặt nước chuyên dùng - Xanh nhạt
  PNK: '#cbd5e1', // Đất phi nông nghiệp khác - Xám xanh
  SON: '#60a5fa', // Đất sông, suối - Xanh nước biển
  MNC: '#38bdf8', // Đất có mặt nước ven biển - Xanh biển nhạt
  DCS: '#f3f4f6', // Đất chưa sử dụng - Xám nhạt
  CSD_DAT_CHUA_SU_DUNG: '#f3f4f6',
  DGT: '#e2e8f0', // Đất giao thông - Xám sáng/Slate nhạt hiện đại (thay thế màu hồng cũ gây rối bản đồ)
  DGD: '#c7d2fe', // Đất giáo dục - Xanh tím/Periwinkle nhã nhặn (để không bị lẫn với đất ở)
  DTT: '#99f6e4', // Đất thể thao - Xanh ngọc nhạt
  DVH: '#e9d5ff', // Đất văn hóa - Tím nhạt
  DDT: '#cbd5e1', // Đất xử lý chất thải/Hạ tầng kỹ thuật - Xám trung tính
  TON: '#fbbf24', // Đất tôn giáo - Vàng nghệ
  TIN: '#f59e0b', // Đất tín ngưỡng - Vàng cam
  DYT: '#fca5a5', // Đất y tế - Đỏ hồng nhạt/chữ thập đỏ dịu mắt
  DNL: '#fdba74', // Đất công trình năng lượng - Cam nhạt
  DBV: '#fed7aa', // Đất bưu chính viễn thông - Cam sữa
  DXH: '#ffedd5', // Đất dịch vụ xã hội - Cam cực nhạt
  DCH: '#fed7aa', // Đất chợ - Cam sữa
  DKH: '#ddd6fe', // Đất khoa học công nghệ - Tím xanh nhạt
  DSN: '#a7f3d0', // Đất danh lam thắng cảnh - Xanh mạ nhạt
  DNG: '#fef08a', // Đất ngoại giao - Vàng nhạt
};

/** Resolve a loai_dat code to its full Vietnamese name, falling back to the raw code. */
export function getLandTypeName(code: string): string {
  return LOAI_DAT[code] ?? code;
}

/** Resolve a loai_dat code to its HEX color. */
export function getLandTypeColor(code: string): string {
  return LOAI_DAT_COLOR[code] ?? '#cbd5e1';
}

/** Remove Vietnamese accents and convert Đ/đ to D/d */
export function removeAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Đ/g, 'D')
    .replace(/đ/g, 'd');
}

/**
 * Dynamic mapping from various custom attributes (descriptions, CAD layer names, numeric IDs)
 * to standard 3-letter land use codes. Used as the Single Source of Truth (SSOT)
 * for both fill colors and text labels.
 */
export const CUSTOM_LAND_TYPE_MAPPING: Record<string, string> = {
  // Hanoi phan khu numeric ids (converted to string)
  '1': 'DTS', // Đất Trường học -> DTS
  '2': 'TMD', // Đất Công cộng -> TMD
  '3': 'DTS', // Đất trường học / trung học phổ thông -> DTS
  '4': 'SKK', // Đất XD Công trình Hỗn hợp cao tầng -> SKK
  '5': 'DTS', // Đất mầm non / nhà trẻ -> DTS
  '6': 'DKV', // Đất cây xanh đơn vị ở -> DKV
  '7': 'DKV', // Đất cây xanh, TDTT -> DKV
  '8': 'ONT', // Đất làng xóm, dân cư hiện có / Đất ở hiện trạng -> ONT
  '9': 'ODT', // Đất nhóm nhà ở hiện có / cải tạo -> ODT
  '10': 'ODT', // Đất nhóm nhà ở xây dựng mới -> ODT
  '11': 'TSC', // Đất cơ quan, viện nghiên cứu, trường đào tạo -> TSC
  '12': 'CSD', // Đất di tích, tôn giáo - tín ngưỡng -> CSD
  '13': 'CAN', // Đất quốc phòng - an ninh -> CAN
  '14': 'SKK', // Đất công nghiệp / tiểu thủ công nghiệp -> SKK
  '15': 'SKC', // Đất kho tàng -> SKC
  '16': 'SKK', // Đất công nghiệp, kho tàng -> SKK
  '17': 'SON', // Đất sông, hồ, mặt nước -> SON
  '18': 'DDT', // Đất đầu mối hạ tầng kỹ thuật -> DDT
  '19': 'DGT', // Đất bãi đỗ xe -> DGT
  '20': 'DGT', // Đất giao thông -> DGT
  '21': 'DGT', // Đất giao thông tĩnh -> DGT
  '22': 'NTD', // Đất nghĩa trang -> NTD
  '76': 'NCC', // Đất nông nghiệp -> NCC
  '77': 'DKV', // Đất cây xanh cách ly / cây xanh chuyên dùng -> DKV
  '100': 'DGT', // Đất giao thông -> DGT
  '92': 'ODT', // Đất ở thấp tầng -> ODT

  // New numeric mappings extracted directly from GeoServer WFS database for Hanoi
  '23': 'NTS', // Đất Nuôi trồng Thủy sản -> NTS
  '24': 'TMD', // Đất hỗ trợ dịch vụ, sản xuất, làng nghề -> TMD
  '25': 'TMD', // Đất Du lịch -> TMD
  '26': 'DCS', // Đất chưa sử dụng -> DCS
  '27': 'DCS', // Đất dự trữ phát triển -> DCS
  '28': 'DGD', // Đất Giáo dục, Đào tạo -> DGD
  '29': 'SKX', // Đất sản xuất vật liệu xây dựng -> SKX
  '30': 'DRA', // Đất Di tích -> DRA
  '31': 'TSC', // Đất Cơ quan Trung ương Đảng -> TSC
  '32': 'TSC', // Đất Cơ quan Quốc hội -> TSC
  '33': 'TSC', // Đất Cơ quan Văn phòng Chủ tịch nước -> TSC
  '34': 'TSC', // Đất Cơ quan Văn phòng Chính phủ -> TSC
  '35': 'TSC', // Đất phục vụ chung cho Khu Trung tâm -> TSC
  '36': 'TSC', // Đất Ủy ban Trung ương... -> TSC
  '51': 'SKK', // Đất cụm đổi mới, Dịch vụ sản xuất -> SKK
  '52': 'SKK', // Đất Trung tâm cụm xã -> SKK
  '53': 'SKK', // Đất phát triển kinh tế địa phương -> SKK
  '61': 'SKK', // Đất Công ty -> SKK
  '62': 'DCS', // Đất bãi bồi -> DCS
  '63': 'SON', // Vùng thoát lũ sông Đáy -> SON
  '69': 'CLN', // Đất trồng cây cảnh -> CLN
  '70': 'BHK', // Đất trồng cây hoa màu -> BHK
  '71': 'NCC', // Đất Trang trại -> NCC
  '72': 'CLN', // Đất trồng cây ăn quả -> CLN
  '73': 'NCC', // Đất trồng rau an toàn -> NCC
  '74': 'NCC', // Đất Chăn nuôi, Nông nghiệp -> NCC
  '75': 'RSX', // Đất Lâm nghiệp -> RSX
  '78': 'DKV', // Đất cây xanh chuyên dùng -> DKV
  '79': 'DKV', // Đất cây xanh chuyên đề -> DKV
  '81': 'ONT', // Đất ở làng xóm, Dân cư xây dựng mới -> ONT
  '82': 'ODT', // Đất ở sinh thái -> ODT
  '83': 'ODT', // Đất Đô thị Sinh thái -> ODT
  '90': 'ONT', // Đất Nhóm nhà ở hiện có - Kiểm soát đặc biệt -> ONT
  '91': 'ODT', // Đất nhóm nhà ở - thuộc QH cải tạo -> ODT
  '93': 'ODT', // Đất ở cao tầng -> ODT
  '94': 'TMD', // Đất Trung tâm Triển lãm -> TMD
  '95': 'ODT', // Đất ở đô thị -> ODT
  '96': 'ODT', // Đất Di dân, giãn dân -> ODT
  '97': 'SKK', // Đất hỗn hợp -> SKK
  '99': 'SKK', // Đất khu Công nghệ cao -> SKK

  // Vietnamese descriptions (uppercase)
  'ĐẤT NÔNG NGHIỆP': 'NCC',
  'ĐẤT AN NINH, QUỐC PHÒNG': 'CAN',
  'ĐẤT CÂY XANH, CÔNG VIÊN, VƯỜN HOA': 'DKV',
  'ĐẤT CÂY XANH': 'DKV',
  'CÂY XANH': 'DKV',
  'CÔNG VIÊN': 'DKV',
  'VƯỜN HOA': 'DKV',
  'ĐẤT TRƯỜNG HỌC': 'DTS',
  'TRƯỜNG HỌC': 'DTS',
  'ĐẤT MẶT NƯỚC, SÔNG, AO, HỒ': 'SON',
  'ĐẤT MẶT NƯỚC': 'SON',
  'SÔNG': 'SON',
  'SUỐI': 'SON',
  'AO': 'SON',
  'HỒ': 'SON',
  'ĐẤT CÔNG CỘNG': 'TMD',
  'CÔNG CỘNG': 'TMD',
  'ĐẤT LÀNG XÓM, DÂN CƯ HIỆN CÓ': 'ONT',
  'ĐẤT LÀNG XÓM': 'ONT',
  'DÂN CƯ HIỆN CÓ': 'ONT',
  'DÂN CƯ HIỆN CO': 'ONT',
  'DÂN CƯ HIỆN HỮU': 'ONT',
  'DÂN CƯ ĐÔ THỊ': 'ODT',
  'ĐẤT Ở THẤP TẦNG': 'ODT',
  'ĐẤT Ở CAO TẦNG': 'ODT',
  'ĐẤT Ở HỖN HỢP': 'SKK',
  'ĐẤT HỖN HỢP': 'SKK',
  'ĐẤT KHU CÔNG NGHIỆP': 'SKK',
  'ĐẤT CÔNG TRÌNH SỰ NGHIỆP': 'DTS',
  'ĐẤT DI TÍCH LỊCH SỬ - VĂN HÓA': 'DRA',
  'ĐẤT TÔN GIÁO, TÍN NGƯỠNG': 'CSD',
  'ĐẤT DI TÍCH, TÔN GIÁO - TÍN NGƯỠNG': 'CSD',
  'ĐẤT CÂY XANH, TDTT': 'DKV',
  'ĐẤT ĐẦU MỐI HẠ TẦNG KỸ THUẬT': 'DDT',
  'ĐẤT GIAO THÔNG TĨNH': 'DGT',
  'ĐẤT CÔNG CỘNG ĐƠN VỊ Ở': 'TMD',
  'ĐẤT CÔNG CỘNG KHU VỰC': 'TMD',
  'ĐẤT CÔNG CỘNG THÀNH PHỐ': 'TMD',
  'ĐẤT MẦM NON, NHÀ TRẺ': 'DTS',
  'ĐẤT MẦM NON / NHÀ TRẺ': 'DTS',
  'ĐẤT NHÀ TRẺ': 'DTS',
  'ĐẤT Ở HIỆN TRẠNG': 'ONT',
  'ĐẤT Ở CẢI TẠO': 'ODT',
  'ĐẤT Ở XÂY DỰNG MỚI': 'ODT',
  'ĐẤT NGHĨA TRANG': 'NTD',
  'NGHĨA TRANG': 'NTD',
  'ĐẤT XD CÔNG TRÌNH HỖN HỢP CAO TẦNG': 'SKK',
  'HỖN HỢP CAO TẦNG': 'SKK',
  'HỖN HỢP': 'SKK',
  'DU LỊCH SINH THÁI': 'DKV',
  'KHO TÀNG': 'SKC',

  // Hanoi phan khu long text descriptions -> standard codes
  'ĐẤT Ở LÀNG XÓM, DÂN CƯ XÂY DỰNG MỚI': 'ONT',
  'ĐẤT CÔNG TRÌNH ĐẦU MỐI HẠ TẦNG KỸ THUẬT': 'DDT',
  'ĐẤT DI DÂN, GIÃN DÂN, CHUYỂN ĐỔI NGHỀ,… (ĐẤT DÀNH CHO ĐỊA PHƯƠNG)': 'ODT',
  'ĐẤT CÂY XANH CHUYÊN DÙNG (TRỒNG HOA, NÔNG NGHIỆP CÔNG NGHỆ CAO)': 'DKV',
  'ĐẤT TRỒNG CÂY HOA MÀU': 'BHK',
  'ĐẤT DỰ TRỮ PHÁT TRIỂN': 'DCS',
  'ĐẤT NHÓM NHÀ Ở - THUỘC QH CẢI TẠO, XD LẠI KHU TT, CHUNG CƯ CŨ - THỰC HIỆN THEO DỰ ÁN RIÊNG': 'ODT',
  'ĐẤT TRỒNG CÂY ĂN QUẢ': 'CLN',
  'ĐẤT HỖT TRỢ TRUNG TÂM DỊCH VỤ, SẢN XUẤT, LÀNG NGHỀ': 'TMD',
  'ĐẤT HỖ TRỢ TRUNG TÂM DỊCH VỤ, SẢN XUẤT, LÀNG NGHỀ': 'TMD',
  'KHU VỰC THỰC HIỆN THEO DỰ ÁN RIÊNG': 'ODT',
  'ĐẤT DU LỊCH': 'TMD',
  'ĐẤT GIÁO DỤC, ĐÀO TẠO': 'DGD',
  'ĐẤT TRỒNG RAU AN TOÀN': 'NCC',
  'ĐẤT CHĂN NUÔI, NÔNG NGHIỆP': 'NCC',
  'ĐẤT TRANG TRẠI': 'NCC',
  'ĐẤT LÂM NGHIỆP': 'RSX',
  'ĐẤT LÀNG NGHỀ': 'SKC',
  'ĐẤT CÂY XANH CHUYÊN ĐỀ ( CÔNG VIÊN, CÂY XANH, VƯỜN ƯƠM, TRỒNG HOA, TRANG TRẠI NÔNG NGHIỆP)': 'DKV',
  'ĐẤT NHÓM NHÀ Ở XÂY DỰNG MỚI': 'ODT',
  'ĐẤT CƠ QUAN NGOẠI GIAO': 'DNG',
  'ĐẤT CÔNG VIÊN DI SẢN (CỔ LOA)': 'DKV',
  'ĐẤT TRUNG TÂM THỂ DỤC THỂ THAO': 'DTT',
  'ĐẤT KHU CÔNG NGHỆ CAO': 'SKK',
  'ĐẤT SẢN XUẤT VẬT LIỆU XÂY DỰNG': 'SKX',
  'ĐẤT CÔNG TRÌNH Y TẾ': 'DYT',
  'ĐẤT DỊCH VỤ, THƯƠNG MẠI': 'TMD',
  'ĐẤT TRỒNG CÂY CẢNH': 'CLN',
  'ĐẤT TRUNG TÂM CỤM XÃ (HTXH, DỊCH VỤ, THƯƠNG MẠI, NHÀ Ở,…)': 'SKK',
  'ĐẤT HỖN HỢP ( Ở + SẢN XUẤT KD)': 'SKK',
  'ĐẤT Ở SINH THÁI': 'ODT',
  'ĐẤT CỤM ĐỔI MỚI, DỊCH VỤ SẢN XUẤT': 'SKK',
  'ĐẤT BÃI BỒI': 'DCS',
  'ĐẤT CÔNG TY': 'SKK',
  'ĐẤT NHÓM NHÀ Ở HIỆN CÓ (ĐẤT Ở DÂN CƯ) - KIỂM SOÁT ĐẶC BIỆT': 'ONT',
  'ĐẤT TRUNG TÂM TRIỂN LÃM': 'TMD',
  'ĐẤT PHÁT TRIỂN KINH TẾ ĐỊA PHƯƠNG': 'SKK',
  'ĐẤT CƠ QUAN VĂN PHÒNG CHÍNH PHỦ': 'TSC',
  'ĐẤT CƠ QUAN TRUNG ƯƠNG ĐẢNG': 'TSC',
  'ĐẤT ĐÔ THỊ SINH THÁI': 'ODT',
  'KHU VỰC HIỆN TRẠNG NẰM TRONG VÙNG THOÁT LŨ SONG ĐÁY (DỰ KIẾN)': 'SON',
  'KHU VỰC HIỆN TRẠNG NẰM VÀO VÙNG THOÁT LŨ SONG ĐÁY (DỰ KIẾN)': 'SON',
  'ĐẤT CƠ QUAN QUỐC HỘI': 'TSC',
  'ĐẤT CƠ QUAN VĂN PHÒNG CHỦ TỊCH NƯỚC': 'TSC',
  'ĐẤT PHỤC VỤ CHUNG CHO KHU TRUNG TÂM CHÍNH TRỊ BA ĐÌNH': 'TSC',
  'ĐẤT ỦY BAN TRUNG ƯƠNG MẶT TRẬN TỔ QUỐC VN': 'TSC',
  'ĐẤT DI TÍCH VỀ CHỦ TỊCH HỒ CHÍ MINH': 'DRA',
  'ĐƯỜNG GIAO THÔNG': 'DGT',

  // Hoc Mon planning layers descriptions
  'CXTDTT': 'DKV',
  'CACHLY': 'DKV',
  'DATTRONGLUA': 'LUA',
  'MATNUOC': 'SON',
  'MAT NUOC': 'SON',
  'DSAT': 'DGT',
  'TMDV': 'TMD',
  'QUANSU': 'CQP',
  'GDDAIHOC': 'DGD',
  'YTE': 'DYT',
  'KHOBAI': 'SKC',

  // Long Bien / Hanoi planning descriptions
  'ĐẤT NHÓM NHÀ Ở XÂY DỰNG MỚI (THEO DỰ ÁN)': 'ODT',
  'ĐẤT NHÓM NHÀ Ở HIỆN CÓ (ĐẤT Ở DÂN CƯ)': 'ODT',
  'ĐẤT CƠ QUAN, VIỆN NGHIÊN CỨU, TRƯỜNG ĐÀO TẠO': 'TSC',
  'ĐẤT CÂY XANH CÁCH LY': 'DKV',
  'ĐẤT DI TÍCH, TÔN GIÁO – TÍN NGƯỠNG': 'CSD',
  'ĐẤT CÔNG NGHIỆP, KHO TÀNG': 'SKK',
  'ĐẤT BÃI ĐỖ XE': 'DGT',
  'ĐẤT GIAO THÔNG': 'DGT',

  // Uppercase non-accented Vietnamese (for safety, excluding duplicates)
  'DAT NONG NGHIEP': 'NCC',
  'DAT AN NINH, QUOC PHONG': 'CAN',
  'DAT CAY XANH, CONG VIEN, VUON HOA': 'DKV',
  'DAT CAY XANH': 'DKV',
  'CAY XANH': 'DKV',
  'CONG VIEN': 'DKV',
  'VUON HOA': 'DKV',
  'DAT TRUONG HOC': 'DTS',
  'TRUONG HOC': 'DTS',
  'DAT MAT NUOC, SONG, AO, HO': 'SON',
  'DAT MAT NUOC': 'SON',
  'SONG': 'SON',
  'SUOI': 'SON',
  'HO': 'SON',
  'DAT CONG CONG': 'TMD',
  'CONG CONG': 'TMD',
  'DAT LÀNG XOM, DAN CU HIEN CO': 'ONT',
  'DAT LANG XOM': 'ONT',
  'DAN CU HIEN CO': 'ONT',
  'DAT O THAP TANG': 'ODT',
  'DAT O CAO TANG': 'ODT',
  'DAT O HON HOP': 'SKK',
  'DAT HON HOP': 'SKK',
  'DAT KHU CONG NGHIEP': 'SKK',
  'DAT CONG TRINH SU NGHIEP': 'DTS',
  'DAT DI TICH LICH SU - VAN HOA': 'DRA',
  'DAT TON GIAO, TIN NGUONG': 'CSD',
  'DAT DI TICH, TON GIAO - TIN NGUONG': 'CSD',
  'DAT CAY XANH CACH LY': 'DKV',
  'DAT CAY XANH, TDTT': 'DKV',
  'DAT DAU MOI HA TANG KY THUAT': 'DDT',
  'DAT GIAO THONG TINH': 'DGT',
  'DAT CONG CONG DON VI O': 'TMD',
  'DAT CO QUAN, VIEN NGHIEN CUU, TRUONG DAO TAO': 'TSC',
  'DAT MAM NON, NHA TRE': 'DTS',
  'DAT O HIEN TRANG': 'ONT',
  'DAT O CAI TAO': 'ODT',
  'DAT O XAY DUNG MOI': 'ODT',
  'DAT NGHIA TRANG': 'NTD',
  'DAT XD CONG TRINH HON HOP CAO TANG': 'SKK',
  'HON HOP CAO TANG': 'SKK',
  'HON HOP': 'SKK',

  // Layer names from hocmon-quyhoach
  'DAN CU DO THI': 'ODT',
  'DAN CU HIEN HUU': 'ONT',
  'DU LICH SINH THAI': 'DKV',
  'KHO TANG': 'SKC',
  'HCNGHIEP': 'SKK',
  'CTCC': 'TMD',
};

/**
 * Shared coalesce keys array for Maplibre GL expressions.
 * Ensures 100% consistency (SSOT) between styling and text labeling.
 */
export function getMaplibreCoalesceExpression(): any[] {
  return [
    'coalesce',
    ['get', 'land_code'], ['get', 'LAND_CODE'],
    ['get', 'loai_dat'], ['get', 'LOAI_DAT'],
    ['get', 'ma_dat'], ['get', 'MA_DAT'],
    ['get', 'ky_hieu'], ['get', 'KY_HIEU'],
    ['get', 'layer'], ['get', 'Layer'], ['get', 'LAYER'],
    ['get', 'purpose'], ['get', 'PURPOSE'],
    ['get', 'class'], ['get', 'CLASS'],
    ['get', 'type'], ['get', 'TYPE'],
    ['get', 'ma_loai_dat'], ['get', 'MA_LOAI_DAT'],
    ''
  ];
}

/**
 * Returns a Maplibre GL expression array for mapping various land use attributes
 * (land_code, loai_dat, ky_hieu, ma_dat, etc.) to standard 3-letter codes (e.g., ODT, CLN).
 */
export function getMaplibreLabelExpression(): any[] {
  const expression: any[] = [
    'match',
    ['upcase', ['string', getMaplibreCoalesceExpression()]]
  ];

  const addedKeys = new Set<string>();

  const addBranch = (key: string, value: string) => {
    const upperKey = key.toUpperCase();
    if (!addedKeys.has(upperKey)) {
      addedKeys.add(upperKey);
      expression.push(upperKey);
      expression.push(value);
    }
  };

  // 1. Add standard codes mapping to their full names (e.g. ODT -> Đất ở đô thị)
  for (const code of Object.keys(LOAI_DAT_COLOR)) {
    const fullName = LOAI_DAT[code] || code;
    addBranch(code, fullName);
  }

  // 1b. Add standard descriptions (accented & accentless) -> full names
  for (const code of Object.keys(LOAI_DAT_COLOR)) {
    const fullName = LOAI_DAT[code];
    if (fullName) {
      addBranch(fullName, fullName);
      
      const noAccent = removeAccents(fullName);
      addBranch(noAccent, fullName);
    }
  }

  // 2. Add custom mapped strings and numeric keys from SSOT to their full names
  for (const [key, code] of Object.entries(CUSTOM_LAND_TYPE_MAPPING)) {
    const fullName = LOAI_DAT[code] || code;
    addBranch(key, fullName);
    
    const noAccent = removeAccents(key);
    addBranch(noAccent, fullName);
  }

  expression.push('');
  return expression;
}
