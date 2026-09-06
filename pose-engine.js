// pose-engine.js - محرك الرؤية الحاسوبية وحساب زوايا التمارين
// يدعم MediaPipe Pose مع تحسينات خاصة لعتاد الآيفون وكاميرات الهواتف

class PoseEngine {
  constructor(videoElement, canvasElement, options = {}) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');

    this.onRep = options.onRep || (() => {});
    this.onCue = options.onCue || (() => {});
    this.onAngleUpdate = options.onAngleUpdate || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onFormWarning = options.onFormWarning || (() => {});

    this.currentExercise = 'squats'; // squats, lunges, deadlifts, pushups, curls, shoulder_press, lateral_raises, tricep_dips, crunches, leg_raises, jacks, plank
    this.facingMode = 'user'; // 'user' (front) or 'environment' (back)

    this.repCount = 0;
    this.state = 'UP'; // 'UP' or 'DOWN'
    this.lowestAngle = 180;
    this.highestAngle = 0;
    this.isRunning = false;
    this.cuePlayed = false;
    this.plankStartTime = null;
    this.plankSeconds = 0;

    // Thermal & Battery Optimization (Prevents iPhone Overheating)
    this.lastPoseTime = 0;
    this.poseInterval = 55; // ~18 FPS (Perfect for fitness AI while keeping CPU/GPU cool)
    this.isProcessing = false;
    this.guideTick = 0; // Animation counter for green guide lines

    this.pose = null;
    this.stream = null;
    this.animationFrameId = null;

