// Bảng động từ bất quy tắc (trang /bang-dong-tu-bat-quy-tac). Mỗi dòng: "V1|V2|V3|nghĩa".
// Dạng có 2 cách viết ghi "a/b" (thường là Anh-Anh / Anh-Mỹ, vd learnt/learned). Dấu * = nhóm thông dụng nhất
// (hay gặp trong sách giáo khoa và đề thi THPT) — dùng cho bộ lọc "Thông dụng" và bài luyện mặc định.
export type IrregularVerb = { v1: string; v2: string; v3: string; vi: string; common: boolean };

const RAW = `
arise|arose|arisen|phát sinh, nảy sinh
awake|awoke|awoken|thức dậy, đánh thức
*be|was/were|been|thì, là, ở
bear|bore|borne|chịu đựng; mang
*beat|beat|beaten|đánh, đánh bại
*become|became|become|trở nên
*begin|began|begun|bắt đầu
bend|bent|bent|bẻ cong, cúi xuống
bet|bet|bet|đánh cược
bind|bound|bound|buộc, trói
*bite|bit|bitten|cắn
bid|bid|bid|trả giá, đấu thầu
bleed|bled|bled|chảy máu
*blow|blew|blown|thổi
*break|broke|broken|làm vỡ, phá vỡ
breed|bred|bred|nuôi, gây giống
*bring|brought|brought|mang đến
broadcast|broadcast|broadcast|phát sóng
*build|built|built|xây dựng
*burn|burnt/burned|burnt/burned|đốt cháy
burst|burst|burst|nổ tung, vỡ òa
*buy|bought|bought|mua
cast|cast|cast|ném, tung; phân vai
*catch|caught|caught|bắt, chụp
*choose|chose|chosen|chọn, lựa chọn
cling|clung|clung|bám vào
*come|came|come|đến
*cost|cost|cost|có giá là
creep|crept|crept|bò, trườn
*cut|cut|cut|cắt
*deal|dealt|dealt|giải quyết, xử lý
*dig|dug|dug|đào
dive|dived/dove|dived|lặn
*do|did|done|làm
*draw|drew|drawn|vẽ; kéo
*dream|dreamt/dreamed|dreamt/dreamed|mơ
*drink|drank|drunk|uống
*drive|drove|driven|lái xe
*eat|ate|eaten|ăn
*fall|fell|fallen|ngã, rơi
*feed|fed|fed|cho ăn
*feel|felt|felt|cảm thấy
*fight|fought|fought|chiến đấu
fit|fit/fitted|fit/fitted|vừa vặn
*find|found|found|tìm thấy
flee|fled|fled|chạy trốn
*fly|flew|flown|bay
forbid|forbade|forbidden|cấm
forecast|forecast|forecast|dự báo
*forget|forgot|forgotten|quên
*forgive|forgave|forgiven|tha thứ
*freeze|froze|frozen|đóng băng
*get|got|got/gotten|có được, trở nên
*give|gave|given|cho, tặng
*go|went|gone|đi
grind|ground|ground|xay, nghiền
*grow|grew|grown|mọc, lớn lên, trồng
*hang|hung|hung|treo
*have|had|had|có
*hear|heard|heard|nghe
*hide|hid|hidden|giấu, trốn
*hit|hit|hit|đánh, va vào
*hold|held|held|cầm, nắm; tổ chức
*hurt|hurt|hurt|làm đau, làm tổn thương
*keep|kept|kept|giữ
kneel|knelt/kneeled|knelt/kneeled|quỳ
*know|knew|known|biết
*lay|laid|laid|đặt, để; đẻ (trứng)
*lead|led|led|dẫn dắt
lean|leant/leaned|leant/leaned|dựa vào
leap|leapt/leaped|leapt/leaped|nhảy qua
*learn|learnt/learned|learnt/learned|học
*leave|left|left|rời đi, để lại
*lend|lent|lent|cho mượn
*let|let|let|để cho, cho phép
*lie|lay|lain|nằm
*light|lit/lighted|lit/lighted|thắp sáng
*lose|lost|lost|mất, thua
*make|made|made|làm, chế tạo
*mean|meant|meant|có nghĩa là
*meet|met|met|gặp
mislead|misled|misled|làm lạc hướng
mistake|mistook|mistaken|nhầm lẫn
misunderstand|misunderstood|misunderstood|hiểu lầm
overcome|overcame|overcome|vượt qua
outgrow|outgrew|outgrown|lớn vượt, không còn hợp
oversleep|overslept|overslept|ngủ quên
*pay|paid|paid|trả tiền
prove|proved|proven/proved|chứng minh
*put|put|put|đặt, để
rebuild|rebuilt|rebuilt|xây dựng lại
quit|quit|quit|từ bỏ
*read|read|read|đọc
*ride|rode|ridden|cưỡi, đạp xe
*ring|rang|rung|reo, rung chuông
*rise|rose|risen|mọc, tăng lên
*run|ran|run|chạy
*say|said|said|nói
*see|saw|seen|nhìn thấy
seek|sought|sought|tìm kiếm
*sell|sold|sold|bán
*send|sent|sent|gửi
*set|set|set|đặt, thiết lập
sew|sewed|sewn/sewed|may, khâu
*shake|shook|shaken|lắc, rung
*shine|shone|shone|chiếu sáng
*shoot|shot|shot|bắn; quay phim
*show|showed|shown/showed|cho xem, chỉ
shrink|shrank|shrunk|co lại
*shut|shut|shut|đóng lại
*sing|sang|sung|hát
*sink|sank|sunk|chìm
*sit|sat|sat|ngồi
*sleep|slept|slept|ngủ
slide|slid|slid|trượt
*smell|smelt/smelled|smelt/smelled|ngửi; có mùi
*speak|spoke|spoken|nói
speed|sped|sped|tăng tốc, chạy nhanh
*spell|spelt/spelled|spelt/spelled|đánh vần
*spend|spent|spent|tiêu (tiền); dành (thời gian)
spill|spilt/spilled|spilt/spilled|làm đổ
spin|spun|spun|quay, xoay
spit|spat|spat|khạc, nhổ
split|split|split|chia, tách
spoil|spoilt/spoiled|spoilt/spoiled|làm hỏng; chiều hư
*spread|spread|spread|lan truyền
spring|sprang|sprung|nhảy, bật lên
*stand|stood|stood|đứng
*steal|stole|stolen|ăn trộm
*stick|stuck|stuck|dán, dính
sting|stung|stung|châm, chích
strike|struck|struck|đánh; đình công
strive|strove|striven|cố gắng
swear|swore|sworn|thề
*sweep|swept|swept|quét
*swim|swam|swum|bơi
swing|swung|swung|đu đưa
*take|took|taken|cầm, lấy
*teach|taught|taught|dạy
*tear|tore|torn|xé
*tell|told|told|kể, bảo
*think|thought|thought|nghĩ
*throw|threw|thrown|ném
*understand|understood|understood|hiểu
undertake|undertook|undertaken|đảm nhận
upset|upset|upset|làm buồn lòng
*wake|woke|woken|thức dậy
*wear|wore|worn|mặc, đội, đeo
weave|wove|woven|dệt
weep|wept|wept|khóc
*win|won|won|thắng
wind|wound|wound|quấn; lên dây cót
withdraw|withdrew|withdrawn|rút lui; rút (tiền)
*write|wrote|written|viết
rewrite|rewrote|rewritten|viết lại
`;

export const IRREGULAR_VERBS: IrregularVerb[] = RAW.trim().split("\n").map((line) => {
  const common = line.startsWith("*");
  const [v1, v2, v3, vi] = line.replace(/^\*/, "").split("|").map((x) => x.trim());
  return { v1, v2, v3, vi, common };
}).sort((a, b) => a.v1.localeCompare(b.v1));

/** So khớp đáp án với 1 trong các dạng "a/b" (không phân biệt hoa thường, bỏ khoảng trắng thừa). */
export function matchForm(input: string, form: string): boolean {
  const a = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (!a) return false;
  return form.toLowerCase().split("/").some((f) => f.trim() === a) || a === form.toLowerCase();
}

/** Bỏ dấu tiếng Việt để tìm theo nghĩa không cần gõ dấu. */
export function normalizeVi(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}
