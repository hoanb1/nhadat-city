/**
 * ETL Script: Tasks 4 & 5 - Populate land_use_types (52 codes) and bank_mortgage_rates (35 banks)
 */
const { Client } = require('pg');

const PG_URI = require('./_env').need('DATABASE_URL');

// Task 4: 52 Official Land Use Types
const LAND_USE_TYPES = [
  // Nhóm đất ở
  {
    code: 'ODT', name: 'Đất ở tại đô thị', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#ff5c5c',
    is_residential: true, max_term_text: 'Ổn định lâu dài',
    legal_summary: 'Đất để xây dựng nhà ở, các công trình phục vụ đời sống tại đô thị theo quy hoạch chi tiết xây dựng đô thị được phê duyệt.',
    buildable_guide: 'Được phép xây dựng nhà ở kiên cố, biệt thự, nhà phố, tuân thủ giấy phép xây dựng, tầng cao và chỉ giới xây dựng.',
    conversion_fee_rule: 'Không mất phí chuyển đổi nếu đã được cấp chứng nhận 100% đất ODT.'
  },
  {
    code: 'ONT', name: 'Đất ở tại nông thôn', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#ffa3a3',
    is_residential: true, max_term_text: 'Ổn định lâu dài',
    legal_summary: 'Đất để xây dựng nhà ở, công trình phục vụ sinh hoạt, vườn ao gắn liền trong cùng thửa đất thuộc khu vực nông thôn.',
    buildable_guide: 'Được xây dựng nhà ở nông thôn, mật độ xây dựng theo quy chuẩn khu dân cư nông thôn và quy hoạch chung xã.',
    conversion_fee_rule: 'Miễn hoặc chuyển tự động sang ODT khi khu vực quy hoạch thành lập phường/thị xã nếu đã có sổ hồng ở lâu dài.'
  },

  // Nhóm đất nông nghiệp
  {
    code: 'CLN', name: 'Đất trồng cây lâu năm', group_name: 'Nhóm đất nông nghiệp', color_hex: '#d2f5b0',
    is_residential: false, max_term_text: '50 năm (gia hạn theo nhu cầu)',
    legal_summary: 'Đất trồng các loại cây trồng một lần, sinh trưởng và cho thu hoạch trong nhiều năm (cà phê, cao su, cây ăn trái).',
    buildable_guide: 'Không được tự ý xây dựng nhà ở kiên cố. Được dựng lán trại tạm thời phục vụ sản xuất hoặc chuyển đổi mục đích sang ODT/ONT.',
    conversion_fee_rule: 'Thu tiền bằng chênh lệch giữa giá đất ở và giá đất nông nghiệp theo bảng giá đất tỉnh tại thời điểm chuyển mục đích.'
  },
  {
    code: 'LUC', name: 'Đất lúa nước còn lại', group_name: 'Nhóm đất nông nghiệp', color_hex: '#fef08a',
    is_residential: false, max_term_text: '50 năm',
    legal_summary: 'Đất trồng lúa nước ngoài đất chuyên trồng lúa nước (ruộng lúa một vụ, lúa kết hợp thủy sản).',
    buildable_guide: 'Nghiêm cấm tự ý xây dựng công trình, chỉ được canh tác lúa hoặc chuyển đổi cơ cấu cây trồng theo kế hoạch.',
    conversion_fee_rule: 'Chuyển mục đích phải nằm trong kế hoạch sử dụng đất hàng năm cấp huyện và nộp tiền bảo vệ phát triển đất lúa.'
  },
  {
    code: 'LUA', name: 'Đất chuyên trồng lúa nước', group_name: 'Nhóm đất nông nghiệp', color_hex: '#fde047',
    is_residential: false, max_term_text: '50 năm',
    legal_summary: 'Đất trồng từ hai vụ lúa nước trở lên trong năm, quỹ đất an ninh lương thực quốc gia.',
    buildable_guide: 'Nghiêm cấm tuyệt đối việc tự ý san lấp xây dựng nhà ở hay công trình.',
    conversion_fee_rule: 'Thẩm quyền cho phép chuyển mục đích sử dụng đất thuộc HĐND cấp tỉnh hoặc Thủ tướng Chính phủ.'
  },
  {
    code: 'LUK', name: 'Đất trồng lúa nương', group_name: 'Nhóm đất nông nghiệp', color_hex: '#fef08a',
    is_residential: false, max_term_text: '50 năm',
    legal_summary: 'Đất trồng lúa trên sườn đồi dốc nương rẫy, phụ thuộc hoàn toàn vào nước mưa tự nhiên.',
    buildable_guide: 'Chỉ phục vụ canh tác nương rẫy nông nghiệp, cấm xây dựng công trình kiên cố.',
    conversion_fee_rule: 'Chuyển mục đích phải được kiểm tra thổ nhưỡng và bảo vệ chống xói mòn theo kế hoạch cấp huyện.'
  },
  {
    code: 'BHK', name: 'Đất bằng trồng cây hàng năm khác', group_name: 'Nhóm đất nông nghiệp', color_hex: '#fef9c3',
    is_residential: false, max_term_text: '50 năm',
    legal_summary: 'Đất trồng các loại cây có thời gian sinh trưởng dưới một năm trên địa hình đồng bằng (ngô, khoai, hoa màu).',
    buildable_guide: 'Chỉ được làm chòi canh, kho chứa vật tư nông nghiệp tạm thời, không xây nhà kiên cố.',
    conversion_fee_rule: 'Được phép chuyển sang đất ở nếu phù hợp quy hoạch phân khu và kế hoạch sử dụng đất cấp huyện.'
  },
  {
    code: 'NKH', name: 'Đất nương rẫy trồng cây hàng năm khác', group_name: 'Nhóm đất nông nghiệp', color_hex: '#f5f5dc',
    is_residential: false, max_term_text: '50 năm',
    legal_summary: 'Đất nương rẫy trên đồi dốc trồng cây ngắn ngày, luân canh nương rẫy.',
    buildable_guide: 'Không được phép xây dựng công trình kiên cố.',
    conversion_fee_rule: 'Chuyển mục đích phải được đánh giá tác động chống sạt lở xói mòn đất vùng cao.'
  },
  {
    code: 'RSX', name: 'Đất rừng sản xuất', group_name: 'Nhóm đất nông nghiệp', color_hex: '#86efac',
    is_residential: false, max_term_text: '50 năm',
    legal_summary: 'Đất rừng sử dụng chủ yếu vào mục đích sản xuất gỗ, lâm sản và kết hợp du lịch sinh thái rừng.',
    buildable_guide: 'Được xây dựng công trình kết hợp du lịch sinh thái nghỉ dưỡng dưới tán rừng với tỷ lệ mật độ xây dựng không quá 1-5%.',
    conversion_fee_rule: 'Phải trồng rừng thay thế và nộp tiền chuyển mục đích sử dụng rừng sang đất phi nông nghiệp.'
  },
  {
    code: 'RPH', name: 'Đất rừng phòng hộ', group_name: 'Nhóm đất nông nghiệp', color_hex: '#34d399',
    is_residential: false, max_term_text: 'Giao quản lý lâu dài',
    legal_summary: 'Đất sử dụng nhằm bảo vệ nguồn nước, nguồn đất, chống xói mòn, hạn chế thiên tai, điều hòa khí hậu.',
    buildable_guide: 'Nghiêm cấm mọi hành vi xâm lấn, chặt phá rừng và xây dựng công trình dân dụng kiên cố.',
    conversion_fee_rule: 'Không cho phép chuyển mục đích sang đất ở cho cá nhân.'
  },
  {
    code: 'RDD', name: 'Đất rừng đặc dụng', group_name: 'Nhóm đất nông nghiệp', color_hex: '#059669',
    is_residential: false, max_term_text: 'Nhà nước bảo tồn lâu dài',
    legal_summary: 'Đất vườn quốc gia, khu bảo tồn thiên nhiên, khu bảo vệ cảnh quan, rừng nghiên cứu khoa học.',
    buildable_guide: 'Chỉ được xây dựng công trình phục vụ nghiên cứu khoa học, bảo tồn thiên nhiên theo dự án được Thủ tướng phê duyệt.',
    conversion_fee_rule: 'Nghiêm cấm chuyển đổi thương mại sang bất động sản nhà ở.'
  },
  {
    code: 'NTS', name: 'Đất nuôi trồng thủy sản', group_name: 'Nhóm đất nông nghiệp', color_hex: '#7dd3fc',
    is_residential: false, max_term_text: '50 năm',
    legal_summary: 'Đất có mặt nước chuyên dùng để nuôi trồng thủy sản nước ngọt, lợ, mặn theo quy trình kỹ thuật.',
    buildable_guide: 'Được dựng nhà tạm trông coi ao nuôi, không được xây móng kiên cố nếu chưa chuyển mục đích.',
    conversion_fee_rule: 'Nộp tiền sử dụng đất bằng chênh lệch giá đất ở và giá đất thủy sản theo bảng giá đất nhà nước.'
  },
  {
    code: 'LMU', name: 'Đất làm muối', group_name: 'Nhóm đất nông nghiệp', color_hex: '#e2e8f0',
    is_residential: false, max_term_text: '50 năm',
    legal_summary: 'Đất ruộng muối chuyên sản xuất muối ăn từ nước biển.',
    buildable_guide: 'Không được phép xây dựng công trình dân dụng kiên cố ngoài công trình phục vụ nghề muối.',
    conversion_fee_rule: 'Chuyển mục đích theo quy hoạch phát triển kinh tế biển của tỉnh.'
  },
  {
    code: 'NCC', name: 'Đất nông nghiệp khác', group_name: 'Nhóm đất nông nghiệp', color_hex: '#dcfce7',
    is_residential: false, max_term_text: '50 năm',
    legal_summary: 'Đất xây dựng nhà kính, trại chăn nuôi công nghệ cao, chuồng trại động vật nuôi được pháp luật cho phép.',
    buildable_guide: 'Được phép xây dựng hệ thống nhà màng, nhà kính, kho ủ phân bón theo thiết kế nông nghiệp kỹ thuật cao.',
    conversion_fee_rule: 'Theo khung giá đất nông nghiệp khác của địa phương.'
  },

  // Nhóm đất phi nông nghiệp
  {
    code: 'TSC', name: 'Đất trụ sở cơ quan', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#93c5fd',
    is_residential: false, max_term_text: 'Giao quản lý lâu dài',
    legal_summary: 'Đất xây dựng trụ sở cơ quan nhà nước, tổ chức chính trị, tổ chức chính trị - xã hội.',
    buildable_guide: 'Xây dựng trụ sở làm việc theo tiêu chuẩn định mức công trình công cộng của nhà nước.',
    conversion_fee_rule: 'Tài sản công, chuyển nhượng hoặc hoán đổi tuân thủ Luật Quản lý, sử dụng tài sản công.'
  },
  {
    code: 'DTS', name: 'Đất công trình sự nghiệp', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#a7f3d0',
    is_residential: false, max_term_text: 'Lâu dài hoặc thuê theo dự án',
    legal_summary: 'Đất xây dựng cơ sở y tế, giáo dục đào tạo, văn hóa, thể thao, khoa học công nghệ, môi trường.',
    buildable_guide: 'Xây dựng trường học, viện nghiên cứu, trung tâm y tế theo quy hoạch mạng lưới an sinh xã hội.',
    conversion_fee_rule: 'Được hưởng chính sách ưu đãi miễn giảm tiền thuê đất nếu phục vụ mục đích xã hội hóa giáo dục, y tế.'
  },
  {
    code: 'CQP', name: 'Đất quốc phòng', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#b91c1c',
    is_residential: false, max_term_text: 'Bộ Quốc phòng quản lý',
    legal_summary: 'Đất dành riêng cho mục đích quân sự, doanh trại, căn cứ quân sự, công trình phòng thủ chiến lược.',
    buildable_guide: 'Chỉ xây dựng công trình quân sự do Bộ Quốc phòng cấp phép.',
    conversion_fee_rule: 'Nghiêm cấm tư nhân phân lô, mua bán hoặc lấn chiếm.'
  },
  {
    code: 'CAN', name: 'Đất an ninh', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#dc2626',
    is_residential: false, max_term_text: 'Bộ Công an quản lý',
    legal_summary: 'Đất xây dựng đồn, trạm công an, trại giam, học viện an ninh nhân dân.',
    buildable_guide: 'Công trình an ninh do Bộ Công an phê duyệt quy hoạch.',
    conversion_fee_rule: 'Không thương mại hóa mua bán tư nhân.'
  },
  {
    code: 'SKK', name: 'Đất khu công nghiệp', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#c084fc',
    is_residential: false, max_term_text: 'Theo thời hạn dự án (50-70 năm)',
    legal_summary: 'Đất trong khu vực tập trung các nhà máy sản xuất công nghiệp và cung ứng dịch vụ công nghiệp.',
    buildable_guide: 'Xây dựng nhà xưởng sản xuất, kho bãi logistics, văn phòng điều hành theo quy hoạch 1/500 KCN.',
    conversion_fee_rule: 'Thuê đất trả tiền một lần hoặc hàng năm từ chủ đầu tư hạ tầng KCN.'
  },
  {
    code: 'SKT', name: 'Đất khu chế xuất', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#e9d5ff',
    is_residential: false, max_term_text: '50-70 năm',
    legal_summary: 'Đất chuyên phục vụ sản xuất hàng xuất khẩu và dịch vụ cho hoạt động chế xuất hải quan riêng.',
    buildable_guide: 'Xây dựng nhà xưởng chế xuất, kiểm soát hàng rào cách ly hải quan nghiêm ngặt.',
    conversion_fee_rule: 'Hưởng chính sách thuế quan ưu đãi khu chế xuất.'
  },
  {
    code: 'SKN', name: 'Đất cụm công nghiệp', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#d8b4fe',
    is_residential: false, max_term_text: '50 năm',
    legal_summary: 'Đất phát triển công nghiệp địa phương, di dời làng nghề ô nhiễm ra khỏi khu dân cư.',
    buildable_guide: 'Xây dựng xưởng gia công cơ khí, mộc, may mặc, tiểu thủ công nghiệp.',
    conversion_fee_rule: 'Thuê đất theo biểu giá hỗ trợ phát triển kinh tế địa phương của UBND tỉnh.'
  },
  {
    code: 'TMD', name: 'Đất thương mại, dịch vụ', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#f97316',
    is_residential: false, max_term_text: 'Tối đa 50-70 năm',
    legal_summary: 'Đất xây dựng trung tâm thương mại, siêu thị, khách sạn, resort nghỉ dưỡng, shophouse thương mại dịch vụ.',
    buildable_guide: 'Được xây dựng tổ hợp công trình kinh doanh, lưu trú du lịch theo quy hoạch xây dựng được duyệt.',
    conversion_fee_rule: 'Nộp tiền thuê đất hoặc chuyển mục đích theo giá đất thương mại dịch vụ quy định trong bảng giá đất.'
  },
  {
    code: 'SKC', name: 'Đất cơ sở sản xuất phi nông nghiệp', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#f472b6',
    is_residential: false, max_term_text: '50 năm',
    legal_summary: 'Đất cơ sở sản xuất công nghiệp, tiểu thủ công nghiệp độc lập ngoài các khu, cụm công nghiệp.',
    buildable_guide: 'Xây dựng nhà xưởng, bến bãi, kho hàng tuân thủ quy chuẩn phòng cháy chữa cháy và khoảng cách an toàn.',
    conversion_fee_rule: 'Muốn chuyển đổi sang đất ở phải phù hợp quy hoạch chung đô thị và đấu thầu dự án nếu diện tích lớn.'
  },
  {
    code: 'SKS', name: 'Đất sử dụng cho hoạt động khoáng sản', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#a8a29e',
    is_residential: false, max_term_text: 'Theo giấy phép khai thác',
    legal_summary: 'Đất khai thác quặng, than, đá, cát, dầu khí và mặt bằng chế biến khoáng sản.',
    buildable_guide: 'Xây dựng công trình phục vụ khai trường mỏ, kho bãi quặng.',
    conversion_fee_rule: 'Ký quỹ phục hồi môi trường và hoàn thổ đất đai sau khi hết hạn khai thác.'
  },
  {
    code: 'SKX', name: 'Đất sản xuất vật liệu xây dựng, gốm sứ', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#b45309',
    is_residential: false, max_term_text: '50 năm',
    legal_summary: 'Đất khai thác đất sét, lò nung gạch ngói, sản xuất sứ, tấm lợp, xi măng bê tông.',
    buildable_guide: 'Xây dựng lò nung công nghệ hiện đại, bãi tập kết vật liệu tuân thủ chỉ tiêu khí thải.',
    conversion_fee_rule: 'Thuê đất nộp ngân sách theo đơn giá sản xuất vật liệu.'
  },
  {
    code: 'DRA', name: 'Đất di tích lịch sử - văn hóa', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#d97706',
    is_residential: false, max_term_text: 'Bảo vệ lâu dài',
    legal_summary: 'Đất gắn liền với di tích lịch sử - văn hóa đã được xếp hạng quốc gia đặc biệt, quốc gia hoặc cấp tỉnh.',
    buildable_guide: 'Nghiêm cấm xâm phạm vùng bảo vệ I. Khu vực bảo vệ II chỉ được xây công trình phục vụ tôn tạo, phát huy di tích.',
    conversion_fee_rule: 'Không cho phép mua bán, chuyển nhượng hoặc chuyển đổi mục đích sử dụng.'
  },
  {
    code: 'DSH', name: 'Đất sinh hoạt cộng đồng', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#38bdf8',
    is_residential: false, max_term_text: 'Lâu dài',
    legal_summary: 'Đất xây dựng nhà văn hóa thôn, bản, tổ dân phố, điểm sinh hoạt cộng đồng dân cư.',
    buildable_guide: 'Xây dựng nhà sinh hoạt chung, sân thể thao mini cho nhân dân khu phố.',
    conversion_fee_rule: 'Đất công cộng cộng đồng tự quản, không cấp sổ đỏ riêng cho cá nhân.'
  },
  {
    code: 'DKV', name: 'Đất khu vui chơi, giải trí công cộng', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#4ade80',
    is_residential: false, max_term_text: 'Lâu dài',
    legal_summary: 'Đất công viên cây xanh, vườn hoa, quảng trường, bãi tắm công cộng, khu vui chơi mở cho người dân.',
    buildable_guide: 'Xây dựng đường dạo bộ, tiểu cảnh hoa viên, sân chơi trẻ em với mật độ xây dựng kiên cố dưới 5%.',
    conversion_fee_rule: 'Nhà nước bố trí quỹ đất công viên an sinh xã hội.'
  },
  {
    code: 'CSD', name: 'Đất cơ sở tôn giáo', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#fbbf24',
    is_residential: false, max_term_text: 'Lâu dài',
    legal_summary: 'Đất thuộc cơ sở tôn giáo gồm chùa, nhà thờ, thánh đường, thánh thất, niệm phật đường, tu viện.',
    buildable_guide: 'Xây dựng công trình thờ tự của giáo hội hợp pháp, tuân thủ giấy phép xây dựng công trình tôn giáo.',
    conversion_fee_rule: 'Nhà nước giao đất không thu tiền sử dụng đất, không được thế chấp chuyển nhượng tự do.'
  },
  {
    code: 'LDG', name: 'Đất tín ngưỡng', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#f59e0b',
    is_residential: false, max_term_text: 'Lâu dài',
    legal_summary: 'Đất đình, đền, miếu, am, từ đường, nhà thờ họ gắn liền tín ngưỡng dân gian truyền thống.',
    buildable_guide: 'Công trình thờ cúng tâm linh của cộng đồng hoặc dòng họ.',
    conversion_fee_rule: 'Cộng đồng dân cư hoặc đại diện dòng họ đứng tên quản lý bảo tồn.'
  },
  {
    code: 'NTD', name: 'Đất nghĩa trang, nghĩa địa', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#78716c',
    is_residential: false, max_term_text: 'Lâu dài',
    legal_summary: 'Đất nghĩa trang, nhà tang lễ, cơ sở hỏa táng, lưu giữ tro cốt.',
    buildable_guide: 'Quy hoạch xây dựng theo mô hình công viên vĩnh hằng, có khoảng cách ly an toàn vệ sinh tối thiểu với khu dân cư.',
    conversion_fee_rule: 'Dự án công viên nghĩa trang thương mại được thuê đất nộp tiền theo quy định.'
  },
  {
    code: 'BCS', name: 'Đất có mặt nước chuyên dùng', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#bae6fd',
    is_residential: false, max_term_text: 'Lâu dài',
    legal_summary: 'Hồ thủy điện, hồ thủy lợi cung cấp nước sinh hoạt, hồ điều hòa đô thị.',
    buildable_guide: 'Xây dựng đập dâng, trạm bơm, âu thuyền. Nghiêm cấm san lấp phân lô trái phép.',
    conversion_fee_rule: 'Bảo vệ nguồn nước sinh hoạt và an ninh thủy lợi.'
  },
  {
    code: 'PNK', name: 'Đất phi nông nghiệp khác', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#cbd5e1',
    is_residential: false, max_term_text: '50 năm',
    legal_summary: 'Đất làm nhà nghỉ, lán, trại cho người lao động tại cơ sở sản xuất, kho tạm chuyên dụng.',
    buildable_guide: 'Xây dựng công trình tạm thời phục vụ hoạt động sản xuất kinh doanh.',
    conversion_fee_rule: 'Thuê đất nộp ngân sách địa phương.'
  },
  {
    code: 'SON', name: 'Đất sông, suối', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#60a5fa',
    is_residential: false, max_term_text: 'Lâu dài',
    legal_summary: 'Mặt nước sông tự nhiên, kênh rạch, suối lưu thông dòng chảy thoát lũ và vận tải đường thủy.',
    buildable_guide: 'Nghiêm cấm tuyệt đối hành vi lấn chiếm dòng chảy. Xây kè bảo vệ bờ sông và bến thủy nội địa có phép.',
    conversion_fee_rule: 'Hành lang bảo vệ nguồn nước theo Luật Tài nguyên nước.'
  },
  {
    code: 'MNC', name: 'Đất có mặt nước ven biển', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#38bdf8',
    is_residential: false, max_term_text: 'Theo quy hoạch biển',
    legal_summary: 'Bãi triều, vùng biển ven bờ được giao hoặc cho thuê để khai thác phát triển kinh tế biển.',
    buildable_guide: 'Nuôi lồng bè thủy sản xa bờ, xây dựng bến du thuyền, công trình thể thao biển theo quy hoạch.',
    conversion_fee_rule: 'Giao khu vực biển theo Nghị định về quản lý khai thác tài nguyên biển.'
  },
  {
    code: 'DCS', name: 'Đất chưa sử dụng', group_name: 'Nhóm đất chưa sử dụng', color_hex: '#f3f4f6',
    is_residential: false, max_term_text: 'Chưa xác định',
    legal_summary: 'Đất đồi núi trọc, bãi bồi ven sông biển chưa được đưa vào sử dụng cho mục đích cụ thể nào.',
    buildable_guide: 'Nghiêm cấm tự ý lấn chiếm phân lô khi chưa có quyết định giao đất của cấp có thẩm quyền.',
    conversion_fee_rule: 'Nhà nước lập phương án cải tạo và đưa vào kế hoạch sử dụng đất theo kỳ quy hoạch.'
  },
  {
    code: 'CSD_DAT_CHUA_SU_DUNG', name: 'Đất chưa sử dụng (phụ trợ)', group_name: 'Nhóm đất chưa sử dụng', color_hex: '#f3f4f6',
    is_residential: false, max_term_text: 'Chưa xác định',
    legal_summary: 'Mã phụ trợ nhận diện đất chưa sử dụng từ các lớp bản đồ quy hoạch cũ.',
    buildable_guide: 'Quản lý nguyên trạng theo quy định về quỹ đất công chưa giao.',
    conversion_fee_rule: 'Chuyển mục đích khi Nhà nước phê duyệt đề án quy hoạch mới.'
  },
  {
    code: 'DGT', name: 'Đất giao thông', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#e2e8f0',
    is_residential: false, max_term_text: 'Lâu dài',
    legal_summary: 'Đất đường bộ, cầu, cống, bến xe, bãi đỗ xe ô tô, đường sắt, sân bay, cảng biển.',
    buildable_guide: 'Xây dựng hạ tầng đường xá và các công trình phụ trợ giao thông theo quy chuẩn kỹ thuật quốc gia.',
    conversion_fee_rule: 'Hành lang an toàn giao thông nghiêm cấm xây nhà kiên cố, vi phạm bị xử phạt tháo dỡ không đền bù.'
  },
  {
    code: 'DGD', name: 'Đất xây dựng cơ sở giáo dục và đào tạo', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#c7d2fe',
    is_residential: false, max_term_text: 'Lâu dài',
    legal_summary: 'Đất xây dựng trường mầm non, tiểu học, THCS, THPT, đại học, viện nghiên cứu đào tạo nghề.',
    buildable_guide: 'Xây dựng khối lớp học, giảng đường, thư viện, khu ký túc xá học sinh sinh viên.',
    conversion_fee_rule: 'Được hưởng chính sách ưu tiên giao đất, thuê đất miễn giảm tiền thuê theo luật khuyến khích đầu tư giáo dục.'
  },
  {
    code: 'DTT', name: 'Đất xây dựng cơ sở thể dục thể thao', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#99f6e4',
    is_residential: false, max_term_text: 'Lâu dài',
    legal_summary: 'Đất xây dựng sân vận động, nhà thi đấu đa năng, bể bơi, trung tâm huấn luyện thể thao.',
    buildable_guide: 'Xây dựng khán đài, sân tập luyện thi đấu thể thao phục vụ cộng đồng hoặc xã hội hóa thể thao.',
    conversion_fee_rule: 'Chính sách ưu đãi tiền thuê đất đối với các dự án thể dục thể thao quần chúng.'
  },
  {
    code: 'DVH', name: 'Đất xây dựng cơ sở văn hóa', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#e9d5ff',
    is_residential: false, max_term_text: 'Lâu dài',
    legal_summary: 'Đất xây dựng bảo tàng, nhà hát, trung tâm hội nghị triển lãm văn hóa nghệ thuật, rạp xiếc, thư viện công cộng.',
    buildable_guide: 'Công trình kiến trúc điểm nhấn văn hóa của đô thị theo quy hoạch đô thị.',
    conversion_fee_rule: 'Nhà nước cấp phát vốn đầu tư công hoặc xã hội hóa công trình văn hóa phi lợi nhuận.'
  },
  {
    code: 'DDT', name: 'Đất bãi thải, xử lý chất thải', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#cbd5e1',
    is_residential: false, max_term_text: '50 năm',
    legal_summary: 'Đất bãi chôn lấp rác thải, nhà máy điện rác, trạm xử lý chất thải rắn công nghiệp và nước thải đô thị.',
    buildable_guide: 'Công trình công nghệ cao xử lý khép kín, hệ thống quan trắc nước thải khí thải tự động liên tục.',
    conversion_fee_rule: 'Khoảng cách ly an toàn môi trường bắt buộc theo QCVN 01:2021/BXD.'
  },
  {
    code: 'TON', name: 'Đất cơ sở tôn giáo', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#fbbf24',
    is_residential: false, max_term_text: 'Lâu dài',
    legal_summary: 'Đất sử dụng bởi các tổ chức tôn giáo được Nhà nước công nhận để làm trụ sở, nơi thờ tự.',
    buildable_guide: 'Xây dựng công trình tôn giáo phù hợp quy hoạch kiến trúc và văn hóa tôn giáo.',
    conversion_fee_rule: 'Giao đất không thu tiền sử dụng đất theo Điều 118 Luật Đất đai 2024.'
  },
  {
    code: 'TIN', name: 'Đất cơ sở tín ngưỡng', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#f59e0b',
    is_residential: false, max_term_text: 'Lâu dài',
    legal_summary: 'Đất miếu mạo, văn chỉ, võ chỉ, đình làng gắn với văn hóa làng xã truyền thống Việt Nam.',
    buildable_guide: 'Tu bổ, tôn tạo công trình tín ngưỡng dân gian theo đúng nguyên trạng kiến trúc cổ.',
    conversion_fee_rule: 'Di sản cộng đồng làng xã giữ gìn lưu truyền, không chuyển nhượng.'
  },
  {
    code: 'DYT', name: 'Đất y tế', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#fca5a5',
    is_residential: false, max_term_text: 'Lâu dài',
    legal_summary: 'Đất xây dựng bệnh viện đa khoa, chuyên khoa, phòng khám đa khoa, trung tâm kiểm soát bệnh tật (CDC).',
    buildable_guide: 'Xây dựng khối khám bệnh nội trú, cấp cứu, bãi đỗ xe trực thăng cấp cứu y tế theo tiêu chuẩn bệnh viện.',
    conversion_fee_rule: 'Miễn tiền thuê đất đối với cơ sở khám chữa bệnh công lập và ưu đãi dự án bệnh viện quốc tế tư nhân.'
  },
  {
    code: 'DNL', name: 'Đất công trình năng lượng', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#fdba74',
    is_residential: false, max_term_text: '50 năm',
    legal_summary: 'Đất nhà máy nhiệt điện, thủy điện, điện mặt trời, điện gió, đường dây và trạm biến áp truyền tải 500kV - 220kV - 110kV.',
    buildable_guide: 'Xây dựng trạm biến áp, móng cột điện, trung tâm điều hành năng lượng điện.',
    conversion_fee_rule: 'Tuân thủ nghiêm ngặt hành lang an toàn bảo vệ lưới điện cao thế theo Luật Điện lực.'
  },
  {
    code: 'DBV', name: 'Đất bưu chính viễn thông', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#fed7aa',
    is_residential: false, max_term_text: '50 năm',
    legal_summary: 'Đất xây dựng bưu điện trung tâm, đài phát sóng phát thanh truyền hình, trạm viễn thông vệ tinh, trạm BTS.',
    buildable_guide: 'Xây dựng cột anten viễn thông, trung tâm dữ liệu Internet (Data Center).',
    conversion_fee_rule: 'Hạ tầng số dùng chung ưu đãi thuê đất.'
  },
  {
    code: 'DXH', name: 'Đất cơ sở dịch vụ xã hội', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#ffedd5',
    is_residential: false, max_term_text: 'Lâu dài',
    legal_summary: 'Đất trung tâm bảo trợ xã hội, trại dưỡng lão, trung tâm nuôi dưỡng trẻ mồ côi, cơ sở cai nghiện phục hồi chức năng.',
    buildable_guide: 'Xây dựng khu lưu trú, phục hồi chức năng, khuôn viên tĩnh dưỡng an sinh.',
    conversion_fee_rule: 'Được Nhà nước cấp đất hoặc hỗ trợ ngân sách xây dựng.'
  },
  {
    code: 'DCH', name: 'Đất chợ', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#fed7aa',
    is_residential: false, max_term_text: '50 năm',
    legal_summary: 'Đất xây dựng chợ dân sinh truyền thống, chợ đầu mối nông sản thực phẩm bán buôn.',
    buildable_guide: 'Xây dựng nhà lồng chợ kiên cố, phân khu sạp hàng tươi sống và đồ khô, hệ thống xử lý nước thải chợ.',
    conversion_fee_rule: 'Khai thác theo mô hình hợp tác xã hoặc doanh nghiệp quản lý khai thác chợ.'
  },
  {
    code: 'DKH', name: 'Đất khoa học công nghệ', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#ddd6fe',
    is_residential: false, max_term_text: '50 năm',
    legal_summary: 'Đất phòng thí nghiệm trọng điểm quốc gia, trung tâm đổi mới sáng tạo, khu ươm tạo công nghệ cao.',
    buildable_guide: 'Xây dựng khu thử nghiệm, nhà xưởng R&D, trung tâm tính toán siêu máy tính AI.',
    conversion_fee_rule: 'Hưởng mức ưu đãi cao nhất về thuế và đất đai theo Luật Công nghệ cao.'
  },
  {
    code: 'DSN', name: 'Đất di tích danh lam thắng cảnh', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#a7f3d0',
    is_residential: false, max_term_text: 'Lâu dài',
    legal_summary: 'Vịnh, đầm phá, hang động, thắng cảnh thiên nhiên được xếp hạng bảo tồn danh thắng quốc gia.',
    buildable_guide: 'Nghiêm cấm phá vỡ cảnh quan tự nhiên. Chỉ xây dựng công trình ngắm cảnh thân thiện môi trường.',
    conversion_fee_rule: 'Bảo tồn nguyên trạng cho thế hệ tương lai.'
  },
  {
    code: 'DNG', name: 'Đất ngoại giao', group_name: 'Nhóm đất phi nông nghiệp', color_hex: '#fef08a',
    is_residential: false, max_term_text: 'Theo hiệp định ngoại giao',
    legal_summary: 'Đất xây dựng trụ sở Đại sứ quán, Lãnh sự quán các nước, cơ quan đại diện Liên Hợp Quốc và nhà công vụ viên ngoại giao.',
    buildable_guide: 'Xây dựng theo quy chuẩn an ninh ngoại giao quốc tế.',
    conversion_fee_rule: 'Thuê đất hoặc trao đổi ngoại giao theo các công ước quốc tế mà Việt Nam ký kết.'
  }
];

