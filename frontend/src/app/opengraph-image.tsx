import { ImageResponse } from "next/og";

// Font mặc định của next/og (Geist) đã có đủ glyph tiếng Việt — không cần nạp font riêng.
export const alt = "Lucy Tutor – Nền tảng luyện thi Tiếng Anh toàn diện";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PILLS = ["Listening", "Reading", "Writing", "Speaking", "IELTS"];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: "#1E3A8A",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, letterSpacing: 6, color: "#BFDBFE" }}>
          ENGLISH LEARNING PLATFORM
        </div>
        <div style={{ display: "flex", fontSize: 128, letterSpacing: -2, marginTop: 12 }}>
          LUCY<span style={{ color: "#93C5FD", marginLeft: 24 }}>TUTOR</span>
        </div>
        <div style={{ display: "flex", fontSize: 48, marginTop: 16, color: "#E0E7FF" }}>
          Nền tảng luyện thi Tiếng Anh toàn diện
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 56 }}>
          {PILLS.map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                fontSize: 28,
                padding: "10px 28px",
                borderRadius: 999,
                border: "2px solid rgba(255,255,255,0.45)",
                background: "rgba(255,255,255,0.10)",
              }}
            >
              {label}
            </div>
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 14,
            background: "#3B82F6",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
