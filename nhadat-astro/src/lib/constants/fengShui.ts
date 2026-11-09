import type { FengShuiResult } from '../types';

export const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
export const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];

export function getCanChi(year: number): string {
  const canIndex = (year - 4) % 10;
  const chiIndex = (year - 4) % 12;
  return `${CAN[(canIndex + 10) % 10]} ${CHI[(chiIndex + 12) % 12]}`;
}

export interface CungInfo {
  cung: string;
  hanViet: string;
  quaiSo: number;
  group: 'Đông Tứ Mệnh' | 'Tây Tứ Mệnh';
  element: string;
  color: string;
  favorable: { direction: string; star: string; score: number; meaning: string }[];
  unfavorable: { direction: string; star: string; severity: string; warning: string }[];
}

export const CUNG_PHI_DATA: Record<string, CungInfo> = {
  Kham: {
    cung: 'Khảm',
    hanViet: 'Thủy',
    quaiSo: 1,
    group: 'Đông Tứ Mệnh',
    element: 'Thủy (Nước)',
    color: 'Xanh nước biển, Đen, Trắng (Kim sinh Thủy)',
    favorable: [
      { direction: 'Đông Nam', star: 'Sinh Khí', score: 100, meaning: 'Đại cát hanh thông, tài lộc vượng phát, thăng quan tiến chức' },
      { direction: 'Đông', star: 'Thiên Y', score: 92, meaning: 'Sức khỏe trường thọ, gặp quý nhân phù trợ, tiêu trừ bệnh tật' },
      { direction: 'Nam', star: 'Diên Niên', score: 86, meaning: 'Gia đạo êm ấm, vợ chồng hòa thuận, các mối quan hệ bền vững' },
      { direction: 'Bắc', star: 'Phục Vị', score: 80, meaning: 'Tâm trí bình an, con đường học vấn thi cử đỗ đạt, công danh vững chắc' },
    ],
    unfavorable: [
      { direction: 'Tây Nam', star: 'Tuyệt Mệnh', severity: 'Cực xấu', warning: 'Tổn hại sức khỏe, tai bay vạ gió, hao tán tài sản nặng nề' },
      { direction: 'Đông Bắc', star: 'Ngũ Quỷ', severity: 'Rất xấu', warning: 'Gặp thị phi, tranh chấp kiện tụng, đề phòng hỏa hoạn và trộm cắp' },
      { direction: 'Tây Bắc', star: 'Lục Sát', severity: 'Xấu', warning: 'Tình cảm rạn nứt, bất an lo lắng, công việc trắc trở' },
      { direction: 'Tây', star: 'Họa Hại', severity: 'Kém may mắn', warning: 'Thường xuyên gặp phiền phức, kế hoạch hay bị đình trệ' },
    ],
  },
  Khon: {
    cung: 'Khôn',
    hanViet: 'Thổ',
    quaiSo: 2,
    group: 'Tây Tứ Mệnh',
    element: 'Thổ (Đất)',
    color: 'Vàng đất, Nâu, Đỏ, Cam (Hỏa sinh Thổ)',
    favorable: [
      { direction: 'Đông Bắc', star: 'Sinh Khí', score: 100, meaning: 'Tài lộc dồi dào, vượng đường con cái, phúc lộc song toàn' },
      { direction: 'Tây', star: 'Thiên Y', score: 92, meaning: 'Thân tâm an lạc, bệnh tật tiêu trừ, gia tăng tuổi thọ' },
      { direction: 'Tây Bắc', star: 'Diên Niên', score: 86, meaning: 'Gia đình hạnh phúc, đoàn kết, kinh doanh bền vững' },
      { direction: 'Tây Nam', star: 'Phục Vị', score: 80, meaning: 'Ổn định công việc, giữ gìn tài sản gia nghiệp tổ tiên' },
    ],
    unfavorable: [
      { direction: 'Bắc', star: 'Tuyệt Mệnh', severity: 'Cực xấu', warning: 'Hao tiền tốn của, gia đạo bất hòa, công danh đổ vỡ' },
      { direction: 'Đông Nam', star: 'Ngũ Quỷ', severity: 'Rất xấu', warning: 'Tiểu nhân hãm hại, làm ăn thất bát, tranh chấp triền miên' },
      { direction: 'Nam', star: 'Lục Sát', severity: 'Xấu', warning: 'Thị phi điều tiếng, thất thoát tiền bạc, tai nạn bất ngờ' },
      { direction: 'Đông', star: 'Họa Hại', severity: 'Kém may mắn', warning: 'Khó tích lũy của cải, công sức bỏ ra nhiều kết quả thu lại ít' },
    ],
  },
  Chan: {
    cung: 'Chấn',
    hanViet: 'Mộc',
    quaiSo: 3,
    group: 'Đông Tứ Mệnh',
    element: 'Mộc (Cây cối)',
    color: 'Xanh lục, Xanh lam, Đen (Thủy sinh Mộc)',
    favorable: [
      { direction: 'Nam', star: 'Sinh Khí', score: 100, meaning: 'Công danh hiển hách, thăng tiến vượt bậc, danh tiếng vang xa' },
      { direction: 'Bắc', star: 'Thiên Y', score: 92, meaning: 'Gặp may mắn về sức khỏe, tinh thần sảng khoái, vượng khí dồi dào' },
      { direction: 'Đông Nam', star: 'Diên Niên', score: 86, meaning: 'Tình cảm sắt son, vạn sự thuận hòa, con cháu thảo hiền' },
      { direction: 'Đông', star: 'Phục Vị', score: 80, meaning: 'Tâm trí tĩnh lặng, duy trì thành quả vững vàng qua nhiều năm' },
    ],
    unfavorable: [
      { direction: 'Tây', star: 'Tuyệt Mệnh', severity: 'Cực xấu', warning: 'Gặp biến cố nghiêm trọng, tài lộc kiệt quệ, tổn thọ' },
      { direction: 'Tây Bắc', star: 'Ngũ Quỷ', severity: 'Rất xấu', warning: 'Khủng hoảng tài chính, bị đối thủ lừa gạt, mất lòng tin' },
      { direction: 'Đông Bắc', star: 'Lục Sát', severity: 'Xấu', warning: 'Mâu thuẫn nội bộ gia đình kéo dài, tâm lý bất an' },
      { direction: 'Tây Nam', star: 'Họa Hại', severity: 'Kém may mắn', warning: 'Mất mát nhỏ tích tụ thành lớn, dự định dang dở' },
    ],
  },
  Ton: {
    cung: 'Tốn',
    hanViet: 'Mộc',
    quaiSo: 4,
    group: 'Đông Tứ Mệnh',
    element: 'Mộc (Gió / Cây)',
    color: 'Xanh lá cây, Xanh nước biển, Đen',
    favorable: [
      { direction: 'Bắc', star: 'Sinh Khí', score: 100, meaning: 'Tài nguyên phong phú, quan lộ thênh thang, đại phú đại quý' },
      { direction: 'Nam', star: 'Thiên Y', score: 92, meaning: 'Sinh khí dồi dào, tâm tính nhân từ, trường thọ an khang' },
      { direction: 'Đông', star: 'Diên Niên', score: 86, meaning: 'Hôn nhân viên mãn, quan hệ xã giao tốt đẹp, gặp người giúp đỡ' },
      { direction: 'Đông Nam', star: 'Phục Vị', score: 80, meaning: 'Thu hút duyên lành, thành công từ sự kiên trì nhẫn nại' },
    ],
    unfavorable: [
      { direction: 'Đông Bắc', star: 'Tuyệt Mệnh', severity: 'Cực xấu', warning: 'Tổn thương nguyên khí, bệnh tật nan y khó chữa' },
      { direction: 'Tây Nam', star: 'Ngũ Quỷ', severity: 'Rất xấu', warning: 'Tán gia bại sản, làm ăn thua lỗ triền miên' },
      { direction: 'Tây', star: 'Lục Sát', severity: 'Xấu', warning: 'Rắc rối tình cảm, kiện cáo phiền toái, tổn hại danh dự' },
      { direction: 'Tây Bắc', star: 'Họa Hại', severity: 'Kém may mắn', warning: 'Thất bại không rõ nguyên nhân, hay gặp xui xẻo' },
    ],
  },
  Can: {
    cung: 'Càn',
    hanViet: 'Kim',
    quaiSo: 6,
    group: 'Tây Tứ Mệnh',
    element: 'Kim (Trời / Kim loại)',
    color: 'Trắng, Ánh kim, Xám ghi, Vàng hoàng thổ (Thổ sinh Kim)',
    favorable: [
      { direction: 'Tây', star: 'Sinh Khí', score: 100, meaning: 'Thu hút tài lộc mạnh mẽ, địa vị xã hội cao quý, quyền uy vang rền' },
      { direction: 'Đông Bắc', star: 'Thiên Y', score: 92, meaning: 'Sức khỏe dẻo dai, trí tuệ mẫn tiệp, hóa giải hoạn nạn' },
      { direction: 'Tây Nam', star: 'Diên Niên', score: 86, meaning: 'Gia đạo êm ấm, vợ chồng đồng thuận, hỗ trợ sự nghiệp lớn' },
      { direction: 'Tây Bắc', star: 'Phục Vị', score: 80, meaning: 'Bản lĩnh kiên cường, vượt qua mọi sóng gió để giữ vững cơ nghiệp' },
    ],
    unfavorable: [
      { direction: 'Nam', star: 'Tuyệt Mệnh', severity: 'Cực xấu', warning: 'Hỏa khắc Kim gây nguy hiểm sức khỏe tim mạch, đại nạn tài chính' },
      { direction: 'Đông', star: 'Ngũ Quỷ', severity: 'Rất xấu', warning: 'Bị bạn bè lừa gạt, mất chức quyền, công việc bấp bênh' },
      { direction: 'Bắc', star: 'Lục Sát', severity: 'Xấu', warning: 'Rối ren gia đạo, hao tán sinh lực, chuyện tình duyên trắc trở' },
      { direction: 'Đông Nam', star: 'Họa Hại', severity: 'Kém may mắn', warning: 'Dính dáng khẩu thiệt thị phi, mưu sự bất thành' },
    ],
  },
  Doai: {
    cung: 'Đoài',
    hanViet: 'Kim',
    quaiSo: 7,
    group: 'Tây Tứ Mệnh',
    element: 'Kim (Hồ / Kim loại)',
    color: 'Trắng, Bạc, Vàng đồng, Nâu đất',
    favorable: [
      { direction: 'Tây Bắc', star: 'Sinh Khí', score: 100, meaning: 'Làm ăn phát đạt, con đường buôn bán hanh thông, thu lợi nhuận lớn' },
      { direction: 'Tây Nam', star: 'Thiên Y', score: 92, meaning: 'Sức khỏe dồi dào, gặp thầy gặp thuốc, gia đình trường thọ' },
      { direction: 'Đông Bắc', star: 'Diên Niên', score: 86, meaning: 'Vợ chồng thủy chung hạnh phúc, gắn bó sắt son suốt đời' },
      { direction: 'Tây', star: 'Phục Vị', score: 80, meaning: 'Tăng cường sức mạnh nội tại, giữ vững uy tín và chữ tín' },
    ],
    unfavorable: [
      { direction: 'Đông', star: 'Tuyệt Mệnh', severity: 'Cực xấu', warning: 'Mệnh vong tài lộc, gặp họa từ trên trời rơi xuống' },
      { direction: 'Nam', star: 'Ngũ Quỷ', severity: 'Rất xấu', warning: 'Thất nghiệp, sa sút tinh thần, hao tổn nguyên khí' },
      { direction: 'Đông Nam', star: 'Lục Sát', severity: 'Xấu', warning: 'Dễ nảy sinh cãi vã, mất hòa khí, gặp tai tiếng ngoài ý muốn' },
      { direction: 'Bắc', star: 'Họa Hại', severity: 'Kém may mắn', warning: 'Chuyện nhỏ xé ra to, mệt mỏi trong các mối quan hệ' },
    ],
  },
  Can_Nui: {
    cung: 'Cấn',
    hanViet: 'Thổ',
    quaiSo: 8,
    group: 'Tây Tứ Mệnh',
    element: 'Thổ (Núi)',
    color: 'Nâu đất, Vàng đất, Đỏ, Tím, Hồng',
    favorable: [
      { direction: 'Tây Nam', star: 'Sinh Khí', score: 100, meaning: 'Của cải tích lũy vững như núi, con cháu thông minh thành đạt' },
      { direction: 'Tây Bắc', star: 'Thiên Y', score: 92, meaning: 'Sống lâu trường thọ, gia đình bình an vô sự qua các năm hạn' },
      { direction: 'Tây', star: 'Diên Niên', score: 86, meaning: 'Các mối liên kết kinh doanh phát triển, tình duyên thắm nồng' },
      { direction: 'Đông Bắc', star: 'Phục Vị', score: 80, meaning: 'Ý chí kiên định, tâm hướng thiện, hậu vận vinh hoa phú quý' },
    ],
    unfavorable: [
      { direction: 'Đông Nam', star: 'Tuyệt Mệnh', severity: 'Cực xấu', warning: 'Mộc khắc Thổ nặng, sức khỏe sa sút nghiêm trọng' },
      { direction: 'Bắc', star: 'Ngũ Quỷ', severity: 'Rất xấu', warning: 'Bị kẻ xấu lừa gạt, tổn thất tiền bạc của cải lớn' },
      { direction: 'Đông', star: 'Lục Sát', severity: 'Xấu', warning: 'Nội bộ gia đình chia rẽ, lục đục, khó hòa giải' },
      { direction: 'Nam', star: 'Họa Hại', severity: 'Kém may mắn', warning: 'Công việc hay bị cản trở, tiền tài khó tụ dễ tán' },
    ],
  },
  Ly: {
    cung: 'Ly',
    hanViet: 'Hỏa',
    quaiSo: 9,
    group: 'Đông Tứ Mệnh',
    element: 'Hỏa (Lửa / Mặt trời)',
    color: 'Đỏ, Hồng, Cam, Xanh lá cây (Mộc sinh Hỏa)',
    favorable: [
      { direction: 'Đông', star: 'Sinh Khí', score: 100, meaning: 'Tài năng xuất chúng, công thành danh toại, tài lộc ào ạt' },
      { direction: 'Đông Nam', star: 'Thiên Y', score: 92, meaning: 'Sinh lực tràn đầy, nhiều niềm vui bất ngờ, quý nhân dẫn đường' },
      { direction: 'Bắc', star: 'Diên Niên', score: 86, meaning: 'Quan hệ gia đình hòa thuận, kính trên nhường dưới, vững chắc' },
      { direction: 'Nam', star: 'Phục Vị', score: 80, meaning: 'Tỏa sáng rạng rỡ, danh tiếng được người đời nể trọng' },
    ],
    unfavorable: [
      { direction: 'Tây Bắc', star: 'Tuyệt Mệnh', severity: 'Cực xấu', warning: 'Tổn hại tài sản nặng nề, gặp chuyện chẳng lành liên miên' },
      { direction: 'Tây', star: 'Ngũ Quỷ', severity: 'Rất xấu', warning: 'Dễ vướng vào vòng lao lý hoặc kiện tụng, danh tiếng bị bôi nhọ' },
      { direction: 'Tây Nam', star: 'Lục Sát', severity: 'Xấu', warning: 'Tâm tính nóng nảy gây họa, đánh mất bạn bè và cơ hội' },
      { direction: 'Đông Bắc', star: 'Họa Hại', severity: 'Kém may mắn', warning: 'Vất vả ngược xuôi mà không gom góp được tiền bạc' },
    ],
  },
};

