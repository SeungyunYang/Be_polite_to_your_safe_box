/**
 * Pose Detection 모듈 (ml5 poseNet)
 * - 카메라 영상에서 포즈 키포인트만 추출해 콜백으로 전달.
 * - 특정 행동 판단은 main.js에서 처리.
 */
const PoseDetection = (function () {
  let poseNet = null;
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
    video = videoEl;
    onPoseCallback = options.onPose || null;

    return new Promise((resolve, reject) => {
      poseNet = ml5.poseNet(video, { architecture: 'MobileNetV1', outputStride: 16 }, () => {
        resolve();
      });
      poseNet.on('pose', (poses) => {
        if (isRunning && onPoseCallback && poses.length) onPoseCallback(poses);
      });
    });
  }

  /**
   * 포즈 스트리밍 시작/중지
   */
  function start() {
    isRunning = true;
  }

  function stop() {
    isRunning = false;
  }

  /**
   * 단일 프레임에서 포즈만 가져오기 (선택용)
   */
  function singlePose() {
    if (!poseNet || !video) return Promise.resolve(null);
    return poseNet.singlePose(video);
  }

  return {
    init,
    start,
    stop,
    singlePose,
    get isRunning() { return isRunning; },
  };
})();
