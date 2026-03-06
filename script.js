/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  VR TRAFFIC POLICE TRAINING SIMULATOR – script.js
 *  Kerala Police × A-Frame
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  Components defined here:
 *   1. game-manager          – central game state (score, timer, fines, sessions)
 *   2. traffic-light         – renders & cycles a single traffic light (R/Y/G)
 *   3. car-driver            – moves a car along its lane, obeys lights, loops
 *   4. fine-system           – handles click→stop/go + scoring logic
 *   5. stop-highlight        – visual ring that appears around a stopped car
 *   6. violation-detector    – watches cars running red lights
 *
 *  Global helpers at bottom: showFeedback(), playSound()
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use strict';

/* ─────────────────────────────────────────────────────────────────────────────
   GLOBAL GAME STATE  (shared across all components)
───────────────────────────────────────────────────────────────────────────── */
window.GAME = {
    running: false,
    score: 0,
    fines: 0,
    stops: 0,
    missed: 0,
    timeLeft: 90,
    timerId: null,
    lightStates: {},            // { 'NS': 'red'|'yellow'|'green', 'EW': ... }
    stoppedCars: new Set(),     // entity ids manually stopped by officer
    violatorCars: new Set(),     // car ids currently running red
    feedbackTimer: null,

    // Called by start button
    start() {
        this.score = 0;
        this.fines = 0;
        this.stops = 0;
        this.missed = 0;
        this.timeLeft = 90;
        this.running = true;
        this.stoppedCars.clear();
        this.violatorCars.clear();
        this._updateHUD();

        // Countdown timer
        clearInterval(this.timerId);
        this.timerId = setInterval(() => {
            this.timeLeft--;
            this._updateHUD();
            if (this.timeLeft <= 0) {
                clearInterval(this.timerId);
                this.end();
            }
        }, 1000);
    },

    end() {
        this.running = false;
        clearInterval(this.timerId);

        document.getElementById('final-score').textContent = this.score;
        document.getElementById('final-fines').textContent = this.fines;
        document.getElementById('final-stops').textContent = this.stops;
        document.getElementById('final-missed').textContent = this.missed;

        const endScreen = document.getElementById('end-screen');
        endScreen.classList.add('show');
    },

    addScore(pts, reason) {
        this.score += pts;
        this._updateHUD();
        showFeedback(`+${pts} pts — ${reason}`, 'success');
        playSound('fine-snd');
    },

    penalise(pts, reason) {
        this.score = Math.max(0, this.score - pts);
        this.missed++;
        this._updateHUD();
        showFeedback(`-${pts} pts — ${reason}`, 'violation');
        playSound('violation-snd');
    },

    _updateHUD() {
        document.querySelector('#score-val').textContent = this.score;
        document.querySelector('#timer-val').textContent = this.timeLeft;
        document.querySelector('#fines-val').textContent = this.fines;

        // Update in-world VR HUD
        const vrText = document.getElementById('vr-score-text');
        if (vrText) {
            vrText.setAttribute('value',
                `🚔 TRAFFIC POLICE TRAINING\nScore: ${this.score}  |  Time: ${this.timeLeft}s  |  Fines: ${this.fines}`
            );
        }
    }
};

/* ─────────────────────────────────────────────────────────────────────────────
   HELPER: Show feedback banner (bottom of screen)
───────────────────────────────────────────────────────────────────────────── */
window.showFeedback = function (msg, type = 'success') {
    const banner = document.getElementById('feedback-banner');
    if (!banner) return;

    banner.textContent = msg;
    banner.className = 'show ' + (type === 'violation' ? 'violation' : type === 'info' ? 'info' : '');
    banner.style.borderLeftColor =
        type === 'violation' ? '#f87171' :
            type === 'info' ? '#60a5fa' : '#4ade80';

    clearTimeout(GAME.feedbackTimer);
    GAME.feedbackTimer = setTimeout(() => {
        banner.classList.remove('show');
    }, 2500);
};

/* ─────────────────────────────────────────────────────────────────────────────
   HELPER: Play audio clip
───────────────────────────────────────────────────────────────────────────── */
window.playSound = function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.currentTime = 0;
    el.play().catch(() => { }); // silence autoplay errors
};

