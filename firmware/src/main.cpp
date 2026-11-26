// Firmware do ZENI.
// Lê o MPU-6050/6500 a 100 Hz, estima a inclinação (roll/pitch) e envia os dados ao app por BLE a 50 Hz.
// O protocolo está em firmware/README.md e é espelhado em zeni-site/src/zeni-dispositivo.js: mudou um, mude o outro.
#include <Arduino.h>
#include <NimBLEDevice.h>
#include <Preferences.h>
#include <Wire.h>
#include <esp_sleep.h>

#ifndef SDA_PIN
#define SDA_PIN 1
#endif
#ifndef SCL_PIN
#define SCL_PIN 2
#endif
#ifndef BAT_ADC_PIN
#define BAT_ADC_PIN -1  // sem pino de bateria: vai como "desconhecida" (255)
#endif
#ifndef MPU_INT_PIN
#define MPU_INT_PIN -1  // sem fio no INT: só o botão BOOT (ou desligar e ligar) acorda do sono
#endif
#ifndef LED_PIN
#define LED_PIN -1
#endif
#if CONFIG_IDF_TARGET_ESP32C3
#define WAKE_BUTTON_PIN 9  // botão BOOT do C3 (não acorda do sono profundo: lá, desligue e ligue)
#else
#define WAKE_BUTTON_PIN 0  // botão BOOT da placa
#endif

// Acorda quando `pino` ficar no `nivel`. O C3 não tem ext0: usa o despertar por GPIO (só pinos 0 a 5).
static void despertarPor(int pino, int nivel) {
#if SOC_PM_SUPPORT_EXT0_WAKEUP
  esp_sleep_enable_ext0_wakeup((gpio_num_t)pino, nivel);
#else
  if (pino <= 5) esp_deep_sleep_enable_gpio_wakeup(1ULL << pino, nivel ? ESP_GPIO_WAKEUP_GPIO_HIGH : ESP_GPIO_WAKEUP_GPIO_LOW);
#endif
}

static const char *FW_VERSION = "1.0.0";

// ---- UUIDs (iguais aos do app) ----
#define UUID_SERVICO "7a3e0001-5a2b-4c8e-9b1f-2e6d0c5a9e10"
#define UUID_DADOS   "7a3e0002-5a2b-4c8e-9b1f-2e6d0c5a9e10"  // notify, 20 bytes, 50 Hz
#define UUID_COMANDO "7a3e0003-5a2b-4c8e-9b1f-2e6d0c5a9e10"  // write, 1 byte
#define UUID_ESTADO  "7a3e0004-5a2b-4c8e-9b1f-2e6d0c5a9e10"  // read + notify, 4 bytes
#define UUID_INFO    "7a3e0005-5a2b-4c8e-9b1f-2e6d0c5a9e10"  // read, texto JSON

// Comandos que o app escreve
enum : uint8_t { CMD_CALIBRAR = 'C', CMD_DORMIR = 'S', CMD_PISCAR = 'I', CMD_ZERAR_CALIBRACAO = 'Z' };
// Estado da calibração (byte 0 do ESTADO)
enum : uint8_t { CAL_NUNCA = 0, CAL_MEDINDO = 1, CAL_OK = 2, CAL_MEXEU = 3, CAL_SEM_SENSOR = 4 };
// Bits de flags (pacote de dados e ESTADO)
enum : uint8_t { F_SENSOR_OK = 1, F_CALIBRADO = 2, F_CALIBRANDO = 4, F_USB = 8, F_BATERIA_FRACA = 16 };

// ---- Tempos ----
static const uint32_t AMOSTRA_US = 10000;               // 100 Hz
static const uint32_t CALIBRACAO_MS = 3000;             // "apoie na mesa por 3 segundos"
static const uint32_t SONO_SEM_USO_MS = 10UL * 60 * 1000; // 10 min sem app e parado: dorme
static const float PARADO_DPS = 4.0f;                   // abaixo disto (com bias tirado) conta como parado

// ---- MPU ----
static uint8_t mpuAddr = 0x68;
static bool sensorOk = false;
static uint32_t proximaTentativaSensor = 0;

static bool mpuWrite(uint8_t reg, uint8_t v) {
  Wire.beginTransmission(mpuAddr);
  Wire.write(reg);
  Wire.write(v);
  return Wire.endTransmission() == 0;
}

