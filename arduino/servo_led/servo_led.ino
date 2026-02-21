/*
 * Be polite to your safe box — Arduino Nano
 * - L0: LED 모두 끄기
 * - L1: 빨간 LED 깜빡임 (인사 감지 시)
 * - L2: 초록 LED 켜기 (3초 웃음 달성 시)
 * - 서보: 7~90도만 사용, S<각도>, R(스윕)
 */

#include <Servo.h>

Servo myServo;

// ===== 설정 =====
const int servoPin = 9;
const int redLedPin = 2;
const int greenLedPin = 3;
const int minAngle = 7;
const int maxAngle = 90;
const int speedDelay = 20;

// LED 모드: 0=끔, 1=빨간 깜빡임, 2=초록 켜기
int ledMode = 0;
unsigned long lastBlinkTime = 0;
const unsigned long BLINK_INTERVAL = 300;
bool redLedState = false;

void setup() {
  Serial.begin(9600);
  pinMode(redLedPin, OUTPUT);
  pinMode(greenLedPin, OUTPUT);
  digitalWrite(redLedPin, LOW);
  digitalWrite(greenLedPin, LOW);
  myServo.attach(servoPin);
  myServo.write(minAngle);
}

void loop() {
  // L1 모드일 때 빨간 LED 깜빡임
  if (ledMode == 1) {
    unsigned long now = millis();
    if (now - lastBlinkTime >= BLINK_INTERVAL) {
      lastBlinkTime = now;
      redLedState = !redLedState;
      digitalWrite(redLedPin, redLedState ? HIGH : LOW);
    }
  }

  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();

    if (cmd == "L0") {
      ledMode = 0;
      digitalWrite(redLedPin, LOW);
      digitalWrite(greenLedPin, LOW);
    } else if (cmd == "L1") {
      ledMode = 1;
      digitalWrite(greenLedPin, LOW);
      lastBlinkTime = millis();
    } else if (cmd == "L2") {
      ledMode = 2;
      digitalWrite(redLedPin, LOW);
      digitalWrite(greenLedPin, HIGH);
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