/* ═══════════════════════════════════════════════════════════════════════════
   1. GAME-MANAGER COMPONENT
   Attach to <a-scene> as game-manager: ""
═══════════════════════════════════════════════════════════════════════════ */
AFRAME.registerComponent('game-manager', {
    init() {
        // Initialise light states
        GAME.lightStates.NS = 'green';   // N-S road gets green first
        GAME.lightStates.EW = 'red';

        // DOM buttons
        const btnStart = document.getElementById('btn-start');
        const btnRestart = document.getElementById('btn-restart');

        if (btnStart) {
            btnStart.addEventListener('click', () => {
                document.getElementById('start-screen').style.display = 'none';
                document.getElementById('hud').style.display = 'flex';
                GAME.start();
            });
        }

        if (btnRestart) {
            btnRestart.addEventListener('click', () => {
                document.getElementById('end-screen').classList.remove('show');
                document.getElementById('hud').style.display = 'flex';
                // Re-release all stopped cars
                GAME.stoppedCars.clear();
                document.querySelectorAll('.vehicle').forEach(car => {
                    car.setAttribute('data-stopped', 'false');
                    car.setAttribute('data-fined', 'false');
                });
                GAME.start();
            });
        }
    }
});

/* ═══════════════════════════════════════════════════════════════════════════
   2. TRAFFIC-LIGHT COMPONENT
   Schema:
     axis  – 'NS' | 'EW'   (which road axis this light governs)
     phase – 0 | 1          (0 = starts green, 1 = starts red, offset timing)

   Cycle timing: GREEN 8s → YELLOW 2s → RED 8s → repeat
   NS and EW are always opposite (when NS=green, EW=red and vice-versa).

   GAME.lightStates.NS and GAME.lightStates.EW are updated here.
═══════════════════════════════════════════════════════════════════════════ */
AFRAME.registerComponent('traffic-light', {
    schema: {
        axis: { type: 'string', default: 'NS' },
        phase: { type: 'int', default: 0 }   // 0=primary, 1=opposite
    },

    init() {
        // Find the three light spheres inside this entity
        this.lights = {
            red: this.el.querySelector('[id$="-red"]'),
            yellow: this.el.querySelector('[id$="-yellow"]'),
            green: this.el.querySelector('[id$="-green"]')
        };

        // Timing constants (ms)
        this.GREEN_TIME = 8000;
        this.YELLOW_TIME = 2000;
        this.RED_TIME = 8000;

        // Only axis=NS entity drives the master cycle (prevents double-cycling)
        if (this.data.axis === 'NS' && this.data.phase === 0) {
            this._runCycle();
        }

        // All lights poll GAME.lightStates every 250 ms and update visuals
        this._pollInterval = setInterval(() => this._refresh(), 250);
        this._refresh();
    },

    remove() {
        clearTimeout(this._cycleTimer);
        clearInterval(this._pollInterval);
    },

    /* Master NS duty-cycle: drives GAME.lightStates for BOTH axes */
    _runCycle() {
        const seq = ['green', 'yellow', 'red'];
        let step = 0;

        const next = () => {
            const nsState = seq[step % 3];

            // EW is always opposite of NS
            const ewState =
                nsState === 'green' ? 'red' :
                    nsState === 'yellow' ? 'yellow' :
                        'green';

            GAME.lightStates.NS = nsState;
            GAME.lightStates.EW = ewState;

            const delay =
                nsState === 'green' ? this.GREEN_TIME :
                    nsState === 'yellow' ? this.YELLOW_TIME :
                        this.RED_TIME;

            step++;
            this._cycleTimer = setTimeout(next, delay);
        };

        // Kick off immediately
        next();
    },

    /* Read GAME.lightStates and update this light's visual */
    _refresh() {
        const state = GAME.lightStates[this.data.axis];

        // Phase 1 lights show the OPPOSITE state (they're on the other side of the road)
        const shown = this.data.phase === 0 ? state : this._opposite(state);

        if (!this.lights.red) return;

        const DIM = '#555555';
        const NONE = '#000000';

        // Reset
        this.lights.red.setAttribute('color', DIM);
        this.lights.yellow.setAttribute('color', DIM);
        this.lights.green.setAttribute('color', DIM);
        this.lights.red.setAttribute('material', 'emissive: ' + NONE);
        this.lights.yellow.setAttribute('material', 'emissive: ' + NONE);
        this.lights.green.setAttribute('material', 'emissive: ' + NONE);

        if (shown === 'red') {
            this.lights.red.setAttribute('color', '#ff4444');
            this.lights.red.setAttribute('material', 'emissive: #ff0000; emissiveIntensity: 1.2');
        } else if (shown === 'yellow') {
            this.lights.yellow.setAttribute('color', '#facc15');
            this.lights.yellow.setAttribute('material', 'emissive: #ffcc00; emissiveIntensity: 1.2');
        } else {
            this.lights.green.setAttribute('color', '#4ade80');
            this.lights.green.setAttribute('material', 'emissive: #00ff44; emissiveIntensity: 1.2');
        }
    },

    _opposite(state) {
        return state === 'green' ? 'red' : state === 'red' ? 'green' : 'yellow';
    }
});