static bool mpuIniciar() {
  for (uint8_t a : {0x68, 0x69}) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) {
      mpuAddr = a;
      mpuWrite(0x6B, 0x80);  // reset
      delay(100);
      mpuWrite(0x6B, 0x01);  // acorda, relógio do giroscópio X
      mpuWrite(0x6C, 0x00);  // todos os eixos ligados
      mpuWrite(0x1A, 0x03);  // filtro passa-baixa ~44 Hz
      mpuWrite(0x1B, 0x08);  // giroscópio ±500 °/s (giro de punho rápido passa de 250)
      mpuWrite(0x1C, 0x08);  // acelerômetro ±4 g (bater na mesa passa de 2 g)
      return true;
    }
  }
  return false;
}

static const float ESCALA_ACC = 1.0f / 8192.0f;  // ±4 g
static const float ESCALA_GIRO = 1.0f / 65.5f;   // ±500 °/s

static bool mpuLer(float a[3], float g[3]) {
  Wire.beginTransmission(mpuAddr);
  Wire.write(0x3B);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom(mpuAddr, (uint8_t)14) != 14) return false;
  int16_t v[7];
  for (int i = 0; i < 7; i++) v[i] = (int16_t)((Wire.read() << 8) | Wire.read());
  for (int i = 0; i < 3; i++) {
    a[i] = v[i] * ESCALA_ACC;
    g[i] = v[i + 4] * ESCALA_GIRO;
  }
  return true;
}

// ---- Calibração (bias do giroscópio), guardada na memória da placa ----
static Preferences prefs;
static float bias[3] = {0, 0, 0};
static uint8_t estadoCal = CAL_NUNCA;
static bool calibrando = false;
static uint32_t calInicio = 0;
static double calSoma[3], calSomaQ[3];
static uint32_t calN = 0;

static void calibracaoCarregar() {
  prefs.begin("zeni", true);
  if (prefs.getBool("cal", false)) {
    bias[0] = prefs.getFloat("bx", 0);
    bias[1] = prefs.getFloat("by", 0);
    bias[2] = prefs.getFloat("bz", 0);
    estadoCal = CAL_OK;
  }
  prefs.end();
}

static void calibracaoGuardar() {
  prefs.begin("zeni", false);
  prefs.putBool("cal", true);
  prefs.putFloat("bx", bias[0]);
  prefs.putFloat("by", bias[1]);
  prefs.putFloat("bz", bias[2]);
  prefs.end();
}

static void calibracaoZerar() {
  prefs.begin("zeni", false);
  prefs.clear();
  prefs.end();
  bias[0] = bias[1] = bias[2] = 0;
  estadoCal = CAL_NUNCA;
}

// ---- Orientação ----
static float roll = 0, pitch = 0;
static bool orientacaoIniciada = false;

static void atualizarOrientacao(const float a[3], const float g[3], float dt) {
  float rAcc = atan2f(a[1], a[2]) * RAD_TO_DEG;
  float pAcc = atan2f(-a[0], sqrtf(a[1] * a[1] + a[2] * a[2])) * RAD_TO_DEG;
  if (!orientacaoIniciada) {
    roll = rAcc;
    pitch = pAcc;
    orientacaoIniciada = true;
    return;
  }
  // Filtro complementar. Perto de ±180° o roll do acelerômetro "dá a volta": corrige a diferença.
  float r = roll + g[0] * dt;
  float d = rAcc - r;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  roll = r + 0.02f * d;
  if (roll > 180) roll -= 360;
  if (roll < -180) roll += 360;
  pitch = 0.98f * (pitch + g[1] * dt) + 0.02f * pAcc;
}

// ---- Bateria ----
static uint8_t bateria = 255;  // 0-100, 255 = desconhecida
static bool usbLigado() { return (bool)Serial; }

