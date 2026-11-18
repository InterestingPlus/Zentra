export interface TtsState {
  supported: boolean;
  status: 'idle' | 'playing' | 'paused';
  rate: number;
  currentBookId: string | null;
  progressPercent: number;
}

type Listener = (state: TtsState) => void;

class SummaryTtsController {
  private state: TtsState = {
    supported: typeof window !== 'undefined' && 'speechSynthesis' in window,
    status: 'idle',
    rate: 1.0,
    currentBookId: null,
    progressPercent: 0,
  };
  private listeners = new Set<Listener>();
  private currentText = '';
  private charOffset = 0;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(partial: Partial<TtsState>) {
    this.state = { ...this.state, ...partial };
    for (const l of this.listeners) l(this.state);
  }

  getState(): TtsState {
    return this.state;
  }

  play(bookId: string, text: string) {
    if (!this.state.supported || !text.trim()) return;
    window.speechSynthesis.cancel();
    this.currentText = text;
    this.charOffset = 0;
    this.speakFromOffset(bookId, 0);
  }

  private speakFromOffset(bookId: string, startOffset: number) {
    const slice = this.currentText.slice(startOffset);
    if (!slice.trim()) {
      this.emit({ status: 'idle', progressPercent: 100 });
      return;
    }

    const utterance = new SpeechSynthesisUtterance(slice);
    utterance.rate = this.state.rate;

    utterance.onboundary = (ev) => {
      const absolutePos = startOffset + (ev.charIndex ?? 0);
      this.charOffset = absolutePos;
      const pct = Math.min(100, Math.round((absolutePos / Math.max(1, this.currentText.length)) * 100));
      this.emit({ progressPercent: pct });
    };

    utterance.onend = () => {
      if (this.state.status === 'playing') {
        this.emit({ status: 'idle', progressPercent: 100 });
      }
    };

    utterance.onerror = () => {
      this.emit({ status: 'idle' });
    };

    this.emit({ status: 'playing', currentBookId: bookId });
    window.speechSynthesis.speak(utterance);
  }

  pause() {
    if (!this.state.supported || this.state.status !== 'playing') return;
    window.speechSynthesis.pause();
    this.emit({ status: 'paused' });
  }

  resume() {
    if (!this.state.supported || this.state.status !== 'paused') return;
    window.speechSynthesis.resume();
    this.emit({ status: 'playing' });
  }

  setRate(rate: number) {
    const nextRate = Math.max(0.75, Math.min(2.0, rate));
    this.emit({ rate: nextRate });
    if (this.state.status === 'playing' && this.state.currentBookId) {
      window.speechSynthesis.cancel();
      this.speakFromOffset(this.state.currentBookId, this.charOffset);
    }
  }

  stop() {
    if (this.state.supported) {
      window.speechSynthesis.cancel();
    }
    this.charOffset = 0;
    this.emit({ status: 'idle', currentBookId: null, progressPercent: 0 });
  }
}

export const summaryTts = new SummaryTtsController();
