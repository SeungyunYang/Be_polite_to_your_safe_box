/**
 * Be polite to your safe box — 메인 오케스트레이션
 *
 * 흐름: 대기 → (인사 감지) → LED 깜빡임 → (3초 웃음 유지) → LED 켜짐 + 서보로 금고 열기
 * - Pose: 고개 끄덕임 인사 감지
 * - Facemesh: 웃음 감지 (기존 스케치와 동일 기준), 3초 유지 시 열기
 */
(function () {
  let video = null;
  let sketch = null;
  let videoWidth = 640;

  // ----- 웃음 감지 상수 (기존 스케치와 동일) -----
  const SMILE_THRESHOLD = 0.035;
  const MOUTH_OPEN_MAX = 0.12;
  const SMILE_DURATION = 3000; // 3초
  const RESET_DURATION = 15000; // 15초 후 초기화

  // ----- 인사 감지: 고개 끄덕임(빠른 아래-위 움직임) -----
  const POSE_SCORE_MIN = 0.28;
  const NOD_DOWN_PX = 9;
  const NOD_RETURN_PX = 4;
  const NOD_WINDOW_MS = 700;
  const NOD_COOLDOWN_MS = 1200;
  const NOD_BASELINE_LERP = 0.18;

  // ----- 상태: 'idle' | 'red_blink' | 'green_open' -----
  let state = 'idle';
  let smileStartTime = null;
  let noseBaselineY = null;
  let nodPhase = 'idle';
  let nodDownTime = 0;
  let nodCooldownUntil = 0;
  let resetStartedAt = null;

  function getEl(id) {
    return document.getElementById(id);
  }

  function setState(newState) {
    const prev = state;
    state = newState;
    if (newState === 'green_open' && prev !== 'green_open') {
      resetStartedAt = Date.now();
    }
    if (newState !== 'green_open') {
      resetStartedAt = null;
    }
    updateStateUI();
    updateResetCountdown();
  }

  function updatePoseInfo(text) {
    const el = getEl('info-pose');
    if (el) el.textContent = 'Pose: ' + text;
  }

  function updateFaceInfo(text) {
    const el = getEl('info-face');
    if (el) el.textContent = 'Face: ' + text;
  }

  function updateStateUI() {
    const el = getEl('info-state');
    if (!el) return;
    const labels = {
      idle: '대기 — 인사해 주세요',
      red_blink: '인사 감지됨 — 3초간 웃어 주세요',
      green_open: '금고 열림',
    };
    el.textContent = labels[state] || state;
    el.className = 'state state-' + state;
  }

  function updateSmileProgress(progress) {
    const el = getEl('smile-progress');
    if (!el) return;
    el.style.width = Math.round(progress * 100) + '%';
  }

  function updateResetCountdown() {
    const infoEl = getEl('reset-info');
    const wrapEl = getEl('reset-progress-wrap');
    const barEl = getEl('reset-progress');
    if (!infoEl || !wrapEl || !barEl) return;

    if (state !== 'green_open' || resetStartedAt == null) {
      infoEl.hidden = true;
      wrapEl.hidden = true;
      barEl.style.width = '100%';
      return;
    }

    const elapsed = Date.now() - resetStartedAt;
    const remainingMs = Math.max(RESET_DURATION - elapsed, 0);
    const remainingSec = Math.ceil(remainingMs / 1000);
    const remainingRatio = remainingMs / RESET_DURATION;

    infoEl.hidden = false;
    wrapEl.hidden = false;
    infoEl.textContent = '초기화까지 ' + remainingSec + '초';
    barEl.style.width = Math.round(remainingRatio * 100) + '%';

    if (remainingMs <= 0) {
      setState('idle');
      updatePoseInfo('인사해 주세요.');
      updateFaceInfo('대기 중');
      updateSmileProgress(0);
      smileStartTime = null;
      if (ArduinoBridge.isConnected()) {
        ArduinoBridge.setLedOff();
        ArduinoBridge.setServo(ArduinoBridge.MIN_ANGLE);
      }
    }
  }

  /** face 예측에서 포인트 배열 얻기 */
  function getPoints(face) {
    return face.keypoints || face.scaledMesh || face.points || null;
  }

  function toXY(p) {
    if (!p) return null;
    if (Array.isArray(p)) return { x: p[0], y: p[1] };
    return { x: p.x, y: p.y };
  }

  function dist(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  function isCurrentlySmiling(predictions) {
    if (!predictions || predictions.length === 0) return false;

    const pts = getPoints(predictions[0]);
    if (!pts || pts.length < 292) return false;

    const p61 = toXY(pts[61]);
    const p291 = toXY(pts[291]);
    const p13 = toXY(pts[13]);
    const p14 = toXY(pts[14]);
    if (!p61 || !p291 || !p13 || !p14) return false;

    const w = videoWidth;
    const L = { x: w - p61.x, y: p61.y };
    const R = { x: w - p291.x, y: p291.y };
    const U = { x: w - p13.x, y: p13.y };
    const D = { x: w - p14.x, y: p14.y };

    const mouthWidth = dist(L, R);
    if (mouthWidth < 1) return false;

    const mouthCenterY = (U.y + D.y) / 2;
    const cornersAvgY = (L.y + R.y) / 2;

    const smileScore = (mouthCenterY - cornersAvgY) / mouthWidth;
    const mouthOpen = dist(U, D) / mouthWidth;

    return smileScore > SMILE_THRESHOLD && mouthOpen < MOUTH_OPEN_MAX;
  }

  /**
   * 인사 감지: 코의 짧은 아래-위 움직임(고개 끄덕임)으로 판정
   */
  function checkPoseAction(poses) {
    const pose = poses && poses[0];
    if (!pose || !pose.keypoints) return null;

    const kp = (...names) => pose.keypoints.find((k) => names.includes(k.name));
    const nose = kp('nose');

    if (!nose) return null;
    const confidenceOf = (k) => (typeof k.confidence === 'number' ? k.confidence : k.score);
    if (confidenceOf(nose) < POSE_SCORE_MIN) return null;

    const now = Date.now();
    const noseY = nose.y;

    if (noseBaselineY == null) {
      noseBaselineY = noseY;
      return null;
    }

    if (nodPhase === 'idle') {
      noseBaselineY += (noseY - noseBaselineY) * NOD_BASELINE_LERP;
    }

    const deltaY = noseY - noseBaselineY;
    if (now < nodCooldownUntil) return null;

    if (nodPhase === 'idle') {
      if (deltaY >= NOD_DOWN_PX) {
        nodPhase = 'down';
        nodDownTime = now;
      }
      return null;
    }

    if (now - nodDownTime > NOD_WINDOW_MS) {
      nodPhase = 'idle';
      return null;
    }

    if (deltaY <= NOD_RETURN_PX) {
      nodPhase = 'idle';
      nodCooldownUntil = now + NOD_COOLDOWN_MS;
      noseBaselineY = noseY;
      return 'bow';
    }

    return null;
  }

  function onPoseDetected(poses) {
    const action = checkPoseAction(poses);

    if (action === 'bow' && state === 'idle') {
      updatePoseInfo('인사 감지됨');
      setState('red_blink');
      if (ArduinoBridge.isConnected()) {
        ArduinoBridge.setLedRedBlink();
      }
    } else if (action) {
      updatePoseInfo(action);
    } else {
      if (state === 'idle') updatePoseInfo('인사해 주세요.');
      else updatePoseInfo('감지 중');
    }
  }

  function onFaceDetected(predictions) {
    const smiling = isCurrentlySmiling(predictions);

    if (state === 'red_blink') {
      if (smiling) {
        if (smileStartTime == null) smileStartTime = Date.now();
        const elapsed = Date.now() - smileStartTime;
        const progress = Math.min(elapsed / SMILE_DURATION, 1);
        updateSmileProgress(progress);
        updateFaceInfo('웃음 유지 ' + (progress * 3).toFixed(1) + ' / 3.0초');

        if (progress >= 1) {
          setState('green_open');
          smileStartTime = null;
          updateFaceInfo('웃음 완료 — 금고 열림');
          if (ArduinoBridge.isConnected()) {
            ArduinoBridge.setLedGreen();
            ArduinoBridge.openSafe();
          }
        }
      } else {
        smileStartTime = null;
        updateSmileProgress(0);
        updateFaceInfo('3초간 웃어 주세요');
      }
    } else if (state === 'green_open') {
      updateFaceInfo('금고 열림');
    } else {
      if (smiling) updateFaceInfo('웃음 감지');
      else updateFaceInfo('대기 중');
    }
  }

  function startCamera() {
    if (sketch) return;
    sketch = new p5(function (p) {
      p.setup = function () {
        const container = getEl('canvas-container');
        const w = Math.min(640, p.windowWidth - 32);
        const h = Math.floor((w * 9) / 16);
        p.createCanvas(w, h).parent(container);
        video = p.createCapture(p.VIDEO);
        video.size(w, h);
        video.hide();

        videoWidth = p.width;
        updateStateUI();

        Promise.all([
          PoseDetection.init(video.elt, { onPose: onPoseDetected }),
          Facemesh.init(video.elt, { onFace: onFaceDetected }),
        ])
          .then(() => {
            PoseDetection.start();
            Facemesh.start();
          })
          .catch((err) => console.error('ML init error:', err));
      };

      p.draw = function () {
        p.background(0);
        updateResetCountdown();
        const ready = video && video.elt && video.elt.readyState >= 2;
        if (ready) {
          p.push();
          p.translate(p.width, 0);
          p.scale(-1, 1);
          p.image(video, 0, 0, p.width, p.height);
          p.pop();
        }
      };
    });
  }

  function initButtons() {
    getEl('btn-cam').addEventListener('click', startCamera);
    getEl('btn-arduino').addEventListener('click', async () => {
      const btn = getEl('btn-arduino');
      const status = getEl('status-arduino');
      if (ArduinoBridge.isConnected()) {
        ArduinoBridge.disconnect();
        status.textContent = '아두이노: 미연결';
        status.classList.remove('connected');
        btn.textContent = '아두이노 연결';
        return;
      }
      try {
        await ArduinoBridge.connect();
        await ArduinoBridge.setLedOff();
        status.textContent = '아두이노: 연결됨';
        status.classList.add('connected');
        btn.textContent = '아두이노 연결 해제';
      } catch (e) {
        console.error(e);
        status.textContent = '아두이노: 연결 실패';
      }
    });
  }

  initButtons();
  updateStateUI();
})();
