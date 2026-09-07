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
    this.persona = 'beast'; // 'beast' (حماسي), 'zen' (متزن), 'strict' (تكنيك)
    this.speechRate = 1.0;
    this.cheerFrequency = 'every3'; // 'every', 'every3', 'super'

    // Cheers by persona in Arabic
    this.personaCheersAr = {
      beast: [
        'عاش يا وحش!',
        'نار وطاقة انفجارية!',
        'اضغط أكثر! لا تستسلم!',
        'قوة خارقة! استمر!',
        'أداء أسطوري يا بطل!',
        'وحش لا يُقهر!',
        'كمل للنهاية!'
      ],
      zen: [
        'أحسنت! تنفس بثبات.',
        'تركيز ممتاز ومتزن.',
        'أداء راقي ومثالي.',
        'ثقة وهدوء في الحركة.',
        'خطوة بخطوة نحو هدفك.',
        'جميل جداً! استمر.'
      ],
      strict: [
        'ثبّت الزاوية تماماً!',
        'مدى حركي كامل ومتقن.',
        'تحكم ممتاز بالنزول والصعود.',
        'استقامة صحيحة 100%.',
        'العضلة تحت أقصى ضغط فعال.',
        'تكنيك عالمي واحترافي!'
      ]
    };

    // Cheers by persona in English
    this.personaCheersEn = {
      beast: [
        'Beast mode activated!',
        'Pure power! Push it!',
        'Unstoppable energy!',
        'Crush it! Next rep!',
        'Legendary effort!'
      ],
      zen: [
        'Great breath and rhythm.',
        'Smooth and steady.',
        'Focus on the feeling.',
        'Mind and muscle harmony.'
      ],
      strict: [
        'Perfect angle maintained!',
        'Full range of motion!',
        'Controlled eccentric phase!',
        'Strict championship form!'
      ]
    };

    this.cheersAr = this.personaCheersAr.beast;
    this.cheersEn = this.personaCheersEn.beast;

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

  setPersona(persona) {
    this.persona = persona;
    if (this.personaCheersAr[persona]) {
      this.cheersAr = this.personaCheersAr[persona];
    }
    if (this.personaCheersEn[persona]) {
      this.cheersEn = this.personaCheersEn[persona];
    }
  }

  setSpeechRate(rate) {
    this.speechRate = parseFloat(rate) || 1.0;
  }

  setCheerFrequency(freq) {
    this.cheerFrequency = freq;
  }

  getSamplePhrase() {
    if (this.language === 'ar') {
      if (this.persona === 'beast') return 'عاش يا وحش! في AI gym لا مكان للتراجع!';
      if (this.persona === 'zen') return 'مرحباً بك، تدرّب بوعي وتركيز وهدوء لتحقيق أفضل نتيجة.';
      return 'انتبه للزوايا واستقامة المفاصل، الدقة تصنع الفرق الحقيقي.';
    } else {
      if (this.persona === 'beast') return 'Beast mode on! Let’s crush this workout at AI gym!';
      if (this.persona === 'zen') return 'Welcome, breathe deeply and move with purpose.';
      return 'Focus on precise angles and full muscle extension.';
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

    let shouldCheer = false;
    if (this.cheerFrequency === 'every') {
      shouldCheer = true;
    } else if (this.cheerFrequency === 'every3') {
      shouldCheer = (repNumber % 3 === 0);
    } else if (this.cheerFrequency === 'super') {
      shouldCheer = (isGoodForm && repNumber % 5 === 0);
    }

    let text = `${repNumber}`;
    if (shouldCheer) {
      if (this.language === 'ar') {
        const cheer = this.cheersAr[(repNumber - 1) % this.cheersAr.length];
        text += ` .. ${cheer}`;
      } else {
        const cheer = this.cheersEn[(repNumber - 1) % this.cheersEn.length];
        text += ` .. ${cheer}`;
      }
    }

    this.speak(text, this.speechRate, 1.05);
  }

  // Play short crisp countdown beep (for 3, 2, 1 rest timer)
  playCountdownBeep(highPitch = false) {
    if (this.isMuted || !this.audioCtx) return;
    try {
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(highPitch ? 880 : 440, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {}
  }

  // Realistic referee sports whistle when rest ends!
  playWhistleSound() {
    if (this.isMuted || !this.audioCtx) return;
    try {
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      const now = this.audioCtx.currentTime;

      // Two slightly detuned oscillators create the classic whistle trill
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(2600, now);
      osc2.frequency.setValueAtTime(2650, now);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.setValueAtTime(0.3, now + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.45);
      osc2.stop(now + 0.45);
    } catch (e) {}
  }

  // High Golden Shimmer chord for Super Rep (Perfect Slow Tempo)
  playSuperRepSound() {
    if (this.isMuted || !this.audioCtx) return;
    try {
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      const now = this.audioCtx.currentTime;
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.05);
        gain.gain.setValueAtTime(0.2, now + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.3);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 0.3);
      });
    } catch (e) {}
  }

  // Speak tempo feedback
  announceTempo(tempoSeconds, isSuperRep = false) {
    if (isSuperRep) {
      this.playSuperRepSound();
      const msg = this.language === 'ar' ? 'سوبر ريب! إيقاع ممتاز!' : 'Super Rep! Perfect Tempo!';
      this.speak(msg, 1.15, 1.1);
    }
  }

  // Speak form feedback if motion wasn't full
  speakFormWarning(warningKey) {
    if (this.isMuted || !this.synth) return;
    const text = this.language === 'ar' ? this.formTipsAr[warningKey] : this.formTipsEn[warningKey];
    if (text) {
      this.speak(text, 1.0, 1.0);
    }
  }

  speak(text, rate = null, pitch = 1.0) {
    try {
      if (!this.synth) return;
      this.synth.cancel(); // Cancel ongoing speech for rapid responsiveness
      const utter = new SpeechSynthesisUtterance(text);
      if (this.voice) utter.voice = this.voice;
      utter.lang = this.language === 'ar' ? 'ar-SA' : 'en-US';
      utter.rate = rate !== null ? rate : (this.speechRate || 1.0);
      utter.pitch = pitch;
      this.synth.speak(utter);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }
}

window.AudioCoach = AudioCoach;
