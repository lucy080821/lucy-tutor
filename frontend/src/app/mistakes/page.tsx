export default function MistakeBank() {
  return (
    <div className="p-8 max-w-5xl mx-auto w-full space-y-8">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Sổ Tay Câu Sai</h1>
          <p className="text-foreground/70">Những câu bạn đã làm sai cần được ôn tập lại bằng thuật toán lặp lại ngắt quãng.</p>
        </div>
        <button className="px-6 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 shadow-lg shadow-primary/30 transition-all">
          Ôn Tập Ngay (15 câu)
        </button>
      </div>

      <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
        <FilterTag label="Tất cả" active />
        <FilterTag label="Ngữ pháp" />
        <FilterTag label="Từ vựng" />
        <FilterTag label="Đọc hiểu" />
        <FilterTag label="Mức độ: Khó" />
      </div>

      <div className="space-y-4">
        {/* Sample Mistake Item */}
        <div className="glass p-6 rounded-2xl flex gap-6">
          <div className="flex flex-col items-center justify-center p-4 bg-red-500/10 rounded-xl text-red-500 min-w-[100px]">
            <span className="text-3xl font-black">3</span>
            <span className="text-xs font-bold uppercase mt-1">Lần sai</span>
          </div>
          
          <div className="flex-1">
            <div className="flex gap-2 mb-2">
              <span className="text-xs font-bold px-2 py-1 bg-secondary/10 text-secondary rounded">Conditionals</span>
              <span className="text-xs font-bold px-2 py-1 bg-accent/10 text-accent rounded">Medium</span>
            </div>
            <p className="font-medium text-lg mb-4">If I _____ you, I would study harder.</p>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-foreground/50 block mb-1">Bạn đã chọn:</span>
                <span className="font-medium text-red-500 line-through">B. was</span>
              </div>
              <div>
                <span className="text-sm text-foreground/50 block mb-1">Đáp án đúng:</span>
                <span className="font-medium text-secondary">C. were</span>
              </div>
            </div>
            
            <div className="mt-4 p-4 rounded-xl bg-foreground/5 text-sm">
              <span className="font-bold block mb-1">Giải thích:</span>
              Câu điều kiện loại 2 diễn tả hành động không có thật ở hiện tại. Động từ "to be" được dùng là "were" cho TẤT CẢ các ngôi trong mệnh đề if.
            </div>
          </div>
        </div>
        
        {/* Sample Mistake Item 2 */}
        <div className="glass p-6 rounded-2xl flex gap-6">
          <div className="flex flex-col items-center justify-center p-4 bg-red-500/10 rounded-xl text-red-500 min-w-[100px]">
            <span className="text-3xl font-black">1</span>
            <span className="text-xs font-bold uppercase mt-1">Lần sai</span>
          </div>
          
          <div className="flex-1">
            <div className="flex gap-2 mb-2">
              <span className="text-xs font-bold px-2 py-1 bg-primary/10 text-primary rounded">Idioms</span>
              <span className="text-xs font-bold px-2 py-1 bg-red-500/10 text-red-500 rounded">Hard</span>
            </div>
            <p className="font-medium text-lg mb-4">When he realized his mistake, he tried to _____ it up.</p>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-foreground/50 block mb-1">Bạn đã chọn:</span>
                <span className="font-medium text-red-500 line-through">C. hide</span>
              </div>
              <div>
                <span className="text-sm text-foreground/50 block mb-1">Đáp án đúng:</span>
                <span className="font-medium text-secondary">A. cover</span>
              </div>
            </div>
            
            <div className="mt-4 p-4 rounded-xl bg-foreground/5 text-sm">
              <span className="font-bold block mb-1">Giải thích:</span>
              Cụm động từ "cover up" có nghĩa là che giấu sự thật (thường là một sai lầm hoặc tội lỗi).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterTag({ label, active }: { label: string, active?: boolean }) {
  return (
    <button className={`px-4 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-colors
      ${active ? 'bg-primary text-white' : 'bg-foreground/5 hover:bg-foreground/10 text-foreground/80'}`}>
      {label}
    </button>
  );
}