export function calculateFengShui(year: number, gender: 'nam' | 'nu'): FengShuiResult {
  const sumDigits = (num: number): number => {
    let sum = 0;
    while (num > 0) {
      sum += num % 10;
      num = Math.floor(num / 10);
    }
    return sum >= 10 ? sumDigits(sum) : sum;
  };

  const lastTwoDigits = year % 100;
  const single = sumDigits(lastTwoDigits);
  let quaiSo = 1;

  if (year < 2000) {
    if (gender === 'nam') {
      quaiSo = (10 - single) % 9 || 9;
    } else {
      quaiSo = (5 + single) % 9 || 9;
    }
  } else {
    // Từ năm 2000 trở đi
    if (gender === 'nam') {
      quaiSo = (9 - single) % 9 || 9;
    } else {
      quaiSo = (6 + single) % 9 || 9;
    }
  }

  // Số 5 đặc biệt: Nam -> Khôn (2), Nữ -> Cấn (8)
  let cungKey = 'Kham';
  if (quaiSo === 1) cungKey = 'Kham';
  else if (quaiSo === 2) cungKey = 'Khon';
  else if (quaiSo === 3) cungKey = 'Chan';
  else if (quaiSo === 4) cungKey = 'Ton';
  else if (quaiSo === 5) cungKey = gender === 'nam' ? 'Khon' : 'Can_Nui';
  else if (quaiSo === 6) cungKey = 'Can';
  else if (quaiSo === 7) cungKey = 'Doai';
  else if (quaiSo === 8) cungKey = 'Can_Nui';
  else if (quaiSo === 9) cungKey = 'Ly';

  const data = CUNG_PHI_DATA[cungKey] || CUNG_PHI_DATA['Kham'];
  const canChi = getCanChi(year);

  return {
    birth_year: year,
    gender,
    lunar_year_name: `Năm ${canChi} (${year})`,
    can_chi: canChi,
    quai_so: quaiSo,
    cung_phi: data.cung,
    group: data.group,
    favorable_directions: data.favorable,
    unfavorable_directions: data.unfavorable,
    recommended_door_color: data.color,
    element: data.element,
  };
}
