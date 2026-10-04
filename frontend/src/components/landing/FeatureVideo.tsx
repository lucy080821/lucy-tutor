"use client";

import { useEffect, useRef, useState } from "react";

// Video giới thiệu tính năng trên landing page (MP4 1776×840, ~73 giây, không tiếng).
// Dùng MP4 thay GIF: nét gấp đôi, đủ màu, nhẹ hơn và dừng được (GIF chạy >5 giây không dừng được là vi phạm WCAG 2.2.2).
// - Phát nhanh PLAYBACK_RATE lần và bỏ qua đoạn mở đầu gần như trắng (START_AT) để vừa thấy là có chuyển động.
// - preload="none" lúc đầu; còn cách khung video PRELOAD_MARGIN thì mới bắt đầu tải → trang vẫn nhẹ nhưng cuộn tới
//   là phát được ngay. Tự phát khi ≥25% khung hình lọt vào màn hình, cuộn qua thì dừng.
//   Người dùng đã bấm Tạm dừng thì không tự phát lại.
// - Bật "giảm chuyển động" ở hệ điều hành → không tự tải/tự phát, chỉ hiện poster + nút Phát.
// Poster = đúng khung hình tại START_AT để chuyển từ ảnh sang video không bị giật.
const SRC = "/videos/lucy-tutor-features.mp4";
const POSTER = "/videos/lucy-tutor-features-poster.webp";
const PLAYBACK_RATE = 2;
const START_AT = 0.5; // giây
const PRELOAD_MARGIN = "800px 0px";

export default function FeatureVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const userPausedRef = useRef(false);
  const visibleRef = useRef(false);
  const [playing, setPlaying] = useState(false);

  const prepare = (video: HTMLVideoElement) => {
    video.defaultPlaybackRate = PLAYBACK_RATE;
    video.playbackRate = PLAYBACK_RATE;
    if (video.currentTime < START_AT) video.currentTime = START_AT;
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Gần tới thì tải trước
    const preloader = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        video.preload = "auto";
        if (video.networkState === HTMLMediaElement.NETWORK_EMPTY) video.load();
        preloader.disconnect();
      },
      { rootMargin: PRELOAD_MARGIN }
    );
    // Lọt vào màn hình thì phát, ra khỏi thì dừng
    const player = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          if (!userPausedRef.current) {
            prepare(video);
            video.play().catch(() => { /* trình duyệt chặn tự phát — người dùng tự bấm Phát */ });
          }
        } else if (!video.paused) {
          video.pause();
        }
      },
      { threshold: 0.25 }
    );
    preloader.observe(video);
    player.observe(video);
    return () => { preloader.disconnect(); player.disconnect(); };
  }, []);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      userPausedRef.current = false;
      prepare(video);
      video.play().catch(() => {});
    } else {
      userPausedRef.current = true;
      video.pause();
    }
  };

  // Tự lặp lại (không dùng thuộc tính loop) để mỗi vòng cũng bỏ qua đoạn mở đầu trắng
  const restart = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = START_AT;
    // Hết vòng lúc người xem đã cuộn đi chỗ khác thì chỉ tua về đầu, đợi cuộn lại mới phát
    if (visibleRef.current && !userPausedRef.current) video.play().catch(() => {});
  };

  return (
    <div className="relative">
      <video
        ref={videoRef}
        className="block w-full h-auto bg-[#fcfbfc]"
        width={1776}
        height={840}
        poster={POSTER}
        muted
        playsInline
        preload="none"
        aria-label="Video giới thiệu các tính năng của Lucy Tutor: luyện 4 kỹ năng, AI chấm Writing theo tiêu chí IELTS, đề thi thử THPT Quốc Gia và dùng thử miễn phí 3 ngày"
        onLoadedMetadata={(e) => prepare(e.currentTarget)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={restart}
      >
        <source src={SRC} type="video/mp4" />
      </video>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Tạm dừng video" : "Phát video"}
        className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-primary/85 text-white flex items-center justify-center shadow-card hover:bg-primary transition-colors cursor-pointer"
      >
        {playing ? (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="w-4 h-4 ml-0.5" fill="currentColor"><path d="M7 4.5v15l12-7.5z" /></svg>
        )}
      </button>
    </div>
  );
}
