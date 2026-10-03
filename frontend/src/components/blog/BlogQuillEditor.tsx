"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

// Lệnh điều khiển editor từ bên ngoài (vd sidebar "Bài viết liên quan" chèn link vào nội dung)
export type BlogEditorApi = { insertLink: (text: string, url: string) => void };

// Editor nội dung bài blog. Phải load qua next/dynamic (ssr: false) — Quill không chạy được phía server.
// Tách thành component riêng để giữ được ref tới Quill (next/dynamic không chuyển tiếp ref), cần cho
// nút chèn ảnh: ảnh được upload lên Storage rồi chèn URL, thay vì Quill mặc định nhét base64 vào HTML.
export default function BlogQuillEditor({
  value,
  onChange,
  onUploadImage,
  apiRef,
}: {
  value: string;
  onChange: (html: string) => void;
  onUploadImage: (file: File) => Promise<string | null>;
  apiRef?: RefObject<BlogEditorApi | null>;
}) {
  const quillRef = useRef<ReactQuill>(null);
  // Giữ handler mới nhất mà không phải tạo lại `modules` (đổi modules = Quill khởi tạo lại, mất nội dung đang gõ)
  const uploadRef = useRef(onUploadImage);
  useEffect(() => { uploadRef.current = onUploadImage; }, [onUploadImage]);

  // Vị trí con trỏ gần nhất trong editor — bấm nút ở sidebar làm editor mất focus, nên phải nhớ lại
  // để chèn link đúng chỗ người dùng đang viết. Chưa từng đặt con trỏ thì chèn vào cuối bài.
  const lastRangeRef = useRef<{ index: number; length: number } | null>(null);
  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const onSel = (range: { index: number; length: number } | null) => { if (range) lastRangeRef.current = range; };
    quill.on("selection-change", onSel);
    if (apiRef) {
      apiRef.current = {
        insertLink: (text, url) => {
          const range = lastRangeRef.current;
          if (range && range.length > 0) {
            // Đang bôi đen chữ -> gắn link vào đúng chữ đó
            quill.formatText(range.index, range.length, "link", url, "user");
            quill.setSelection(range.index + range.length, 0, "user");
            return;
          }
          const index = range ? range.index : Math.max(0, quill.getLength() - 1);
          quill.insertText(index, text, { link: url }, "user");
          quill.insertText(index + text.length, " ", { link: false }, "user");
          quill.setSelection(index + text.length + 1, 0, "user");
        },
      };
    }
    return () => {
      quill.off("selection-change", onSel);
      if (apiRef) apiRef.current = null;
    };
  }, [apiRef]);

  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ header: [2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ color: [] }, { background: [] }],
        [{ list: "ordered" }, { list: "bullet" }, { indent: "-1" }, { indent: "+1" }],
        [{ align: [] }],
        ["blockquote", "code-block"],
        ["link", "image", "video"],
        ["clean"],
      ],
      handlers: {
        image: () => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/png,image/jpeg,image/webp,image/gif";
          input.onchange = async () => {
            const file = input.files?.[0];
            const quill = quillRef.current?.getEditor();
            if (!file || !quill) return;
            const url = await uploadRef.current(file);
            if (!url) return;
            const range = quill.getSelection(true);
            quill.insertEmbed(range.index, "image", url, "user");
            quill.setSelection(range.index + 1, 0);
          };
          input.click();
        },
      },
    },
  }), []);

  return (
    <div className="blog-editor">
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        placeholder="Bắt đầu viết nội dung bài viết... (dùng Tiêu đề 2/3 để chia mục — trang bài viết sẽ tự tạo mục lục)"
        className="bg-white text-black rounded-xl"
      />
    </div>
  );
}
