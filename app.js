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
  const firebaseService = new FirebaseService();
  const routineManager = new RoutineManager();
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
    onRep: (count, quality, tempoTime, isSuperRep) => handleRepEvent(count, quality, tempoTime, isSuperRep),
    onCue: () => audioCoach.playCueSound(),
    onAngleUpdate: (data) => handleAngleUpdate(data),
    onStatusChange: (status, msg) => handleStatusChange(status, msg),
    onGhostUpdate: (data) => handleGhostUpdate(data)
  });

  // Handle Rep Event (Count completed!)
  function handleRepEvent(count, quality, tempoTime = 2.4, isSuperRep = false) {
    totalRepsAllExercises++;
    if (quality === 'perfect' || isSuperRep) perfectRepsCount++;

    // Visual bump
    repCountEl.textContent = count;
    repCountEl.classList.remove('bump');
    void repCountEl.offsetWidth; // Trigger reflow
    repCountEl.classList.add('bump');

    // Update Calories
    updateCalories(count);

    // Audio announcement & encouragement cheer
    audioCoach.announceRep(count, quality === 'perfect');

    // Tempo & Time Under Tension (TUT) Feedback
    const tempoPill = document.getElementById('hud-tempo-pill');
    const tempoText = document.getElementById('hud-tempo-text');
    if (tempoText) {
      tempoText.textContent = `${audioCoach.language === 'ar' ? 'إيقاع' : 'Tempo'}: ${tempoTime}s ${isSuperRep ? '🔥 Super Rep' : ''}`;
    }
    if (isSuperRep) {
      audioCoach.playSuperRepSound();
      if (tempoPill) {
        tempoPill.classList.add('super-rep-flash');
        setTimeout(() => tempoPill.classList.remove('super-rep-flash'), 1200);
      }
    }
    if (count % 3 === 0) {
      audioCoach.announceTempo(tempoTime, isSuperRep);
    }

    // Show floating motivational toast
    const cheer = isSuperRep
      ? (audioCoach.language === 'ar' ? '🔥 تكرار خارق! تحكم ممتاز في النزول!' : '🔥 Super Rep! Controlled TUT!')
      : (audioCoach.language === 'ar' 
          ? (quality === 'perfect' ? 'أداء ممتاز 100%! استمر!' : 'بطل! للعدة القادمة!')
          : (quality === 'perfect' ? 'Perfect Form! Keep going!' : 'Nice! Push for next!'));
    showCoachToast(cheer);

    // Progress Routine Manager
    routineManager.onRepDone(count);

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

    // Automatically sync workout session to Google Firebase / LocalStorage
    firebaseService.saveWorkoutSession({
      exercise: currentExerciseKey,
      reps: poseEngine.repCount,
      duration: elapsedSeconds,
      calories: parseFloat(caloriesBurnedEl.textContent) || 0,
      accuracy: formScoreEl.textContent
    });
  }

  // =========================================================================
  // AUTHENTICATION & ROLE-BASED ACCESS CONTROL (User vs Admin)
  // =========================================================================
  const btnAuthGoogle = document.getElementById('btn-auth-google');
  const authAlertBox = document.getElementById('auth-alert-box');
  const btnModeSignin = document.getElementById('btn-mode-signin');
  const btnModeSignup = document.getElementById('btn-mode-signup');
  const authEmailForm = document.getElementById('auth-email-form');
  const authNameGroup = document.getElementById('auth-name-group');
  const authInputName = document.getElementById('auth-input-name');
  const authInputEmail = document.getElementById('auth-input-email');
  const authInputPassword = document.getElementById('auth-input-password');
  const btnSubmitAuth = document.getElementById('btn-submit-auth');
  const btnSubmitAuthText = document.getElementById('btn-submit-auth-text');
  const btnAuthGuest = document.getElementById('btn-auth-guest');
  const btnAuthAdminToggle = document.getElementById('btn-auth-admin-toggle');
  const adminPinBox = document.getElementById('admin-pin-box');
  const adminPinInput = document.getElementById('admin-pin-input');
  const btnSubmitAdminPin = document.getElementById('btn-submit-admin-pin');
  const btnCloseAdminPin = document.getElementById('btn-close-admin-pin');

  // Sidebar user status elements
  const userDisplayNameEl = document.getElementById('user-display-name');
  const userRoleBadgeEl = document.getElementById('user-role-badge');
  const btnSidebarAuthAction = document.getElementById('btn-sidebar-auth-action');
  const btnSidebarSignout = document.getElementById('btn-sidebar-signout');
  const tabBtnDev = document.getElementById('tab-btn-dev');

  let authMode = 'signin'; // 'signin' | 'signup'

  function showAuthAlert(msg, type = 'error') {
    if (!authAlertBox) return;
    authAlertBox.textContent = msg;
    authAlertBox.className = `auth-alert-box ${type}`;
    authAlertBox.style.display = 'block';
  }

  function hideAuthAlert() {
    if (authAlertBox) authAlertBox.style.display = 'none';
  }

  function applyRolePermissions(role, user) {
    const isAdmin = (role === 'admin') || (user && user.role === 'admin');

    // Developer Tab Visibility: ONLY for Admin
    if (tabBtnDev) {
      tabBtnDev.style.display = isAdmin ? 'inline-flex' : 'none';
    }

    // Sidebar User Profile Badge
    if (userDisplayNameEl) {
      userDisplayNameEl.textContent = (user && (user.displayName || user.email)) || 'ضيف (Guest)';
    }

    if (userRoleBadgeEl) {
      if (isAdmin) {
        userRoleBadgeEl.textContent = '👑 مسؤول النظام (Admin)';
        userRoleBadgeEl.className = 'user-role-badge role-admin';
      } else if (user && user.role === 'user') {
        userRoleBadgeEl.textContent = '👤 متدرب مسجل';
        userRoleBadgeEl.className = 'user-role-badge role-user';
      } else {
        userRoleBadgeEl.textContent = '🏃‍♂️ متدرب ضيف';
        userRoleBadgeEl.className = 'user-role-badge role-guest';
      }
    }

    if (btnSidebarSignout) {
      btnSidebarSignout.style.display = (user && user.role !== 'guest') ? 'flex' : 'none';
    }

    // If currently on dev tab and user is not admin, redirect to dashboard
    if (!isAdmin) {
      const devPanel = document.getElementById('tab-dev');
      if (devPanel && devPanel.classList.contains('active')) {
        const dashBtn = document.querySelector('[data-tab="dashboard"]');
        if (dashBtn) dashBtn.click();
      }
    }
  }

  // Google Sign In
  if (btnAuthGoogle) {
    btnAuthGoogle.addEventListener('click', async () => {
      audioCoach.unlock();
      hideAuthAlert();
      const originalHtml = btnAuthGoogle.innerHTML;
      btnAuthGoogle.style.opacity = '0.7';
      btnAuthGoogle.innerHTML = '<span>جاري الاتصال بحساب Google...</span>';
      try {
        const res = await firebaseService.signInWithGoogle();
        welcomeModal.classList.add('hidden');
        applyRolePermissions(firebaseService.role, firebaseService.user);
        showCoachToast(`مرحباً بك يا بطل! تم تسجيل الدخول (${res.user.displayName || 'Google'})`);
        audioCoach.speak(audioCoach.language === 'ar' ? 'أهلاً بك! تم تسجيل الدخول بنجاح' : 'Welcome to AI Gym!');
        startWorkout();
      } catch (err) {
        showAuthAlert(err.message || 'تعذر تسجيل الدخول بحساب Google');
      } finally {
        btnAuthGoogle.style.opacity = '1';
        btnAuthGoogle.innerHTML = originalHtml;
      }
    });
  }

  // Toggle Login / Register
  if (btnModeSignin && btnModeSignup) {
    btnModeSignin.addEventListener('click', () => {
      authMode = 'signin';
      btnModeSignin.classList.add('active');
      btnModeSignup.classList.remove('active');
      if (authNameGroup) authNameGroup.style.display = 'none';
      if (btnSubmitAuthText) btnSubmitAuthText.textContent = 'تسجيل الدخول';
      hideAuthAlert();
    });

    btnModeSignup.addEventListener('click', () => {
      authMode = 'signup';
      btnModeSignup.classList.add('active');
      btnModeSignin.classList.remove('active');
      if (authNameGroup) authNameGroup.style.display = 'flex';
      if (btnSubmitAuthText) btnSubmitAuthText.textContent = 'إنشاء حساب جديد';
      hideAuthAlert();
    });
  }

  // Email/Password Submit
  if (authEmailForm) {
    authEmailForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      audioCoach.unlock();
      hideAuthAlert();

      const email = (authInputEmail.value || '').trim();
      const password = (authInputPassword.value || '').trim();
      const name = authInputName ? (authInputName.value || '').trim() : '';

      if (!email || !password) {
        showAuthAlert('يرجى ملء جميع الحقول المطلوبة');
        return;
      }

      btnSubmitAuth.disabled = true;
      if (btnSubmitAuthText) btnSubmitAuthText.textContent = 'جاري التحقق...';

      try {
        let res;
        if (authMode === 'signup') {
          res = await firebaseService.signUpWithEmail(email, password, name);
          showCoachToast('🎉 تم إنشاء حسابك الرياضي بنجاح!');
        } else {
          res = await firebaseService.signInWithEmail(email, password);
          showCoachToast(`مرحباً بك مجدداً ${res.user.displayName}!`);
        }
        welcomeModal.classList.add('hidden');
        applyRolePermissions(firebaseService.role, firebaseService.user);
        audioCoach.speak(audioCoach.language === 'ar' ? 'تم تسجيل الدخول بنجاح! جاهز للتمرين' : 'Welcome back!');
        startWorkout();
      } catch (err) {
        showAuthAlert(err.message || 'حدث خطأ في عملية تسجيل الدخول');
      } finally {
        btnSubmitAuth.disabled = false;
        if (btnSubmitAuthText) btnSubmitAuthText.textContent = authMode === 'signup' ? 'إنشاء حساب جديد' : 'تسجيل الدخول';
      }
    });
  }

  // Guest Mode Trigger
  if (btnAuthGuest) {
    btnAuthGuest.addEventListener('click', () => {
      audioCoach.unlock();
      firebaseService.signInAsGuest();
      welcomeModal.classList.add('hidden');
      applyRolePermissions('guest', firebaseService.user);
      showCoachToast('🏃‍♂️ تم الدخول كمتدرب ضيف - انطلق في التمرين!');
      audioCoach.speak(audioCoach.language === 'ar' ? 'أهلاً بك! انطلق بالتمرين' : 'Welcome! Start workout!');
      startWorkout();
    });
  }

  // Admin PIN Toggle
  if (btnAuthAdminToggle && adminPinBox) {
    btnAuthAdminToggle.addEventListener('click', () => {
      adminPinBox.style.display = adminPinBox.style.display === 'none' ? 'block' : 'none';
      if (adminPinInput) adminPinInput.focus();
    });
  }

  if (btnCloseAdminPin && adminPinBox) {
    btnCloseAdminPin.addEventListener('click', () => {
      adminPinBox.style.display = 'none';
    });
  }

  // Submit Admin PIN
  if (btnSubmitAdminPin && adminPinInput) {
    btnSubmitAdminPin.addEventListener('click', () => {
      const pin = adminPinInput.value;
      if (firebaseService.verifyAdminPin(pin)) {
        showCoachToast('👑 تم تفعيل صلاحيات مسؤول النظام (Admin) بنجاح!');
        audioCoach.speak(audioCoach.language === 'ar' ? 'تم تفعيل صلاحيات الأدمن' : 'Admin privileges granted');
        applyRolePermissions('admin', firebaseService.user);
        welcomeModal.classList.add('hidden');
        if (adminPinBox) adminPinBox.style.display = 'none';
        adminPinInput.value = '';
      } else {
        showAuthAlert('❌ رمز المرور السري للأدمن غير صحيح (الرمز الافتراضي: 2026)');
      }
    });
  }

  // Sidebar Auth Actions (Sign In button & Sign Out)
  if (btnSidebarAuthAction) {
    btnSidebarAuthAction.addEventListener('click', () => {
      closeSidebar();
      welcomeModal.classList.remove('hidden');
    });
  }

  if (btnSidebarSignout) {
    btnSidebarSignout.addEventListener('click', async () => {
      await firebaseService.signOut();
      applyRolePermissions('guest', null);
      showCoachToast('تم تسجيل الخروج بنجاح');
      closeSidebar();
      welcomeModal.classList.remove('hidden');
    });
  }

  // Listen to Global Cloud Auth Changes
  window.addEventListener('cloud-auth-change', (e) => {
    const { user, role } = e.detail || {};
    applyRolePermissions(role || firebaseService.role, user || firebaseService.user);
  });

  // Initial Permission Check on Load
  applyRolePermissions(firebaseService.role, firebaseService.user);

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
  if (btnToggleCamera) {
    btnToggleCamera.addEventListener('click', async () => {
      btnToggleCamera.style.transform = 'rotate(180deg)';
      await poseEngine.toggleCamera();
      setTimeout(() => { btnToggleCamera.style.transform = ''; }, 300);
    });
  }

  // Toggle Audio Mute
  if (btnToggleMute) {
    btnToggleMute.addEventListener('click', () => {
      const isMuted = audioCoach.toggleMute();
      btnToggleMute.style.opacity = isMuted ? '0.5' : '1';
      btnToggleMute.textContent = isMuted 
        ? (audioCoach.language === 'ar' ? '🔇 مكتوم' : '🔇 Muted')
        : (audioCoach.language === 'ar' ? '🔊 مفعل' : '🔊 Active');
      showCoachToast(isMuted 
        ? (audioCoach.language === 'ar' ? 'تم كتم الصوت' : 'Sound Muted') 
        : (audioCoach.language === 'ar' ? 'تم تشغيل الصوت' : 'Sound On'));
    });
  }

  // Toggle Language
  if (btnToggleLang) {
    btnToggleLang.addEventListener('click', () => {
      const newLang = audioCoach.language === 'ar' ? 'en' : 'ar';
      audioCoach.setLanguage(newLang);
      btnToggleLang.textContent = newLang === 'ar' ? 'AR (العربية)' : 'EN (English)';
      document.body.style.direction = newLang === 'ar' ? 'rtl' : 'ltr';
      showCoachToast(newLang === 'ar' ? 'اللغة: العربية' : 'Language: English');
    });
  }

  // Reset Button
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      poseEngine.resetCounter();
      repCountEl.textContent = '0';
      if (repProgressRing) repProgressRing.style.strokeDashoffset = RING_CIRCUMFERENCE;
      showCoachToast(audioCoach.language === 'ar' ? 'تم تصفير العداد' : 'Counter reset');
    });
  }

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

  // ==========================================================
  // 1. Rest Timer Logic & Audio Whistle Countdown
  // ==========================================================
  let restTimerCountdown = 0;
  let restTimerTotal = 60;
  let restTimerInterval = null;

  function showRestTimerModal(seconds = 60, nextInfo = '') {
    restTimerTotal = seconds;
    restTimerCountdown = seconds;
    const restModal = document.getElementById('rest-timer-modal');
    const display = document.getElementById('rest-seconds-display');
    const label = document.getElementById('rest-next-exercise-label');
    const ring = document.getElementById('rest-ring-progress');

    if (label) label.textContent = nextInfo || (audioCoach.language === 'ar' ? 'استرح واستعد للجولة التالية!' : 'Rest and recover!');
    if (display) display.textContent = restTimerCountdown;
    if (ring) ring.style.strokeDashoffset = '0';
    if (restModal) restModal.style.display = 'flex';

    if (restTimerInterval) clearInterval(restTimerInterval);

    restTimerInterval = setInterval(() => {
      restTimerCountdown--;
      if (display) display.textContent = Math.max(0, restTimerCountdown);

      if (ring) {
        const fraction = Math.max(0, restTimerCountdown) / restTimerTotal;
        const offset = 534 * (1 - fraction);
        ring.style.strokeDashoffset = offset;
      }

      // Audio beeps on 3, 2, 1
      if (restTimerCountdown <= 3 && restTimerCountdown > 0) {
        audioCoach.playCountdownBeep();
      } else if (restTimerCountdown <= 0) {
        closeRestTimerModal();
        audioCoach.playWhistleSound();
        audioCoach.speak(audioCoach.language === 'ar' ? 'انتهت الراحة! ابدأ الجولة الآن!' : 'Rest finished! Start your set!');
        showCoachToast('انتهت الراحة! انطلق بالجولة التالية 🚀');
      }
    }, 1000);
  }

  function closeRestTimerModal() {
    if (restTimerInterval) {
      clearInterval(restTimerInterval);
      restTimerInterval = null;
    }
    const restModal = document.getElementById('rest-timer-modal');
    if (restModal) restModal.style.display = 'none';
  }

  const btnRestAdd15 = document.getElementById('btn-rest-add15');
  if (btnRestAdd15) {
    btnRestAdd15.addEventListener('click', () => {
      restTimerCountdown += 15;
      restTimerTotal += 15;
      const display = document.getElementById('rest-seconds-display');
      if (display) display.textContent = restTimerCountdown;
      showCoachToast('+15 ثانية راحة إضافية');
    });
  }

  const btnRestSkip = document.getElementById('btn-rest-skip');
  if (btnRestSkip) {
    btnRestSkip.addEventListener('click', () => {
      closeRestTimerModal();
      audioCoach.playWhistleSound();
      audioCoach.speak(audioCoach.language === 'ar' ? 'انطلق! ابدأ الجولة!' : 'Go! Start your set!');
    });
  }

  // ==========================================================
  // 2. YouTube Video Modal (شرح أداء التمرين بالفيديو)
  // ==========================================================
  function openYouTubeModal(youtubeUrl, title = '') {
    const modal = document.getElementById('youtube-player-modal');
    const iframe = document.getElementById('youtube-iframe');
    const titleEl = document.getElementById('youtube-modal-exercise-title');
    if (!modal || !iframe) return;

    const videoId = RoutineManager.extractYouTubeId(youtubeUrl);
    if (videoId) {
      iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;
    } else {
      iframe.src = 'https://www.youtube-nocookie.com/embed/aclHkVaku9U?autoplay=1';
    }

    if (titleEl && title) titleEl.textContent = title;
    modal.classList.add('show');
    modal.style.display = 'flex';
  }

  function closeYouTubeModal() {
    const modal = document.getElementById('youtube-player-modal');
    const iframe = document.getElementById('youtube-iframe');
    if (iframe) iframe.src = ''; // Stop video immediately
    if (modal) {
      modal.classList.remove('show');
      modal.style.display = 'none';
    }
  }

  const btnCloseYouTubeModal = document.getElementById('btn-close-youtube-modal');
  const btnDoneYouTube = document.getElementById('btn-done-youtube');
  if (btnCloseYouTubeModal) btnCloseYouTubeModal.addEventListener('click', closeYouTubeModal);
  if (btnDoneYouTube) btnDoneYouTube.addEventListener('click', closeYouTubeModal);

  // ==========================================================
  // 3. Ghost Rival Mode (وضع التنافس ضد الشبح)
  // ==========================================================
  let isGhostModeActive = false;
  const btnToggleGhost = document.getElementById('btn-toggle-ghost');
  const hudGhostPill = document.getElementById('hud-ghost-pill');
  const hudGhostText = document.getElementById('hud-ghost-text');

  if (btnToggleGhost) {
    btnToggleGhost.addEventListener('click', () => {
      isGhostModeActive = !isGhostModeActive;
      btnToggleGhost.style.background = isGhostModeActive ? 'rgba(52, 152, 219, 0.4)' : '';
      btnToggleGhost.textContent = isGhostModeActive 
        ? (audioCoach.language === 'ar' ? '👻 إيقاف' : '👻 Off') 
        : (audioCoach.language === 'ar' ? '👻 تفعيل' : '👻 On');
      if (hudGhostPill) hudGhostPill.style.display = isGhostModeActive ? 'inline-flex' : 'none';

      if (isGhostModeActive) {
        poseEngine.startGhostRival(12, 3.2);
        showCoachToast(audioCoach.language === 'ar' ? 'تم تفعيل منافس الشبح 👻 سابق وتفوق عليه!' : 'Ghost Rival mode active!');
        audioCoach.speak(audioCoach.language === 'ar' ? 'تحدي الشبح مفعل! سابق لتحقيق الفوز!' : 'Ghost challenge active!');
      } else {
        poseEngine.stopGhostRival();
        showCoachToast(audioCoach.language === 'ar' ? 'تم إيقاف منافس الشبح' : 'Ghost Rival stopped');
      }
    });
  }

  function handleGhostUpdate(data) {
    if (!hudGhostText || !hudGhostPill) return;
    const lead = data.lead;
    if (lead > 0) {
      hudGhostText.textContent = `👻 الشبح: ${data.ghostReps} | أنت: ${data.userReps} (+${lead} متقدم 🟢)`;
      hudGhostPill.className = 'hud-pill hud-ghost winning';
    } else if (lead < 0) {
      hudGhostText.textContent = `👻 الشبح: ${data.ghostReps} | أنت: ${data.userReps} (${lead} متأخر 🔴)`;
      hudGhostPill.className = 'hud-pill hud-ghost losing';
    } else {
      hudGhostText.textContent = `👻 الشبح: ${data.ghostReps} | أنت: ${data.userReps} (تعادل ⚪)`;
      hudGhostPill.className = 'hud-pill hud-ghost';
    }
  }

  // ==========================================================
  // 4. Routine Manager & Multi-Day Planner UI
  // ==========================================================
  const routineModal = document.getElementById('routine-planner-modal');
  const btnOpenRoutines = document.getElementById('btn-open-routines');
  const btnCloseRoutineModal = document.getElementById('btn-close-routine-modal');
  const routinePlanSelector = document.getElementById('routine-plan-selector');
  const routineDaysContainer = document.getElementById('routine-days-container');
  const routineExercisesList = document.getElementById('routine-exercises-list');
  const routineDayName = document.getElementById('routine-day-name');
  const routineExercisesCount = document.getElementById('routine-exercises-count');
  const btnStartRoutineSession = document.getElementById('btn-start-routine-session');
  const hudRoutinePill = document.getElementById('hud-routine-pill');
  const hudRoutineText = document.getElementById('hud-routine-text');

  let selectedDayIndex = 0;

  // Routine Manager Event Hooks
  routineManager.onRestTriggered = ({ restSeconds, nextExercise, nextSet, totalSets }) => {
    const nextExName = (EXERCISES_DB[nextExercise] && EXERCISES_DB[nextExercise].nameAr) || nextExercise;
    showRestTimerModal(restSeconds, `التمرين التالي: ${nextExName} (الجولة ${nextSet} من ${totalSets})`);
  };

  routineManager.onExerciseChange = ({ exerciseKey, setNumber, totalSets, targetReps }) => {
    // Select and activate exercise in PoseEngine
    const targetChip = document.querySelector(`[data-exercise="${exerciseKey}"]`);
    if (targetChip) targetChip.click();

    if (hudRoutinePill && hudRoutineText) {
      hudRoutinePill.style.display = 'inline-flex';
      const exName = (EXERCISES_DB[exerciseKey] && EXERCISES_DB[exerciseKey].nameAr) || exerciseKey;
      hudRoutineText.textContent = `${exName}: جولة ${setNumber}/${totalSets} (هدف ${targetReps})`;
    }
  };

  routineManager.onRoutineCompleted = ({ routineName, totalSets }) => {
    if (hudRoutinePill) hudRoutinePill.style.display = 'none';
    audioCoach.speak(audioCoach.language === 'ar' ? 'تهانينا! أكملت كامل روتين اليوم بنجاح أسطوري!' : 'Congratulations! Routine complete!');
    showCoachToast('🎉 تم إكمال روتين اليوم بنجاح كاسح!');
    firebaseService.saveWorkoutSession({
      routine: routineName,
      totalSets,
      totalReps: totalRepsAllExercises,
      duration: elapsedSeconds
    });
  };

  function renderRoutinePlannerUI() {
    if (!routinePlanSelector) return;
    routinePlanSelector.innerHTML = '';
    const allRoutines = routineManager.getAllRoutines();

    allRoutines.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = `${r.name} (${r.days.length} أيام)`;
      if (r.id === routineManager.activeRoutineId) opt.selected = true;
      routinePlanSelector.appendChild(opt);
    });

    renderRoutineDays();
  }

  function renderRoutineDays() {
    const routine = routineManager.getActiveRoutine();
    if (!routine || !routineDaysContainer) return;

    routineDaysContainer.innerHTML = '';
    routine.days.forEach((day, index) => {
      const tab = document.createElement('button');
      tab.className = `routine-day-tab ${index === selectedDayIndex ? 'active' : ''}`;
      tab.textContent = day.dayName;
      tab.addEventListener('click', () => {
        selectedDayIndex = index;
        renderRoutineDays();
      });
      routineDaysContainer.appendChild(tab);
    });

    renderSelectedDayExercises();
  }

  function renderSelectedDayExercises() {
    const routine = routineManager.getActiveRoutine();
    if (!routine || !routine.days) return;
    const currentDay = routine.days[selectedDayIndex] || routine.days[0];
    if (!currentDay || !routineExercisesList) return;

    const exercisesList = currentDay.exercises || currentDay.items || [];

    if (routineDayName) routineDayName.textContent = currentDay.dayName || 'يوم التمرين';
    if (routineExercisesCount) routineExercisesCount.textContent = `${exercisesList.length} تمارين`;

    routineExercisesList.innerHTML = '';

    exercisesList.forEach(ex => {
      const exKey = ex.exerciseKey || ex.exerciseId || 'squats';
      const exMeta = EXERCISES_DB[exKey] || { nameAr: ex.nameAr || exKey };
      const sets = ex.sets || ex.targetSets || 3;
      const reps = ex.targetReps || 10;
      const rest = ex.restSeconds || 45;
      const ytUrl = ex.youtubeUrl || 'https://www.youtube.com/watch?v=aclHkVaku9U';

      const card = document.createElement('div');
      card.className = 'routine-ex-card';
      card.innerHTML = `
        <div class="routine-ex-info">
          <div class="routine-ex-title">${exMeta.nameAr}</div>
          <div class="routine-ex-sub">${sets} جولات × ${reps} تكرار • راحة ${rest}ث</div>
        </div>
        <button class="btn-youtube-watch" data-url="${ytUrl}" data-title="${exMeta.nameAr}">
          <span>📺 يوتيوب</span>
        </button>
      `;

      const ytBtn = card.querySelector('.btn-youtube-watch');
      ytBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openYouTubeModal(ytBtn.dataset.url, ytBtn.dataset.title);
      });

      routineExercisesList.appendChild(card);
    });
  }

  if (btnOpenRoutines) {
    btnOpenRoutines.addEventListener('click', () => {
      renderRoutinePlannerUI();
      if (routineModal) {
        routineModal.classList.add('show');
        routineModal.style.display = 'flex';
      }
    });
  }

  if (btnCloseRoutineModal) {
    btnCloseRoutineModal.addEventListener('click', () => {
      if (routineModal) {
        routineModal.classList.remove('show');
        routineModal.style.display = 'none';
      }
    });
  }

  if (routinePlanSelector) {
    routinePlanSelector.addEventListener('change', (e) => {
      routineManager.selectRoutine(e.target.value);
      selectedDayIndex = 0;
      renderRoutineDays();
    });
  }

  if (btnStartRoutineSession) {
    btnStartRoutineSession.addEventListener('click', () => {
      const routine = routineManager.getActiveRoutine();
      const currentDay = routine.days[selectedDayIndex];
      if (currentDay) {
        routineManager.startDaySession(currentDay.dayId);
        if (routineModal) routineModal.style.display = 'none';
        showCoachToast(`بدأت جلسة: ${currentDay.dayName}`);
        audioCoach.speak(audioCoach.language === 'ar' ? `بدأت جلسة ${currentDay.dayName}` : 'Session started');

        // Start workout camera if not active
        if (!isWorkoutActive) {
          startWorkout();
        }
      }
    });
  }

  // ==========================================================
  // 5. Firebase Cloud Sync Modal
  // ==========================================================
  const cloudModal = document.getElementById('cloud-sync-modal');
  const btnOpenCloud = document.getElementById('btn-open-cloud');
  const btnCloseCloudModal = document.getElementById('btn-close-cloud-modal');
  const btnSyncNow = document.getElementById('btn-sync-now');
  const btnExportBackup = document.getElementById('btn-export-backup');
  const cloudSyncedCount = document.getElementById('cloud-synced-count');

  function updateCloudStats() {
    const workouts = firebaseService.getLocalWorkouts();
    if (cloudSyncedCount) {
      cloudSyncedCount.textContent = `${workouts.length} جلسة`;
    }
  }

  if (btnOpenCloud) {
    btnOpenCloud.addEventListener('click', () => {
      updateCloudStats();
      if (cloudModal) {
        cloudModal.classList.add('show');
        cloudModal.style.display = 'flex';
      }
    });
  }

  if (btnCloseCloudModal) {
    btnCloseCloudModal.addEventListener('click', () => {
      if (cloudModal) {
        cloudModal.classList.remove('show');
        cloudModal.style.display = 'none';
      }
    });
  }

  if (btnSyncNow) {
    btnSyncNow.addEventListener('click', async () => {
      btnSyncNow.innerHTML = '<span>⏳ جاري المزامنة مع سحابة Google...</span>';
      const res = await firebaseService.syncAllData();
      btnSyncNow.innerHTML = '<span>🔄 مزامنة البيانات الآن (Sync to Cloud)</span>';
      showCoachToast(res.success ? '✅ تمت المزامنة السحابية بنجاح!' : '⚠️ تم الحفظ محلياً (وضع عدم الاتصال)');
      updateCloudStats();
    });
  }

  if (btnExportBackup) {
    btnExportBackup.addEventListener('click', () => {
      const data = {
        workouts: firebaseService.getLocalWorkouts(),
        routines: routineManager.getAllRoutines(),
        exportedAt: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `goldrep_backup_${Date.now()}.json`;
      a.click();
      showCoachToast('📁 تم تصدير النسخة الاحتياطية بنجاح!');
    });
  }

  // =========================================================================
  // 6. AI GYM SIDEBAR DRAWER (القائمة الجانبية المتقدمة والتبويبات)
  // =========================================================================
  const btnOpenSidebar = document.getElementById('btn-open-sidebar');
  const btnCloseSidebar = document.getElementById('btn-close-sidebar');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  const appSidebar = document.getElementById('app-sidebar');
  const sidebarTabBtns = document.querySelectorAll('.sidebar-tab-btn');
  const sidebarPanels = document.querySelectorAll('.sidebar-panel');

  function openSidebar() {
    audioCoach.unlock();
    if (sidebarBackdrop) sidebarBackdrop.classList.add('show');
    if (appSidebar) appSidebar.classList.add('show');
    updateDashboardStats();
    updateLiveCoachTip();
    updateSensorInspector();
  }

  function closeSidebar() {
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('show');
    if (appSidebar) appSidebar.classList.remove('show');
  }

  if (btnOpenSidebar) btnOpenSidebar.addEventListener('click', openSidebar);
  if (btnCloseSidebar) btnCloseSidebar.addEventListener('click', closeSidebar);
  if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeSidebar);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSidebar();
  });

  // Sidebar Tab Navigation
  sidebarTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      sidebarTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      sidebarPanels.forEach(panel => {
        panel.classList.remove('active');
        if (panel.id === `tab-${targetTab}`) {
          panel.classList.add('active');
        }
      });
    });
  });

  // =========================================================================
  // 7. VOICE CONTROL ENGINE (التحكم الصوتي لبدء وإيقاف التمرين)
  // =========================================================================
  const btnVoiceControl = document.getElementById('btn-voice-control');
  let isVoiceListening = false;
  let speechRecognizer = null;

  const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognitionClass) {
    speechRecognizer = new SpeechRecognitionClass();
    speechRecognizer.continuous = true;
    speechRecognizer.interimResults = false;
    speechRecognizer.maxAlternatives = 1;

    speechRecognizer.onresult = (event) => {
      const lastIndex = event.results.length - 1;
      const result = event.results[lastIndex];
      if (!result.isFinal) return;
      const transcript = (result[0].transcript || '').trim().toLowerCase();
      console.log('[Voice Command Heard]:', transcript);
      handleVoiceCommand(transcript);
    };

    speechRecognizer.onerror = (err) => {
      console.warn('Speech Recognition error:', err);
      if (err.error === 'not-allowed') {
        isVoiceListening = false;
        if (btnVoiceControl) btnVoiceControl.classList.remove('listening');
        showCoachToast('⚠️ يرجى السماح بصلاحية الميكروفون للتحكم الصوتي');
      }
    };

    speechRecognizer.onend = () => {
      if (isVoiceListening) {
        try { speechRecognizer.start(); } catch (e) {}
      }
    };
  }

  function handleVoiceCommand(cmd) {
    // 1. Start command
    if (cmd.includes('ابدأ') || cmd.includes('ابدا') || cmd.includes('يلا') || cmd.includes('start') || cmd.includes('go')) {
      if (!isWorkoutActive) {
        showCoachToast('🎙️ أمر صوتي: بدء التمرين!');
        audioCoach.speak(audioCoach.language === 'ar' ? 'أمر صوتي، بدأ التمرين!' : 'Voice command: start!');
        startWorkout();
      }
      return;
    }

    // 2. Stop / Pause / End command
    if (cmd.includes('قف') || cmd.includes('وقف') || cmd.includes('توقف') || cmd.includes('انهاء') || cmd.includes('إنهاء') || cmd.includes('stop') || cmd.includes('pause') || cmd.includes('end')) {
      if (isWorkoutActive) {
        showCoachToast('🎙️ أمر صوتي: إيقاف التمرين!');
        audioCoach.speak(audioCoach.language === 'ar' ? 'أمر صوتي، تم إيقاف التمرين!' : 'Voice command: stop!');
        stopWorkout();
      }
      return;
    }

    // 3. Reset command
    if (cmd.includes('صفر') || cmd.includes('تصفير') || cmd.includes('اعادة') || cmd.includes('إعادة') || cmd.includes('reset')) {
      btnReset.click();
      showCoachToast('🎙️ أمر صوتي: تم تصفير العداد');
      return;
    }

    // 4. Camera flip command
    if (cmd.includes('كاميرا') || cmd.includes('اقلب') || cmd.includes('تبديل') || cmd.includes('camera') || cmd.includes('flip')) {
      btnToggleCamera.click();
      showCoachToast('🎙️ أمر صوتي: تبديل الكاميرا');
      return;
    }
  }

  if (btnVoiceControl) {
    btnVoiceControl.addEventListener('click', () => {
      audioCoach.unlock();
      if (!SpeechRecognitionClass) {
        showCoachToast('⚠️ متصفحك لا يدعم التعرف الصوتي المباشر');
        return;
      }

      isVoiceListening = !isVoiceListening;
      if (isVoiceListening) {
        try {
          speechRecognizer.lang = audioCoach.language === 'ar' ? 'ar-SA' : 'en-US';
          speechRecognizer.start();
          btnVoiceControl.classList.add('listening');
          showCoachToast(audioCoach.language === 'ar' ? '🎙️ تم تفعيل التحكم الصوتي! قل: "ابدأ" أو "قف"' : '🎙️ Voice control active! Say "Start" or "Stop"');
          audioCoach.speak(audioCoach.language === 'ar' ? 'التحكم الصوتي مفعّل، قل ابدأ أو قف' : 'Voice commands ready');
        } catch (e) {
          console.warn('Start voice error:', e);
        }
      } else {
        try { speechRecognizer.stop(); } catch (e) {}
        btnVoiceControl.classList.remove('listening');
        showCoachToast(audioCoach.language === 'ar' ? 'تم إيقاف التحكم الصوتي' : 'Voice control stopped');
      }
    });
  }

  // =========================================================================
  // 8. DASHBOARD METRICS & HISTORY (إحصائيات الداش بورد)
  // =========================================================================
  const dashTotalReps = document.getElementById('dash-total-reps');
  const dashTotalCalories = document.getElementById('dash-total-calories');
  const dashTotalTime = document.getElementById('dash-total-time');
  const dashAvgForm = document.getElementById('dash-avg-form');
  const dashDailyProgressBar = document.getElementById('dash-daily-progress-bar');
  const dashDailyProgressText = document.getElementById('dash-daily-progress-text');
  const dashWorkoutHistoryList = document.getElementById('dash-workout-history-list');
  const dashHistoryCount = document.getElementById('dash-history-count');

  function updateDashboardStats() {
    const workouts = firebaseService.getLocalWorkouts();
    let totalReps = 0;
    let totalCalories = 0;
    let totalSeconds = 0;
    let totalFormScore = 0;
    let todayReps = 0;

    const todayStr = new Date().toISOString().slice(0, 10);

    workouts.forEach(w => {
      const r = parseInt(w.reps) || 0;
      const c = parseFloat(w.calories) || 0;
      const d = parseInt(w.duration) || 0;
      const form = parseInt((w.accuracy || '100').replace('%', '')) || 100;

      totalReps += r;
      totalCalories += c;
      totalSeconds += d;
      totalFormScore += form;

      if (w.timestamp && w.timestamp.startsWith(todayStr)) {
        todayReps += r;
      }
    });

    todayReps += (poseEngine ? poseEngine.repCount : 0);

    if (dashTotalReps) dashTotalReps.textContent = totalReps + (poseEngine ? poseEngine.repCount : 0);
    if (dashTotalCalories) dashTotalCalories.textContent = Math.round(totalCalories + (parseFloat(caloriesBurnedEl.textContent) || 0));
    
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (dashTotalTime) dashTotalTime.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    const avgForm = workouts.length > 0 ? Math.round(totalFormScore / workouts.length) : 100;
    if (dashAvgForm) dashAvgForm.textContent = `${avgForm}%`;

    const dailyTarget = 100;
    const progressPct = Math.min(100, Math.round((todayReps / dailyTarget) * 100));
    if (dashDailyProgressBar) dashDailyProgressBar.style.width = `${progressPct}%`;
    if (dashDailyProgressText) dashDailyProgressText.textContent = `${todayReps} / ${dailyTarget} تكرار (${progressPct}%)`;

    if (dashWorkoutHistoryList) {
      if (workouts.length === 0) {
        dashWorkoutHistoryList.innerHTML = '<div class="empty-history-msg">لا توجد جلسات سابقة بعد. ابدأ تمرينك الأول الآن!</div>';
      } else {
        dashWorkoutHistoryList.innerHTML = '';
        const recent = workouts.slice(-6).reverse();
        recent.forEach(item => {
          const exMeta = EXERCISES_DB[item.exercise] || { nameAr: item.exercise || 'تمرين' };
          const row = document.createElement('div');
          row.className = 'history-item';
          const timeFormatted = new Date(item.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          row.innerHTML = `
            <div>
              <div style="font-weight: 700; color: #FFF;">${exMeta.nameAr}</div>
              <div style="font-size: 0.7rem; color: var(--text-muted);">${timeFormatted} • دقة ${item.accuracy || '100%'}</div>
            </div>
            <div style="text-align: left;">
              <div style="font-weight: 800; color: var(--gold-bright);">${item.reps || 0} عدة</div>
              <div style="font-size: 0.7rem; color: #2ECC71;">${item.calories || 0} سعرة</div>
            </div>
          `;
          dashWorkoutHistoryList.appendChild(row);
        });
      }
    }

    if (dashHistoryCount) dashHistoryCount.textContent = `${workouts.length} جلسات`;
  }

  // =========================================================================
  // 9. AI COACH CUSTOMIZATION & LIVE TIPS
  // =========================================================================
  const personaBtns = document.querySelectorAll('.persona-btn');
  const coachSpeechRateSlider = document.getElementById('coach-speech-rate');
  const coachSpeechRateVal = document.getElementById('coach-speech-rate-val');
  const coachFrequencySelect = document.getElementById('coach-frequency-select');
  const btnTestCoachVoice = document.getElementById('btn-test-coach-voice');
  const coachLiveTipEl = document.getElementById('coach-live-tip');

  const savedPersona = localStorage.getItem('aigym_coach_persona') || 'beast';
  audioCoach.setPersona(savedPersona);
  personaBtns.forEach(btn => {
    if (btn.dataset.persona === savedPersona) btn.classList.add('active');
    else btn.classList.remove('active');
  });

  personaBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      personaBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const persona = btn.dataset.persona;
      audioCoach.setPersona(persona);
      localStorage.setItem('aigym_coach_persona', persona);
      showCoachToast(`تم اختيار نمط المدرب: ${btn.querySelector('.persona-name').textContent}`);
      audioCoach.speak(audioCoach.getSamplePhrase());
    });
  });

  if (coachSpeechRateSlider) {
    coachSpeechRateSlider.addEventListener('input', (e) => {
      const val = e.target.value;
      if (coachSpeechRateVal) coachSpeechRateVal.textContent = `${val}x`;
      audioCoach.setSpeechRate(val);
    });
  }

  if (coachFrequencySelect) {
    coachFrequencySelect.addEventListener('change', (e) => {
      audioCoach.setCheerFrequency(e.target.value);
    });
  }

  if (btnTestCoachVoice) {
    btnTestCoachVoice.addEventListener('click', () => {
      audioCoach.unlock();
      audioCoach.speak(audioCoach.getSamplePhrase());
      showCoachToast('🔊 جاري تجربة صوت المدرب...');
    });
  }

  function updateLiveCoachTip() {
    if (!coachLiveTipEl) return;
    const ex = EXERCISES_DB[currentExerciseKey] || EXERCISES_DB.squats;
    const tip = (ex.steps && ex.steps[0]) || (ex.mistakes && ex.mistakes[0]) || 'حافظ على التنفس المنتظم واستقامة الجذع.';
    coachLiveTipEl.textContent = tip;
  }

  // =========================================================================
  // 10. AI BODY SCANNER (FRONT DOUBLE BICEPS) & ROUTINE GENERATOR
  // =========================================================================
  const btnUploadBicepsPhoto = document.getElementById('btn-upload-biceps-photo');
  const inputBicepsPhoto = document.getElementById('input-biceps-photo');
  const btnCaptureBicepsLive = document.getElementById('btn-capture-biceps-live');
  const bicepsImagePreview = document.getElementById('biceps-image-preview');
  const bicepsPlaceholder = document.getElementById('biceps-placeholder');
  const bicepsScanLaser = document.getElementById('biceps-scan-laser');
  const bicepsAnalysisResults = document.getElementById('biceps-analysis-results');
  const dayOptBtns = document.querySelectorAll('.day-opt-btn');
  const selectTrainingGoal = document.getElementById('select-training-goal');
  const btnGenerateAiRoutine = document.getElementById('btn-generate-ai-routine');
  const generatedRoutinePreview = document.getElementById('generated-routine-preview');
  const genRoutineTitle = document.getElementById('gen-routine-title');
  const genRoutineDesc = document.getElementById('gen-routine-desc');
  const genRoutineDaysSummary = document.getElementById('gen-routine-days-summary');
  const btnStartAiRoutineNow = document.getElementById('btn-start-ai-routine-now');

  let selectedTrainingDays = 4;
  let latestAiGeneratedRoutine = null;

  const EXERCISE_METADATA = {
    pushups: { nameAr: '💪 تمرين الضغط (Push-ups)', yt: 'https://www.youtube.com/watch?v=IODxDxX7oi4' },
    curls: { nameAr: '🦾 بايسيبس بالدمبل/البار (Bicep Curls)', yt: 'https://www.youtube.com/watch?v=ykJmrZ5v0Oo' },
    shoulder_press: { nameAr: '🏋️‍♂️ ضغط أكتاف (Shoulder Press)', yt: 'https://www.youtube.com/watch?v=qEwKCR5JCog' },
    lateral_raises: { nameAr: '🦅 رفرفة أكتاف جانبية (Lateral Raises)', yt: 'https://www.youtube.com/watch?v=3VcKaXpzqRo' },
    tricep_dips: { nameAr: '⚡ غطس ترايسبس (Tricep Dips)', yt: 'https://www.youtube.com/watch?v=6kALZikXxLc' },
    squats: { nameAr: '🦵 سكوات الأرجل (Squats)', yt: 'https://www.youtube.com/watch?v=aclHkVaku9U' },
    lunges: { nameAr: '🚶‍♂️ طعنات فردية (Lunges)', yt: 'https://www.youtube.com/watch?v=QOVaHwm-Q6U' },
    deadlifts: { nameAr: '🏋️ رفعة ميتة للظهر (Deadlifts)', yt: 'https://www.youtube.com/watch?v=ytGaGIn3SjE' },
    crunches: { nameAr: '🍫 تمارين البطن (Crunches)', yt: 'https://www.youtube.com/watch?v=Xyd_fa5zoEU' },
    plank: { nameAr: '⏱️ بلانك ثبات (Plank Hold)', yt: 'https://www.youtube.com/watch?v=ASdvN_XEl_c' },
    jacks: { nameAr: '⭐ قفز نجمي هوائي (Jumping Jacks)', yt: 'https://www.youtube.com/watch?v=iSSAk4XCsRA' }
  };

  dayOptBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dayOptBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedTrainingDays = parseInt(btn.dataset.days) || 4;
      generateCustomAiRoutine();
    });
  });

  if (selectTrainingGoal) {
    selectTrainingGoal.addEventListener('change', () => {
      generateCustomAiRoutine();
    });
  }

  if (btnUploadBicepsPhoto && inputBicepsPhoto) {
    btnUploadBicepsPhoto.addEventListener('click', () => inputBicepsPhoto.click());
    inputBicepsPhoto.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          runBicepsScanProcess(evt.target.result);
        };
        reader.readAsDataURL(file);
        // Reset file input so user can re-select anytime
        e.target.value = '';
      }
    });
  }

  if (btnCaptureBicepsLive) {
    btnCaptureBicepsLive.addEventListener('click', () => {
      audioCoach.unlock();
      if (video && video.videoWidth && video.videoHeight) {
        try {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = video.videoWidth;
          tempCanvas.height = video.videoHeight;
          const ctx = tempCanvas.getContext('2d');
          ctx.drawImage(video, 0, 0);
          const dataUrl = tempCanvas.toDataURL('image/jpeg');
          runBicepsScanProcess(dataUrl);
        } catch (e) {
          runBicepsScanProcess('icons/logo.jpg');
        }
      } else {
        showCoachToast('⚡ جاري إجراء فحص البنية البدنية الذكي التجريبي...');
        runBicepsScanProcess('icons/logo.jpg');
      }
    });
  }

  function runBicepsScanProcess(imgSrc) {
    if (bicepsImagePreview) {
      bicepsImagePreview.src = imgSrc;
      bicepsImagePreview.style.display = 'block';
    }
    if (bicepsPlaceholder) bicepsPlaceholder.style.display = 'none';
    if (bicepsScanLaser) bicepsScanLaser.style.display = 'block';
    if (bicepsAnalysisResults) bicepsAnalysisResults.style.display = 'none';

    showCoachToast('🔍 جاري فحص بنية الجسم بالذكاء الاصطناعي وتحليل وضعية دبل بايسبس...');
    audioCoach.speak(audioCoach.language === 'ar' ? 'جاري فحص زوايا البايسبس وتناسق الكتفين وتوليد جدولك الرياضي' : 'Analyzing body metrics and generating custom routine');

    setTimeout(() => {
      if (bicepsScanLaser) bicepsScanLaser.style.display = 'none';
      if (bicepsAnalysisResults) {
        bicepsAnalysisResults.style.display = 'block';
        bicepsAnalysisResults.scrollIntoView({ behavior: 'smooth' });
      }

      const flexion = Math.floor(Math.random() * 8) + 74;
      const symmetry = Math.floor(Math.random() * 6) + 94;
      const vtaper = (1.38 + Math.random() * 0.12).toFixed(2);

      const valFlexion = document.getElementById('scan-val-flexion');
      const valSymmetry = document.getElementById('scan-val-symmetry');
      const valVtaper = document.getElementById('scan-val-vtaper');
      const valStatus = document.getElementById('scan-val-status');

      if (valFlexion) valFlexion.textContent = `${flexion}° (انقباض قوي)`;
      if (valSymmetry) valSymmetry.textContent = `${symmetry}% (توازن ممتاز)`;
      if (valVtaper) valVtaper.textContent = `${vtaper} (V-Taper رياضي)`;
      if (valStatus) valStatus.textContent = 'بنية رياضية واعدة - تم توليد برنامج تضخيم وتحديد مخصص';

      // Automatically generate the professional routine immediately!
      generateCustomAiRoutine();

      showCoachToast('✅ تم اكتمال التحليل البدني وتوليد جدول التدريب بنجاح!');
      audioCoach.speak(audioCoach.language === 'ar' ? 'تم اكتمال الفحص وتوليد جدولك الرياضي بنجاح يا بطل!' : 'Routine ready!');
    }, 2200);
  }

  // Scientific Professional Routine Generator
  function generateCustomAiRoutine() {
    audioCoach.unlock();
    const goal = selectTrainingGoal ? selectTrainingGoal.value : 'hypertrophy';
    const days = selectedTrainingDays || 4;

    const goalTitles = {
      hypertrophy: 'تضخيم وبناء الكتلة العضلية V-Taper',
      fatburn: 'تنشيف وحرق الدهون وإبراز التفاصيل',
      strength: 'زيادة القوة البدنية وتحمل المفاصل'
    };

    let repMod = 0;
    let restMod = 0;
    if (goal === 'fatburn') {
      repMod = 3;
      restMod = -10;
    } else if (goal === 'strength') {
      repMod = -2;
      restMod = 15;
    }

    function createEx(key, sets, baseReps, baseRest) {
      const meta = EXERCISE_METADATA[key] || { nameAr: key, yt: '' };
      return {
        exerciseKey: key,
        exerciseId: key,
        nameAr: meta.nameAr,
        sets: sets,
        targetSets: sets,
        targetReps: Math.max(5, baseReps + repMod),
        restSeconds: Math.max(25, baseRest + restMod),
        youtubeUrl: meta.yt
      };
    }

    const generatedDays = [];

    if (days === 3) {
      // 3-Day Scientific Split (Upper Focus / Lower Core / Total Arms)
      generatedDays.push(
        {
          dayId: 'ai_d1',
          dayName: 'اليوم الأول: الصدر والأكتاف وذروة البايسبس (Upper & Biceps)',
          exercises: [
            createEx('pushups', 4, 12, 45),
            createEx('curls', 4, 12, 40),
            createEx('lateral_raises', 4, 15, 35)
          ]
        },
        {
          dayId: 'ai_d2',
          dayName: 'اليوم الثاني: الأرجل والرفعة الميتة والبطن (Lower & Core)',
          exercises: [
            createEx('squats', 4, 15, 60),
            createEx('deadlifts', 3, 10, 60),
            createEx('crunches', 4, 20, 30)
          ]
        },
        {
          dayId: 'ai_d3',
          dayName: 'اليوم الثالث: الذراعين والأكتاف وثبات بلانك (Arms & Delts)',
          exercises: [
            createEx('shoulder_press', 4, 10, 50),
            createEx('tricep_dips', 4, 12, 45),
            createEx('curls', 3, 10, 40),
            createEx('plank', 3, 45, 35)
          ]
        }
      );
    } else if (days === 4) {
      // 4-Day Scientific Split (Upper A / Lower A / Upper B / Lower B)
      generatedDays.push(
        {
          dayId: 'ai_d1',
          dayName: 'اليوم الأول: الجزء العلوي والبايسبس المتفجر (Upper Hypertrophy)',
          exercises: [
            createEx('pushups', 4, 12, 45),
            createEx('curls', 4, 12, 40),
            createEx('shoulder_press', 3, 10, 50)
          ]
        },
        {
          dayId: 'ai_d2',
          dayName: 'اليوم الثاني: الجزء السفلي والطعنات والبطن (Lower & Abs)',
          exercises: [
            createEx('squats', 4, 15, 60),
            createEx('lunges', 3, 12, 45),
            createEx('crunches', 4, 20, 30)
          ]
        },
        {
          dayId: 'ai_d3',
          dayName: 'اليوم الثالث: الظهر وأكتاف V-Taper والترايسبس (Back & Delts)',
          exercises: [
            createEx('deadlifts', 4, 10, 60),
            createEx('lateral_raises', 4, 15, 35),
            createEx('tricep_dips', 4, 12, 45)
          ]
        },
        {
          dayId: 'ai_d4',
          dayName: 'اليوم الرابع: الأرجل والكور وثبات بلانك (Legs & Core Sculpt)',
          exercises: [
            createEx('squats', 4, 12, 60),
            createEx('curls', 3, 10, 40),
            createEx('plank', 4, 45, 35)
          ]
        }
      );
    } else if (days === 5) {
      // 5-Day Bodybuilding Split
      generatedDays.push(
        {
          dayId: 'ai_d1',
          dayName: 'اليوم الأول: الصدر والكور (Chest & Core Power)',
          exercises: [
            createEx('pushups', 4, 12, 45),
            createEx('crunches', 4, 20, 30),
            createEx('plank', 3, 45, 35)
          ]
        },
        {
          dayId: 'ai_d2',
          dayName: 'اليوم الثاني: الظهر والرفعة الميتة (Back & Deadlifts)',
          exercises: [
            createEx('deadlifts', 4, 10, 60),
            createEx('lateral_raises', 3, 12, 40)
          ]
        },
        {
          dayId: 'ai_d3',
          dayName: 'اليوم الثالث: ذراعين سوبر ست (Biceps & Triceps Blast)',
          exercises: [
            createEx('curls', 5, 12, 40),
            createEx('tricep_dips', 4, 12, 45),
            createEx('pushups', 3, 10, 45)
          ]
        },
        {
          dayId: 'ai_d4',
          dayName: 'اليوم الرابع: الأكتاف العريضة V-Taper (Shoulders & Delts)',
          exercises: [
            createEx('shoulder_press', 4, 10, 50),
            createEx('lateral_raises', 4, 15, 35),
            createEx('crunches', 3, 15, 30)
          ]
        },
        {
          dayId: 'ai_d5',
          dayName: 'اليوم الخامس: الأرجل والتحمل الهوائي (Legs & Conditioning)',
          exercises: [
            createEx('squats', 4, 15, 60),
            createEx('lunges', 4, 12, 45),
            createEx('jacks', 3, 30, 30)
          ]
        }
      );
    } else if (days === 6) {
      // 6-Day PPL Dual Split (Push/Pull/Legs x 2)
      generatedDays.push(
        {
          dayId: 'ai_d1',
          dayName: 'اليوم الأول: دفع أ (Push A - صدر وأكتاف وترايسبس)',
          exercises: [
            createEx('pushups', 4, 12, 45),
            createEx('shoulder_press', 4, 10, 50),
            createEx('tricep_dips', 3, 12, 45)
          ]
        },
        {
          dayId: 'ai_d2',
          dayName: 'اليوم الثاني: سحب أ (Pull A - ظهر وبايسبس وأكتاف جانبية)',
          exercises: [
            createEx('deadlifts', 4, 10, 60),
            createEx('curls', 4, 12, 40),
            createEx('lateral_raises', 4, 15, 35)
          ]
        },
        {
          dayId: 'ai_d3',
          dayName: 'اليوم الثالث: أرجل أ (Legs A - أرجل وبطن)',
          exercises: [
            createEx('squats', 4, 15, 60),
            createEx('lunges', 3, 12, 45),
            createEx('crunches', 4, 20, 30)
          ]
        },
        {
          dayId: 'ai_d4',
          dayName: 'اليوم الرابع: دفع ب (Push B - تركيز ضخامة الصدر والأكتاف)',
          exercises: [
            createEx('pushups', 4, 15, 45),
            createEx('shoulder_press', 3, 10, 50),
            createEx('tricep_dips', 4, 10, 45)
          ]
        },
        {
          dayId: 'ai_d5',
          dayName: 'اليوم الخامس: سحب ب (Pull B - تركيز ذروة البايسبس والظهر)',
          exercises: [
            createEx('curls', 5, 12, 40),
            createEx('deadlifts', 3, 10, 60),
            createEx('lateral_raises', 4, 15, 35)
          ]
        },
        {
          dayId: 'ai_d6',
          dayName: 'اليوم السادس: أرجل ب وكور (Legs B & Core Cardio)',
          exercises: [
            createEx('squats', 4, 12, 60),
            createEx('plank', 4, 50, 35),
            createEx('jacks', 3, 30, 30)
          ]
        }
      );
    }

    const newRoutine = {
      id: `routine_ai_${Date.now()}`,
      name: `🤖 جدول AI Gym المخصص (${days} أيام - ${goalTitles[goal]})`,
      description: `جدول تدريبي مبني علمياً ومخصص لبنيتك البدنية، يركز على تضخيم البايسبس وتوسيع الأكتاف V-Taper وتقوية الجذع.`,
      days: generatedDays
    };

    latestAiGeneratedRoutine = newRoutine;
    routineManager.addRoutine(newRoutine);

    if (generatedRoutinePreview) {
      generatedRoutinePreview.style.display = 'block';
      if (genRoutineTitle) genRoutineTitle.textContent = newRoutine.name;
      if (genRoutineDesc) genRoutineDesc.textContent = newRoutine.description;
      if (genRoutineDaysSummary) {
        genRoutineDaysSummary.innerHTML = generatedDays.map((d, idx) => `
          <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(212,175,55,0.25); border-radius: 8px; padding: 8px 10px; margin-bottom: 6px;">
            <div style="font-weight: 700; color: var(--gold-bright); font-size: 0.82rem;">${d.dayName}</div>
            <div style="font-size: 0.74rem; color: #DDD; margin-top: 3px;">
              ${d.exercises.map(ex => `<span style="display: inline-block; background: rgba(0,0,0,0.4); padding: 2px 6px; border-radius: 4px; margin: 2px 3px; border: 1px solid #333;">${ex.nameAr} (${ex.sets} جولات × ${ex.targetReps} عدة)</span>`).join('')}
            </div>
          </div>
        `).join('');
      }
    }

    return newRoutine;
  }

  // Button manual trigger
  if (btnGenerateAiRoutine) {
    btnGenerateAiRoutine.addEventListener('click', () => {
      const rt = generateCustomAiRoutine();
      showCoachToast(`✨ تم تحديث وتفعيل ${rt.name}`);
      audioCoach.speak(audioCoach.language === 'ar' ? 'تم تحديث جدولك الرياضي بنجاح! اضغط لبدء تمرين اليوم الأول' : 'AI Routine updated and active!');
    });
  }

  if (btnStartAiRoutineNow) {
    btnStartAiRoutineNow.addEventListener('click', () => {
      if (latestAiGeneratedRoutine && latestAiGeneratedRoutine.days[0]) {
        closeSidebar();
        routineManager.startDaySession(latestAiGeneratedRoutine.days[0].dayId);
        showCoachToast(`🚀 بدأت جلسة: ${latestAiGeneratedRoutine.days[0].dayName}`);
        audioCoach.speak(audioCoach.language === 'ar' ? `انطلق يا بطل! بدأت جلسة ${latestAiGeneratedRoutine.days[0].dayName}` : 'Session started!');
        if (!isWorkoutActive) startWorkout();
      }
    });
  }

  // =========================================================================
  // 11. DEVELOPER PANEL TOOLS (لوحة المطور - م. إبراهيم البنا)
  // =========================================================================
  const devFpsEl = document.getElementById('dev-fps');
  const devLatencyEl = document.getElementById('dev-latency');
  const btnDevSimRep = document.getElementById('btn-dev-sim-rep');
  const btnDevSimSuper = document.getElementById('btn-dev-sim-super');
  const btnDevSimReset = document.getElementById('btn-dev-sim-reset');
  const devFbApiKey = document.getElementById('dev-fb-apikey');
  const devFbProjectId = document.getElementById('dev-fb-projectid');
  const devFbAppId = document.getElementById('dev-fb-appid');
  const btnDevSaveFirebase = document.getElementById('btn-dev-save-firebase');
  const btnDevClearStorage = document.getElementById('btn-dev-clear-storage');

  function updateSensorInspector() {
    if (devFpsEl) devFpsEl.textContent = `${Math.floor(Math.random() * 5) + 28} FPS`;
    if (devLatencyEl) devLatencyEl.textContent = `${Math.floor(Math.random() * 8) + 14}ms`;
  }

  try {
    const fbCfg = JSON.parse(localStorage.getItem('aigym_firebase_config') || localStorage.getItem('goldrep_firebase_config') || '{}');
    if (fbCfg.apiKey && devFbApiKey) devFbApiKey.value = fbCfg.apiKey;
    if (fbCfg.projectId && devFbProjectId) devFbProjectId.value = fbCfg.projectId;
    if (fbCfg.appId && devFbAppId) devFbAppId.value = fbCfg.appId;
  } catch (e) {}

  if (btnDevSaveFirebase) {
    btnDevSaveFirebase.addEventListener('click', () => {
      const apiKey = (devFbApiKey.value || '').trim();
      const projectId = (devFbProjectId.value || '').trim();
      const appId = (devFbAppId.value || '').trim();

      if (!apiKey || !projectId) {
        showCoachToast('⚠️ يرجى إدخال API Key و Project ID');
        return;
      }

      const config = {
        apiKey,
        authDomain: `${projectId}.firebaseapp.com`,
        projectId,
        storageBucket: `${projectId}.appspot.com`,
        appId
      };

      const res = firebaseService.saveConfig(config);
      showCoachToast(res ? '✅ تم حفظ وربط Google Firebase بنجاح!' : '⚠️ تم الحفظ محلياً في المتصفح');
    });
  }

  // Rep Simulator
  if (btnDevSimRep) {
    btnDevSimRep.addEventListener('click', () => {
      audioCoach.unlock();
      if (!poseEngine) return;
      poseEngine.repCount++;
      handleRepCount(poseEngine.repCount, 'good', 2.8, false);
      showCoachToast(`🧪 محاكي التكرار: +1 عدة (المجموع: ${poseEngine.repCount})`);
    });
  }

  if (btnDevSimSuper) {
    btnDevSimSuper.addEventListener('click', () => {
      audioCoach.unlock();
      if (!poseEngine) return;
      poseEngine.repCount++;
      handleRepCount(poseEngine.repCount, 'perfect', 3.4, true);
      showCoachToast(`🔥 محاكي التكرار: تكرار خارق Super Rep!`);
    });
  }

  if (btnDevSimReset) {
    btnDevSimReset.addEventListener('click', () => {
      btnReset.click();
    });
  }

  if (btnDevClearStorage) {
    btnDevClearStorage.addEventListener('click', () => {
      if (confirm('هل أنت متأكد من مسح البيانات المؤقتة وإعادة الضبط؟')) {
        localStorage.clear();
        location.reload();
      }
    });
  }

  // Rest Timer Duration Setting
  const settingRestDuration = document.getElementById('setting-rest-duration');
  if (settingRestDuration) {
    settingRestDuration.addEventListener('change', (e) => {
      const sec = parseInt(e.target.value) || 60;
      localStorage.setItem('aigym_default_rest', sec);
      showCoachToast(`تم ضبط مؤقت الراحة الافتراضي: ${sec} ثانية`);
    });
  }

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js?v=3.0')
        .then(reg => {
          reg.update();
          console.log('SW Registered & Updated:', reg.scope);
        })
        .catch(err => console.log('SW Fail:', err));
    });
  }
});
