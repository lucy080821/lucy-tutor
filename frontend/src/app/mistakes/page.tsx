export default function MistakeBank() {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
      <section className="rounded-2xl bg-primary-soft border border-line px-5 py-6 sm:px-8 sm:py-8 flex flex-col md:flex-row md:items-center gap-6">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm text-muted mb-2">Trang chủ / Sổ Tay Câu Sai</p>
          <h1 className="ui-page-title sm:text-4xl mb-2">Sổ Tay Câu Sai</h1>
          <p className="ui-page-subtitle mb-5">Những câu bạn đã làm sai cần được ôn tập lại bằng thuật toán lặp lại ngắt quãng.</p>
          <button className="btn-primary px-6 py-3 shrink-0">
            Ôn Tập Ngay (15 câu)
          </button>
        </div>
        <div className="hidden md:block w-full max-w-[320px] shrink-0">
          <img src="/images/thumbs/mistakes.svg" alt="Minh hoạ sổ tay câu sai" width={640} height={360} loading="eager" className="w-full h-auto rounded-2xl" />
        </div>
      </section>

      <div className="flex gap-2.5 mb-6 overflow-x-auto pb-2">
        <FilterTag label="Tất cả" active />
        <FilterTag label="Ngữ pháp" />
        <FilterTag label="Từ vựng" />
        <FilterTag label="Đọc hiểu" />
        <FilterTag label="Mức độ: Khó" />
      </div>

      <div className="space-y-4">
        {/* Sample Mistake Item */}
        <div className="ui-card ui-card-hover p-5 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-6">
          <div className="flex flex-row sm:flex-col items-center justify-center gap-2 sm:gap-0 p-4 bg-red-50 rounded-xl text-red-700 sm:min-w-[100px]">
            <span className="text-3xl font-black">3</span>
            <span className="text-xs font-bold uppercase mt-1">Lần sai</span>
          </div>
          
          <div className="flex-1">
            <div className="flex gap-2 mb-2">
              <span className="ui-badge">Conditionals</span>
              <span className="ui-badge bg-amber-50 text-amber-700">Medium</span>
            </div>
            <p className="font-semibold text-lg text-foreground mb-4">If I _____ you, I would study harder.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-muted block mb-1">Bạn đã chọn:</span>
                <span className="font-semibold text-red-600 line-through">B. was</span>
              </div>
              <div>
                <span className="text-sm text-muted block mb-1">Đáp án đúng:</span>
                <span className="font-semibold text-emerald-700">C. were</span>
              </div>
            </div>
            
            <div className="mt-4 p-4 rounded-xl bg-primary-soft text-sm text-foreground">
              <span className="font-bold text-primary block mb-1">Giải thích:</span>
              Câu điều kiện loại 2 diễn tả hành động không có thật ở hiện tại. Động từ "to be" được dùng là "were" cho TẤT CẢ các ngôi trong mệnh đề if.
            </div>
          </div>
        </div>
        
        {/* Sample Mistake Item 2 */}
        <div className="ui-card ui-card-hover p-5 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-6">
          <div className="flex flex-row sm:flex-col items-center justify-center gap-2 sm:gap-0 p-4 bg-red-50 rounded-xl text-red-700 sm:min-w-[100px]">
            <span className="text-3xl font-black">1</span>
            <span className="text-xs font-bold uppercase mt-1">Lần sai</span>
          </div>
          
          <div className="flex-1">
            <div className="flex gap-2 mb-2">
              <span className="ui-badge">Idioms</span>
              <span className="ui-badge bg-red-50 text-red-700">Hard</span>
            </div>
            <p className="font-semibold text-lg text-foreground mb-4">When he realized his mistake, he tried to _____ it up.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-muted block mb-1">Bạn đã chọn:</span>
                <span className="font-semibold text-red-600 line-through">C. hide</span>
              </div>
              <div>
                <span className="text-sm text-muted block mb-1">Đáp án đúng:</span>
                <span className="font-semibold text-emerald-700">A. cover</span>
              </div>
            </div>
            
            <div className="mt-4 p-4 rounded-xl bg-primary-soft text-sm text-foreground">
              <span className="font-bold text-primary block mb-1">Giải thích:</span>
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
    <button className={`ui-chip cursor-pointer
      ${active ? 'ui-chip-active' : ''}`}>
      {label}
    </button>
  );
}
