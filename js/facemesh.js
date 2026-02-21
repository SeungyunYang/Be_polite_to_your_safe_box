/**
 * Facemesh 모듈 (ml5 facemesh)
 * - 얼굴 랜드마크만 추출해 콜백으로 전달.
 * - 표정/제스처 판단은 main.js에서 처리.
 */
const Facemesh = (function () {
  let facemesh = null;
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
    video = videoEl;
    onFaceCallback = options.onFace || null;

    return new Promise((resolve, reject) => {
      facemesh = ml5.facemesh(video, { maxFaces: 1 }, () => {
        resolve();
      });
      facemesh.on('face', (results) => {
        if (isRunning && onFaceCallback && results.length) onFaceCallback(results);
      });
    });
  }

  /**
   * 얼굴 스트리밍 시작/중지
   */
  function start() {
    isRunning = true;
  }

  function stop() {
    isRunning = false;
  }

  /**
   * 단일 프레임에서 얼굴만 예측 (선택용)
   */
  function predict() {
    if (!facemesh || !video) return Promise.resolve([]);
    return facemesh.predict(video);
  }

  return {
    init,
    start,
    stop,
    predict,
    get isRunning() { return isRunning; },
  };
})();
