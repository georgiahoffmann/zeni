# Firmware do ZENI

Este é o programa que roda no ESP32 dentro do ZENI. Ele lê o sensor de movimento (MPU-6050 ou MPU-6500) e manda os dados ao site por Bluetooth Low Energy. O site conecta pelo Web Bluetooth (`zeni-site/src/zeni-dispositivo.js`), sem app nem servidor no meio.

## O que precisa

| Peça | Para quê |
|---|---|
| ESP32-S3 (ou ESP32-C3) | Bluetooth e processamento |
| MPU-6050 / MPU-6500 | sensor de giro e aceleração |
| Bateria de lítio 3,7 V + módulo carregador TP4056 (com proteção) | energia |
| Diodo Schottky 1N5819 | impede que o 5 V do USB volte para a bateria |
| Interruptor | liga e desliga |
| 2 resistores de 100 kΩ (opcional) | o site mostra a % da bateria |
| Fio do INT do MPU (opcional) | chacoalhar o ZENI o acorda do sono |

## Ligações (ESP32-S3)

```
MPU VCC → 3V3        MPU GND → GND
MPU SDA → IO1        MPU SCL → IO2
MPU INT → IO14       (opcional, ative -DMPU_INT_PIN=14)

Bateria → TP4056 B+ / B−
TP4056 OUT+ → interruptor → diodo (faixa para o ESP) → 5V do ESP
TP4056 OUT− → GND do ESP

Medidor de bateria (opcional, já ativo no firmware do S3):
  OUT+ (depois do interruptor) ─ 100 kΩ ─┬─ 100 kΩ ─ GND
                                         └─ IO3
```

Sem os dois resistores, o ZENI percebe que o IO3 está solto e manda "sem medida". O site mostra então "ZENI conectado" sem a porcentagem. No ESP32-C3, o MPU vai em SDA = IO4 e SCL = IO5.

## Gravar

```bash
cd firmware
pio run -e s3 -t upload
pio device monitor        # log: "# anunciando como ZENI-XXXX", "# app conectado"...
```

Pelo cabo, o firmware continua mandando a linha CSV de sempre (`ax,ay,az,gx,gy,gz`), útil para depurar sem Bluetooth.

## Como se comporta

- **Ligou, anunciou.** Anuncia como `ZENI-XXXX`, com os quatro últimos dígitos do endereço da placa, para não confundir vários ZENI na mesma sala. Depois de desconectar, volta a anunciar sozinho.
- **Posição inicial.** O site manda o comando `C` e o ZENI mede o próprio repouso por 3 segundos. Se ele se mexer (o giro varia ou a aceleração foge de 1 g), responde "mexeu" e o site pede para tentar de novo. Se der certo, o resultado fica guardado na placa e vale até depois de desligar.
- **Sensor solto.** Se o MPU parar de responder, o ZENI avisa "sem sensor" e tenta de novo a cada segundo, sem derrubar o Bluetooth.
- **Sono.** Sem conexão com o site, sem cabo e parado por 10 minutos, o ZENI dorme e consome perto de 0,1 mA no chip (o LED de energia da placa e o regulador ainda gastam). Acorda pelo botão BOOT, desligando e ligando, ou chacoalhando se o INT estiver ligado.

## Protocolo BLE

O serviço é `7a3e0001-5a2b-4c8e-9b1f-2e6d0c5a9e10`.

| Característica | UUID | Tipo | Conteúdo |
|---|---|---|---|
| Dados | `…0002…` | notify, 50 Hz | 20 bytes, little-endian (tabela abaixo) |
| Comando | `…0003…` | write | 1 byte: `C` calibrar, `Z` apagar calibração, `S` dormir, `I` piscar o LED |
| Estado | `…0004…` | read + notify | `[calibração, bateria, flags, 0]` |
| Info | `…0005…` | read | JSON `{"fw","sensor","hz","bateria","despertar"}` |

Também há o serviço padrão de bateria (`0x180F`).

Pacote de dados:

| Byte | Campo | Unidade |
|---|---|---|
| 0 | sequência | 0–255, para contar pacotes perdidos |
| 1 | flags | 1 sensor ok · 2 calibrado · 4 calibrando · 8 USB · 16 bateria fraca |
| 2–7 | aceleração x, y, z | int16, mg |
| 8–13 | giro x, y, z | int16, 0,1 °/s (sem o bias) |
| 14–17 | roll, pitch | int16, 0,01 ° |
| 18 | bateria | 0–100, 255 = sem medida |
| 19 | calibração | 0 nunca · 1 medindo · 2 ok · 3 mexeu · 4 sem sensor |

Escalas do sensor: giro ±500 °/s e aceleração ±4 g, para que um giro rápido do punho ou uma batida na mesa não saturem.

Ao mudar o protocolo, mude também `zeni-site/src/zeni-dispositivo.js`.
