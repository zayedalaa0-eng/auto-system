"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2 } from "lucide-react";

/**
 * وضعان:
 * 1. رفع فوري  → مرّر customerId  (للصفحة التفصيلية — العميل موجود)
 * 2. إرسال مع الفورم → مرّر name  (للـ wizard — العميل لم يُنشأ بعد)
 *
 * onRecorded(durationText, publicUrl?)
 *   - في وضع الرفع الفوري: publicUrl هو URL التشغيل المحفوظ
 *   - في وضع الفورم: publicUrl غير موجود
 */
interface VoiceRecorderProps {
  customerId?: string;   // وضع الرفع الفوري
  name?: string;         // وضع إرسال مع الفورم
  /** وصف السياق — يُعرض في السجل التاريخي بدل اسم الملف */
  label?: string;
  onRecorded: (durationText: string, publicUrl?: string) => void;
  onDeleted: () => void;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceRecorder({ customerId, name, label, onRecorded, onDeleted }: VoiceRecorderProps) {
  const [state, setState] = useState<"idle" | "requesting" | "recording" | "uploading" | "done" | "error">("idle");
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // نحفظ المدة في ref حتى تكون صحيحة داخل onstop
  const durationRef = useRef(0);

  const isDirectUpload = Boolean(customerId);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startRecording() {
    setErrorMsg("");
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const finalDuration = durationRef.current;

        const blob = new Blob(chunksRef.current, { type: mimeType });
        const ext = mimeType.includes("webm") ? "webm" : "mp4";
        // نستخدم الـ label في اسم الملف إن وُجد — يساعد في التتبع
        const safeLabel = label
          ? label.replace(/[^a-zA-Z0-9؀-ۿ\s-]/g, "").trim().replace(/\s+/g, "_").slice(0, 40)
          : "voice-note";
        const fileName = `${safeLabel}-${Date.now()}.${ext}`;
        const file = new File([blob], fileName, { type: mimeType });

        const localUrl = URL.createObjectURL(blob);
        setAudioUrl(localUrl);

        if (isDirectUpload) {
          // ── وضع الرفع الفوري ─────────────────────────────────
          setState("uploading");
          try {
            const fd = new FormData();
            fd.append("customer_id", customerId!);
            fd.append("file", file);
            if (label) fd.append("label", label);
            const res = await fetch("/api/voice-upload", { method: "POST", body: fd });
            const json = await res.json() as { id?: string; public_url?: string; error?: string };
            if (!res.ok || json.error) throw new Error(json.error ?? "فشل الرفع");
            setState("done");
            onRecorded(`🎤 ${formatDuration(finalDuration)}`, json.public_url);
          } catch (err) {
            const msg = err instanceof Error ? err.message : "تعذر رفع الصوت";
            setState("error");
            setErrorMsg(msg);
            URL.revokeObjectURL(localUrl);
            setAudioUrl(null);
          }
        } else {
          // ── وضع الفورم (wizard) — ضع الملف في hidden input ──
          if (fileInputRef.current) {
            const dt = new DataTransfer();
            dt.items.add(file);
            fileInputRef.current.files = dt.files;
          }
          setState("done");
          onRecorded(`🎤 ${formatDuration(finalDuration)}`);
        }
      };

      recorder.start(250);
      setState("recording");
      setDuration(0);
      durationRef.current = 0;
      timerRef.current = setInterval(() => {
        durationRef.current += 1;
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      setState("error");
      setErrorMsg(
        (err as { name?: string }).name === "NotAllowedError"
          ? "لم يتم منح إذن المايكروفون"
          : "تعذر بدء التسجيل"
      );
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function deleteRecording() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setDuration(0);
    durationRef.current = 0;
    setState("idle");
    if (!isDirectUpload && fileInputRef.current) fileInputRef.current.value = "";
    onDeleted();
  }

  return (
    <div className="flex items-center gap-2 mt-1.5">
      {/* hidden input للـ wizard فقط */}
      {!isDirectUpload && name && (
        <input
          ref={fileInputRef}
          type="file"
          name={name}
          accept="audio/*"
          className="hidden"
          aria-hidden="true"
        />
      )}

      {state === "idle" && (
        <button
          type="button"
          onClick={startRecording}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700"
          title="تسجيل ملاحظة صوتية"
        >
          <Mic className="h-3.5 w-3.5" />
          تسجيل صوتي
        </button>
      )}

      {state === "requesting" && (
        <span className="text-xs text-slate-400 animate-pulse">جاري الوصول للمايكروفون…</span>
      )}

      {state === "recording" && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
          </span>
          <span className="text-xs font-mono font-semibold text-rose-700">{formatDuration(duration)}</span>
          <button
            type="button"
            onClick={stopRecording}
            className="inline-flex items-center gap-1 rounded bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white transition hover:bg-rose-700"
          >
            <Square className="h-3 w-3" />
            إيقاف
          </button>
        </div>
      )}

      {state === "uploading" && (
        <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5">
          <span className="text-xs text-sky-600 animate-pulse">⏫ جاري حفظ التسجيل…</span>
          {audioUrl && <audio controls src={audioUrl} className="h-7 max-w-[180px]" />}
        </div>
      )}

      {state === "done" && audioUrl && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5">
          <span className="text-xs font-semibold text-emerald-700">🎤 {formatDuration(duration)}</span>
          <audio controls src={audioUrl} className="h-7 max-w-[180px]" />
          <button
            type="button"
            onClick={deleteRecording}
            className="inline-flex items-center gap-1 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600 transition hover:bg-rose-100 hover:text-rose-700"
            title="حذف التسجيل"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}

      {state === "error" && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-rose-600">⚠️ {errorMsg}</span>
          <button
            type="button"
            onClick={() => setState("idle")}
            className="text-xs text-slate-500 underline"
          >
            إعادة المحاولة
          </button>
        </div>
      )}
    </div>
  );
}