static uint8_t lerBateria() {
#if BAT_ADC_PIN >= 0
  // Tem divisor ligado? Com o pull-down interno, um pino solto cai a ~0 V; com o divisor, fica bem acima.
  pinMode(BAT_ADC_PIN, INPUT_PULLDOWN);
  delayMicroseconds(200);
  bool temDivisor = analogReadMilliVolts(BAT_ADC_PIN) > 300;
  pinMode(BAT_ADC_PIN, INPUT);
  if (!temDivisor) return 255;
  delayMicroseconds(200);
  static float filtrada = 0;
  uint32_t mv = analogReadMilliVolts(BAT_ADC_PIN) * 2;  // divisor 100k/100k
  filtrada = filtrada == 0 ? mv : filtrada * 0.9f + mv * 0.1f;
  // Curva aproximada de uma célula de lítio em descarga leve
  static const uint16_t mvTab[] = {3300, 3500, 3600, 3700, 3750, 3800, 3870, 3950, 4050, 4150};
  static const uint8_t pctTab[] = {0, 5, 10, 20, 30, 40, 55, 70, 85, 100};
  if (filtrada <= mvTab[0]) return 0;
  for (int i = 1; i < 10; i++) {
    if (filtrada <= mvTab[i])
      return pctTab[i - 1] + (uint8_t)((filtrada - mvTab[i - 1]) * (pctTab[i] - pctTab[i - 1]) / (mvTab[i] - mvTab[i - 1]));
  }
  return 100;
#else
  return 255;
#endif
}

// ---- BLE ----
static NimBLEServer *servidor;
static NimBLECharacteristic *chDados, *chEstado, *chInfo;
static volatile bool conectado = false;
static volatile bool inscrito = false;
static volatile uint8_t comandoPendente = 0;

static uint8_t flagsAtuais() {
  uint8_t f = 0;
  if (sensorOk) f |= F_SENSOR_OK;
  if (estadoCal == CAL_OK) f |= F_CALIBRADO;
  if (calibrando) f |= F_CALIBRANDO;
  if (usbLigado()) f |= F_USB;
  if (bateria != 255 && bateria <= 15) f |= F_BATERIA_FRACA;
  return f;
}

static void publicarEstado() {
  uint8_t e[4] = {estadoCal, bateria, flagsAtuais(), 0};
  chEstado->setValue(e, sizeof(e));
  if (conectado) chEstado->notify();
}

class AoConectar : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer *s, NimBLEConnInfo &info) override {
    conectado = true;
    // Intervalo curto (7,5–15 ms) para 50 pacotes/s sem atraso; o celular pode negociar outro.
    s->updateConnParams(info.getConnHandle(), 6, 12, 0, 200);
    Serial.println("# app conectado");
  }
  void onDisconnect(NimBLEServer *s, NimBLEConnInfo &info, int motivo) override {
    conectado = false;
    inscrito = false;
    Serial.printf("# app desconectado (%d)\n", motivo);
    NimBLEDevice::startAdvertising();
  }
};

class AoInscrever : public NimBLECharacteristicCallbacks {
  void onSubscribe(NimBLECharacteristic *c, NimBLEConnInfo &info, uint16_t valor) override {
    if (c == chDados) inscrito = valor != 0;
  }
  void onWrite(NimBLECharacteristic *c, NimBLEConnInfo &info) override {
    std::string v = c->getValue();
    if (!v.empty()) comandoPendente = (uint8_t)v[0];
  }
};

static void bleIniciar() {
  uint64_t mac = ESP.getEfuseMac();
  char nome[16];
  snprintf(nome, sizeof(nome), "ZENI-%02X%02X", (uint8_t)(mac >> 32), (uint8_t)(mac >> 40));  // vários ZENI na mesma sala
  NimBLEDevice::init(nome);
  NimBLEDevice::setPower(9);
  NimBLEDevice::setMTU(64);

  servidor = NimBLEDevice::createServer();
  servidor->setCallbacks(new AoConectar());
  NimBLEService *svc = servidor->createService(UUID_SERVICO);
  static AoInscrever cb;
  chDados = svc->createCharacteristic(UUID_DADOS, NIMBLE_PROPERTY::NOTIFY);
  chDados->setCallbacks(&cb);
  NimBLECharacteristic *chCmd = svc->createCharacteristic(UUID_COMANDO, NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR);
  chCmd->setCallbacks(&cb);
  chEstado = svc->createCharacteristic(UUID_ESTADO, NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY);
  chInfo = svc->createCharacteristic(UUID_INFO, NIMBLE_PROPERTY::READ);
  char info[160];
  snprintf(info, sizeof(info), "{\"fw\":\"%s\",\"sensor\":\"MPU6050\",\"hz\":50,\"bateria\":%s,\"despertar\":\"%s\"}", FW_VERSION,
           BAT_ADC_PIN >= 0 ? "true" : "false", MPU_INT_PIN >= 0 ? "movimento" : "botao");
  chInfo->setValue(info);
  svc->start();

  // Bateria no serviço padrão também (o celular mostra em alguns sistemas)
  NimBLEService *bat = servidor->createService("180F");
  bat->createCharacteristic("2A19", NIMBLE_PROPERTY::READ)->setValue((uint8_t)(bateria == 255 ? 100 : bateria));
  bat->start();

  NimBLEAdvertising *adv = NimBLEDevice::getAdvertising();
  adv->setName(nome);
  adv->addServiceUUID(UUID_SERVICO);
  adv->enableScanResponse(true);
  adv->start();
  Serial.printf("# anunciando como %s\n", nome);
}