    this.initMediaPipe();
  }

  // Initialize MediaPipe Pose with mobile-optimized parameters
  initMediaPipe() {
    if (typeof window.Pose === 'undefined') {
      console.error('MediaPipe Pose library not yet loaded');
      return;
    }

    this.pose = new window.Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });

    // Use modelComplexity: 0 (Lite model designed for phones to prevent overheating & save 70% battery)
    this.pose.setOptions({
      modelComplexity: 0, 
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    this.pose.onResults((results) => this.onPoseResults(results));
  }

  // Calculate 2D angle in degrees between three landmarks (A, B, C) where B is the vertex
  calculateAngle(a, b, c) {
    if (!a || !b || !c) return 0;
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) {
      angle = 360.0 - angle;
    }
    return Math.round(angle);
  }

  setExercise(exercise) {
    this.currentExercise = exercise;
    if (exercise === 'curls' || exercise === 'lateral_raises' || exercise === 'shoulder_press') {
      this.state = 'DOWN';
    } else {
      this.state = 'UP';
    }
    this.lowestAngle = 180;
    this.highestAngle = 0;
    this.cuePlayed = false;
    this.plankStartTime = null;
    this.plankSeconds = 0;
  }

  resetCounter() {
    this.repCount = 0;
    this.state = (this.currentExercise === 'curls' || this.currentExercise === 'lateral_raises' || this.currentExercise === 'shoulder_press') ? 'DOWN' : 'UP';
    this.cuePlayed = false;
    this.plankStartTime = null;
    this.plankSeconds = 0;
    this.onAngleUpdate({ angle: 0, progress: 0, state: this.state, reps: 0 });
  }

  // Start Camera with iPhone hardware constraints
  async startCamera() {
    try {
      this.video.setAttribute('playsinline', 'true');
      this.video.setAttribute('webkit-playsinline', 'true');
      this.video.muted = true;

      // Mobile Optimized constraints: 480x360 keeps the phone cool and battery lasting
      const constraints = {
        audio: false,
        video: {
          facingMode: this.facingMode,
          width: { ideal: 480 },
          height: { ideal: 360 },
          frameRate: { ideal: 24 }
        }
      };

      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
      }

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;

      await new Promise((resolve) => {
        this.video.onloadedmetadata = () => {
          this.video.play();
          resolve();
        };
      });

      this.canvas.width = this.video.videoWidth || 480;
      this.canvas.height = this.video.videoHeight || 360;

      this.isRunning = true;
      this.processVideo();
      this.onStatusChange('active');
    } catch (err) {
      console.error('Camera Access Error:', err);
      this.onStatusChange('camera_error', err.message);
      throw err;
    }
  }

  // Switch between front and back camera (for iPhone and Android)
  async toggleCamera() {
    this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
    if (this.isRunning) {
      await this.startCamera();
    }
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.onStatusChange('stopped');
  }

  // Throttled processing loop: keeps video 60 FPS smooth but paces AI inference to 18 FPS
  async processVideo() {
    if (!this.isRunning) return;

    const now = performance.now();
    if (now - this.lastPoseTime >= this.poseInterval && !this.isProcessing) {
      if (this.video.readyState >= 2 && this.pose) {
        this.lastPoseTime = now;
        this.isProcessing = true;
        try {
          await this.pose.send({ image: this.video });
        } catch (e) {
          console.warn('Pose frame drop:', e);
        } finally {
          this.isProcessing = false;
        }
      }
    }

    this.animationFrameId = requestAnimationFrame(() => this.processVideo());
  }

  // Handle detection results and state machine logic
  onPoseResults(results) {
    if (!this.isRunning) return;

    const ctx = this.ctx;
    const canvas = this.canvas;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Mirror the video if front camera
    if (this.facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    if (results.poseLandmarks) {
      this.drawGoldSkeleton(ctx, results.poseLandmarks, canvas.width, canvas.height);
      this.drawDynamicGreenGuides(ctx, results.poseLandmarks, canvas.width, canvas.height);
      this.evaluateExercise(results.poseLandmarks);
    } else {
      this.onStatusChange('no_pose');
    }

    ctx.restore();
  }

  // Draw Luxury Gold & Emerald glowing skeleton overlay
  drawGoldSkeleton(ctx, landmarks, w, h) {
    const connections = [
      [11, 12], [11, 13], [13, 15], // Left arm
      [12, 14], [14, 16], // Right arm
      [11, 23], [12, 24], [23, 24], // Torso
      [23, 25], [25, 27], // Left leg
      [24, 26], [26, 28]  // Right leg
    ];

    ctx.lineWidth = 4;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#D4AF37'; // Gold glow
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.85)';

    for (const [startIdx, endIdx] of connections) {
      const p1 = landmarks[startIdx];
      const p2 = landmarks[endIdx];
      if (p1 && p2 && p1.visibility > 0.4 && p2.visibility > 0.4) {
        ctx.beginPath();
        ctx.moveTo(p1.x * w, p1.y * h);
        ctx.lineTo(p2.x * w, p2.y * h);
        ctx.stroke();
      }
    }

    for (const lm of landmarks) {
      if (lm.visibility > 0.45) {
        const x = lm.x * w;
        const y = lm.y * h;

        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = '#FFDF73';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#FFD700';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowBlur = 0;
        ctx.fill();
      }
    }
  }

  // Draw Animated Green Motion Guide Lines (خطوط وأسهم الإرشاد الخضراء المتحركة)
  drawDynamicGreenGuides(ctx, lm, w, h) {
    this.guideTick = (this.guideTick + 1) % 60;
    const shift = (this.guideTick % 20) / 20; // 0 to 1 moving offset
    const neonGreen = '#2ECC71';
    const neonGreenGlow = 'rgba(46, 204, 113, 0.75)';

    ctx.save();
    ctx.lineWidth = 4;
    ctx.shadowBlur = 14;
    ctx.shadowColor = neonGreenGlow;
    ctx.strokeStyle = neonGreen;
    ctx.fillStyle = neonGreen;

    const leftLegVis = (lm[23].visibility + lm[25].visibility + lm[27].visibility) / 3;
    const rightLegVis = (lm[24].visibility + lm[26].visibility + lm[28].visibility) / 3;
    const leftArmVis = (lm[11].visibility + lm[13].visibility + lm[15].visibility) / 3;
    const rightArmVis = (lm[12].visibility + lm[14].visibility + lm[16].visibility) / 3;

    // 1. SQUATS & DEADLIFTS GUIDES
    if (this.currentExercise === 'squats' || this.currentExercise === 'deadlifts') {
      const hip = leftLegVis > rightLegVis ? lm[23] : lm[24];
      const knee = leftLegVis > rightLegVis ? lm[25] : lm[26];
      if (hip.visibility > 0.4 && knee.visibility > 0.4) {
        const hx = hip.x * w;
        const hy = hip.y * h;
        const ky = knee.y * h;

        if (this.state === 'UP') {
          // Guide down: Trainee needs to squat down!
          const targetY = ky - 10;
          this.drawArrow(ctx, hx - 25, hy + 10, hx - 25, targetY, shift);
          this.drawArrow(ctx, hx + 25, hy + 10, hx + 25, targetY, shift);

          // Target depth line at knee level
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.moveTo(hx - 50, ky);
          ctx.lineTo(hx + 50, ky);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          // Guide up: Trainee reached depth, push back up!
          this.drawArrow(ctx, hx - 25, ky, hx - 25, hy - 15, shift);
          this.drawArrow(ctx, hx + 25, ky, hx + 25, hy - 15, shift);
        }
      }
    }
    // 2. BICEP CURLS GUIDES
    else if (this.currentExercise === 'curls') {
      const elbow = leftArmVis > rightArmVis ? lm[13] : lm[14];
      const wrist = leftArmVis > rightArmVis ? lm[15] : lm[16];
      const shoulder = leftArmVis > rightArmVis ? lm[11] : lm[12];

      if (wrist.visibility > 0.4 && shoulder.visibility > 0.4) {
        const wx = wrist.x * w;
        const wy = wrist.y * h;
        const sx = shoulder.x * w;
        const sy = shoulder.y * h;

        if (this.state === 'DOWN') {
          // Guide curl upwards
          this.drawArrow(ctx, wx, wy - 5, sx, sy + 15, shift);
        } else {
          // Guide arm extending down
          this.drawArrow(ctx, sx, sy + 15, wx, wy + 20, shift);
        }
      }
    }
    // 3. PUSH-UPS & TRICEP DIPS GUIDES
    else if (this.currentExercise === 'pushups' || this.currentExercise === 'tricep_dips') {
      const shoulder = leftArmVis > rightArmVis ? lm[11] : lm[12];
      if (shoulder.visibility > 0.4) {
        const sx = shoulder.x * w;
        const sy = shoulder.y * h;
        if (this.state === 'UP') {
          this.drawArrow(ctx, sx, sy, sx, sy + 50, shift);
        } else {
          this.drawArrow(ctx, sx, sy, sx, sy - 50, shift);
        }
      }
    }
    // 4. OVERHEAD SHOULDER PRESS
    else if (this.currentExercise === 'shoulder_press') {
      const wrist = leftArmVis > rightArmVis ? lm[15] : lm[16];
      if (wrist.visibility > 0.4) {
        const wx = wrist.x * w;
        const wy = wrist.y * h;
        if (this.state === 'DOWN') {
          this.drawArrow(ctx, wx, wy, wx, wy - 70, shift);
        } else {
          this.drawArrow(ctx, wx, wy, wx, wy + 60, shift);
        }
      }
    }
    // 5. LATERAL RAISES
    else if (this.currentExercise === 'lateral_raises') {
      const elbow = leftArmVis > rightArmVis ? lm[13] : lm[14];
      const hip = leftLegVis > rightLegVis ? lm[23] : lm[24];
      if (elbow.visibility > 0.4 && hip.visibility > 0.4) {
        const ex = elbow.x * w;
        const ey = elbow.y * h;
        if (this.state === 'DOWN') {
          this.drawArrow(ctx, ex, ey, ex + (leftArmVis > rightArmVis ? -40 : 40), ey - 40, shift);
        } else {
          this.drawArrow(ctx, ex, ey, ex, ey + 40, shift);
        }
      }
    }

    ctx.restore();
  }

  // Draw moving guide arrow along vector
  drawArrow(ctx, fromX, fromY, toX, toY, shift) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const angle = Math.atan2(dy, dx);
    const headlen = 12;

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    const headX = fromX + dx * (0.4 + shift * 0.55);
    const headY = fromY + dy * (0.4 + shift * 0.55);

    ctx.beginPath();
    ctx.moveTo(headX, headY);
    ctx.lineTo(headX - headlen * Math.cos(angle - Math.PI / 6), headY - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(headX - headlen * Math.cos(angle + Math.PI / 6), headY - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  // Comprehensive Exercise Library with State Machines
  evaluateExercise(lm) {
    let angle = 0;
    let progress = 0;

    // Helper visibility getters
    const leftArmVis = (lm[11].visibility + lm[13].visibility + lm[15].visibility) / 3;
    const rightArmVis = (lm[12].visibility + lm[14].visibility + lm[16].visibility) / 3;
    const leftLegVis = (lm[23].visibility + lm[25].visibility + lm[27].visibility) / 3;
    const rightLegVis = (lm[24].visibility + lm[26].visibility + lm[28].visibility) / 3;

    const shoulder = leftArmVis > rightArmVis ? lm[11] : lm[12];
    const elbow = leftArmVis > rightArmVis ? lm[13] : lm[14];
    const wrist = leftArmVis > rightArmVis ? lm[15] : lm[16];

    const hip = leftLegVis > rightLegVis ? lm[23] : lm[24];
    const knee = leftLegVis > rightLegVis ? lm[25] : lm[26];
    const ankle = leftLegVis > rightLegVis ? lm[27] : lm[28];

    switch (this.currentExercise) {
      // 1. SQUATS
      case 'squats': {
        angle = this.calculateAngle(hip, knee, ankle);
        progress = Math.min(100, Math.max(0, Math.round(((170 - angle) / (170 - 90)) * 100)));

        if (angle < 95) {
          if (this.state === 'UP') {
            this.state = 'DOWN';
            if (!this.cuePlayed) { this.onCue(); this.cuePlayed = true; }
          }
        } else if (angle > 160) {
          if (this.state === 'DOWN') {
            this.state = 'UP';
            this.repCount++;
            this.cuePlayed = false;
            this.onRep(this.repCount, progress >= 90 ? 'perfect' : 'good');
          }
        }
        break;
      }

      // 2. LUNGES (الطعنات)
      case 'lunges': {
        angle = this.calculateAngle(hip, knee, ankle);
        progress = Math.min(100, Math.max(0, Math.round(((165 - angle) / (165 - 95)) * 100)));

        if (angle < 100) {
          if (this.state === 'UP') {
            this.state = 'DOWN';
            if (!this.cuePlayed) { this.onCue(); this.cuePlayed = true; }
          }
        } else if (angle > 155) {
          if (this.state === 'DOWN') {
            this.state = 'UP';
            this.repCount++;
            this.cuePlayed = false;
            this.onRep(this.repCount, 'perfect');
          }
        }
        break;
      }

      // 3. DEADLIFT / RDL (الرفعة الميتة)
      case 'deadlifts': {
        // Measures hip hinge: Shoulder - Hip - Knee
        angle = this.calculateAngle(shoulder, hip, knee);
        progress = Math.min(100, Math.max(0, Math.round(((170 - angle) / (170 - 100)) * 100)));

        if (angle < 110) {
          if (this.state === 'UP') {
            this.state = 'DOWN';
            if (!this.cuePlayed) { this.onCue(); this.cuePlayed = true; }
          }
        } else if (angle > 160) {
          if (this.state === 'DOWN') {
            this.state = 'UP';
            this.repCount++;
            this.cuePlayed = false;
            this.onRep(this.repCount, 'perfect');
          }
        }
        break;
      }

      // 4. PUSH-UPS (تمرين الضغط)
      case 'pushups': {
        angle = this.calculateAngle(shoulder, elbow, wrist);
        progress = Math.min(100, Math.max(0, Math.round(((160 - angle) / (160 - 85)) * 100)));

        if (angle < 90) {
          if (this.state === 'UP') {
            this.state = 'DOWN';
            if (!this.cuePlayed) { this.onCue(); this.cuePlayed = true; }
          }
        } else if (angle > 155) {
          if (this.state === 'DOWN') {
            this.state = 'UP';
            this.repCount++;
            this.cuePlayed = false;
            this.onRep(this.repCount, progress >= 90 ? 'perfect' : 'good');
          }
        }
        break;
      }

      // 5. BICEP CURLS (بايسبس)
      case 'curls': {
        angle = this.calculateAngle(shoulder, elbow, wrist);
        progress = Math.min(100, Math.max(0, Math.round(((155 - angle) / (155 - 40)) * 100)));

        if (angle < 45) {
          if (this.state === 'DOWN') {
            this.state = 'UP';
            if (!this.cuePlayed) { this.onCue(); this.cuePlayed = true; }
          }
        } else if (angle > 145) {
          if (this.state === 'UP') {
            this.state = 'DOWN';
            this.repCount++;
            this.cuePlayed = false;
            this.onRep(this.repCount, 'perfect');
          }
        }
        break;
      }

      // 6. OVERHEAD SHOULDER PRESS (ضغط الأكتاف العسكري)
      case 'shoulder_press': {
        angle = this.calculateAngle(shoulder, elbow, wrist);
        // From 90° (at ear level) up to 165° (locked out overhead)
        progress = Math.min(100, Math.max(0, Math.round(((angle - 85) / (165 - 85)) * 100)));

        if (angle > 155 && wrist.y < shoulder.y) {
          if (this.state === 'DOWN') {
            this.state = 'UP';
            if (!this.cuePlayed) { this.onCue(); this.cuePlayed = true; }
          }
        } else if (angle < 95) {
          if (this.state === 'UP') {
            this.state = 'DOWN';
            this.repCount++;
            this.cuePlayed = false;
            this.onRep(this.repCount, 'perfect');
          }
        }
        break;
      }

      // 7. LATERAL SHOULDER RAISES (الرفرفة الجانبية)
      case 'lateral_raises': {
        // Angle between Torso and Arm: Hip - Shoulder - Elbow
        angle = this.calculateAngle(hip, shoulder, elbow);
        progress = Math.min(100, Math.max(0, Math.round(((angle - 25) / (90 - 25)) * 100)));

        if (angle > 80) {
          if (this.state === 'DOWN') {
            this.state = 'UP';
            if (!this.cuePlayed) { this.onCue(); this.cuePlayed = true; }
          }
        } else if (angle < 35) {
          if (this.state === 'UP') {
            this.state = 'DOWN';
            this.repCount++;
            this.cuePlayed = false;
            this.onRep(this.repCount, 'perfect');
          }
        }
        break;
      }

      // 8. TRICEP DIPS (ترايسبس ديبس)
      case 'tricep_dips': {
        angle = this.calculateAngle(shoulder, elbow, wrist);
        progress = Math.min(100, Math.max(0, Math.round(((160 - angle) / (160 - 90)) * 100)));

        if (angle < 95) {
          if (this.state === 'UP') {
            this.state = 'DOWN';
            if (!this.cuePlayed) { this.onCue(); this.cuePlayed = true; }
          }
        } else if (angle > 150) {
          if (this.state === 'DOWN') {
            this.state = 'UP';
            this.repCount++;
            this.cuePlayed = false;
            this.onRep(this.repCount, 'perfect');
          }
        }
        break;
      }

      // 9. CRUNCHES / SIT-UPS (تمارين المعدة)
      case 'crunches': {
        // Torso flexion: Shoulder - Hip - Knee
        angle = this.calculateAngle(shoulder, hip, knee);
        progress = Math.min(100, Math.max(0, Math.round(((140 - angle) / (140 - 75)) * 100)));

        if (angle < 85) {
          if (this.state === 'DOWN') {
            this.state = 'UP';
            if (!this.cuePlayed) { this.onCue(); this.cuePlayed = true; }
          }
        } else if (angle > 130) {
          if (this.state === 'UP') {
            this.state = 'DOWN';
            this.repCount++;
            this.cuePlayed = false;
            this.onRep(this.repCount, 'perfect');
          }
        }
        break;
      }

      // 10. LEG RAISES (رفع الساقين للبطن)
      case 'leg_raises': {
        // Angle between Torso and Legs: Shoulder - Hip - Ankle
        angle = this.calculateAngle(shoulder, hip, ankle);
        progress = Math.min(100, Math.max(0, Math.round(((170 - angle) / (170 - 95)) * 100)));

        if (angle < 105) {
          if (this.state === 'DOWN') {
            this.state = 'UP';
            if (!this.cuePlayed) { this.onCue(); this.cuePlayed = true; }
          }
        } else if (angle > 155) {
          if (this.state === 'UP') {
            this.state = 'DOWN';
            this.repCount++;
            this.cuePlayed = false;
            this.onRep(this.repCount, 'perfect');
          }
        }
        break;
      }

      // 11. JUMPING JACKS (القفز النجمي)
      case 'jacks': {
        const leftWrist = lm[15];
        const rightWrist = lm[16];
        const nose = lm[0];
        const leftAnkle = lm[27];
        const rightAnkle = lm[28];

        const handsUp = leftWrist.y < nose.y && rightWrist.y < nose.y;
        const feetApart = Math.abs(leftAnkle.x - rightAnkle.x) > 0.28;

        if (handsUp && feetApart) {
          angle = 180;
          progress = 100;
          if (this.state === 'DOWN') {
            this.state = 'UP';
            if (!this.cuePlayed) { this.onCue(); this.cuePlayed = true; }
          }
        } else if (!handsUp && !feetApart) {
          angle = 30;
          progress = 0;
          if (this.state === 'UP') {
            this.state = 'DOWN';
            this.repCount++;
            this.cuePlayed = false;
            this.onRep(this.repCount, 'perfect');
          }
        }
        break;
      }

      // 12. PLANK (البلانك - ثواني الثبات)
      case 'plank': {
        // Checks straight line: Shoulder - Hip - Ankle (around 160°-180°)
        angle = this.calculateAngle(shoulder, hip, ankle);
        const isHoldingGoodForm = angle >= 150 && angle <= 185;

        if (isHoldingGoodForm) {
          progress = 100;
          if (!this.plankStartTime) {
            this.plankStartTime = Date.now();
          } else {
            const elapsed = Math.floor((Date.now() - this.plankStartTime) / 1000);
            if (elapsed > this.repCount) {
              this.repCount = elapsed;
              if (this.repCount % 5 === 0) {
                this.onRep(this.repCount, 'perfect');
              } else {
                this.onAngleUpdate({ angle, progress: 100, state: 'HOLD', reps: this.repCount });
              }
            }
          }
        } else {
          progress = 40;
          this.plankStartTime = null;
        }
        break;
      }
    }

    this.onAngleUpdate({
      angle,
      progress,
      state: this.state,
      reps: this.repCount
    });
  }
}

window.PoseEngine = PoseEngine;
