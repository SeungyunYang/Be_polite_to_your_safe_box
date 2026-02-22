/*
 * Be polite to your safe box — Arduino Nano
 * - L0: LED 서서히 끄기 + 서보 초기 각도(7°) 복귀
 * - L1: 흰색 LED 숨쉬기 디밍 (0~15)
 * - L2: 흰색 LED 고정 밝기 50 (15초 후 L0 자동 복귀)
 * - 서보: 7~90도만 사용, S<각도>, R(스윕)
 */

#include <Servo.h>

Servo myServo;

// ===== 설정 =====
const int servoPin = 9;
const int ledPin = 5; // PWM 핀 사용 (밝기 제어)
const bool LED_ACTIVE_LOW = true;
const int minAngle = 7;
const int maxAngle = 90;
const int speedDelay = 20;

const unsigned long LED_ON_DURATION = 15000;
const unsigned long FADE_OUT_DURATION = 1200;
const int LED_MAX_BRIGHTNESS = 100;
const int LED_BREATH_MIN = 0;
const int LED_BREATH_MAX = 15;
const int LED_SMILE_LEVEL = 50;
const unsigned long BREATH_HALF_CYCLE_MS = 1200;

// LED 모드: 0=끔(페이드아웃), 1=숨쉬기 디밍, 2=고정 밝기 50
int ledMode = 0;
unsigned long ledOnStartTime = 0;
unsigned long breathStartTime = 0;

// 논리 밝기: 0(꺼짐) ~ LED_MAX_BRIGHTNESS
int ledLevel = 0;

// 페이드 상태
bool isFading = false;
unsigned long fadeStartTime = 0;
unsigned long fadeDuration = 0;
int fadeFrom = 0;
int fadeTo = 0;

void writeLedLevel(int level) {
  int lv = constrain(level, 0, LED_MAX_BRIGHTNESS);
  ledLevel = lv;
  int pwm = LED_ACTIVE_LOW ? (255 - lv) : lv;
  analogWrite(ledPin, pwm);
}

void startFadeTo(int targetLevel, unsigned long durationMs) {
  int target = constrain(targetLevel, 0, LED_MAX_BRIGHTNESS);
  if (durationMs == 0 || target == ledLevel) {
    isFading = false;
    writeLedLevel(target);
    return;
  }

  isFading = true;
  fadeStartTime = millis();
  fadeDuration = durationMs;
  fadeFrom = ledLevel;
  fadeTo = target;
}

void updateFade() {
  if (!isFading) return;

  unsigned long now = millis();
  unsigned long elapsed = now - fadeStartTime;
  if (elapsed >= fadeDuration) {
    isFading = false;
    writeLedLevel(fadeTo);
    return;
  }

  float t = (float)elapsed / (float)fadeDuration;
  int level = fadeFrom + (int)((fadeTo - fadeFrom) * t);
  writeLedLevel(level);
}

void updateBreathing() {
  if (ledMode != 1) return;
  if (BREATH_HALF_CYCLE_MS == 0) {
    writeLedLevel(LED_BREATH_MAX);
    return;
  }

  unsigned long fullCycle = BREATH_HALF_CYCLE_MS * 2;
  unsigned long elapsed = (millis() - breathStartTime) % fullCycle;
  unsigned long phase = elapsed <= BREATH_HALF_CYCLE_MS ? elapsed : (fullCycle - elapsed);
  float ratio = (float)phase / (float)BREATH_HALF_CYCLE_MS;
  int level = LED_BREATH_MIN + (int)((LED_BREATH_MAX - LED_BREATH_MIN) * ratio);
  writeLedLevel(level);
}

void setIdleMode(bool smoothOff) {
  ledMode = 0;
  ledOnStartTime = 0;
  if (smoothOff) {
    startFadeTo(0, FADE_OUT_DURATION);
  } else {
    isFading = false;
    writeLedLevel(0);
  }
  myServo.write(minAngle);
}

void setup() {
  Serial.begin(9600);
  pinMode(ledPin, OUTPUT);
  myServo.attach(servoPin);
  setIdleMode(false);
}

void loop() {
  updateFade();
  updateBreathing();

  // L2 모드는 15초 유지 후 자동으로 L0(끔)으로 복귀
  if (ledMode == 2) {
    unsigned long now = millis();
    if (now - ledOnStartTime >= LED_ON_DURATION) {
      setIdleMode(true);
    }
  }

  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();

    if (cmd == "L0") {
      setIdleMode(true);
    } else if (cmd == "L1") {
      ledMode = 1;
      ledOnStartTime = 0;
      isFading = false;
      breathStartTime = millis();
      writeLedLevel(LED_BREATH_MIN);
    } else if (cmd == "L2") {
      ledMode = 2;
      isFading = false;
      writeLedLevel(LED_SMILE_LEVEL);
      ledOnStartTime = millis();
    } else if (cmd.startsWith("S")) {
      int angle = cmd.substring(1).toInt();
      angle = constrain(angle, minAngle, maxAngle);
      myServo.write(angle);
    } else if (cmd == "R") {
      for (int a = minAngle; a <= maxAngle; a++) {
        myServo.write(a);
        delay(speedDelay);
      }
      delay(300);
      for (int a = maxAngle; a >= minAngle; a--) {
        myServo.write(a);
        delay(speedDelay);
      }
      delay(300);
    }
  }
}
