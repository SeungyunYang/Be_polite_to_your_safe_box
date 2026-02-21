/**
 * Be polite to your safe box — Arduino Nano 시리얼 브릿지 (Web Serial API)
 * - LED: L0(끄기), L1(빨간 깜빡임), L2(초록 켜기)
 * - 서보: S<각도> (7~90), R(스윕)
 */
const ArduinoBridge = (function () {
  let port = null;
  let writer = null;
  const MIN_ANGLE = 7;
  const MAX_ANGLE = 90;

  function clampAngle(angle) {
    return Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, Math.round(angle)));
  }

  async function connect() {
    if (!('serial' in navigator)) {
      throw new Error('이 브라우저는 Web Serial을 지원하지 않습니다. Chrome 권장.');
    }
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    const encoder = new TextEncoderStream();
    encoder.readable.pipeTo(port.writable);
    writer = encoder.writable.getWriter();
    return true;
  }

  function disconnect() {
    if (writer) {
      writer.close().catch(() => {});
      writer = null;
    }
    if (port) {
      port.close();
      port = null;
    }
  }

  function isConnected() {
    return port != null && writer != null;
  }

  async function sendLine(line) {
    if (!writer) return;
    await writer.write(line + '\n');
  }

  /** LED 모두 끄기 */
  async function setLedOff() {
    await sendLine('L0');
  }

  /** 빨간 LED 깜빡임 (인사 감지 시) */
  async function setLedRedBlink() {
    await sendLine('L1');
  }

  /** 초록 LED 켜기 (3초 웃음 달성 시) */
  async function setLedGreen() {
    await sendLine('L2');
  }

  /** 서보 각도 (7~90만 허용) */
  async function setServo(angle) {
    const a = clampAngle(angle);
    await sendLine('S' + a);
  }

  /** 서보 스윕 (7°→90°→7°). 금고 열기 시 90°만 쓰려면 setServo(90) 사용. */
  async function servoSweep() {
    await sendLine('R');
  }

  /** 금고 열기: 서보를 90°로 이동 */
  async function openSafe() {
    await sendLine('S' + MAX_ANGLE);
  }

  return {
    connect,
    disconnect,
    isConnected,
    setLedOff,
    setLedRedBlink,
    setLedGreen,
    setServo,
    servoSweep,
    openSafe,
    MIN_ANGLE,
    MAX_ANGLE,
  };
})();
