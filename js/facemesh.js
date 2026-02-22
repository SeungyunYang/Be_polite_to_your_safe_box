/**
 * Facemesh 모듈 (ml5 facemesh)
 * - 얼굴 랜드마크만 추출해 콜백으로 전달.
 * - 표정/제스처 판단은 main.js에서 처리.
 */
const Facemesh = (function () {
  let faceMesh = null;
  let video = null;
  let onFaceCallback = null;
  let isRunning = false;

  /**
   * facemesh 초기화
   * @param {HTMLVideoElement} videoEl - 비디오 엘리먼트
   * @param {Object} options - { onFace: (predictions) => {} }
   */
  function init(videoEl, options = {}) {
    if (!videoEl || !ml5) return Promise.reject(new Error('video 또는 ml5 없음'));
    if (typeof ml5.faceMesh !== 'function') return Promise.reject(new Error('ml5.faceMesh를 찾을 수 없음'));
    video = videoEl;
    onFaceCallback = options.onFace || null;

    faceMesh = ml5.faceMesh(options.modelOptions || { maxFaces: 1, refineLandmarks: false, flipHorizontal: false });
    if (faceMesh && faceMesh.ready && typeof faceMesh.ready.then === 'function') {
      return faceMesh.ready;
    }
    return Promise.resolve();
  }

  /**
   * 얼굴 스트리밍 시작/중지
   */
  function start() {
    if (!faceMesh || !video) return;
    isRunning = true;
    faceMesh.detectStart(video, (results) => {
      if (isRunning && onFaceCallback) onFaceCallback(results || []);
    });
  }

  function stop() {
    if (faceMesh && typeof faceMesh.detectStop === 'function') {
      faceMesh.detectStop();
    }
    isRunning = false;
  }

  /**
   * 단일 프레임에서 얼굴만 예측 (선택용)
   */
  function predict() {
    if (!faceMesh || !video || typeof faceMesh.detect !== 'function') return Promise.resolve([]);
    return faceMesh.detect(video);
  }

  return {
    init,
    start,
    stop,
    predict,
    get isRunning() { return isRunning; },
  };
})();