/* ═══════════════════════════════════════════════════════════════════════════
   3. CAR-DRIVER COMPONENT
   Schema:
     speed    – units per tick (~60fps)
     axis     – 'NS' (along Z) | 'SN' (along -Z) | 'EW' (along -X) | 'WE' (along +X)
     startZ   – initial Z  (for NS/SN lanes)
     startX   – initial X  (for EW/WE lanes)
     lightId  – axis key for GAME.lightStates lookup ('NS' | 'EW')
     violator – if true, this car will sometimes run red lights

   Stopping logic:
     • If officer has manually stopped the car → frozen.
     • If light for this lane is RED and car is approaching intersection → brake.
     • If light is GREEN (or car already past intersection) → drive.
     • Violator cars have a 30% chance of ignoring red lights.
═══════════════════════════════════════════════════════════════════════════ */
AFRAME.registerComponent('car-driver', {
    schema: {
        speed: { type: 'number', default: 0.1 },
        axis: { type: 'string', default: 'NS' },
        startZ: { type: 'number', default: -50 },
        startX: { type: 'number', default: 60 },
        lightId: { type: 'string', default: 'NS' },
        violator: { type: 'boolean', default: false }
    },

    init() {
        this.manuallyStopped = false;
        this.willViolate = false;          // decided per-loop: will this car ignore red?
        this.hasBeenCaught = false;          // officer stopped this violator this pass
        this.crossedZero = false;          // did car pass the intersection this loop?
        this.isAtRed = false;

        // Store original speed for restore
        this._baseSpeed = this.data.speed;

        // Listen for officer click (fine-system fires this)
        this.el.addEventListener('car-stopped', () => this._officerStop());
        this.el.addEventListener('car-released', () => this._officerRelease());

        // Decide violator tendency
        if (this.data.violator) {
            this._decideViolation();
        }
    },

    _decideViolation() {
        // 35% of the time, this violator car will run the next red light
        this.willViolate = Math.random() < 0.35;
    },

    _officerStop() {
        this.manuallyStopped = true;
        this.hasBeenCaught = true;
    },

    _officerRelease() {
        this.manuallyStopped = false;
    },

    tick() {
        if (!GAME.running) return;
        if (this.manuallyStopped) return;

        const pos = this.el.getAttribute('position');
        const axis = this.data.axis;

        // ── Determine if car is near/at intersection (|coord| < 14) ──
        const nearIntersection =
            (axis === 'NS' || axis === 'SN') ?
                (Math.abs(pos.z) < 14) :
                (Math.abs(pos.x) < 14);

        const lightState = GAME.lightStates[this.data.lightId];

        // ── Red light braking (if near intersection and light is red) ──
        let shouldStop = false;
        if (nearIntersection && lightState === 'red') {
            if (this.data.violator && this.willViolate) {
                // This violator ignores the red – mark as active violation
                if (!GAME.violatorCars.has(this.el.id) && !this.hasBeenCaught) {
                    GAME.violatorCars.add(this.el.id);
                    // Notify violation if not yet caught
                    console.log(`[VR] Violator car ${this.el.id} running red!`);
                }
                shouldStop = false;
            } else {
                shouldStop = true;
            }
        }

        if (shouldStop) {
            this.isAtRed = true;
            GAME.violatorCars.delete(this.el.id);   // cleared violation (obeying)
            return;
        }
        this.isAtRed = false;

        // ── Move car ──
        const spd = this.data.speed;

        if (axis === 'NS') pos.z += spd;
        else if (axis === 'SN') pos.z -= spd;
        else if (axis === 'EW') pos.x -= spd;
        else if (axis === 'WE') pos.x += spd;

        this.el.setAttribute('position', pos);

        // ── Track crossing of intersection ──
        const crossed =
            (axis === 'NS') ? (pos.z > 0) :
                (axis === 'SN') ? (pos.z < 0) :
                    (axis === 'EW') ? (pos.x < 0) :
                        (pos.x > 0);

        if (crossed && !this.crossedZero) {
            this.crossedZero = true;
            // If car was a violator and wasn't caught, penalise the officer
            if (this.data.violator && this.willViolate && !this.hasBeenCaught) {
                GAME.penalise(15, `Violator escaped! ${this.el.id} ran a red light!`);
                GAME.violatorCars.delete(this.el.id);
            }
        }

        // ── Loop car back to start ──
        const LIMIT = 100;
        let reset = false;

        if (axis === 'NS' && pos.z > LIMIT) { pos.z = this.data.startZ; reset = true; }
        else if (axis === 'SN' && pos.z < -LIMIT) { pos.z = this.data.startZ; reset = true; }
        else if (axis === 'EW' && pos.x < -LIMIT) { pos.x = this.data.startX; reset = true; }
        else if (axis === 'WE' && pos.x > LIMIT) { pos.x = this.data.startX; reset = true; }

        if (reset) {
            this.el.setAttribute('position', pos);
            this.crossedZero = false;
            this.hasBeenCaught = false;
            GAME.violatorCars.delete(this.el.id);
            this.el.removeAttribute('data-fined');
            this.el.setAttribute('data-stopped', 'false');
            this.manuallyStopped = false;

            // Re-decide if violator will run next red
            if (this.data.violator) this._decideViolation();

            // Speed variation each loop (±20%) for realism
            const variation = 0.8 + Math.random() * 0.4;
            this.data.speed = this._baseSpeed * variation;
        }
    }
});

