"use client";
import { useState, type ReactNode } from "react";
import Modal from "./Modal";
import {
  IconBarn, IconBolt, IconMail, IconChat, IconFlame, IconGift, IconHelp, IconMaximize, IconMenu, IconMove, IconPalette, IconPaw, IconPen, IconShop,
  IconSprout, IconStar, IconTarget, IconTruck, IconUsers, IconWeather, IconWheel, IconZoomIn, IconBrain,
} from "./FarmIcons";

// Hướng dẫn chơi: chia tab theo việc người chơi cần biết. Số liệu (thưởng, thời gian, giá) lấy đúng theo farmCatalog.js —
// sửa cân bằng game ở backend thì nhớ sửa lại ở đây.
type Item = { icon: (p: { size?: number }) => React.ReactElement; title: string; body: ReactNode; tip?: ReactNode };
type Tab = { id: string; label: string; intro?: ReactNode; items: Item[] };

const B = ({ children }: { children: ReactNode }) => <b className="text-foreground">{children}</b>;

const TABS: Tab[] = [
  {
    id: "start", label: "Bắt đầu",
    intro: <>Mỗi ô đất là <B>một từ (hoặc thẻ ngữ pháp, phát âm)</B> bạn cần nhớ. Cây lớn theo đúng <B>lịch ôn tập SRS</B>, thu hoạch chính là lúc bạn ôn lại từ đó.</>,
    items: [
      { icon: IconSprout, title: "1. Trồng", body: <>Bấm <B>ô đất trống (dấu +)</B> rồi chọn hạt giống. Có 5 nguồn: <B>Deck của bạn</B> (từ đang học), <B>Từ vựng</B> (20 chủ đề), <B>Ngữ pháp</B>, <B>Phát âm</B> và <B>SGK</B> (từ vựng Global Success lớp 1–12 theo Unit). Xem thẻ từ trước khi trồng.</> },
      { icon: IconBolt, title: "2. Chờ cây lớn", body: <>Từ mới chín sau <B>10 phút</B>. Những lần sau, thời gian chờ là khoảng cách tới lần ôn kế tiếp của riêng từ đó (1 ngày, 6 ngày, vài tuần…), hiện ngay dưới cây. Từ càng nhớ chắc thì chờ càng lâu.</>, tip: <>Xu và kim cương <B>không mua được thời gian chờ</B> vì đó là lịch ôn tối ưu cho trí nhớ của bạn. Muốn nhanh hơn, hãy xem tab &ldquo;Học nhanh &amp; thưởng&rdquo;.</> },
      { icon: IconPen, title: "3. Thu hoạch bằng trí nhớ", body: <>Cây chín hiện dấu <B>!</B>. Bấm vào và trả lời 1 câu: chọn nghĩa, nghe rồi chọn, gõ lại từ hoặc điền câu. <B>Đúng</B> thì nhận xu, XP và nông sản. <B>Sai</B> thì cây héo, mọc lại sau 10 phút để bạn học lại từ đầu.</>, tip: <>Nút <B>&ldquo;N cây chín&rdquo;</B> ở góc cảnh đưa bạn tới cây chín đầu tiên.</> },
      { icon: IconTruck, title: "4. Dùng thành quả", body: <>Nông sản vào <B>Kho</B>. Dùng để <B>giao đơn hàng</B> cho khách, bán lấy xu, <B>chế biến</B> ở nhà máy hoặc <B>cho vật nuôi ăn</B>. Có tiền thì mua thêm ô đất, mở rộng đất và trang trí.</> },
    ],
  },
  {
    id: "fast", label: "Học nhanh & thưởng",
    intro: <>Muốn rút ngắn thời gian chờ thì phải <B>học thêm</B>. Bấm vào <B>cây đang lớn</B> để thấy 2 cách dưới đây, cùng phần thưởng của cây.</>,
    items: [
      { icon: IconBolt, title: "Ôn sớm", body: <>Trả lời 1 câu <B>gõ/điền từ, không có gợi ý</B>. Đúng thì thu hoạch ngay, nhưng thưởng chỉ <B>một nửa</B> và <B>lịch ôn gốc không đổi</B> (lần chín kế tiếp hẹn sau khoảng 60% chu kỳ hiện tại, tối thiểu 6 giờ). Trả lời sai thì <B>không héo, không mất gì</B>, và game không tiết lộ đáp án.</> },
      { icon: IconSprout, title: "Tưới nước bằng kiến thức", body: <>Gõ lại một từ <B>đã học khác</B> (không phải từ của cây). Đúng thì cây rút <B>10% thời gian còn lại</B>, bạn được +3 xu. Tối đa <B>3 lần mỗi cây mỗi ngày</B>.</> },
      { icon: IconFlame, title: "Chờ càng lâu càng lời", body: <>Thưởng xu, XP và nông sản nhân theo độ dài chu kỳ: 1 giờ <B>×1,15</B> · 6 giờ <B>×1,4</B> · 1 ngày <B>×1,8</B> · 3 ngày <B>×2,4</B> · 7 ngày <B>×3,2</B> · từ 14 ngày <B>×4</B>. Cây báo trước mức thưởng khi bạn bấm vào.</>, tip: <>Từ bạn nhớ càng lâu thì thu hoạch càng lớn, nên đừng ngại trả lời cẩn thận.</> },
      { icon: IconStar, title: "Từ thuộc lòng", body: <>Từ nhớ lâu hơn <B>21 ngày</B> được đánh dấu ⭐ — cất vào kho để lấy lại chỗ trồng từ mới. Trong <B>Kho</B> có mục <B>Ôn kho từ</B>: gõ lại 5 từ đã thuộc, mỗi từ đúng được 6 xu (tối đa 15 từ có thưởng mỗi ngày) mà không đổi lịch ôn.</> },
      { icon: IconBrain, title: "Cây héo nghĩa là gì?", body: <>Bạn trả lời sai khi thu hoạch. Từ đó quay về đầu chu kỳ và mọc lại sau 10 phút. Đây là lúc game giúp bạn ôn lại từ đang quên.</> },
    ],
  },
  {
    id: "farm", label: "Nông trại",
    intro: <>Tiền kiếm được dùng để mở rộng, nuôi vật nuôi, chế biến và trang trí. Mở <B>Cửa hàng</B> (nút cam ở thanh dưới) để mua.</>,
    items: [
      { icon: IconTruck, title: "Đơn hàng", body: <>Khách đặt hàng: giao nông sản lấy từ Kho, hoặc đơn <B>&ldquo;Viết câu&rdquo;</B>: game nêu 1 từ vựng bạn đã trồng kèm nghĩa, bạn viết 1 câu tiếng Anh có chứa từ đó (được chia dạng, vd <i>play</i> → <i>plays</i>, <i>played</i>); AI chấm ngữ pháp và nghĩa, sai thì chỉ cần làm lại. Giao càng nhiều đơn thì đơn càng khó và thưởng càng lớn. Bỏ đơn tốn một ít xu.</> },
      { icon: IconBarn, title: "Chuồng trại", body: <>Cửa hàng › <B>Chuồng trại</B> (gà cấp 3, vịt 4, bò 5, heo 6, cừu 7; mỗi loại 1 chuồng). Chọn <B>Xây</B> (rẻ nhưng phải đợi) hoặc <B>Mua ngay</B> (đắt hơn nhiều). Sau đó bấm chuồng để mua vật nuôi, <B>cho ăn bằng nông sản trong Kho</B>, chờ rồi thu <B>trứng, sữa, trứng vịt, nấm truffle hoặc len</B>. Gà, vịt ra sân ban ngày và về chuồng buổi tối.</>, tip: <>Chờ càng lâu thì lãi mỗi giờ càng cao: bò, heo, cừu lời hơn gà, vịt.</> },
      { icon: IconShop, title: "Nhà máy chế biến", body: <>Lò bánh (cấp 4), Máy ép nước (5), Bếp làm mứt (6), Nhà hàng nhỏ (8). Bấm nhà máy, chọn công thức: nguyên liệu trừ từ Kho, chờ đủ phút thật, rồi thu <B>thành phẩm giá cao hơn nhiều</B> so với bán nguyên liệu. Sản phẩm chuồng trại cũng là nguyên liệu (bánh kem, phô mai…).</> },
      { icon: IconMove, title: "Mở rộng đất & ô đất", body: <>Cửa hàng › <B>Đất đai</B>: thêm ô trồng, và mở rộng đất theo <B>chiều ngang (↘ thêm 3 cột)</B> hoặc <B>chiều dọc (↙ thêm 2 hàng)</B> tuỳ bạn chọn. Giá tính theo số ô thêm và tăng theo diện tích đất.</> },
      { icon: IconPalette, title: "Trang trí & sắp xếp", body: <>Bấm nút <B>Sắp xếp</B> trên thanh công cụ: chọn món rồi <B>Xoay</B>, <B>Bán</B> hoặc bấm ô trống để dời. Tường, rào, hàng cây và cổng tự nối liền nhau. <B>Bán lại chỉ được 25% giá</B> (đồ mua bằng kim cương được hoàn xu), nên hãy cân nhắc trước khi mua.</> },
    ],
  },
  {
    id: "pet", label: "Qilin & bạn bè",
    items: [
      { icon: IconPaw, title: "Qilin con", body: <>Vuốt ve, <B>cho ăn mỗi ngày 1 lần</B>, đổi tên và thay trang phục (mua ở Cửa hàng). Qilin lên cấp khi được chăm sóc và có <B>kỹ năng theo cấp</B>: cấp 2 +10% xu thu hoạch, cấp 3 +10% xu đơn hàng, cấp 4 thám hiểm nhanh hơn 20%, cấp 5 nhà máy nhanh hơn 15%, cấp 6 +25% XP.</>, tip: <>Kỹ năng chỉ hoạt động khi bạn <B>đã cho Qilin ăn hôm nay</B>. Dấu ! ở nút Qilin nhắc bạn.</> },
      { icon: IconBolt, title: "Thám hiểm", body: <>Cho Qilin đi <B>15 phút, 1 giờ hoặc 4 giờ</B> (mở dần theo cấp Qilin). Về mang xu, nông sản, đôi khi kim cương và <B>từ vựng mới tự vào deck</B> để bạn trồng. Lúc đi vắng Qilin không có ở nông trại.</> },
      { icon: IconTarget, title: "Nhiệm vụ & thành tựu", body: <>Mỗi ngày có <B>4 nhiệm vụ</B> và 1 rương thưởng khi làm đủ. <B>Thành tựu</B> là các mốc dài hạn. Nút Nhiệm vụ hiện số phần thưởng đang chờ nhận.</> },
      { icon: IconWheel, title: "Vòng quay", body: <>Quay <B>1 lần mỗi ngày</B> để nhận xu, kim cương, nông sản hoặc đồ trang trí.</> },
      { icon: IconMail, title: "Thư tiếng Anh cho bạn cùng lớp", body: <>Nút <B>phong thư</B> bên phải cảnh. Viết thư <B>bằng tiếng Anh</B> cho bạn cùng lớp (có mẫu câu gợi ý), bấm <B>Kiểm tra bằng AI</B> để được sửa lỗi và nhận mẹo trước khi gửi. Chọn <B>Nhờ giúp nông sản</B> để xin bạn gửi hàng; khi bạn bấm <B>Giúp bạn</B> thì hàng chuyển sang Kho của người nhờ và bạn được thưởng xu.</>, tip: <>Mỗi ngày gửi tối đa 15 thư, nhờ giúp tối đa 3 lần; 3 thư đầu được thưởng xu. Không chia sẻ số điện thoại hay mạng xã hội.</> },
      { icon: IconChat, title: "Khách ghé nông trại (NPC)", body: <>Mỗi khoảng 3 giờ có thể có khách ghé: <B>Mr. Bao</B> (thương nhân), <B>Grandma Lan</B>, <B>Tom</B> (du khách), <B>Mina</B> (bé gái). Bấm vào khách để trò chuyện bằng tiếng Anh, AI đóng vai và sửa câu của bạn. Làm xong <B>nhiệm vụ nói chuyện</B> để nhận thưởng; thương nhân còn <B>mua nông sản giá cao hơn Kho</B> sau khi bạn đề nghị bán.</> },
      { icon: IconUsers, title: "Bạn bè & bảng vàng", body: <>Thăm nông trại của bạn cùng lớp và học viên khác, <B>thả tim</B> (1 lần/ngày mỗi bạn), <B>tặng quà</B> (tối đa 3 lần/ngày) và xem <B>Bảng vàng</B> theo số lần thu hoạch.</> },
    ],
  },
  {
    id: "village", label: "Làng quê",
    intro: <>Nông trại của bạn nằm giữa một <B>ngôi làng quê</B>: đường làng, ruộng, ao, xe cộ và dân làng đi lại. <B>Thu nhỏ</B> (nút kính lúp −) để thấy cả làng, bấm vào các toà nhà để dùng chức năng của chúng.</>,
    items: [
      { icon: IconShop, title: "Chợ làng, Tạp hóa, Kho vận", body: <><B>Chợ làng</B> mua nông sản theo <B>giá chợ đổi mỗi ngày</B> (0,8–1,4× giá kho) — hôm nào giá cao thì bán. <B>Tạp hóa</B> là Cửa hàng. <B>Kho vận</B> là Kho nông sản.</>, tip: <>Hàng giá thấp hôm nay thì để dành giao đơn hoặc chờ ngày mai.</> },
      { icon: IconChat, title: "Trường làng và Quán ăn", body: <>Nói chuyện tiếng Anh với <B>cô Mai</B> (giới thiệu bản thân) và phục vụ <B>Ben</B> (gọi món). Mỗi nơi có <B>1 nhiệm vụ nói mỗi ngày</B>, AI sửa câu cho bạn và có thưởng khi làm xong.</> },
      { icon: IconMail, title: "Bưu điện, Thư viện, Đình làng", body: <><B>Bưu điện</B> viết thư tiếng Anh cho bạn cùng lớp. <B>Thư viện</B> mở thẳng mục <B>Ôn kho từ</B>. <B>Đình làng</B> là Nhiệm vụ, thành tựu và bảng vàng.</> },
      { icon: IconPaw, title: "Thú y, Hội chợ, Cổng làng, Bảng tin", body: <><B>Trạm thú y</B> chăm Qilin · <B>Lều hội chợ</B> là vòng quay may mắn · <B>Cổng làng</B> để thăm bạn bè · <B>Bảng tin</B> là đơn hàng của dân làng.</> },
      { icon: IconTruck, title: "Xe tới trại", body: <>Thỉnh thoảng có <B>xe tải thu mua</B> (mua số lượng lớn, giá cao) hoặc <B>xe bán rong</B> (bán nông sản cho bạn) đỗ ở lối vào phía đông. Bấm vào xe, nói tiếng Anh để hoàn thành nhiệm vụ rồi mới giao dịch được.</> },
      { icon: IconUsers, title: "Dân làng", body: <>Bấm vào người đi bộ trên đường để nghe một <B>câu chào tiếng Anh</B> kèm nghĩa tiếng Việt — cách học câu giao tiếp thông dụng.</> },
    ],
  },
  {
    id: "ctrl", label: "Điều khiển",
    items: [
      { icon: IconZoomIn, title: "Phóng to, thu nhỏ, kéo cảnh", body: <>Dùng 2 nút <B>kính lúp</B> bên phải cảnh, hoặc 2 ngón chụm trên điện thoại, hoặc <B>Ctrl + lăn chuột</B>. Khi đã phóng to hoặc đất rộng, <B>kéo</B> để xem phần còn lại.</> },
      { icon: IconMenu, title: "Thanh điều hướng", body: <>Dưới cảnh là Cửa hàng, Qilin, Nhiệm vụ, Vòng quay, Bạn bè, Kho. Huy hiệu đỏ hoặc dấu ! là việc đang chờ bạn. Trên điện thoại có nút nhỏ phía trên để <B>ẩn/hiện</B> thanh này cho rộng chỗ.</> },
      { icon: IconMaximize, title: "Toàn màn hình", body: <>Nút <B>toàn màn hình</B> gom mọi thứ trong 1 màn hình. <B>Đơn hàng</B> nằm ở nút xe tải trên thanh công cụ; bấm ra ngoài khung hoặc nút × để đóng.</> },
      { icon: IconWeather, title: "Ngày đêm & thời tiết", body: <>Cảnh đổi theo giờ thật (khuya Qilin đi ngủ). Bấm nút <B>đám mây</B> để bật thời tiết thật theo vị trí của bạn; tính năng tắt sẵn và toạ độ <B>không gửi về máy chủ Lucy Tutor</B>. Nút loa để tắt âm thanh.</> },
      { icon: IconGift, title: "Mẹo chơi", body: <>Vào mỗi ngày một lần để thu hoạch, quay vòng quay và cho Qilin ăn. Trả lời cẩn thận vì từ sai sẽ phải học lại. Cây chờ lâu thưởng lớn nên ưu tiên trồng từ bạn muốn nhớ thật chắc.</> },
    ],
  },
];

