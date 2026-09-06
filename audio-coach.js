// audio-coach.js - محرك الأصوات التفاعلي والمدرب الصوتي الذكي
// متوافق بالكامل مع هواتف iPhone (iOS Safari) و Android

class AudioCoach {
  constructor() {
    this.audioCtx = null;
    this.synth = window.speechSynthesis || null;
    this.voice = null;
    this.language = 'ar'; // 'ar' or 'en'
    this.isMuted = false;
    this.isUnlocked = false;

    this.cheersAr = [
      'عاش يا بطل!',
      'وحش! كمل!',
      'ممتاز جداً!',
      'قوة وإصرار!',
      'أداء أسطوري!',
      'بطل! استمر للعدة القادمة!',
      'رائع! اضغط أكثر!',
      'عاش! باقي القليل!'
    ];

    this.cheersEn = [
      'Great rep!',
      'Beast mode!',
      'Keep pushing!',
      'Awesome form!',
      'Power! Ready for next!',
      'Unstoppable!',
      'You got this!'
    ];

    this.formTipsAr = {
      goLower: 'انزل أكثر!',
      extendMore: 'مد ذراعك بالكامل!',
      straightenBack: 'استقم ظهرك!'
    };

    this.formTipsEn = {
      goLower: 'Go lower!',
      extendMore: 'Full extension!',
      straightenBack: 'Keep your back straight!'
    };

    // Load available voices
    if (this.synth) {
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
      this.loadVoices();
    }
  }

  // Mandatory for iPhone / Safari: unlock AudioContext on first touch
  unlock() {
    if (this.isUnlocked) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume();
        }
        // Play silent buffer to unlock iOS audio channel
        const buffer = this.audioCtx.createBuffer(1, 1, 22050);
        const source = this.audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioCtx.destination);
        source.start(0);
      }

      // Unlock SpeechSynthesis for iOS
      if (this.synth) {
        const silentUtterance = new SpeechSynthesisUtterance('');
        this.synth.speak(silentUtterance);
        this.loadVoices();
      }

      this.isUnlocked = true;
      console.log('Audio Engine successfully unlocked for iOS/Mobile');
    } catch (err) {
      console.warn('Audio unlock warning:', err);
    }
  }

  loadVoices() {
    if (!this.synth) return;
    const voices = this.synth.getVoices();
    if (this.language === 'ar') {
      this.voice = voices.find(v => v.lang.startsWith('ar')) || null;
    } else {
      this.voice = voices.find(v => v.lang.startsWith('en')) || null;
    }
  }

  setLanguage(lang) {
    this.language = lang;
    this.loadVoices();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  // Golden chime bell on rep completion (Pure Web Audio Synthesis)
  playRepSound() {
    if (this.isMuted) return;
    if (!this.audioCtx) this.unlock();
    if (!this.audioCtx) return;

    try {
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      const now = this.audioCtx.currentTime;
      // Tone 1: High crisp gold shimmer (659.25 Hz - E5)
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15);

      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Tone 2: Warm undertone (523.25 Hz - C5)
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(523.25, now);
      gain2.gain.setValueAtTime(0.2, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now);
      osc2.stop(now + 0.4);

      // Haptic feedback (iPhone / Android)
      if (navigator.vibrate) {
        navigator.vibrate([60, 40, 90]);
      }
    } catch (e) {
      console.warn('Sound error:', e);
    }
  }

  // Soft cue when bottoming out in movement (Reached inflection point)
  playCueSound() {
    if (this.isMuted || !this.audioCtx) return;
    try {
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(392, now); // G4
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {}
  }

  // Speak number and dynamic motivational encouragement
  announceRep(repNumber, isGoodForm = true) {
    this.playRepSound();
    if (this.isMuted || !this.synth) return;

    // Build the spoken phrase
    let text = '';
    if (this.language === 'ar') {
      text = `${repNumber}`;
      // Every rep, append an encouraging cheer
      const cheer = this.cheersAr[(repNumber - 1) % this.cheersAr.length];
      text += ` .. ${cheer}`;
    } else {
      text = `${repNumber}`;
      const cheer = this.cheersEn[(repNumber - 1) % this.cheersEn.length];
      text += ` .. ${cheer}`;
    }

    this.speak(text, 1.1, 1.05);
  }

  // Speak form feedback if motion wasn't full
  speakFormWarning(warningKey) {
    if (this.isMuted || !this.synth) return;
    const text = this.language === 'ar' ? this.formTipsAr[warningKey] : this.formTipsEn[warningKey];
    if (text) {
      this.speak(text, 1.0, 1.0);
    }
  }

  speak(text, rate = 1.0, pitch = 1.0) {
    try {
      if (!this.synth) return;
      this.synth.cancel(); // Cancel ongoing speech for rapid responsiveness
      const utter = new SpeechSynthesisUtterance(text);
      if (this.voice) utter.voice = this.voice;
      utter.lang = this.language === 'ar' ? 'ar-SA' : 'en-US';
      utter.rate = rate;
      utter.pitch = pitch;
      this.synth.speak(utter);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }
}

window.AudioCoach = AudioCoach;
