import Link from "next/link";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/20 blur-[120px] pointer-events-none" />

      <div className="max-w-3xl z-10 space-y-8 mt-12">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">
          Nền tảng Tiếng Anh <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
            Thông Minh Cho Mọi Nhà
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-foreground/70 max-w-2xl mx-auto">
          Học sinh tự tin bứt phá điểm số với AI phân tích điểm yếu. Giáo viên dễ dàng quản lý lớp học và số hóa đề thi chỉ bằng 1 cú click.
        </p>

        <div className="pt-8 flex flex-col sm:flex-row gap-6 justify-center">
          <Link href="/auth?role=STUDENT" className="px-8 py-4 rounded-2xl bg-primary text-white font-bold text-lg shadow-[0_0_40px_-10px_rgba(79,70,229,0.5)] hover:scale-105 transition-transform flex items-center justify-center gap-2">
            Dành cho Học Sinh
          </Link>
          <Link href="/auth?role=TEACHER" className="px-8 py-4 rounded-2xl glass font-bold text-lg hover:-translate-y-1 transition-transform flex items-center justify-center gap-2 border-2 border-primary/20">
            Dành cho Giáo Viên
          </Link>
        </div>
      </div>
      
      <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl z-10">
        <FeatureCard 
          title="Phân Tích Điểm Yếu" 
          desc="Tự động phát hiện các phần ngữ pháp bạn hay sai và đề xuất bài ôn tập." 
        />
        <FeatureCard 
          title="Tự Động Quét Đề Thi" 
          desc="Giáo viên chỉ cần upload file Word/PDF, hệ thống tự trích xuất câu hỏi và đáp án." 
        />
        <FeatureCard 
          title="Quản Lý Lớp Học" 
          desc="Tạo lớp, cấp mã mời và theo dõi toàn bộ tiến độ của từng học sinh." 
        />
      </div>
    </div>
  );
}

function FeatureCard({ title, desc }: { title: string, desc: string }) {
  return (
    <div className="glass p-6 rounded-3xl text-left hover:-translate-y-2 transition-transform duration-300">
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-foreground/70">{desc}</p>
    </div>
  );
}