// Task 5: 35 Commercial Banks in Vietnam with accurate 2026 mortgage rates
const BANK_RATES = [
  // Big 4 Nhà Nước
  {
    slug: 'vietcombank', bank_name: 'Ngân hàng TMCP Ngoại thương Việt Nam', short_name: 'Vietcombank', bank_group: 'Big 4 Nhà Nước',
    promo_rate_6m: 5.5, promo_rate_12m: 6.0, promo_rate_24m: 7.2, floating_rate: 9.2,
    max_ltv_pct: 70, max_term_years: 25, early_repayment_fee: '1.0% trong 3 năm đầu, miễn phí từ năm thứ 5', grace_period_months: 12,
    notes: 'Lãi suất vay mua nhà ưu đãi hàng đầu thị trường, thủ tục pháp lý minh bạch, hạn mức cao.'
  },
  {
    slug: 'bidv', bank_name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam', short_name: 'BIDV', bank_group: 'Big 4 Nhà Nước',
    promo_rate_6m: 5.6, promo_rate_12m: 6.2, promo_rate_24m: 7.4, floating_rate: 9.3,
    max_ltv_pct: 75, max_term_years: 30, early_repayment_fee: '0.5% - 1.5% trong 3 năm đầu, miễn phí từ năm thứ 5', grace_period_months: 24,
    notes: 'Thời gian vay tối đa lên đến 30 năm, chính sách ân hạn gốc linh hoạt đến 24 tháng.'
  },
  {
    slug: 'vietinbank', bank_name: 'Ngân hàng TMCP Công Thương Việt Nam', short_name: 'VietinBank', bank_group: 'Big 4 Nhà Nước',
    promo_rate_6m: 5.8, promo_rate_12m: 6.4, promo_rate_24m: 7.5, floating_rate: 9.5,
    max_ltv_pct: 80, max_term_years: 25, early_repayment_fee: '1.0% trong 2 năm đầu, 0.5% năm thứ 3', grace_period_months: 12,
    notes: 'Hỗ trợ gói vay mua nhà dự án liên kết lãi suất cực kỳ cạnh tranh và hồ sơ giải ngân nhanh.'
  },
  {
    slug: 'agribank', bank_name: 'Ngân hàng Nông nghiệp & Phát triển Nông thôn Việt Nam', short_name: 'Agribank', bank_group: 'Big 4 Nhà Nước',
    promo_rate_6m: 6.0, promo_rate_12m: 6.5, promo_rate_24m: 7.6, floating_rate: 9.4,
    max_ltv_pct: 70, max_term_years: 20, early_repayment_fee: '1.0% trong 2 năm đầu', grace_period_months: 12,
    notes: 'Mạng lưới chi nhánh phủ kín toàn quốc đến từng huyện, xã; thế mạnh tài trợ đất nền và nhà ở nông thôn.'
  },

  // TMCP Hàng Đầu & Năng Động (26 ngân hàng)
  {
    slug: 'techcombank', bank_name: 'Ngân hàng TMCP Kỹ Thương Việt Nam', short_name: 'Techcombank', bank_group: 'TMCP Hàng Đầu',
    promo_rate_6m: 5.9, promo_rate_12m: 6.8, promo_rate_24m: 8.2, floating_rate: 10.2,
    max_ltv_pct: 80, max_term_years: 35, early_repayment_fee: '1.5% năm đầu, 1.0% năm 2, miễn phí từ năm thứ 4', grace_period_months: 24,
    notes: 'Chính sách ân hạn nợ gốc lên đến 24 tháng, thời gian vay dài nhất thị trường lên tới 35 năm.'
  },
  {
    slug: 'vpbank', bank_name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng', short_name: 'VPBank', bank_group: 'TMCP Hàng Đầu',
    promo_rate_6m: 6.5, promo_rate_12m: 7.2, promo_rate_24m: 8.5, floating_rate: 10.8,
    max_ltv_pct: 85, max_term_years: 25, early_repayment_fee: '1.5% trong 3 năm đầu, miễn phí từ năm thứ 4', grace_period_months: 12,
    notes: 'Hỗ trợ LTV tối đa lên tới 85% giá trị tài sản bảo đảm, chấp nhận nguồn thu linh hoạt.'
  },
  {
    slug: 'mb-bank', bank_name: 'Ngân hàng TMCP Quân Đội', short_name: 'MBBank', bank_group: 'TMCP Hàng Đầu',
    promo_rate_6m: 6.2, promo_rate_12m: 6.9, promo_rate_24m: 8.0, floating_rate: 9.8,
    max_ltv_pct: 80, max_term_years: 25, early_repayment_fee: '1.0% trong 3 năm đầu', grace_period_months: 12,
    notes: 'Thủ tục phê duyệt tự động nhanh chóng qua App MBBank, hạn mức vay lớn cho dự án đô thị.'
  },
  {
    slug: 'acb', bank_name: 'Ngân hàng TMCP Á Châu', short_name: 'ACB', bank_group: 'TMCP Hàng Đầu',
    promo_rate_6m: 6.0, promo_rate_12m: 6.8, promo_rate_24m: 7.9, floating_rate: 9.7,
    max_ltv_pct: 75, max_term_years: 25, early_repayment_fee: '1.0% trong 2 năm đầu, miễn phí từ năm thứ 4', grace_period_months: 12,
    notes: 'Dịch vụ định giá bất động sản minh bạch, chuyên nghiệp và chi phí cạnh tranh.'
  },
  {
    slug: 'sacombank', bank_name: 'Ngân hàng TMCP Sài Gòn Thương Tín', short_name: 'Sacombank', bank_group: 'TMCP Hàng Đầu',
    promo_rate_6m: 6.3, promo_rate_12m: 7.2, promo_rate_24m: 8.4, floating_rate: 10.0,
    max_ltv_pct: 75, max_term_years: 25, early_repayment_fee: '1.0% trong 2 năm đầu', grace_period_months: 12,
    notes: 'Gói vay linh hoạt trả gốc bậc thang, phù hợp hộ kinh doanh cá thể.'
  },
  {
    slug: 'vib', bank_name: 'Ngân hàng TMCP Quốc Tế Việt Nam', short_name: 'VIB', bank_group: 'TMCP Năng Động',
    promo_rate_6m: 6.5, promo_rate_12m: 7.5, promo_rate_24m: 8.9, floating_rate: 10.5,
    max_ltv_pct: 80, max_term_years: 30, early_repayment_fee: '1.5% trong 3 năm đầu', grace_period_months: 12,
    notes: 'Chuyên sâu tài trợ nhà phố và đất nền sổ đỏ, tốc độ thẩm định hồ sơ trong 24h.'
  },
  {
    slug: 'tpbank', bank_name: 'Ngân hàng TMCP Tiên Phong', short_name: 'TPBank', bank_group: 'TMCP Năng Động',
    promo_rate_6m: 6.2, promo_rate_12m: 7.0, promo_rate_24m: 8.3, floating_rate: 10.3,
    max_ltv_pct: 75, max_term_years: 30, early_repayment_fee: '1.0% trong 3 năm đầu', grace_period_months: 12,
    notes: 'Ứng dụng số hóa hồ sơ vay trực tuyến, phê duyệt nhanh không cần gặp mặt ban đầu.'
  },
  {
    slug: 'hdbank', bank_name: 'Ngân hàng TMCP Phát triển TP.HCM', short_name: 'HDBank', bank_group: 'TMCP Năng Động',
    promo_rate_6m: 6.5, promo_rate_12m: 7.3, promo_rate_24m: 8.6, floating_rate: 10.5,
    max_ltv_pct: 75, max_term_years: 30, early_repayment_fee: '1.2% trong 3 năm đầu', grace_period_months: 12,
    notes: 'Liên kết sâu rộng các dự án căn hộ và nhà ở xã hội trên địa bàn TP.HCM và vùng phụ cận.'
  },
  {
    slug: 'shb', bank_name: 'Ngân hàng TMCP Sài Gòn - Hà Nội', short_name: 'SHB', bank_group: 'TMCP',
    promo_rate_6m: 6.4, promo_rate_12m: 7.1, promo_rate_24m: 8.4, floating_rate: 10.2,
    max_ltv_pct: 75, max_term_years: 25, early_repayment_fee: '1.0% trong 3 năm đầu', grace_period_months: 12,
    notes: 'Lãi suất cố định 12 tháng đầu cạnh tranh, giải ngân theo tiến độ hợp đồng mua bán.'
  },
  {
    slug: 'lpbank', bank_name: 'Ngân hàng TMCP Lộc Phát Việt Nam', short_name: 'LPBank', bank_group: 'TMCP Năng Động',
    promo_rate_6m: 6.3, promo_rate_12m: 7.2, promo_rate_24m: 8.4, floating_rate: 10.1,
    max_ltv_pct: 75, max_term_years: 25, early_repayment_fee: '1.0% trong 3 năm đầu', grace_period_months: 12,
    notes: 'Mạng lưới bưu cục và phòng giao dịch rộng khắp hỗ trợ khách hàng địa phương.'
  },
  {
    slug: 'msb', bank_name: 'Ngân hàng TMCP Hàng Hải Việt Nam', short_name: 'MSB', bank_group: 'TMCP Năng Động',
    promo_rate_6m: 6.3, promo_rate_12m: 7.0, promo_rate_24m: 8.2, floating_rate: 10.0,
    max_ltv_pct: 80, max_term_years: 35, early_repayment_fee: '1.0% trong 3 năm đầu', grace_period_months: 24,
    notes: 'Gói vay ân hạn gốc tới 24 tháng cho khách hàng mua nhà lần đầu.'
  },
  {
    slug: 'ocb', bank_name: 'Ngân hàng TMCP Phương Đông', short_name: 'OCB', bank_group: 'TMCP Năng Động',
    promo_rate_6m: 6.5, promo_rate_12m: 7.4, promo_rate_24m: 8.7, floating_rate: 10.4,
    max_ltv_pct: 80, max_term_years: 30, early_repayment_fee: '1.5% trong 2 năm đầu', grace_period_months: 12,
    notes: 'Tốc độ giải ngân siêu tốc trong 8 giờ làm việc sau khi hoàn tất hồ sơ pháp lý.'
  },
  {
    slug: 'seabank', bank_name: 'Ngân hàng TMCP Đông Nam Á', short_name: 'SeABank', bank_group: 'TMCP',
    promo_rate_6m: 6.6, promo_rate_12m: 7.5, promo_rate_24m: 8.8, floating_rate: 10.5,
    max_ltv_pct: 75, max_term_years: 25, early_repayment_fee: '1.0% trong 3 năm đầu', grace_period_months: 12,
    notes: 'Gói vay mua nhà SeAHome lãi suất minh bạch, định giá tài sản đa dạng.'
  },
  {
    slug: 'eximbank', bank_name: 'Ngân hàng TMCP Xuất Nhập Khẩu Việt Nam', short_name: 'Eximbank', bank_group: 'TMCP',
    promo_rate_6m: 6.5, promo_rate_12m: 7.5, promo_rate_24m: 8.8, floating_rate: 10.4,
    max_ltv_pct: 75, max_term_years: 25, early_repayment_fee: '1.0% trong 2 năm đầu', grace_period_months: 12,
    notes: 'Thủ tục tín dụng nhanh gọn cho khách hàng vay mua nhà phố và căn hộ tái định cư.'
  },
  {
    slug: 'nam-a-bank', bank_name: 'Ngân hàng TMCP Nam Á', short_name: 'NamABank', bank_group: 'TMCP',
    promo_rate_6m: 6.7, promo_rate_12m: 7.6, promo_rate_24m: 8.9, floating_rate: 10.6,
    max_ltv_pct: 75, max_term_years: 25, early_repayment_fee: '1.2% trong 3 năm đầu', grace_period_months: 12,
    notes: 'Gói Happy Home ưu đãi thế hệ trẻ mua căn hộ đầu tiên với biên độ thả nổi thấp.'
  },
  {
    slug: 'abbank', bank_name: 'Ngân hàng TMCP An Bình', short_name: 'ABBank', bank_group: 'TMCP',
    promo_rate_6m: 6.6, promo_rate_12m: 7.5, promo_rate_24m: 8.8, floating_rate: 10.5,
    max_ltv_pct: 75, max_term_years: 25, early_repayment_fee: '1.0% trong 3 năm đầu', grace_period_months: 12,
    notes: 'Gói YouHome chuyên biệt cho khách hàng mua nhà thổ cư tại các đô thị lớn.'
  },
  {
    slug: 'pvcombank', bank_name: 'Ngân hàng TMCP Đại Chúng Việt Nam', short_name: 'PVcomBank', bank_group: 'TMCP',
    promo_rate_6m: 6.8, promo_rate_12m: 7.7, promo_rate_24m: 9.0, floating_rate: 10.7,
    max_ltv_pct: 75, max_term_years: 25, early_repayment_fee: '1.5% trong 3 năm đầu', grace_period_months: 12,
    notes: 'Liên kết chặt chẽ với các dự án năng lượng và đô thị ven sông.'
  },
  {
    slug: 'bac-a-bank', bank_name: 'Ngân hàng TMCP Bắc Á', short_name: 'BacABank', bank_group: 'TMCP',
    promo_rate_6m: 6.8, promo_rate_12m: 7.8, promo_rate_24m: 9.0, floating_rate: 10.8,
    max_ltv_pct: 70, max_term_years: 20, early_repayment_fee: '1.5% trong 3 năm đầu', grace_period_months: 12,
    notes: 'Tập trung mạng lưới khách hàng khu vực miền Trung và miền Bắc, lãi suất ổn định.'
  },
  {
    slug: 'viet-a-bank', bank_name: 'Ngân hàng TMCP Việt Á', short_name: 'VietABank', bank_group: 'TMCP',
    promo_rate_6m: 7.2, promo_rate_12m: 8.2, promo_rate_24m: 9.5, floating_rate: 11.2,
    max_ltv_pct: 70, max_term_years: 20, early_repayment_fee: '1.5% trong 3 năm đầu', grace_period_months: 6,
    notes: 'Tài trợ các phân khúc nhà ở thứ cấp và bất động sản khu dân cư hiện hữu.'
  },
  {
    slug: 'ncb', bank_name: 'Ngân hàng TMCP Quốc Dân', short_name: 'NCB', bank_group: 'TMCP',
    promo_rate_6m: 6.9, promo_rate_12m: 7.9, promo_rate_24m: 9.1, floating_rate: 10.9,
    max_ltv_pct: 75, max_term_years: 25, early_repayment_fee: '1.0% trong 2 năm đầu', grace_period_months: 12,
    notes: 'Gói vay mua nhà An Cư số hóa, thủ tục đơn giản và giải ngân kịp thời.'
  },
  {
    slug: 'bvbank', bank_name: 'Ngân hàng TMCP Bản Việt', short_name: 'BVBank', bank_group: 'TMCP',
    promo_rate_6m: 6.7, promo_rate_12m: 7.6, promo_rate_24m: 8.9, floating_rate: 10.6,
    max_ltv_pct: 75, max_term_years: 25, early_repayment_fee: '1.2% trong 2 năm đầu', grace_period_months: 12,
    notes: 'Chính sách vay mua nhà phố linh hoạt, thẩm định giá trị tài sản bám sát giá thị trường.'
  },
  {
    slug: 'kienlongbank', bank_name: 'Ngân hàng TMCP Kiên Long', short_name: 'KienlongBank', bank_group: 'TMCP',
    promo_rate_6m: 7.0, promo_rate_12m: 8.0, promo_rate_24m: 9.2, floating_rate: 11.0,
    max_ltv_pct: 70, max_term_years: 20, early_repayment_fee: '1.5% trong 2 năm đầu', grace_period_months: 6,
    notes: 'Mạng lưới chi nhánh miền Tây Nam Bộ cực mạnh, thủ tục quen thuộc với người dân nông thôn.'
  },
  {
    slug: 'saigonbank', bank_name: 'Ngân hàng TMCP Sài Gòn Công Thương', short_name: 'Saigonbank', bank_group: 'TMCP',
    promo_rate_6m: 7.0, promo_rate_12m: 8.0, promo_rate_24m: 9.2, floating_rate: 10.9,
    max_ltv_pct: 70, max_term_years: 20, early_repayment_fee: '1.0% trong 2 năm đầu', grace_period_months: 6,
    notes: 'Tập trung tệp khách hàng truyền thống và nhà ở phân khúc vừa tại khu vực TP.HCM.'
  },
  {
    slug: 'pg-bank', bank_name: 'Ngân hàng TMCP Thịnh Vượng và Phát Triển', short_name: 'PGBank', bank_group: 'TMCP',
    promo_rate_6m: 6.9, promo_rate_12m: 7.8, promo_rate_24m: 9.0, floating_rate: 10.8,
    max_ltv_pct: 70, max_term_years: 20, early_repayment_fee: '1.5% trong 2 năm đầu', grace_period_months: 12,
    notes: 'Tài trợ mua nhà đất đô thị loại 1 và loại 2 với lãi suất ổn định.'
  },
  {
    slug: 'vietbank', bank_name: 'Ngân hàng TMCP Việt Nam Thương Tín', short_name: 'Vietbank', bank_group: 'TMCP',
    promo_rate_6m: 6.8, promo_rate_12m: 7.7, promo_rate_24m: 8.9, floating_rate: 10.7,
    max_ltv_pct: 75, max_term_years: 25, early_repayment_fee: '1.0% trong 2 năm đầu', grace_period_months: 12,
    notes: 'Hỗ trợ gói vay mua bất động sản thổ cư và căn hộ dự án đã có biên bản nghiệm thu.'
  },
  {
    slug: 'baoviet-bank', bank_name: 'Ngân hàng TMCP Bảo Việt', short_name: 'BaoVietBank', bank_group: 'TMCP',
    promo_rate_6m: 6.8, promo_rate_12m: 7.7, promo_rate_24m: 8.9, floating_rate: 10.7,
    max_ltv_pct: 70, max_term_years: 25, early_repayment_fee: '1.0% trong 3 năm đầu', grace_period_months: 12,
    notes: 'Ưu đãi tích hợp gói bảo hiểm nhà ở và tài sản toàn diện của Tập đoàn Bảo Việt.'
  },

  // Ngân Hàng Nước Ngoài (5 ngân hàng)
  {
    slug: 'shinhan-bank', bank_name: 'Ngân hàng TNHH MTV Shinhan Việt Nam', short_name: 'Shinhan Bank', bank_group: 'Ngân Hàng Nước Ngoài',
    promo_rate_6m: 5.4, promo_rate_12m: 5.9, promo_rate_24m: 7.0, floating_rate: 8.8,
    max_ltv_pct: 70, max_term_years: 30, early_repayment_fee: '1.0% trong 3 năm đầu, miễn phí từ năm thứ 4', grace_period_months: 12,
    notes: 'Lãi suất siêu hấp dẫn hàng đầu thị trường, chứng minh thu nhập sao kê lương chuẩn mực.'
  },
  {
    slug: 'woori-bank', bank_name: 'Ngân hàng TNHH MTV Woori Việt Nam', short_name: 'Woori Bank', bank_group: 'Ngân Hàng Nước Ngoài',
    promo_rate_6m: 5.5, promo_rate_12m: 6.0, promo_rate_24m: 7.1, floating_rate: 8.9,
    max_ltv_pct: 70, max_term_years: 30, early_repayment_fee: '1.0% trong 3 năm đầu', grace_period_months: 12,
    notes: 'Ưu đãi lãi suất lớn cho cán bộ nhân viên công ty Hàn Quốc và các tập đoàn FDI tại Việt Nam.'
  },
  {
    slug: 'standard-chartered', bank_name: 'Ngân hàng Standard Chartered Việt Nam', short_name: 'Standard Chartered', bank_group: 'Ngân Hàng Nước Ngoài',
    promo_rate_6m: 5.8, promo_rate_12m: 6.5, promo_rate_24m: 7.8, floating_rate: 9.2,
    max_ltv_pct: 70, max_term_years: 25, early_repayment_fee: '1.5% trong 3 năm đầu', grace_period_months: 12,
    notes: 'Dịch vụ Priority Banking cao cấp, giải pháp tài chính quốc tế cho khách hàng cao cấp.'
  },
  {
    slug: 'hsbc', bank_name: 'Ngân hàng TNHH MTV HSBC Việt Nam', short_name: 'HSBC', bank_group: 'Ngân Hàng Nước Ngoài',
    promo_rate_6m: 5.7, promo_rate_12m: 6.3, promo_rate_24m: 7.5, floating_rate: 9.0,
    max_ltv_pct: 70, max_term_years: 25, early_repayment_fee: '1.5% trong 3 năm đầu', grace_period_months: 12,
    notes: 'Quy chuẩn định giá tài sản quốc tế, lãi suất ưu đãi cho khách hàng HSBC Premier.'
  },
  {
    slug: 'uob', bank_name: 'Ngân hàng UOB Việt Nam', short_name: 'UOB', bank_group: 'Ngân Hàng Nước Ngoài',
    promo_rate_6m: 5.6, promo_rate_12m: 6.2, promo_rate_24m: 7.4, floating_rate: 9.1,
    max_ltv_pct: 75, max_term_years: 30, early_repayment_fee: '1.0% trong 3 năm đầu', grace_period_months: 12,
    notes: 'Gói vay Home Loan liên kết các dự án chung cư cao cấp tại TP.HCM và Hà Nội.'
  }
];

