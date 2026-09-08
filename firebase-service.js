// firebase-service.js - خدمة الربط السحابي مع Google Firebase Firestore & Auth
// يدعم تسجيل الدخول عبر Google والإيميل، مع نظام صلاحيات متقدم (Admin vs User)

class FirebaseService {
  constructor() {
    this.isConfigured = false;
    this.user = null;
    this.db = null;
    this.auth = null;
    this.role = localStorage.getItem('aigym_user_role') || 'user'; // 'user' | 'admin' | 'guest'

    // Load saved custom config if user provided one in localStorage
    this.loadConfig();

    // Check if there is an active local session
    const savedUser = localStorage.getItem('aigym_current_user');
    if (savedUser) {
      try {
        this.user = JSON.parse(savedUser);
        this.role = this.user.role || this.role;
      } catch (e) {}
    }
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
          if (user) {
            const isAdmin = this.checkIfAdminEmail(user.email);
            this.user = {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || user.email.split('@')[0],
              photoURL: user.photoURL || null,
              role: isAdmin ? 'admin' : (this.role || 'user')
            };
            this.role = this.user.role;
            localStorage.setItem('aigym_current_user', JSON.stringify(this.user));
            localStorage.setItem('aigym_user_role', this.role);
          } else if (!this.user) {
            this.user = null;
            this.role = 'guest';
          }
          console.log('[Firebase Auth State]:', this.user ? `${this.user.email} (${this.role})` : 'Signed Out');
          window.dispatchEvent(new CustomEvent('cloud-auth-change', { detail: { user: this.user, role: this.role } }));
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

  checkIfAdminEmail(email) {
    if (!email) return false;
    const em = email.toLowerCase();
    return em.includes('admin') || em.includes('ibrahim') || em === 'eng.ibrahim@aigym.com';
  }

  // --- GOOGLE SIGN IN ---
  async signInWithGoogle() {
    if (this.isConfigured && this.auth && window.firebase) {
      try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const res = await this.auth.signInWithPopup(provider);
        const isAdmin = this.checkIfAdminEmail(res.user.email);
        this.user = {
          uid: res.user.uid,
          email: res.user.email,
          displayName: res.user.displayName || 'بطل اللياقة',
          photoURL: res.user.photoURL,
          role: isAdmin ? 'admin' : 'user'
        };
        this.role = this.user.role;
        localStorage.setItem('aigym_current_user', JSON.stringify(this.user));
        localStorage.setItem('aigym_user_role', this.role);
        window.dispatchEvent(new CustomEvent('cloud-auth-change', { detail: { user: this.user, role: this.role } }));
        return { success: true, user: this.user };
      } catch (err) {
        console.warn('Google popup error, falling back to simulated Google sign-in:', err);
      }
    }

    // Local / Offline demo Google sign-in
    const mockUser = {
      uid: `google_user_${Date.now()}`,
      email: 'athlete.google@gmail.com',
      displayName: 'متدرب Google الذكي',
      photoURL: null,
      role: 'user'
    };
    this.user = mockUser;
    this.role = 'user';
    localStorage.setItem('aigym_current_user', JSON.stringify(this.user));
    localStorage.setItem('aigym_user_role', this.role);
    window.dispatchEvent(new CustomEvent('cloud-auth-change', { detail: { user: this.user, role: this.role } }));
    return { success: true, user: this.user, simulated: true };
  }

  // --- EMAIL SIGN IN ---
  async signInWithEmail(email, password) {
    email = (email || '').trim();
    if (!email || !password) {
      throw new Error('يرجى كتابة البريد الإلكتروني وكلمة المرور');
    }

    if (this.isConfigured && this.auth && window.firebase) {
      try {
        const res = await this.auth.signInWithEmailAndPassword(email, password);
        const isAdmin = this.checkIfAdminEmail(res.user.email);
        this.user = {
          uid: res.user.uid,
          email: res.user.email,
          displayName: res.user.displayName || email.split('@')[0],
          photoURL: null,
          role: isAdmin ? 'admin' : 'user'
        };
        this.role = this.user.role;
        localStorage.setItem('aigym_current_user', JSON.stringify(this.user));
        localStorage.setItem('aigym_user_role', this.role);
        window.dispatchEvent(new CustomEvent('cloud-auth-change', { detail: { user: this.user, role: this.role } }));
        return { success: true, user: this.user };
      } catch (err) {
        throw new Error(this.formatAuthError(err));
      }
    }

    // Local / Offline Email sign-in
    const isAdmin = this.checkIfAdminEmail(email);
    this.user = {
      uid: `user_${Date.now()}`,
      email: email,
      displayName: email.split('@')[0],
      photoURL: null,
      role: isAdmin ? 'admin' : 'user'
    };
    this.role = this.user.role;
    localStorage.setItem('aigym_current_user', JSON.stringify(this.user));
    localStorage.setItem('aigym_user_role', this.role);
    window.dispatchEvent(new CustomEvent('cloud-auth-change', { detail: { user: this.user, role: this.role } }));
    return { success: true, user: this.user, simulated: true };
  }

