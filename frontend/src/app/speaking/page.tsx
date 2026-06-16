"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import Swal from "sweetalert2";

const PART1_TOPICS = [
  { id: "hometown", title: "Hometown & Living", prompt: "Describe your hometown. What do you like most about where you live? How has it changed over the years?" },
  { id: "study", title: "Study & Education", prompt: "Tell me about your studies. What subject do you enjoy most and why? What are your future study plans?" },
  { id: "hobbies", title: "Hobbies & Free Time", prompt: "What do you do in your free time? How did you develop this hobby? How much time do you spend on it each week?" },
  { id: "technology", title: "Technology & Internet", prompt: "How do you use technology in your daily life? Do you think young people spend too much time on their phones?" },
  { id: "food", title: "Food & Cooking", prompt: "What kinds of food do you like? Do you prefer cooking at home or eating out? What is a traditional dish from your country?" },
  { id: "travel", title: "Travel & Holidays", prompt: "Do you like travelling? Where have you been recently? What is your dream travel destination?" },
];

const PART2_TOPICS = [
  { id: "person", title: "Describe a person", prompt: "Describe a person you admire. You should say: who this person is, how you know them, what they do, and explain why you admire them. You have 1 minute to prepare, then speak for 1-2 minutes." },
  { id: "place", title: "Describe a place", prompt: "Describe a place you have visited that made a strong impression on you. You should say: where it is, when you went there, what you did there, and explain why it made such an impression." },
  { id: "experience", title: "Describe an experience", prompt: "Describe a challenging experience you had. You should say: what happened, when it happened, who was involved, and explain how you dealt with the challenge." },
  { id: "object", title: "Describe an object", prompt: "Describe something you own that is very important to you. You should say: what it is, how long you have had it, how you use it, and explain why it is important to you." },
];

const PART3_TOPICS = [
  { id: "education", title: "Education System", prompt: "Do you think the education system in Vietnam adequately prepares students for the modern workforce? What changes would you suggest?" },
  { id: "environment", title: "Environment & Climate", prompt: "How serious is environmental pollution in your country? What do you think individuals and governments should do to address this issue?" },
  { id: "technology_future", title: "Future of Technology", prompt: "Some people believe that artificial intelligence will soon replace human workers. To what extent do you agree? What jobs do you think are most at risk?" },
  { id: "urbanization", title: "Urbanization", prompt: "What are the main problems caused by rapid urbanization? How can city planners and governments address these challenges effectively?" },
];

const TIPS = [
  "Nói to rõ, không cần hoàn hảo — fluency quan trọng hơn accuracy",
  "Dùng connectors: firstly, moreover, on the other hand, in conclusion",
  "Kéo dài câu trả lời Part 1 thành 2-3 câu với lý do cụ thể",
  "Part 2: dùng 1 phút chuẩn bị để note ra 3-4 ý chính",
  "Nếu không biết từ, diễn đạt lại bằng cách khác — đừng dừng lại",
];

type RecordingState = "idle" | "prep" | "recording" | "done";