// ---- Sono profundo ----
static void piscar(int vezes) {
#if LED_PIN >= 0
  for (int i = 0; i < vezes; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(120);
    digitalWrite(LED_PIN, LOW);
    delay(120);
  }
#endif
}

static void dormir() {
  Serial.println("# dormindo");
  Serial.flush();
  NimBLEDevice::deinit(true);
#if MPU_INT_PIN >= 0
  // MPU em ciclo de baixo consumo, com interrupção de movimento: chacoalhar acorda
  mpuWrite(0x1F, 20);    // limiar de movimento (~40 mg)
  mpuWrite(0x20, 1);     // duração 1 ms
  mpuWrite(0x37, 0x20);  // INT ativo em nível alto, travado até ler
  mpuWrite(0x38, 0x40);  // só a interrupção de movimento
  mpuWrite(0x6C, 0x47);  // acorda a 5 Hz, giroscópios em espera
  mpuWrite(0x6B, 0x20);  // modo ciclo
  despertarPor(MPU_INT_PIN, 1);
#else
  mpuWrite(0x6B, 0x40);  // MPU dormindo (economiza ~3,5 mA)
  despertarPor(WAKE_BUTTON_PIN, 0);
#endif
  esp_deep_sleep_start();
}

// ---- Programa ----
void setup() {
  Serial.begin(115200);
#if LED_PIN >= 0
  pinMode(LED_PIN, OUTPUT);
#endif
  pinMode(WAKE_BUTTON_PIN, INPUT_PULLUP);
  Wire.begin(SDA_PIN, SCL_PIN, 400000);
  sensorOk = mpuIniciar();
  if (!sensorOk) estadoCal = CAL_SEM_SENSOR;
  calibracaoCarregar();
  if (!sensorOk) estadoCal = CAL_SEM_SENSOR;
  bateria = lerBateria();
  bleIniciar();
  publicarEstado();
  piscar(2);
}

static void iniciarCalibracao() {
  if (!sensorOk) {
    estadoCal = CAL_SEM_SENSOR;
    publicarEstado();
    return;
  }
  calibrando = true;
  calInicio = millis();
  calN = 0;
  for (int i = 0; i < 3; i++) calSoma[i] = calSomaQ[i] = 0;
  estadoCal = CAL_MEDINDO;
  publicarEstado();
}