  // --- EMAIL SIGN UP ---
  async signUpWithEmail(email, password, displayName = '') {
    email = (email || '').trim();
    if (!email || !password) {
      throw new Error('يرجى ملء جميع الحقول المطلوبة');
    }
    if (password.length < 6) {
      throw new Error('كلمة المرور يجب أن لا تقل عن 6 أحرف');
    }

    if (this.isConfigured && this.auth && window.firebase) {
      try {
        const res = await this.auth.createUserWithEmailAndPassword(email, password);
        if (displayName && res.user.updateProfile) {
          await res.user.updateProfile({ displayName });
        }
        const isAdmin = this.checkIfAdminEmail(res.user.email);
        this.user = {
          uid: res.user.uid,
          email: res.user.email,
          displayName: displayName || email.split('@')[0],
          photoURL: null,
          role: isAdmin ? 'admin' : 'user'
        };
        this.role = this.user.role;
        localStorage.setItem('aigym_current_user', JSON.stringify(this.user));
        localStorage.setItem('aigym_user_role', this.role);
        window.dispatchEvent(new CustomEvent('cloud-auth-change', { detail: { user: this.user, role: this.role } }));
        return { success: true, user: this.user };
      } catch (err) {
        throw new Error(this.formatAuthError(err));
      }
    }

    // Local / Offline sign up
    const isAdmin = this.checkIfAdminEmail(email);
    this.user = {
      uid: `user_${Date.now()}`,
      email: email,
      displayName: displayName || email.split('@')[0],
      photoURL: null,
      role: isAdmin ? 'admin' : 'user'
    };
    this.role = this.user.role;
    localStorage.setItem('aigym_current_user', JSON.stringify(this.user));
    localStorage.setItem('aigym_user_role', this.role);
    window.dispatchEvent(new CustomEvent('cloud-auth-change', { detail: { user: this.user, role: this.role } }));
    return { success: true, user: this.user, simulated: true };
  }

  // --- GUEST SIGN IN ---
  signInAsGuest() {
    this.user = {
      uid: `guest_${Date.now()}`,
      email: 'guest@aigym.local',
      displayName: 'متدرب ضيف',
      photoURL: null,
      role: 'guest'
    };
    this.role = 'guest';
    localStorage.setItem('aigym_current_user', JSON.stringify(this.user));
    localStorage.setItem('aigym_user_role', 'guest');
    window.dispatchEvent(new CustomEvent('cloud-auth-change', { detail: { user: this.user, role: 'guest' } }));
    return this.user;
  }

  // --- ADMIN PIN ELEVATION ---
  verifyAdminPin(pin) {
    if ((pin || '').trim() === '2026' || (pin || '').trim() === '1234') {
      this.role = 'admin';
      if (this.user) this.user.role = 'admin';
      else {
        this.user = {
          uid: 'admin_ibrahim',
          email: 'eng.ibrahim@aigym.com',
          displayName: 'م. إبراهيم البنا (مسؤول النظام)',
          role: 'admin'
        };
      }
      localStorage.setItem('aigym_current_user', JSON.stringify(this.user));
      localStorage.setItem('aigym_user_role', 'admin');
      window.dispatchEvent(new CustomEvent('cloud-auth-change', { detail: { user: this.user, role: 'admin' } }));
      return true;
    }
    return false;
  }

  // --- SIGN OUT ---
  async signOut() {
    if (this.isConfigured && this.auth) {
      try {
        await this.auth.signOut();
      } catch (e) {}
    }
    this.user = null;
    this.role = 'guest';
    localStorage.removeItem('aigym_current_user');
    localStorage.removeItem('aigym_user_role');
    window.dispatchEvent(new CustomEvent('cloud-auth-change', { detail: { user: null, role: 'guest' } }));
  }

  isAdmin() {
    return this.role === 'admin';
  }

  formatAuthError(err) {
    if (!err) return 'حدث خطأ في عملية تسجيل الدخول';
    if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      return 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
    }
    if (err.code === 'auth/email-already-in-use') {
      return 'هذا البريد الإلكتروني مسجل مسبقاً، يمكنك تسجيل الدخول به';
    }
    if (err.code === 'auth/weak-password') {
      return 'كلمة المرور ضعيفة، يجب أن تحتوي على 6 أحرف على الأقل';
    }
    if (err.code === 'auth/invalid-email') {
      return 'صيغة البريد الإلكتروني غير صالحة';
    }
    return err.message || 'تعذر إتمام العملية، يرجى المحاولة لاحقاً';
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
    if (this.isConfigured && this.db && this.user && this.user.uid) {
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

    if (this.isConfigured && this.db && this.user && this.user.uid) {
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
    if (this.isConfigured && this.db && this.user && this.user.uid) {
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
    return { success: true, count: workouts.length, offline: true };
  }
}

window.FirebaseService = FirebaseService;