/* ═══════════════════════════════════════════════════════════════════════════
   4. FINE-SYSTEM COMPONENT
   Attach to the <a-scene> element.

   Listens for click events on entities with class .clickable.
   If the clicked entity is a vehicle (.vehicle):
     – First click  → stops the car (officer signals to halt)
     – Second click → issues fine or releases (toggle)

   Scoring:
     • Stop a car running RED → +25 pts, +1 fine, play whistle
     • Stop a car at yellow   → +10 pts (good anticipation)
     • Stop a car at green    → −5 pts (unnecessary halt)
     • Release a correctly stopped car → +5 pts
═══════════════════════════════════════════════════════════════════════════ */
AFRAME.registerComponent('fine-system', {
    init() {
        this.el.addEventListener('click', evt => {
            if (!GAME.running) return;

            const target = evt.detail.intersectedEl;
            if (!target) return;
            if (!target.classList.contains('vehicle')) return;

            const id = target.id;
            const isStopped = target.getAttribute('data-stopped') === 'true';

            if (!isStopped) {
                // ── STOP the car ──
                target.setAttribute('data-stopped', 'true');
                target.emit('car-stopped');
                GAME.stops++;
                GAME.stoppedCars.add(id);
                playSound('whistle-snd');

                // ── Score based on light state for this car's axis ──
                const driverComp = target.components['car-driver'];
                if (driverComp) {
                    const lightId = driverComp.data.lightId;
                    const lightState = GAME.lightStates[lightId];
                    const isViolator = GAME.violatorCars.has(id);

                    if (isViolator || lightState === 'red') {
                        GAME.fines++;
                        GAME.addScore(25, '🚨 Red-light violator caught!');
                        target.setAttribute('data-fined', 'true');
                        // Flash car red briefly
                        this._flash(target, '#ff0000');
                    } else if (lightState === 'yellow') {
                        GAME.fines++;
                        GAME.addScore(10, '⚠️ Vehicle stopped at yellow');
                        target.setAttribute('data-fined', 'true');
                        this._flash(target, '#facc15');
                    } else {
                        // Green light – unnecessary stop
                        GAME.addScore(-5, '🟢 Car stopped on green!');
                        this._flash(target, '#22c55e');
                    }
                }

                // Show stop ring visual
                this._showStopRing(target);

            } else {
                // ── RELEASE the car ──
                target.setAttribute('data-stopped', 'false');
                target.emit('car-released');
                GAME.stoppedCars.delete(id);
                GAME.addScore(5, '✅ Vehicle released');
                playSound('whistle-snd');
                this._removeStopRing(target);
            }
        });
    },

    /* Flash the car a colour briefly */
    _flash(target, color) {
        const orig = target.getAttribute('material') || {};
        target.setAttribute('material', `color: ${color}; emissive: ${color}; emissiveIntensity: 0.5`);
        setTimeout(() => {
            target.removeAttribute('material');
        }, 600);
    },

    /* Remove stop-ring child */
    _removeStopRing(target) {
        const ring = target.querySelector('.stop-ring');
        if (ring) target.removeChild(ring);
    },

    /* Add a glowing ring under the stopped car */
    _showStopRing(target) {
        this._removeStopRing(target);   // safety

        const ring = document.createElement('a-torus');
        ring.setAttribute('position', '0 0.05 0');
        ring.setAttribute('rotation', '-90 0 0');
        ring.setAttribute('radius', '0.12');
        ring.setAttribute('radius-tubular', '0.005');
        ring.setAttribute('color', '#f87171');
        ring.setAttribute('material', 'emissive: #ff0000; emissiveIntensity: 0.8');
        ring.classList.add('stop-ring');
        ring.setAttribute('animation', 'property: scale; from: 1 1 1; to: 1.4 1.4 1.4; loop: true; dir: alternate; dur: 600; easing: easeInOutSine');
        target.appendChild(ring);
    }
});

