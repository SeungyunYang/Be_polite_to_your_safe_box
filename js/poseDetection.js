/**
 * Pose Detection 모듈 (ml5 bodyPose)
 * - 카메라 영상에서 포즈 키포인트만 추출해 콜백으로 전달.
 * - 특정 행동 판단은 main.js에서 처리.
 */
const PoseDetection = (function () {
  let bodyPose = null;
  let video = null;
  let onPoseCallback = null;
  let isRunning = false;

  /**
   * poseNet 초기화
   * @param {HTMLVideoElement} videoEl - 비디오 엘리먼트
   * @param {Object} options - { onPose: (poses) => {} }
   */
  function init(videoEl, options = {}) {
    if (!videoEl || !ml5) return Promise.reject(new Error('video 또는 ml5 없음'));
    if (typeof ml5.bodyPose !== 'function') return Promise.reject(new Error('ml5.bodyPose를 찾을 수 없음'));
    video = videoEl;
    onPoseCallback = options.onPose || null;

    bodyPose = ml5.bodyPose(options.modelOptions || {});
    if (bodyPose && bodyPose.ready && typeof bodyPose.ready.then === 'function') {
      return bodyPose.ready;
    }
    return Promise.resolve();
  }

  /**
   * 포즈 스트리밍 시작/중지
   */
  function start() {
    if (!bodyPose || !video) return;
    isRunning = true;
    bodyPose.detectStart(video, (poses) => {
      if (isRunning && onPoseCallback) onPoseCallback(poses || []);
    });
  }

  function stop() {
    if (bodyPose && typeof bodyPose.detectStop === 'function') {
      bodyPose.detectStop();
    }
    isRunning = false;
  }

  /**
   * 단일 프레임에서 포즈만 가져오기 (선택용)
   */
  function singlePose() {
    if (!bodyPose || !video || typeof bodyPose.detect !== 'function') return Promise.resolve(null);
    return bodyPose.detect(video).then((poses) => (poses && poses[0]) || null);
  }

  return {
    init,
    start,
    stop,
    singlePose,
    get isRunning() { return isRunning; },
  };
})();