export default function SpeakingPracticePage() {
  const [selectedPart, setSelectedPart] = useState<1 | 2 | 3>(1);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [transcript, setTranscript] = useState("");
  const [prepTimer, setPrepTimer] = useState(60);
  const [recordTimer, setRecordTimer] = useState(0);
  const [feedback, setFeedback] = useState<any>(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [currentTip, setCurrentTip] = useState(0);

  const recognitionRef = useRef<any>(null);
  const prepIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [hasSpeechAPI, setHasSpeechAPI] = useState(true);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setHasSpeechAPI(!!SpeechRecognition);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTip(t => (t + 1) % TIPS.length), 5000);
    return () => clearInterval(interval);
  }, []);

  const topics = selectedPart === 1 ? PART1_TOPICS : selectedPart === 2 ? PART2_TOPICS : PART3_TOPICS;
  const currentTopic = topics.find(t => t.id === selectedTopic);

  const startPrep = () => {
    if (!selectedTopic) return;
    if (selectedPart === 1) {
      startRecording();
      return;
    }
    setRecordingState("prep");
    setPrepTimer(60);
    prepIntervalRef.current = setInterval(() => {
      setPrepTimer(prev => {
        if (prev <= 1) {
          clearInterval(prepIntervalRef.current!);
          startRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startRecording = useCallback(async () => {
    setRecordingState("recording");
    setTranscript("");
    setRecordTimer(0);
    setAudioUrl(null);
    audioChunksRef.current = [];

    recordIntervalRef.current = setInterval(() => {
      setRecordTimer(t => t + 1);
    }, 1000);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start(200);
    } catch {
      // microphone not available — still allow transcript-only mode
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;

      let finalTranscript = "";
      recognition.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + " ";
          } else {
            interim = event.results[i][0].transcript;
          }
        }
        setTranscript(finalTranscript + interim);
      };
      recognition.onerror = () => {};
      recognition.start();
      recognitionRef.current = recognition;
    }
  }, []);

  const stopRecording = () => {
    clearInterval(recordIntervalRef.current!);
    recognitionRef.current?.stop();
    mediaRecorderRef.current?.stop();
    setRecordingState("done");
  };

  const skipPrep = () => {
    clearInterval(prepIntervalRef.current!);
    startRecording();
  };

  const reset = () => {
    clearInterval(prepIntervalRef.current!);
    clearInterval(recordIntervalRef.current!);
    recognitionRef.current?.stop();
    mediaRecorderRef.current?.stop();
    setRecordingState("idle");
    setTranscript("");
    setFeedback(null);
    setAudioUrl(null);
    setPrepTimer(60);
    setRecordTimer(0);
  };

  const getAIFeedback = async () => {
    if (!transcript.trim()) {
      Swal.fire("Chưa có bài nói", "Vui lòng ghi âm trước khi nhận feedback.", "warning");
      return;
    }
    setLoadingFeedback(true);
    setFeedback(null);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const res = await fetch(`${API}/api/ai/speaking-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcript.trim(),
          prompt: currentTopic?.prompt,
          part: selectedPart,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFeedback(data);
    } catch {
      setFeedback({
        bandScore: null,
        fluency: "Không thể kết nối AI. Vui lòng thử lại.",
        lexical: "",
        grammar: "",
        pronunciation: "",
        suggestions: ["Kiểm tra kết nối mạng và backend API."],
      });
    } finally {
      setLoadingFeedback(false);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-surface border-b border-foreground/10 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-foreground/50 hover:text-foreground transition-colors text-sm font-medium flex items-center gap-1">
          ← Dashboard
        </Link>
        <span className="text-foreground/20">/</span>
        <h1 className="font-bold text-foreground">Speaking Practice</h1>
        <span className="ml-auto px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold border border-purple-200">IELTS Speaking</span>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Tip Banner */}
        <div className="bg-purple-50 border border-purple-200 px-5 py-3 flex items-center gap-3">
          <span className="text-purple-600 font-bold text-sm shrink-0">💡 Mẹo:</span>
          <p className="text-purple-700 text-sm font-medium transition-all">{TIPS[currentTip]}</p>
        </div>

        {/* Part Selector */}
        <div className="bg-surface border border-foreground/10 p-6">
          <h2 className="font-bold text-lg mb-4">Chọn phần thi</h2>
          <div className="grid grid-cols-3 gap-3">
            {([1, 2, 3] as const).map(part => (
              <button
                key={part}
                onClick={() => { setSelectedPart(part); setSelectedTopic(null); reset(); }}
                className={`p-4 text-left border transition-all ${selectedPart === part ? "bg-purple-50 border-purple-300 text-purple-700" : "border-foreground/15 hover:border-foreground/30"}`}
              >
                <div className="font-black text-2xl mb-1">Part {part}</div>
                <div className="text-sm text-foreground/60">
                  {part === 1 ? "Câu hỏi cá nhân (4-5 phút)" : part === 2 ? "Monologue chủ đề (3-4 phút)" : "Thảo luận học thuật (4-5 phút)"}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Topic Selector */}
        <div className="bg-surface border border-foreground/10 p-6">
          <h2 className="font-bold text-lg mb-4">Chọn chủ đề Part {selectedPart}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {topics.map(topic => (
              <button
                key={topic.id}
                onClick={() => { setSelectedTopic(topic.id); reset(); }}
                className={`p-4 text-left border transition-all ${selectedTopic === topic.id ? "bg-purple-50 border-purple-300 text-purple-700" : "border-foreground/15 hover:border-foreground/30"}`}
              >
                <div className="font-bold">{topic.title}</div>
                <div className="text-xs text-foreground/50 mt-1 line-clamp-2">{topic.prompt}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Recording Area */}
        {selectedTopic && currentTopic && (
          <div className="bg-surface border border-foreground/10 p-6 space-y-6">
            <div className="bg-purple-50 border border-purple-200 p-5">
              <p className="text-sm font-bold text-purple-600 mb-2 uppercase tracking-wide">Đề bài</p>
              <p className="text-foreground/80 leading-relaxed">{currentTopic.prompt}</p>
            </div>

            {/* State: idle */}
            {recordingState === "idle" && (
              <div className="flex flex-col items-center gap-4 py-6">
                {!hasSpeechAPI && (
                  <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 px-4 py-2 text-center">
                    Trình duyệt của bạn không hỗ trợ Speech Recognition. Transcript sẽ không hiển thị, nhưng vẫn có thể ghi âm.
                  </p>
                )}
                <button
                  onClick={startPrep}
                  className="w-20 h-20 bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center transition-colors shadow-lg"
                >
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                </button>
                <p className="text-foreground/60 text-sm">
                  {selectedPart === 1 ? "Nhấn để bắt đầu nói ngay" : "Nhấn để bắt đầu 1 phút chuẩn bị"}
                </p>
              </div>
            )}

            {/* State: prep */}
            {recordingState === "prep" && (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="text-5xl font-black text-purple-600">{prepTimer}s</div>
                <p className="text-foreground/60 text-sm">Thời gian chuẩn bị — ghi nhanh ý chính</p>
                <button onClick={skipPrep} className="px-6 py-2 border border-purple-300 text-purple-700 text-sm font-bold hover:bg-purple-50 transition-colors">
                  Bỏ qua, nói ngay →
                </button>
              </div>
            )}

            {/* State: recording */}
            {recordingState === "recording" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <span className="font-bold text-red-600">Đang ghi âm</span>
                  </div>
                  <span className="font-mono font-bold text-lg text-foreground/80">{formatTime(recordTimer)}</span>
                </div>

                {hasSpeechAPI && (
                  <div className="min-h-[100px] p-4 bg-foreground/5 border border-foreground/10 text-sm leading-relaxed text-foreground/70 italic">
                    {transcript || "Bắt đầu nói — transcript sẽ hiển thị ở đây..."}
                  </div>
                )}

                <button
                  onClick={stopRecording}
                  className="w-full py-3 bg-red-500 text-white font-bold hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z" clipRule="evenodd" />
                  </svg>
                  Dừng ghi âm
                </button>
              </div>
            )}

            {/* State: done */}
            {recordingState === "done" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-green-600">✓ Hoàn thành — {formatTime(recordTimer)}</span>
                  <button onClick={reset} className="text-sm text-foreground/50 hover:text-foreground transition-colors underline">
                    Thử lại
                  </button>
                </div>

                {audioUrl && (
                  <div className="bg-foreground/5 border border-foreground/10 p-4 flex items-center gap-3">
                    <span className="text-sm font-bold text-foreground/60">Nghe lại:</span>
                    <audio controls src={audioUrl} className="flex-1 h-8" />
                  </div>
                )}

                {hasSpeechAPI && transcript && (
                  <div>
                    <p className="text-xs font-bold text-foreground/50 uppercase tracking-wide mb-2">Transcript</p>
                    <div className="p-4 bg-foreground/5 border border-foreground/10 text-sm leading-relaxed text-foreground/80">
                      {transcript}
                    </div>
                  </div>
                )}

                <button
                  onClick={getAIFeedback}
                  disabled={loadingFeedback}
                  className="w-full py-3 bg-purple-600 text-white font-bold hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loadingFeedback ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang phân tích...</>
                  ) : (
                    <><span>🤖</span> Nhận AI Feedback</>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* AI Feedback */}
        {feedback && (
          <div className="bg-surface border border-purple-200 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-foreground/10 pb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span>🤖</span> AI Feedback
              </h2>
              {feedback.bandScore && (
                <div className="text-center">
                  <div className="text-3xl font-black text-purple-600">{feedback.bandScore}</div>
                  <div className="text-xs text-foreground/50">Band Score</div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: "fluency", label: "Fluency & Coherence", icon: "🗣️" },
                { key: "lexical", label: "Lexical Resource", icon: "📚" },
                { key: "grammar", label: "Grammatical Range", icon: "✏️" },
                { key: "pronunciation", label: "Pronunciation", icon: "🔊" },
              ].map(({ key, label, icon }) => feedback[key] && (
                <div key={key} className="bg-foreground/5 border border-foreground/10 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-foreground/50 mb-2">{icon} {label}</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{feedback[key]}</p>
                </div>
              ))}
            </div>

            {feedback.suggestions?.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-3">💡 Gợi ý cải thiện</p>
                <ul className="space-y-2">
                  {feedback.suggestions.map((s: string, i: number) => (
                    <li key={i} className="text-sm text-amber-800 flex gap-2">
                      <span className="text-amber-500 font-bold shrink-0">{i + 1}.</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={reset}
              className="w-full py-3 bg-purple-100 text-purple-700 font-bold hover:bg-purple-200 transition-colors border border-purple-200"
            >
              Luyện lại chủ đề khác
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
