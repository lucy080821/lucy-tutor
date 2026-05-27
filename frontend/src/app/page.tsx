import Link from "next/link";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/20 blur-[120px] pointer-events-none" />

      <div className="max-w-3xl z-10 space-y-8 mt-12">
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight">
          Nền tảng Tiếng Anh <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
            Thông Minh Cho Mọi Nhà
          </span>
        </h1>
        
        <p className="text-base sm:text-lg md:text-xl text-foreground/70 max-w-2xl mx-auto px-4">
          Học sinh tự tin bứt phá điểm số với AI phân tích điểm yếu. Giáo viên dễ dàng quản lý lớp học và số hóa đề thi chỉ bằng 1 cú click.
        </p>

        <div className="pt-8 flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center w-full px-6">
          <Link href="/auth?role=STUDENT" className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-primary text-white font-bold text-lg shadow-[0_0_40px_-10px_rgba(79,70,229,0.5)] hover:scale-105 transition-transform flex items-center justify-center gap-2">
            Dành cho Học Sinh
          </Link>
          <Link href="/auth?role=TEACHER" className="w-full sm:w-auto px-8 py-4 rounded-2xl glass font-bold text-lg hover:-translate-y-1 transition-transform flex items-center justify-center gap-2 border-2 border-primary/20">
            Dành cho Giáo Viên
          </Link>
        </div>
      </div>
      
      <div className="mt-24 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 w-full max-w-5xl z-10 text-left">
        <FeatureCard 
          icon="🎯"
          title="Mục Tiêu & Lộ Trình" 
          desc="Thiết lập điểm số mục tiêu và theo dõi phần trăm hoàn thành chặng đường." 
        />
        <FeatureCard 
          icon="📚"
          title="Sổ Tay Lỗi Sai" 
          desc="Tự động lưu lại các câu làm sai theo từng chuyên đề và xuất ra PDF ôn tập." 
        />
        <FeatureCard 
          icon="💎"
          title="Cấp Bậc & EXP" 
          desc="Tích lũy kinh nghiệm, thăng hạng và giữ chuỗi học tập mỗi ngày như chơi game." 
        />
        <FeatureCard 
          icon="🤖"
          title="AI Phân Tích Điểm Yếu" 
          desc="Tự động phát hiện các phần ngữ pháp bạn hay sai và gợi ý bài luyện tập." 
        />
        <FeatureCard 
          icon="👨‍🏫"
          title="Quản Lý Lớp Học" 
          desc="Giáo viên dễ dàng tạo lớp, giao đề thi và theo dõi tiến độ chi tiết của học sinh." 
        />
        <FeatureCard 
          icon="✨"
          title="Giao Diện Cá Nhân" 
          desc="Thể hiện phong cách với ảnh đại diện Avatar sắc nét dung lượng lên đến 100MB." 
        />
      </div>
      {/* Footer */}
      <footer className="mt-32 w-full max-w-5xl border-t border-foreground/10 pt-8 pb-4 text-center z-10 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Lucy Tutor Logo" className="w-8 h-8 object-contain" />
          <span className="font-bold text-foreground/80">Lucy Tutor</span>
        </div>
        <p className="text-sm text-foreground/50 text-left md:text-right">
          © 2026 Lucy Tutor. Đã đăng ký bản quyền.<br/>
          Hệ thống luyện thi Tiếng Anh thông minh.
        </p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string, title: string, desc: string }) {
  return (
    <div className="glass p-6 rounded-3xl text-left hover:-translate-y-2 hover:shadow-xl hover:border-primary/30 transition-all duration-300 group bg-surface/50 backdrop-blur-md">
      <div className="text-4xl mb-4 group-hover:scale-110 transition-transform origin-left">{icon}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-foreground/70 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}
