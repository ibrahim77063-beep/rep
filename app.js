// app.js - المحرك الرئيسي لتطبيق GoldRep AI
// يدير تدفق التمرين، واجهة المستخدم، حساب السعرات، والمؤقت

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const video = document.getElementById('webcam');
  const canvas = document.getElementById('output_canvas');
  const repCountEl = document.getElementById('rep-count');
  const repProgressRing = document.getElementById('ring-progress');
  const stateBadge = document.getElementById('state-badge');
  const stateText = document.getElementById('state-text');
  const workoutTimerEl = document.getElementById('workout-timer');
  const caloriesBurnedEl = document.getElementById('calories-burned');
  const formScoreEl = document.getElementById('form-score');
  const coachToast = document.getElementById('coach-toast');
  const coachToastText = document.getElementById('coach-toast-text');

  // Controls
  const btnStartWorkout = document.getElementById('btn-start-workout');
  const btnToggleCamera = document.getElementById('btn-toggle-camera');
  const btnToggleMute = document.getElementById('btn-toggle-mute');
  const btnToggleLang = document.getElementById('btn-toggle-lang');
  const btnReset = document.getElementById('btn-reset');
  const welcomeModal = document.getElementById('welcome-modal');
  const btnWelcomeStart = document.getElementById('btn-welcome-start');
  const summaryDialog = document.getElementById('summary-dialog');
  const btnCloseSummary = document.getElementById('btn-close-summary');

  // Exercise Buttons
  const exerciseChips = document.querySelectorAll('.chip-btn');

  // Instances
  const audioCoach = new AudioCoach();
  let poseEngine = null;

  // State
  let isWorkoutActive = false;
  let timerInterval = null;
  let elapsedSeconds = 0;
  let totalRepsAllExercises = 0;
  let currentExerciseKey = 'squats';
  let perfectRepsCount = 0;

  // Expanded Exercise Database (12 exercises with form guides and mistake prevention)
  const EXERCISES_DB = {
    squats: {
      nameAr: '🦵 سكوات (Squats)', nameEn: 'Squats', cat: 'lower', calFactor: 0.35, unitAr: 'تكرار', unitEn: 'Reps',
      targetAngle: '90° (مستوى الفخذ موازي للأرض)',
      steps: [
        'قف بتباعد القدمين بمحاذاة الكتفين مع توجيه أصابع القدم للخارج قليلاً.',
        'انزل بالحوض للخلف والأسفل كأنك تجلس على كرسي حتى تصل لزاوية 90° باتباع الأسهم الخضراء.',
        'ادفع بكعبيك للأعلى للعودة لوضع البداية مع الزفير.'
      ],
      mistakes: [
        'لا تجعل ركبتيك تتقاربان للداخل أثناء الصعود.',
        'حافظ على استقامة ظهرك وصدرك مرفوعاً للأعلى دون تقوس.'
      ]
    },
    lunges: {
      nameAr: '🚶‍♂️ طعنات (Lunges)', nameEn: 'Lunges', cat: 'lower', calFactor: 0.32, unitAr: 'تكرار', unitEn: 'Reps',
      targetAngle: '90° للركبتين',
      steps: [
        'اخطُ خطوة واسعة للأمام بساق واحدة.',
        'انزل بجسمك عمودياً حتى تنثني الركبتان بزاوية 90° باتباع السهم الأخضر.',
        'ادفع بالساق الأمامية للعودة لوضع البداية.'
      ],
      mistakes: [
        'لا تدع ركبتك الأمامية تتقدم كثيراً فوق أصابع القدم.',
        'حافظ على جذعك عمودياً دون ميل مفرط للأمام.'
      ]
    },
    deadlifts: {
      nameAr: '🏋️ رفعة ميتة (Deadlifts)', nameEn: 'Deadlifts', cat: 'lower', calFactor: 0.40, unitAr: 'تكرار', unitEn: 'Reps',
      targetAngle: '100° ثني الحوض',
      steps: [
        'قف وقدماك باتساع الحوض مع ثني طفيف جداً في الركبتين.',
        'ادفع حوضك ومؤخرتك للخلف مع النزول بالجذع لأسفل مع ظهر مفرود تماماً.',
        'اقبض عضلات الحوض وادفع للأمام للعودة للوقوف الكامل.'
      ],
      mistakes: [
        'احذر تماماً من تقويس أو تحنيب أسفل الظهر.',
        'لا تعتمد على عضلات الذراع لرفع الوزن، القوة تأتي من الحوض والأرجل.'
      ]
    },
    pushups: {
      nameAr: '💪 تمرين الضغط (Push-ups)', nameEn: 'Push-ups', cat: 'upper', calFactor: 0.45, unitAr: 'تكرار', unitEn: 'Reps',
      targetAngle: '85° نزول الكوع',
      steps: [
        'ضع يديك على الأرض باتساع أكبر قليلاً من الكتفين.',
        'حافظ على استقامة جسمك كقطعة واحدة من الرأس حتى الكعبين.',
        'انزل بصدرك نحو الأرض باتباع الأسهم الخضراء حتى ينثني الكوع 90° ثم ادفع للأعلى.'
      ],
      mistakes: [
        'لا تدع وسطك أو حوضك يهبط لأسفل.',
        'لا تفتح كوعيك للخارج بزاوية 90° مع الكتف (اجعلهما بزاوية 45° لحماية المفصل).'
      ]
    },
    curls: {
      nameAr: '🦾 بايسبس (Bicep Curls)', nameEn: 'Bicep Curls', cat: 'upper', calFactor: 0.20, unitAr: 'تكرار', unitEn: 'Reps',
      targetAngle: '45° ثني الذراع كاملاً',
      steps: [
        'قف ثابتاً مع تثبيت الكوعين بجانب خصرك.',
        'اثنِ ذراعيك للأعلى باتباع القوس الأخضر حتى تقبض عضلة البايسبس بقوة.',
        'انزل بالوزن ببطء وتحكم حتى يمتد الذراع بالكامل (160°).'
      ],
      mistakes: [
        'لا تؤرجح ظهرك أو تدفع خصرك للمساعدة في رفع الوزن.',
        'لا تحرك كوعك للأمام أو الخلف أثناء الصعود.'
      ]
    },
    shoulder_press: {
      nameAr: '🏋️‍♂️ ضغط أكتاف (Shoulder Press)', nameEn: 'Shoulder Press', cat: 'upper', calFactor: 0.30, unitAr: 'تكرار', unitEn: 'Reps',
      targetAngle: '160° امتداد الذراعين للأعلى',
      steps: [
        'ابدأ والوزن بمحاذاة أذنيك والكوعان مثنيان 90°.',
        'ادفع الوزن عمودياً للأعلى فوق رأسك باتباع الأسهم الخضراء حتى تمتد الأذرع.',
        'انزل بالوزن ببطء وتحكم لمستوى البداية.'
      ],
      mistakes: [
        'لا تقوّس أسفل ظهرك للخلف بشكل مفرط.',
        'لا تغلق مفصل الكوع بقوة زائدة عند القمة (Lockout).'
      ]
    },
    lateral_raises: {
      nameAr: '🦅 رفرفة أكتاف (Lateral Raises)', nameEn: 'Lateral Raises', cat: 'upper', calFactor: 0.22, unitAr: 'تكرار', unitEn: 'Reps',
      targetAngle: '85° محاذاة الذراع مع الكتف',
      steps: [
        'ابدأ والذراعان بجانب فخذيك مع انحناء طفيف في الكوع.',
        'ارفع ذراعيك للجانبين كأجنحة النسر باتباع الأسهم الخضراء حتى تصبح بمستوى الكتف.',
        'انزل بالذراعين بهدوء مع الحفاظ على التحكم.'
      ],
      mistakes: [
        'لا ترفع الوزن فوق مستوى الكتفين لتجنب إجهاد أوتار الكتف.',
        'لا تستخدم قوة الدفع أو هز الجذع.'
      ]
    },
    tricep_dips: {
      nameAr: '⚡ ترايسبس (Tricep Dips)', nameEn: 'Tricep Dips', cat: 'upper', calFactor: 0.35, unitAr: 'تكرار', unitEn: 'Reps',
      targetAngle: '90° ثني الكوع للخلف',
      steps: [
        'استند بيديك خلفك على كرسي أو حافة ثابتة.',
        'انزل بالحوض للأسفل مع ثني الكوعين للخلف باتباع الأسهم الخضراء حتى 90°.',
        'ادفع بقوة عضلات الترايسبس للعودة للأعلى.'
      ],
      mistakes: [
        'لا تبتعد بحوضك كثيراً للأمام بعيداً عن حافة المقعد.',
        'لا تنزل أكثر من 90° لحماية الكتف من الإجهاد.'
      ]
    },
    crunches: {
      nameAr: '🍫 تمارين المعدة (Crunches)', nameEn: 'Crunches', cat: 'core', calFactor: 0.25, unitAr: 'تكرار', unitEn: 'Reps',
      targetAngle: '80° ثني عضلات البطن',
      steps: [
        'استلقِ على ظهرك واثنِ ركبتيك مع وضع اليدين بجانب الرأس دون شده.',
        'اقبض عضلات بطنك وارفع لوحي كتفيك عن الأرض نحو ركبتيك.',
        'انزل ببطء للتحكم بالهبوط دون ارتخاء كامل.'
      ],
      mistakes: [
        'لا تشد رقبتك أو رأسك بيديك للأمام (القوة تأتي من البطن فقط).',
        'لا ترفع كامل ظهرك من الأرض، يكفي رفع أعلى الظهر.'
      ]
    },
    leg_raises: {
      nameAr: '📐 رفع الأرجل (Leg Raises)', nameEn: 'Leg Raises', cat: 'core', calFactor: 0.28, unitAr: 'تكرار', unitEn: 'Reps',
      targetAngle: '95° رفع الساقين عمودياً',
      steps: [
        'استلقِ مستوياً على ظهرك وضع يديك تحت حوضك لتثبيت أسفل الظهر.',
        'ارفع ساقيك معاً وهما مفرودتان للأعلى بزاوية 90° باتباع الأسهم الخضراء.',
        'انزل بالساقين ببطء دون أن تلمسا الأرض ثم ارفعهما مجدداً.'
      ],
      mistakes: [
        'لا تدع أسفل ظهرك يتقوس أو يرتفع عن الأرض أثناء النزول.',
        'لا تعتمد على قوة الاندفاع والأرجحة السريعة.'
      ]
    },
    jacks: {
      nameAr: '⭐ قفز نجمي (Jumping Jacks)', nameEn: 'Jumping Jacks', cat: 'core', calFactor: 0.25, unitAr: 'تكرار', unitEn: 'Reps',
      targetAngle: 'فتح الذراعين والساقين كاملاً',
      steps: [
        'ابدأ بالوقوف وقدماك متقاربتان والذراعان بجانبك.',
        'اقفز وافتح ساقيك للجانبين وارفع يديك فوق رأسك بالتزامن.',
        'اقفز مجدداً للعودة لوضع البداية بسلاسة وإيقاع منتظم.'
      ],
      mistakes: [
        'اهبط دائماً على مشط قدميك برفق لامتصاص الصدمات وحماية الركبتين.'
      ]
    },
    plank: {
      nameAr: '⏱️ بلانك (Plank Hold)', nameEn: 'Plank', cat: 'core', calFactor: 0.15, unitAr: 'ثانية', unitEn: 'Seconds',
      targetAngle: '170°-180° استقامة الجسم الكاملة',
      steps: [
        'استند على ساعديك وأطراف أصابع قدميك.',
        'شد عضلات البطن والأرداف للحفاظ على خط مستقيم من رأسك لكعبيك.',
        'تنفس بهدوء واستمر في وضعية الثبات لأطول فترة ممكنة.'
      ],
      mistakes: [
        'لا تدع حوضك يهبط لأسفل (يسبب ألماً في الظهر).',
        'لا ترفع مؤخرتك للأعلى بشكل مثلث.'
      ]
    }
  };

  const repUnitEl = document.querySelector('.rep-unit');

  // Ring progress circumference (radius = 75 => 2 * pi * 75 ≈ 471.2)
  const RING_CIRCUMFERENCE = 471.2;
  if (repProgressRing) {
    repProgressRing.style.strokeDasharray = `${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`;
    repProgressRing.style.strokeDashoffset = RING_CIRCUMFERENCE;
  }

  // Initialize Pose Engine
  poseEngine = new PoseEngine(video, canvas, {
    onRep: (count, quality) => handleRepEvent(count, quality),
    onCue: () => audioCoach.playCueSound(),
    onAngleUpdate: (data) => handleAngleUpdate(data),
    onStatusChange: (status, msg) => handleStatusChange(status, msg)
  });

  // Handle Rep Event (Count completed!)
  function handleRepEvent(count, quality) {
    totalRepsAllExercises++;
    if (quality === 'perfect') perfectRepsCount++;

    // Visual bump
    repCountEl.textContent = count;
    repCountEl.classList.remove('bump');
    void repCountEl.offsetWidth; // Trigger reflow
    repCountEl.classList.add('bump');

    // Update Calories
    updateCalories(count);

    // Audio announcement & encouragement cheer
    audioCoach.announceRep(count, quality === 'perfect');

    // Show floating motivational toast
    const cheer = audioCoach.language === 'ar' 
      ? (quality === 'perfect' ? 'أداء ممتاز 100%! استمر!' : 'بطل! للعدة القادمة!')
      : (quality === 'perfect' ? 'Perfect Form! Keep going!' : 'Nice! Push for next!');
    showCoachToast(cheer);

    // Form Quality calculation
    const accuracy = count > 0 ? Math.round((perfectRepsCount / count) * 100) : 100;
    formScoreEl.textContent = `${accuracy}%`;
  }

  // Handle Real-time angle & progress
  function handleAngleUpdate(data) {
    // Update circular progress
    const offset = RING_CIRCUMFERENCE - (data.progress / 100) * RING_CIRCUMFERENCE;
    if (repProgressRing) {
      repProgressRing.style.strokeDashoffset = offset;
    }

    // Update status text badge
    if (stateText) {
      if (audioCoach.language === 'ar') {
        stateText.textContent = data.state === 'DOWN' ? 'أسفل (Down)' : 'أعلى (Up)';
      } else {
        stateText.textContent = data.state;
      }
    }
  }

  function handleStatusChange(status, msg) {
    if (status === 'camera_error') {
      const permModal = document.getElementById('camera-permission-modal');
      const httpsLink = document.getElementById('btn-open-https');
      if (httpsLink) {
        const host = window.location.hostname || '192.168.18.189';
        httpsLink.href = `https://${host}:8443/index.html`;
      }
      if (permModal) {
        permModal.classList.add('show');
      } else {
        alert(audioCoach.language === 'ar' 
          ? 'يرجى السماح بالوصول للكاميرا لتشغيل التطبيق.' 
          : 'Please allow camera access to use the app.');
      }
    }
  }

  function updateCalories(reps) {
    const factor = (EXERCISES_DB[currentExerciseKey] && EXERCISES_DB[currentExerciseKey].calFactor) || 0.3;
    const cals = Math.round(reps * factor * 10) / 10;
    caloriesBurnedEl.textContent = cals;
  }

  function showCoachToast(msg) {
    coachToastText.textContent = msg;
    coachToast.classList.add('show');
    clearTimeout(coachToast._timeout);
    coachToast._timeout = setTimeout(() => {
      coachToast.classList.remove('show');
    }, 2400);
  }

  // Workout Timer
  function startTimer() {
    elapsedSeconds = 0;
    workoutTimerEl.textContent = '00:00';
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      elapsedSeconds++;
      const mins = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
      const secs = String(elapsedSeconds % 60).padStart(2, '0');
      workoutTimerEl.textContent = `${mins}:${secs}`;
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
  }

  // Start / Stop Workout Cycle
  async function startWorkout() {
    // Unlock iOS audio channels
    audioCoach.unlock();

    try {
      await poseEngine.startCamera();
      isWorkoutActive = true;
      startTimer();

      btnStartWorkout.classList.add('stopping');
      btnStartWorkout.innerHTML = `
        <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        <span>${audioCoach.language === 'ar' ? 'إنهاء التمرين' : 'End Workout'}</span>
      `;

      showCoachToast(audioCoach.language === 'ar' ? 'تم تفعيل الكاميرا! ابدأ الآن!' : 'Camera ready! Start moving!');
      audioCoach.speak(audioCoach.language === 'ar' ? 'بدأ التمرين، استعد!' : 'Workout started, ready!');
    } catch (e) {
      console.error(e);
    }
  }

  function stopWorkout() {
    isWorkoutActive = false;
    stopTimer();
    poseEngine.stop();

    btnStartWorkout.classList.remove('stopping');
    btnStartWorkout.innerHTML = `
      <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
      <span>${audioCoach.language === 'ar' ? 'بدء التمرين' : 'Start Workout'}</span>
    `;

    // Show summary modal
    showSummaryModal();
  }

  function showSummaryModal() {
    const sumReps = document.getElementById('sum-reps');
    const sumTime = document.getElementById('sum-time');
    const sumCals = document.getElementById('sum-cals');
    const sumForm = document.getElementById('sum-form');

    if (sumReps) sumReps.textContent = poseEngine.repCount;
    if (sumTime) sumTime.textContent = workoutTimerEl.textContent;
    if (sumCals) sumCals.textContent = caloriesBurnedEl.textContent;
    if (sumForm) sumForm.textContent = formScoreEl.textContent;

    summaryDialog.classList.add('show');
    audioCoach.speak(audioCoach.language === 'ar' ? 'تمرين رائع! أحسنت اليوم!' : 'Awesome workout! Well done today!');
  }

  // Event Listeners
  btnWelcomeStart.addEventListener('click', () => {
    // Crucial for iPhone: First user gesture unlocks Audio and initiates MediaStream
    audioCoach.unlock();
    welcomeModal.classList.add('hidden');
    startWorkout();
  });

  btnStartWorkout.addEventListener('click', () => {
    audioCoach.unlock();
    if (!isWorkoutActive) {
      startWorkout();
    } else {
      stopWorkout();
    }
  });

  btnCloseSummary.addEventListener('click', () => {
    summaryDialog.classList.remove('show');
    poseEngine.resetCounter();
    repCountEl.textContent = '0';
    caloriesBurnedEl.textContent = '0';
    formScoreEl.textContent = '100%';
    if (repProgressRing) repProgressRing.style.strokeDashoffset = RING_CIRCUMFERENCE;
  });

  const btnDismissPermission = document.getElementById('btn-dismiss-permission');
  if (btnDismissPermission) {
    btnDismissPermission.addEventListener('click', () => {
      const permModal = document.getElementById('camera-permission-modal');
      if (permModal) permModal.classList.remove('show');
    });
  }

  // Exercise Form Guide Modal (دليل الأداء الصحيح)
  const btnExerciseGuide = document.getElementById('btn-exercise-guide');
  const guideModal = document.getElementById('exercise-guide-modal');
  const btnCloseGuide = document.getElementById('btn-close-guide');
  const guideModalTitle = document.getElementById('guide-modal-title');
  const guideStepsList = document.getElementById('guide-steps-list');
  const guideMistakesList = document.getElementById('guide-mistakes-list');
  const guideTargetAngle = document.getElementById('guide-target-angle');

  function openExerciseGuide(exKey) {
    const data = EXERCISES_DB[exKey] || EXERCISES_DB.squats;
    if (guideModalTitle) guideModalTitle.textContent = data.nameAr;
    if (guideTargetAngle) guideTargetAngle.textContent = data.targetAngle || '90°';

    if (guideStepsList) {
      guideStepsList.innerHTML = (data.steps || []).map(step => `<li>${step}</li>`).join('');
    }
    if (guideMistakesList) {
      guideMistakesList.innerHTML = (data.mistakes || []).map(m => `<li>${m}</li>`).join('');
    }

    if (guideModal) guideModal.classList.add('show');
  }

  if (btnExerciseGuide) {
    btnExerciseGuide.addEventListener('click', () => {
      openExerciseGuide(currentExerciseKey);
    });
  }

  if (btnCloseGuide) {
    btnCloseGuide.addEventListener('click', () => {
      if (guideModal) guideModal.classList.remove('show');
    });
  }

  // Category Filter Tabs
  const catTabs = document.querySelectorAll('.cat-tab');
  catTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      catTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const cat = tab.dataset.cat;

      const allChips = document.querySelectorAll('.chip-btn');
      allChips.forEach(chip => {
        if (cat === 'all' || chip.dataset.cat === cat) {
          chip.style.display = 'inline-flex';
        } else {
          chip.style.display = 'none';
        }
      });
    });
  });

  // Switch Exercise (Support for all 12 exercises)
  const allChips = document.querySelectorAll('.chip-btn');
  allChips.forEach(chip => {
    chip.addEventListener('click', () => {
      allChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      const ex = chip.dataset.exercise;
      currentExerciseKey = ex;
      const exData = EXERCISES_DB[ex] || { nameAr: ex, nameEn: ex, unitAr: 'تكرار', unitEn: 'Reps' };

      poseEngine.setExercise(ex);
      poseEngine.resetCounter();
      repCountEl.textContent = '0';
      caloriesBurnedEl.textContent = '0';
      if (repUnitEl) {
        repUnitEl.textContent = audioCoach.language === 'ar' ? exData.unitAr : exData.unitEn;
      }
      if (repProgressRing) repProgressRing.style.strokeDashoffset = RING_CIRCUMFERENCE;

      const title = audioCoach.language === 'ar' ? exData.nameAr : exData.nameEn;
      showCoachToast(`${audioCoach.language === 'ar' ? 'تمرين: ' : 'Exercise: '}${title}`);
      audioCoach.speak(audioCoach.language === 'ar' ? `تمرين ${exData.nameAr}` : `Exercise ${exData.nameEn}`);
    });
  });

  // Toggle Camera (Front / Back)
  btnToggleCamera.addEventListener('click', async () => {
    btnToggleCamera.style.transform = 'rotate(180deg)';
    await poseEngine.toggleCamera();
    setTimeout(() => { btnToggleCamera.style.transform = ''; }, 300);
  });

  // Toggle Audio Mute
  btnToggleMute.addEventListener('click', () => {
    const isMuted = audioCoach.toggleMute();
    btnToggleMute.style.opacity = isMuted ? '0.4' : '1';
    showCoachToast(isMuted 
      ? (audioCoach.language === 'ar' ? 'تم كتم الصوت' : 'Sound Muted') 
      : (audioCoach.language === 'ar' ? 'تم تشغيل الصوت' : 'Sound On'));
  });

  // Toggle Language
  btnToggleLang.addEventListener('click', () => {
    const newLang = audioCoach.language === 'ar' ? 'en' : 'ar';
    audioCoach.setLanguage(newLang);
    btnToggleLang.textContent = newLang === 'ar' ? 'AR' : 'EN';
    document.body.style.direction = newLang === 'ar' ? 'rtl' : 'ltr';
    showCoachToast(newLang === 'ar' ? 'اللغة: العربية' : 'Language: English');
  });

  // Reset Button
  btnReset.addEventListener('click', () => {
    poseEngine.resetCounter();
    repCountEl.textContent = '0';
    if (repProgressRing) repProgressRing.style.strokeDashoffset = RING_CIRCUMFERENCE;
    showCoachToast(audioCoach.language === 'ar' ? 'تم تصفير العداد' : 'Counter reset');
  });

  // ==========================================
  // IN-APP CUSTOM EXERCISE BUILDER (حفظ دائم)
  // ==========================================
  const btnOpenCustomBuilder = document.getElementById('btn-open-custom-builder');
  const customModal = document.getElementById('custom-exercise-modal');
  const btnCancelCustom = document.getElementById('btn-cancel-custom-exercise');
  const btnSaveCustom = document.getElementById('btn-save-custom-exercise');
  const customInputName = document.getElementById('custom-input-name');
  const customSelectJoint = document.getElementById('custom-select-joint');
  const customLiveAngleDisplay = document.getElementById('custom-live-angle-display');
  const btnCalibrateStart = document.getElementById('btn-calibrate-start');
  const btnCalibrateEnd = document.getElementById('btn-calibrate-end');
  const badgeStartAngle = document.getElementById('badge-start-angle');
  const badgeEndAngle = document.getElementById('badge-end-angle');
  const chipsContainer = document.getElementById('exercise-chips-container');

  let recordedStartAngle = 160;
  let recordedEndAngle = 80;
  let currentCalibAngle = 160;

  // Live angle feedback from camera during calibration
  poseEngine.onLiveCalibration = (angle) => {
    currentCalibAngle = angle;
    if (customLiveAngleDisplay) {
      customLiveAngleDisplay.textContent = `${angle}°`;
    }
  };

  // Open Builder Modal
  if (btnOpenCustomBuilder) {
    btnOpenCustomBuilder.addEventListener('click', () => {
      audioCoach.unlock();
      if (!poseEngine.isRunning) {
        poseEngine.startCamera().catch(e => console.warn(e));
      }
      poseEngine.setCalibratingJoint(customSelectJoint.value);
      if (customModal) customModal.classList.add('show');
    });
  }

  // Joint Selection Changed
  if (customSelectJoint) {
    customSelectJoint.addEventListener('change', () => {
      poseEngine.setCalibratingJoint(customSelectJoint.value);
    });
  }

  // Record Start Angle
  if (btnCalibrateStart) {
    btnCalibrateStart.addEventListener('click', () => {
      recordedStartAngle = currentCalibAngle || 160;
      if (badgeStartAngle) badgeStartAngle.textContent = `${recordedStartAngle}°`;
      showCoachToast(`تم حفظ زاوية البداية: ${recordedStartAngle}°`);
    });
  }

  // Record End Angle
  if (btnCalibrateEnd) {
    btnCalibrateEnd.addEventListener('click', () => {
      recordedEndAngle = currentCalibAngle || 80;
      if (badgeEndAngle) badgeEndAngle.textContent = `${recordedEndAngle}°`;
      showCoachToast(`تم حفظ زاوية النهاية: ${recordedEndAngle}°`);
    });
  }

  // Close Builder
  if (btnCancelCustom) {
    btnCancelCustom.addEventListener('click', () => {
      poseEngine.setCalibratingJoint(null);
      if (customModal) customModal.classList.remove('show');
    });
  }

  // Save Custom Exercise Permanently to LocalStorage
  if (btnSaveCustom) {
    btnSaveCustom.addEventListener('click', () => {
      const name = (customInputName.value || '').trim();
      if (!name) {
        alert(audioCoach.language === 'ar' ? 'يرجى كتابة اسم للتمرين' : 'Please enter an exercise name');
        return;
      }

      const id = `custom_${Date.now()}`;
      const config = {
        id,
        nameAr: `⭐ ${name}`,
        nameEn: name,
        cat: 'custom',
        joint: customSelectJoint.value,
        startAngle: recordedStartAngle,
        endAngle: recordedEndAngle,
        calFactor: 0.35,
        unitAr: 'تكرار',
        unitEn: 'Reps',
        targetAngle: `${recordedEndAngle}°`,
        steps: [
          `ابدأ التمرين في وضعية الزاوية (${recordedStartAngle}°).`,
          `تحرك بأقصى انثناء حتى تصل للزاوية (${recordedEndAngle}°).`,
          `عد لوضعية البداية لإكمال التكرار بنجاح.`
        ],
        mistakes: ['حافظ على حركة منتظمة وثابتة.']
      };

      // 1. Save to LocalStorage permanently
      saveCustomExerciseToStorage(config);

      // 2. Register in PoseEngine and Database
      registerAndRenderCustomExercise(config, true);

      // 3. Reset and Close Modal
      poseEngine.setCalibratingJoint(null);
      customInputName.value = '';
      if (customModal) customModal.classList.remove('show');

      showCoachToast(`تم حفظ وتفعيل تمرين: ${name}`);
      audioCoach.speak(audioCoach.language === 'ar' ? `تم حفظ تمرين ${name} بنجاح` : `Custom exercise ${name} saved`);
    });
  }

  function saveCustomExerciseToStorage(config) {
    try {
      const list = JSON.parse(localStorage.getItem('goldrep_custom_exercises') || '[]');
      list.push(config);
      localStorage.setItem('goldrep_custom_exercises', JSON.stringify(list));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }

  function registerAndRenderCustomExercise(config, selectImmediately = false) {
    // Register in EXERCISES_DB
    EXERCISES_DB[config.id] = config;

    // Register in PoseEngine
    poseEngine.registerCustomExercise(config.id, config);

    // Create UI chip button if not already in DOM
    let btn = document.querySelector(`[data-exercise="${config.id}"]`);
    if (!btn && chipsContainer) {
      btn = document.createElement('button');
      btn.className = 'chip-btn';
      btn.dataset.exercise = config.id;
      btn.dataset.cat = 'custom';
      btn.innerHTML = `${config.nameAr}`;

      btn.addEventListener('click', () => {
        document.querySelectorAll('.chip-btn').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');

        currentExerciseKey = config.id;
        poseEngine.setExercise(config.id);
        poseEngine.resetCounter();
        repCountEl.textContent = '0';
        caloriesBurnedEl.textContent = '0';
        if (repUnitEl) repUnitEl.textContent = audioCoach.language === 'ar' ? config.unitAr : config.unitEn;
        if (repProgressRing) repProgressRing.style.strokeDashoffset = RING_CIRCUMFERENCE;

        showCoachToast(`تمرين: ${config.nameAr}`);
        audioCoach.speak(audioCoach.language === 'ar' ? `تمرين ${config.nameAr}` : `Exercise ${config.nameEn}`);
      });

      chipsContainer.appendChild(btn);
    }

    if (selectImmediately && btn) {
      btn.click();
    }
  }

  // Load all custom exercises on app startup
  function loadStoredCustomExercises() {
    try {
      const list = JSON.parse(localStorage.getItem('goldrep_custom_exercises') || '[]');
      list.forEach(item => registerAndRenderCustomExercise(item, false));
    } catch (e) {
      console.warn('LocalStorage load error:', e);
    }
  }
  loadStoredCustomExercises();

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('SW Registered:', reg.scope))
        .catch(err => console.log('SW Fail:', err));
    });
  }
});
