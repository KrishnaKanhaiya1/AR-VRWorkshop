# 🚔 VR Traffic Police Training Simulator

> An immersive A-Frame VR experience for training traffic police officers at a busy Kochi 4-way intersection. Works in any WebXR browser and on **Meta Quest 3**.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-brightgreen)](https://ghaziTrueAlpha.github.io/AR-VRWorkshop)
[![A-Frame](https://img.shields.io/badge/A--Frame-1.7.1-blue)](https://aframe.io)
[![WebXR](https://img.shields.io/badge/WebXR-Ready-purple)](https://immersiveweb.dev)

---

## 🎮 How to Play

| Control | Desktop | Meta Quest 3 |
|---------|---------|--------------|
| Look around | Mouse drag | Head movement |
| Stop a car | Click on car | Point laser + trigger |
| Release a car | Click on car again | Point laser + trigger |
| Check light status | Press `R` | — |
| Blow whistle | Press `W` | — |

### Scoring
| Action | Points |
|--------|--------|
| Stop a red-light runner | **+25 pts** |
| Stop a car at yellow | **+10 pts** |
| Release a correctly stopped car | **+5 pts** |
| Let a violator escape | **−15 pts** |
| Unnecessary stop (green light) | **−5 pts** |

---

## 🗂️ File Structure

```
AR-VRWorkshop/
├── index.html        ← Main VR scene (A-Frame)
├── script.js         ← All game logic & A-Frame components
├── assets/           ← Place any local GLBs / images here
└── README.md         ← This file
```

---

## 🧱 Scene Elements

- **4-way intersection** with road, lane markings, zebra crossings
- **6 cars** across all 4 lanes (N→S, S→N, E→W, W→E)
- **4 traffic lights** with automatic NS/EW phase cycling
- **Violator cars** that randomly run red lights
- **Buildings, trees, street lamps** for immersion
- **Police booth** at the centre of the intersection
- **Gaze cursor** (desktop) + **laser controls** (Meta Quest)
- **Score HUD** (browser overlay + in-world VR panel)
- **Training timer** (90 seconds per session)

---

## 🚀 Running Locally

### Option A – VS Code Live Server
1. Open the project folder in **VS Code**
2. Install the **Live Server** extension (if not already installed)
3. Right-click `index.html` → **Open with Live Server**
4. Browser opens at `http://127.0.0.1:5500`

### Option B – Python server
```bash
cd AR-VRWorkshop
python -m http.server 8080
# Open http://localhost:8080
```

### Option C – Node.js
```bash
npx serve .
```

> ⚠️ **Always serve via HTTP, not file://**, because A-Frame's asset loading and WebXR require a proper server context.

---

## 🌐 Deploying to GitHub Pages

1. **Commit & push** all files to your `main` branch:
   ```bash
   git add .
   git commit -m "feat: VR Traffic Police Training Simulator"
   git push origin main
   ```

2. Go to your repository on **GitHub.com**

3. Navigate to: **Settings → Pages**

4. Under *Branch*, select **main** and folder **/ (root)**

5. Click **Save** — GitHub will deploy within 1–3 minutes

6. Your live URL will be:
   ```
   https://<your-username>.github.io/AR-VRWorkshop/
   ```

---

## 🥽 Loading on Meta Quest 3

1. Ensure your Quest and PC are on the **same Wi-Fi network**
2. Open **Meta Quest Browser**
3. Type in your GitHub Pages URL (e.g., `https://yourusername.github.io/AR-VRWorkshop/`)
4. The training start screen will appear
5. Tap **Begin Training**
6. Tap the **Enter VR** button (bottom right of screen)
7. Use the **controller triggers** to point and stop cars

---

## 🛠️ Customisation

### Adjust car speeds
In `index.html`, find each `car-driver` attribute and change `speed`:
```html
car-driver="speed: 0.09; ..."   <!-- slow car -->
car-driver="speed: 0.18; ..."   <!-- fast/violator car -->
```

### Change traffic light timing
In `script.js`, find the traffic-light component constants:
```js
this.GREEN_TIME  = 8000;   // 8 seconds
this.YELLOW_TIME = 2000;   // 2 seconds
this.RED_TIME    = 8000;   // 8 seconds
```

### Add local 3D models (GLB)
1. Download free GLBs from [Sketchfab](https://sketchfab.com) (filter: Free + Downloadable)
2. Put them in the `assets/` folder
3. Replace CDN references in `<a-assets>`:
   ```html
   <a-asset-item id="car-model" src="assets/your-car.glb"></a-asset-item>
   ```

---

## 📋 A-Frame Components Reference

| Component | File | Purpose |
|-----------|------|---------|
| `game-manager` | script.js | Score, timer, UI wiring |
| `traffic-light` | script.js | Light cycling (NS/EW phase) |
| `car-driver` | script.js | Movement, red-light braking, loop |
| `fine-system` | script.js | Click → stop/release → score |
| `violation-detector` | script.js | Alerts officer about red runners |

---

## 📚 Tech Stack

- **[A-Frame 1.7.1](https://aframe.io)** – WebVR/WebXR framework
- **[A-Frame Extras 7.4](https://github.com/c-frame/aframe-extras)** – Animation & movement utilities
- **[BabylonJS Asset CDN](https://github.com/BabylonJS/Assets)** – Free car GLB model
- **Vanilla JS + CSS** – UI, HUD, game logic
- **GitHub Pages** – Free hosting with HTTPS

---

*Built for Kerala Police traffic officer VR training — A-Frame × WebXR × Meta Quest 3*
