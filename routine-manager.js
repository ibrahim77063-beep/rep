// routine-manager.js - إدارة الجداول التدريبية متعددة الأيام ومقاطع يوتيوب
class RoutineManager {
  constructor() {
    this.routines = [];
    this.activeRoutineId = 'routine_starter_3day';
    this.activeRoutine = null;
    this.activeDayIndex = 0;
    this.activeItemIndex = 0;
    this.currentSet = 1;
    this.isSessionActive = false;

    // Callbacks
    this.onRestTriggered = () => {};
    this.onExerciseChange = () => {};
    this.onRoutineCompleted = () => {};

    this.loadRoutines();
    this.activeRoutine = this.routines.find(r => r.id === this.activeRoutineId) || this.routines[0];
  }

  loadRoutines() {
    try {
      const saved = JSON.parse(localStorage.getItem('goldrep_routines') || '[]');
      if (saved && saved.length > 0) {
        this.routines = saved.map(r => {
          if (r.days) {
            r.days.forEach(d => {
              d.exercises = d.exercises || d.items || [];
              d.items = d.exercises;
              d.exercises.forEach(ex => {
                ex.exerciseKey = ex.exerciseKey || ex.exerciseId || 'squats';
                ex.exerciseId = ex.exerciseKey;
                ex.sets = ex.sets || ex.targetSets || 3;
                ex.targetSets = ex.sets;
                ex.targetReps = ex.targetReps || 10;
                ex.restSeconds = ex.restSeconds || 45;
              });
            });
          }
          r.name = r.name || r.title || 'روتين تدريبي';
          r.title = r.name;
          return r;
        });
      } else {
        // Default Starter 3-Day Professional Routine with YouTube tutorials
        const starterRoutine = {
          id: 'routine_starter_3day',
          name: '🔥 جدول الـ 3 أيام للمبتدئين والمحترفين',
          title: '🔥 جدول الـ 3 أيام للمبتدئين والمحترفين',
          days: [
            {
              dayId: 'day_1',
              dayName: 'اليوم الأول: الأرجل والسكوات',
              exercises: [
                {
                  exerciseKey: 'squats',
                  exerciseId: 'squats',
                  nameAr: '🦵 سكوات (Squats)',
                  sets: 3,
                  targetSets: 3,
                  targetReps: 12,
                  restSeconds: 45,
                  youtubeUrl: 'https://www.youtube.com/watch?v=aclHkVaku9U'
                },
                {
                  exerciseKey: 'lunges',
                  exerciseId: 'lunges',
                  nameAr: '🚶‍♂️ طعنات (Lunges)',
                  sets: 3,
                  targetSets: 3,
                  targetReps: 10,
                  restSeconds: 40,
                  youtubeUrl: 'https://www.youtube.com/watch?v=QOVaHwm-Q6U'
                },
                {
                  exerciseKey: 'deadlifts',
                  exerciseId: 'deadlifts',
                  nameAr: '🏋️ رفعة ميتة (Deadlifts)',
                  sets: 3,
                  targetSets: 3,
                  targetReps: 10,
                  restSeconds: 60,
                  youtubeUrl: 'https://www.youtube.com/watch?v=ytGaGIn3SjE'
                }
              ]
            },
            {
              dayId: 'day_2',
              dayName: 'اليوم الثاني: صدر وذراعين',
              exercises: [
                {
                  exerciseKey: 'pushups',
                  exerciseId: 'pushups',
                  nameAr: '💪 تمرين الضغط (Push-ups)',
                  sets: 3,
                  targetSets: 3,
                  targetReps: 12,
                  restSeconds: 45,
                  youtubeUrl: 'https://www.youtube.com/watch?v=IODxDxX7oi4'
                },
                {
                  exerciseKey: 'curls',
                  exerciseId: 'curls',
                  nameAr: '🦾 بايسبس (Bicep Curls)',
                  sets: 3,
                  targetSets: 3,
                  targetReps: 12,
                  restSeconds: 30,
                  youtubeUrl: 'https://www.youtube.com/watch?v=ykJmrZ5v0Oo'
                },
                {
                  exerciseKey: 'shoulder_press',
                  exerciseId: 'shoulder_press',
                  nameAr: '🏋️‍♂️ ضغط أكتاف (Shoulder Press)',
                  sets: 3,
                  targetSets: 3,
                  targetReps: 10,
                  restSeconds: 45,
                  youtubeUrl: 'https://www.youtube.com/watch?v=qEwKCR5JCog'
                }
              ]
            },
            {
              dayId: 'day_3',
              dayName: 'اليوم الثالث: البطن والكارديو',
              exercises: [
                {
                  exerciseKey: 'crunches',
                  exerciseId: 'crunches',
                  nameAr: '🍫 تمارين المعدة (Crunches)',
                  sets: 3,
                  targetSets: 3,
                  targetReps: 15,
                  restSeconds: 30,
                  youtubeUrl: 'https://www.youtube.com/watch?v=Xyd_fa5zoEU'
                },
                {
                  exerciseKey: 'plank',
                  exerciseId: 'plank',
                  nameAr: '⏱️ بلانك ثبات (Plank Hold)',
                  sets: 3,
                  targetSets: 3,
                  targetReps: 30,
                  restSeconds: 45,
                  youtubeUrl: 'https://www.youtube.com/watch?v=ASdvN_XEl_c'
                },
                {
                  exerciseKey: 'jacks',
                  exerciseId: 'jacks',
                  nameAr: '⭐ قفز نجمي (Jumping Jacks)',
                  sets: 3,
                  targetSets: 3,
                  targetReps: 25,
                  restSeconds: 30,
                  youtubeUrl: 'https://www.youtube.com/watch?v=iSSAk4XCsRA'
                }
              ]
            }
          ]
        };

        // Mirror items for backwards-compatibility
        starterRoutine.days.forEach(d => { d.items = d.exercises; });
        this.routines = [starterRoutine];
        this.saveRoutines();
      }
    } catch (e) {
      console.warn('Routines load error:', e);
    }
  }