/* ═══════════════════════════════════════════════════════════════════════════
   5. VIOLATION-DETECTOR COMPONENT
   Polls every second for cars running red lights and warns the officer.
═══════════════════════════════════════════════════════════════════════════ */
AFRAME.registerComponent('violation-detector', {
    init() {
        this._interval = setInterval(() => {
            if (!GAME.running) return;

            GAME.violatorCars.forEach(carId => {
                const car = document.getElementById(carId);
                if (!car) return;
                const isStopped = car.getAttribute('data-stopped') === 'true';
                if (!isStopped) {
                    showFeedback(`🚨 VIOLATION! ${carId} is running a RED LIGHT – Stop it!`, 'violation');
                }
            });
        }, 1500);
    },

    remove() {
        clearInterval(this._interval);
    }
});

/* ═══════════════════════════════════════════════════════════════════════════
   SCENE INIT
   Attach game-manager, fine-system, and violation-detector to the scene
   once A-Frame has loaded.
═══════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    const scene = document.getElementById('main-scene');
    if (!scene) return;

    scene.setAttribute('game-manager', '');
    scene.setAttribute('fine-system', '');
    scene.setAttribute('violation-detector', '');

    // Attach traffic-light component to each light entity
    // (already defined inline in HTML but we add traffic-light attrs here
    //  to keep HTML cleaner – both ways work, HTML overrides if present)

    // Inform officer of gaze-cursor mechanics after scene load
    scene.addEventListener('loaded', () => {
        setTimeout(() => {
            showFeedback('🚔 Training scene loaded! Click Start Training to begin.', 'info');
        }, 1500);
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
   KEY-MAP   (desktop quick-actions for demo / testing)
═══════════════════════════════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
    if (e.key === 'w' || e.key === 'W') {
        // Whistle – show all active violators
        showFeedback('📢 Whistle blown! Violators: ' +
            (GAME.violatorCars.size ? [...GAME.violatorCars].join(', ') : 'None'), 'info');
        playSound('whistle-snd');
    }
    if (e.key === 'r' || e.key === 'R') {
        showFeedback(`🚦 NS light: ${GAME.lightStates.NS} | EW light: ${GAME.lightStates.EW}`, 'info');
    }
});