static void passoCalibracao(const float a[3], const float gBruto[3]) {
  for (int i = 0; i < 3; i++) {
    calSoma[i] += gBruto[i];
    calSomaQ[i] += (double)gBruto[i] * gBruto[i];
  }
  calN++;
  float norma = sqrtf(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
  bool mexeu = fabsf(norma - 1.0f) > 0.12f;  // levantou ou bateu: não está apoiado
  if (!mexeu && millis() - calInicio < CALIBRACAO_MS) return;
  calibrando = false;
  float desvioMax = 0;
  float media[3];
  for (int i = 0; i < 3; i++) {
    media[i] = calSoma[i] / calN;
    float var = calSomaQ[i] / calN - media[i] * media[i];
    desvioMax = max(desvioMax, sqrtf(max(var, 0.0f)));
  }
  // Parado de verdade: o giroscópio quase não varia e o bias é plausível para um MPU (< 15 °/s)
  bool ok = !mexeu && desvioMax < 1.5f && fabsf(media[0]) < 15 && fabsf(media[1]) < 15 && fabsf(media[2]) < 15;
  if (ok) {
    for (int i = 0; i < 3; i++) bias[i] = media[i];
    calibracaoGuardar();
    estadoCal = CAL_OK;
    orientacaoIniciada = false;  // recomeça a inclinação pelo acelerômetro
  } else {
    estadoCal = CAL_MEXEU;
  }
  Serial.printf("# calibracao %s (desvio %.2f, n=%u)\n", ok ? "ok" : "mexeu", desvioMax, calN);
  publicarEstado();
}

static inline int16_t sat16(float v) { return (int16_t)constrain(lroundf(v), -32768, 32767); }

void loop() {
  static uint32_t proxima = micros();
  static uint32_t ultimoUso = millis();
  static uint32_t ultimaBateria = 0;
  static uint8_t seq = 0;
  static bool par = false;

  uint8_t cmd = comandoPendente;
  if (cmd) {
    comandoPendente = 0;
    if (cmd == CMD_CALIBRAR) iniciarCalibracao();
    else if (cmd == CMD_DORMIR) dormir();
    else if (cmd == CMD_PISCAR) piscar(4);
    else if (cmd == CMD_ZERAR_CALIBRACAO) {
      calibracaoZerar();
      publicarEstado();
    }
  }

  if ((int32_t)(micros() - proxima) < 0) return;
  proxima += AMOSTRA_US;
  if ((int32_t)(micros() - proxima) > 100000) proxima = micros();  // atrasou muito (ex.: I2C travado): ressincroniza

  // Sensor caiu (fio solto)? Tenta de novo a cada 1 s, sem travar o Bluetooth.
  if (!sensorOk) {
    if (millis() >= proximaTentativaSensor) {
      proximaTentativaSensor = millis() + 1000;
      sensorOk = mpuIniciar();
      if (sensorOk && estadoCal == CAL_SEM_SENSOR) estadoCal = CAL_NUNCA, calibracaoCarregar();
      publicarEstado();
    }
    return;
  }

  float a[3], gBruto[3];
  if (!mpuLer(a, gBruto)) {
    sensorOk = false;
    estadoCal = CAL_SEM_SENSOR;
    publicarEstado();
    return;
  }
  float g[3] = {gBruto[0] - bias[0], gBruto[1] - bias[1], gBruto[2] - bias[2]};
  if (calibrando) passoCalibracao(a, gBruto);
  atualizarOrientacao(a, g, AMOSTRA_US / 1e6f);

  if (millis() - ultimaBateria > 5000) {
    ultimaBateria = millis();
    uint8_t b = lerBateria();
    if (b != bateria) {
      bateria = b;
      publicarEstado();
    }
  }

  // Sono: sem app conectado, sem USB e parado por 10 min
  float giro = sqrtf(g[0] * g[0] + g[1] * g[1] + g[2] * g[2]);
  if (conectado || giro > PARADO_DPS || usbLigado()) ultimoUso = millis();
  if (millis() - ultimoUso > SONO_SEM_USO_MS) dormir();

  // 50 Hz para o app (uma amostra sim, uma não)
  par = !par;
  if (!par) return;

  if (conectado && inscrito) {
    uint8_t p[20];
    int16_t v[8] = {sat16(a[0] * 1000), sat16(a[1] * 1000), sat16(a[2] * 1000),  // mg
                    sat16(g[0] * 10),   sat16(g[1] * 10),   sat16(g[2] * 10),    // 0,1 °/s
                    sat16(roll * 100),  sat16(pitch * 100)};                      // 0,01 °
    p[0] = seq++;
    p[1] = flagsAtuais();
    memcpy(p + 2, v, 16);  // little-endian
    p[18] = bateria;
    p[19] = estadoCal;
    chDados->setValue(p, sizeof(p));
    chDados->notify();
  }

  // Pelo cabo, o mesmo CSV de sempre (útil para depurar sem Bluetooth)
  if (usbLigado()) Serial.printf("%.4f,%.4f,%.4f,%.3f,%.3f,%.3f\n", a[0], a[1], a[2], g[0], g[1], g[2]);
}