  saveRoutines() {
    try {
      localStorage.setItem('goldrep_routines', JSON.stringify(this.routines));
    } catch (e) {}
  }

  getAllRoutines() {
    return this.routines;
  }

  getActiveRoutine() {
    return this.activeRoutine || this.routines[0];
  }

  selectRoutine(id) {
    this.activeRoutineId = id;
    this.activeRoutine = this.routines.find(r => r.id === id) || this.routines[0];
    this.activeDayIndex = 0;
    this.activeItemIndex = 0;
    this.currentSet = 1;
    return this.activeRoutine;
  }

  startDaySession(dayIdOrIndex) {
    const routine = this.getActiveRoutine();
    if (!routine) return null;

    let dayIdx = 0;
    if (typeof dayIdOrIndex === 'number') {
      dayIdx = dayIdOrIndex;
    } else {
      const idx = routine.days.findIndex(d => d.dayId === dayIdOrIndex);
      dayIdx = idx >= 0 ? idx : 0;
    }

    this.activeDayIndex = dayIdx;
    this.activeItemIndex = 0;
    this.currentSet = 1;
    this.isSessionActive = true;

    const currentEx = this.getCurrentExercise();
    if (currentEx) {
      this.onExerciseChange({
        exerciseKey: currentEx.exerciseKey || currentEx.exerciseId,
        setNumber: this.currentSet,
        totalSets: currentEx.sets || currentEx.targetSets,
        targetReps: currentEx.targetReps
      });
    }
    return currentEx;
  }

  getCurrentExercise() {
    const routine = this.getActiveRoutine();
    if (!routine) return null;
    const day = routine.days[this.activeDayIndex];
    if (!day) return null;
    const ex = (day.exercises || day.items)[this.activeItemIndex];
    return ex || null;
  }

  // Hook called on every completed repetition
  onRepDone(count) {
    if (!this.isSessionActive) return;
    const currentEx = this.getCurrentExercise();
    if (!currentEx) return;

    if (count >= currentEx.targetReps) {
      this.completeCurrentSet();
    }
  }

  completeCurrentSet() {
    if (!this.isSessionActive) return;
    const currentEx = this.getCurrentExercise();
    if (!currentEx) return;

    const totalSets = currentEx.sets || currentEx.targetSets || 3;
    const routine = this.getActiveRoutine();
    const day = routine.days[this.activeDayIndex];
    const exercisesList = day.exercises || day.items;

    if (this.currentSet < totalSets) {
      // Advance to next set of same exercise
      this.currentSet++;
      this.onRestTriggered({
        restSeconds: currentEx.restSeconds || 45,
        nextExercise: currentEx.exerciseKey || currentEx.exerciseId,
        nextSet: this.currentSet,
        totalSets
      });
      this.onExerciseChange({
        exerciseKey: currentEx.exerciseKey || currentEx.exerciseId,
        setNumber: this.currentSet,
        totalSets,
        targetReps: currentEx.targetReps
      });
    } else {
      // Completed all sets for this exercise, move to next exercise
      if (this.activeItemIndex + 1 < exercisesList.length) {
        this.activeItemIndex++;
        this.currentSet = 1;
        const nextEx = exercisesList[this.activeItemIndex];
        const nextTotalSets = nextEx.sets || nextEx.targetSets || 3;

        this.onRestTriggered({
          restSeconds: currentEx.restSeconds || 60,
          nextExercise: nextEx.exerciseKey || nextEx.exerciseId,
          nextSet: 1,
          totalSets: nextTotalSets
        });
        this.onExerciseChange({
          exerciseKey: nextEx.exerciseKey || nextEx.exerciseId,
          setNumber: 1,
          totalSets: nextTotalSets,
          targetReps: nextEx.targetReps
        });
      } else {
        // Entire Day routine completed!
        this.isSessionActive = false;
        this.onRoutineCompleted({
          routineName: routine.name || routine.title,
          dayName: day.dayName,
          totalSets: exercisesList.reduce((acc, x) => acc + (x.sets || x.targetSets || 3), 0)
        });
      }
    }
  }

  stopRoutine() {
    this.isSessionActive = false;
    this.activeDayIndex = 0;
    this.activeItemIndex = 0;
    this.currentSet = 1;
  }

  // Helper to extract clean YouTube video ID from URL
  static extractYouTubeId(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }
}

window.RoutineManager = RoutineManager;
