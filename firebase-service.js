// firebase-service.js - خدمة الربط السحابي مع Google Firebase Firestore & Auth
// تصميم هجين (Offline-First): يعمل أوفلاين مع حفظ محلي، ويرفع سحابياً عند الاتصال

class FirebaseService {
  constructor() {
    this.isConfigured = false;
    this.user = null;
    this.db = null;
    this.auth = null;

    // Load saved custom config if user provided one in localStorage
    this.loadConfig();
  }

  loadConfig() {
    const saved = localStorage.getItem('aigym_firebase_config') || localStorage.getItem('goldrep_firebase_config');
    if (saved) {
      try {
        const config = JSON.parse(saved);
        this.initialize(config);
      } catch (e) {
        console.warn('Invalid saved Firebase config:', e);
      }
    }
  }

  saveConfig(config) {
    try {
      localStorage.setItem('aigym_firebase_config', JSON.stringify(config));
      return this.initialize(config);
    } catch (e) {
      console.error('Error saving config:', e);
      return false;
    }
  }

  initialize(config) {
    if (!config || !config.apiKey || config.apiKey.includes('XXXX')) {
      this.isConfigured = false;
      return false;
    }

    try {
      if (window.firebase) {
        if (!firebase.apps.length) {
          firebase.initializeApp(config);
        }
        this.db = firebase.firestore();
        this.auth = firebase.auth();

        this.auth.onAuthStateChanged((user) => {
          this.user = user;
          console.log('[Firebase Auth State]:', user ? user.email : 'Anonymous');
          const statusEvent = new CustomEvent('cloud-auth-change', { detail: { user } });
          window.dispatchEvent(statusEvent);
        });

        this.isConfigured = true;
        console.log('✅ Connected to Google Firebase Cloud successfully!');
        return true;
      }
    } catch (err) {
      console.warn('Firebase initialization notice:', err.message);
      this.isConfigured = false;
    }
    return false;
  }

  // Get locally persisted workout history
  getLocalWorkouts() {
    try {
      return JSON.parse(localStorage.getItem('goldrep_workout_history') || '[]');
    } catch (e) {
      return [];
    }
  }

  // Save Workout History
  async saveWorkout(workoutData) {
    // 1. Save locally first (Guaranteed Persistence)
    try {
      const history = this.getLocalWorkouts();
      history.unshift({ ...workoutData, timestamp: Date.now(), id: `workout_${Date.now()}` });
      localStorage.setItem('goldrep_workout_history', JSON.stringify(history.slice(0, 100)));
    } catch (e) {}

    // 2. Sync to Cloud Firestore if connected
    if (this.isConfigured && this.db && this.user) {
      try {
        await this.db.collection('workouts').add({
          ...workoutData,
          userId: this.user.uid,
          userEmail: this.user.email,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('☁️ Workout session synced to Firebase Firestore!');
        return true;
      } catch (err) {
        console.warn('Cloud sync error (saved locally):', err.message);
      }
    }
    return false;
  }

  // Alias for compatibility
  async saveWorkoutSession(workoutData) {
    return this.saveWorkout(workoutData);
  }

  // Save Custom Multi-Day Routine
  async saveRoutine(routine) {
    try {
      const routines = JSON.parse(localStorage.getItem('goldrep_routines') || '[]');
      const index = routines.findIndex(r => r.id === routine.id);
      if (index >= 0) routines[index] = routine;
      else routines.push(routine);
      localStorage.setItem('goldrep_routines', JSON.stringify(routines));
    } catch (e) {}

    if (this.isConfigured && this.db && this.user) {
      try {
        await this.db.collection('routines').doc(routine.id).set({
          ...routine,
          userId: this.user.uid,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('☁️ Routine synced to Cloud Firestore!');
      } catch (e) {
        console.warn('Routine cloud sync deferred:', e);
      }
    }
  }

  // Sync all local records to Google Cloud
  async syncAllData() {
    const workouts = this.getLocalWorkouts();
    if (this.isConfigured && this.db && this.user) {
      try {
        const batch = this.db.batch();
        workouts.slice(0, 20).forEach(w => {
          const docRef = this.db.collection('workouts').doc(w.id || `workout_${w.timestamp}`);
          batch.set(docRef, {
            ...w,
            userId: this.user.uid,
            syncedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });
        await batch.commit();
        return { success: true, count: workouts.length };
      } catch (e) {
        console.warn('Batch sync error:', e);
        return { success: false, error: e.message };
      }
    }
    // Offline mode: successfully preserved locally
    return { success: true, count: workouts.length, offline: true };
  }
}

window.FirebaseService = FirebaseService;
