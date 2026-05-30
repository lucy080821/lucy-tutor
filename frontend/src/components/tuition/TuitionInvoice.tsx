import React from 'react';

interface TuitionInvoiceProps {
  studentName: string;
  month: number;
  year: number;
  classes: Array<{
    classroomName: string;
    presentCount: number;
    feePerLesson: number;
    totalAmount: number;
  }>;
  totalAmount: number;
}

// Ensure this component is wrapped in a div with a fixed width (e.g., 800px) when rendering to PDF
export const TuitionInvoice = React.forwardRef<HTMLDivElement, TuitionInvoiceProps>(({
  studentName, month, year, classes, totalAmount
}, ref) => {
  return (
    <div ref={ref} className="bg-white text-slate-800 p-10 font-sans mx-auto" style={{ width: '800px', height: '1131px', boxSizing: 'border-box', position: 'relative' }}>
      
      {/* Header */}
      <div className="flex justify-between items-start mb-12 border-b-2 border-primary pb-8">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="LucyTutor Logo" className="w-16 h-16 object-contain" />
          <div>
            <h1 className="text-3xl font-black text-primary tracking-tight">LUCYTUTOR</h1>
            <p className="text-sm font-medium text-slate-500 mt-1">Học tập không ngừng, vươn tới thành công</p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-4xl font-black text-slate-800 mb-2 tracking-tighter">THÔNG BÁO HỌC PHÍ</h2>
          <p className="text-slate-500 font-medium">Tháng {month} / {year}</p>
        </div>
      </div>

      {/* Info Section */}
      <div className="mb-12 bg-slate-50 p-6 rounded-2xl border border-slate-100">
        <p className="text-sm font-semibold text-slate-500 mb-1">Kính gửi Phụ huynh bé</p>
        <h3 className="text-2xl font-bold text-primary mb-1">{studentName}</h3>
        <p className="text-sm font-medium text-slate-600">Lớp: {classes.map(c => c.classroomName).join(', ')}</p>
      </div>

      {/* Table Section */}
      <div className="mb-12">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-primary/5">
              <th className="py-4 px-6 font-bold text-slate-600 border-b-2 border-primary/20 rounded-tl-xl whitespace-nowrap">Mô tả chi tiết</th>
              <th className="py-4 px-6 font-bold text-slate-600 border-b-2 border-primary/20 text-center whitespace-nowrap">Số lượng</th>
              <th className="py-4 px-6 font-bold text-slate-600 border-b-2 border-primary/20 text-right whitespace-nowrap">Đơn giá</th>
              <th className="py-4 px-6 font-bold text-primary border-b-2 border-primary/20 text-right rounded-tr-xl whitespace-nowrap">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((cls, idx) => (
              <tr key={idx} className="border-b border-slate-100">
                <td className="py-6 px-6">
                  <p className="font-bold text-slate-800">Học phí tháng {month}/{year}</p>
                  <p className="text-sm text-slate-500 mt-1">Lớp {cls.classroomName} (Tính theo số buổi đi học thực tế)</p>
                </td>
                <td className="py-6 px-6 text-center font-semibold text-slate-700 whitespace-nowrap">{cls.presentCount} buổi</td>
                <td className="py-6 px-6 text-right font-semibold text-slate-700 whitespace-nowrap">{cls.feePerLesson.toLocaleString('vi-VN')} đ</td>
                <td className="py-6 px-6 text-right font-black text-primary text-lg whitespace-nowrap">{cls.totalAmount.toLocaleString('vi-VN')} đ</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Total & Payment Info */}
      <div className="flex justify-between items-end bg-primary/5 p-8 rounded-3xl border border-primary/10 mb-12">
        <div className="w-1/2">
          {totalAmount > 0 && (
            <>
              <p className="text-xs font-bold text-primary uppercase tracking-wider mb-3">Thông tin chuyển khoản</p>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-start gap-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold mb-1"><span className="text-slate-500">Ngân hàng:</span> TPBank</p>
                  <p className="text-sm font-semibold mb-1"><span className="text-slate-500">Chủ TK:</span> TA HOANG ANH TUAN</p>
                  <p className="text-sm font-semibold mb-1"><span className="text-slate-500">Số TK:</span> 86812121993</p>
                  <p className="text-sm font-semibold mt-3 pt-3 border-t border-slate-100 text-primary">
                    <span className="text-slate-500">Nội dung:</span> {studentName} HP T{month}
                  </p>
                </div>
                <div className="shrink-0 p-1 border-2 border-primary/20 rounded-lg">
                  <img 
                    src={`https://img.vietqr.io/image/tpbank-86812121993-qr_only.png?amount=${totalAmount}&addInfo=${encodeURIComponent(studentName + " HP T" + month)}&accountName=TA%20HOANG%20ANH%20TUAN`} 
                    alt="QR Code" 
                    className="w-24 h-24 object-contain" 
                    crossOrigin="anonymous" 
                  />
                </div>
              </div>
            </>
          )}
        </div>
        <div className="w-5/12">
          <div className="flex justify-between items-center mb-2 whitespace-nowrap gap-4">
            <span className="text-slate-500 font-semibold">Cộng tiền học:</span>
            <span className="font-bold">{totalAmount.toLocaleString('vi-VN')} đ</span>
          </div>
          <div className="flex justify-between items-center mb-4 whitespace-nowrap gap-4">
            <span className="text-slate-500 font-semibold">Khuyến mãi / Giảm trừ:</span>
            <span className="font-bold">0 đ</span>
          </div>
          <div className="flex justify-between items-center pt-4 border-t-2 border-primary/20 whitespace-nowrap gap-4">
            <span className="text-xl font-black text-slate-800">TỔNG CỘNG:</span>
            <span className="text-3xl font-black text-primary">{totalAmount.toLocaleString('vi-VN')} đ</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-10 left-10 right-10 text-center border-t border-slate-200 pt-6">
        <p className="text-sm font-semibold text-slate-600 mb-1">Cảm ơn bạn đã tin tưởng và đồng hành cùng LucyTutor!</p>
        <p className="text-xs text-slate-400">Mọi thắc mắc vui lòng liên hệ Zalo/SĐT: 0869.603.164</p>
      </div>
      
    </div>
  );
});

TuitionInvoice.displayName = 'TuitionInvoice';
