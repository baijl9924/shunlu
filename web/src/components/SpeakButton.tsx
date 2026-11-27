import { Square, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '../lib/store';

/** 无障碍语音播报按钮（使用原生中文语音合成，方便视障人士与长辈收听） */
export default function SpeakButton({ text, label = '语音播报', className = '' }: { text: string; label?: string; className?: string }) {
  const { toast } = useApp();
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [text]);

  function toggle() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast('当前浏览器暂不支持语音播报');
      return;
    }
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    u.rate = 0.96;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(u);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={speaking}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition active:scale-95 ${
        speaking ? 'bg-brand text-white shadow-xs' : 'bg-brand-soft text-brand'
      } ${className}`}
    >
      {speaking ? <Square className="h-3.5 w-3.5 fill-current" /> : <Volume2 className="h-3.5 w-3.5" />}
      <span>{speaking ? '停止播报' : label}</span>
    </button>
  );
}