async function run() {
  const pClient = new Client({ connectionString: PG_URI });
  await pClient.connect();

  console.log('=== Step 4: Populating land_use_types ===');
  await pClient.query('TRUNCATE TABLE land_use_types RESTART IDENTITY CASCADE;');

  for (const land of LAND_USE_TYPES) {
    await pClient.query(`
      INSERT INTO land_use_types (
        code, name, group_name, color_hex, is_residential,
        max_term_text, legal_summary, buildable_guide, conversion_fee_rule
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        group_name = EXCLUDED.group_name,
        color_hex = EXCLUDED.color_hex,
        is_residential = EXCLUDED.is_residential,
        max_term_text = EXCLUDED.max_term_text,
        legal_summary = EXCLUDED.legal_summary,
        buildable_guide = EXCLUDED.buildable_guide,
        conversion_fee_rule = EXCLUDED.conversion_fee_rule;
    `, [
      land.code, land.name, land.group_name, land.color_hex, land.is_residential,
      land.max_term_text, land.legal_summary, land.buildable_guide, land.conversion_fee_rule
    ]);
  }
  const landRes = await pClient.query('SELECT COUNT(*) FROM land_use_types;');
  console.log(`land_use_types row count: ${landRes.rows[0].count}`);

  console.log('=== Step 5: Populating bank_mortgage_rates ===');
  await pClient.query('TRUNCATE TABLE bank_mortgage_rates RESTART IDENTITY CASCADE;');

  for (const bank of BANK_RATES) {
    await pClient.query(`
      INSERT INTO bank_mortgage_rates (
        slug, bank_name, short_name, bank_group,
        promo_rate_6m, promo_rate_12m, promo_rate_24m, floating_rate,
        max_ltv_pct, max_term_years, early_repayment_fee, grace_period_months,
        notes, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      ON CONFLICT (slug) DO UPDATE SET
        bank_name = EXCLUDED.bank_name,
        short_name = EXCLUDED.short_name,
        bank_group = EXCLUDED.bank_group,
        promo_rate_6m = EXCLUDED.promo_rate_6m,
        promo_rate_12m = EXCLUDED.promo_rate_12m,
        promo_rate_24m = EXCLUDED.promo_rate_24m,
        floating_rate = EXCLUDED.floating_rate,
        max_ltv_pct = EXCLUDED.max_ltv_pct,
        max_term_years = EXCLUDED.max_term_years,
        early_repayment_fee = EXCLUDED.early_repayment_fee,
        grace_period_months = EXCLUDED.grace_period_months,
        notes = EXCLUDED.notes,
        updated_at = NOW();
    `, [
      bank.slug, bank.bank_name, bank.short_name, bank.bank_group,
      bank.promo_rate_6m, bank.promo_rate_12m, bank.promo_rate_24m, bank.floating_rate,
      bank.max_ltv_pct, bank.max_term_years, bank.early_repayment_fee, bank.grace_period_months,
      bank.notes
    ]);
  }
  const bankRes = await pClient.query('SELECT COUNT(*) FROM bank_mortgage_rates;');
  console.log(`bank_mortgage_rates row count: ${bankRes.rows[0].count}`);

  await pClient.end();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