export default function HelpPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState(TABS[0].id);
  const cur = TABS.find((t) => t.id === tab) || TABS[0];
  const idx = TABS.findIndex((t) => t.id === cur.id);
  const last = idx === TABS.length - 1;
  return (
    <Modal title="Hướng dẫn Nông Trại Qilin" subtitle="Vừa chơi vừa nhớ từ — cây lớn theo đúng lịch ôn của bạn" onClose={onClose} wide
      footer={
        <div className="flex gap-2">
          {!last && <button onClick={() => setTab(TABS[idx + 1].id)} className="btn-outline rounded-full px-5 py-2.5 font-bold flex-1">Tiếp: {TABS[idx + 1].label}</button>}
          <button onClick={onClose} className="btn-primary rounded-full px-6 py-2.5 font-bold flex-1">{last ? "Đã hiểu, vào chơi!" : "Bắt đầu trồng!"}</button>
        </div>
      }>
      <div role="tablist" aria-label="Các phần hướng dẫn" className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={t.id === tab} onClick={() => setTab(t.id)} className={`ui-chip whitespace-nowrap ${t.id === tab ? "ui-chip-active" : ""}`}>{t.label}</button>
        ))}
      </div>
      {cur.intro && <p className="mt-3 text-sm text-muted leading-relaxed bg-primary-soft rounded-xl px-4 py-3">{cur.intro}</p>}
      <ul className="mt-3 space-y-3">
        {cur.items.map((it) => (
          <li key={it.title} className="flex gap-3 items-start rounded-xl border border-line p-3">
            <span className="farm-ring !w-10 !h-10 mt-0.5"><it.icon size={19} /></span>
            <div className="min-w-0">
              <h4 className="font-extrabold text-primary leading-tight">{it.title}</h4>
              <p className="text-sm text-muted leading-relaxed mt-1">{it.body}</p>
              {it.tip && <p className="text-xs leading-relaxed mt-2 rounded-lg bg-amber-50 text-amber-800 px-3 py-2"><b>Mẹo: </b>{it.tip}</p>}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] text-muted flex items-center gap-1.5"><IconHelp size={14} /> Mở lại hướng dẫn bất cứ lúc nào bằng nút dấu ? bên phải cảnh.</p>
    </Modal>
  );
}
