// Teste sem hardware: gera, exercício a exercício, o que o MPU mediria num movimento real (com ruído e, no D,
// as batidas na mesa) e confere tamanho, ritmo, suavidade e "pulos" (quanto a barra salta de uma janela para outra).
// Rodar: node tools/testar-zeni.mjs
import { avaliar } from '../src/avaliacao.js'
import { definirExercicio, fecharJanela, receberPacote } from '../src/zeni-dispositivo.js'

const HZ = 50
const rad = Math.PI / 180
let seq = 0
let ruido = 0
const r = () => {
  ruido = (ruido * 1103515245 + 12345) % 2147483648
  return ruido / 2147483648 - 0.5
}
function pacote(a, g) {
  const dv = new DataView(new ArrayBuffer(20))
  dv.setUint8(0, seq++ & 255)
  dv.setUint8(1, 3)
  a.forEach((v, i) => dv.setInt16(2 + i * 2, Math.round((v + r() * 0.01) * 1000), true))
  g.forEach((v, i) => dv.setInt16(8 + i * 2, Math.round((v + r() * 1) * 10), true))
  dv.setUint8(18, 80)
  dv.setUint8(19, 2)
  return dv
}

// Cada movimento devolve, para o tempo t: aceleração e giro no corpo do sensor.
// O ZENI de pé: z do sensor para cima (montagem padrão).
const periodo = 1.6
const fase = (t) => (2 * Math.PI * t) / periodo
const MOVIMENTOS = {
  // A/C/E: punho girando em torno do eixo longo (vertical): o acelerômetro fica em 1 g, só o giro z muda
  A: (t) => ({ a: [0, 0, 1], g: [0, 0, 70 * 2 * Math.PI / periodo * Math.cos(fase(t))] }),
  // C com o ZENI inclinando para os lados (punho dobrando): a gravidade "passeia" no sensor — antes dava saltos
  C: (t) => {
    const th = 40 * rad * Math.sin(fase(t))
    return { a: [0, Math.sin(th), Math.cos(th)], g: [40 * (2 * Math.PI / periodo) * Math.cos(fase(t)), 0, 0] }
  },
  // B: levantar 35 cm (cintura ao ombro) e voltar, sem girar
  B: (t) => ({ a: [0, 0, 1 + (0.35 / 2) * (2 * Math.PI / periodo) ** 2 * Math.cos(fase(t)) / 9.81], g: [0, 0, 0] }),
  // D: subir 6 cm e bater na mesa a cada ciclo (pico de 3 g por 1 amostra)
  D: (t) => {
    const u = (t % periodo) / periodo
    const bate = u < 1 / HZ / periodo
    return { a: [0, 0, bate ? 3 : 1 + (0.06 / 2) * (2 * Math.PI / periodo) ** 2 * Math.cos(fase(t)) / 9.81], g: [bate ? 40 : 0, 0, 0] }
  },
  // F: antebraço na mesa girando ±35° em torno da vertical
  F: (t) => ({ a: [0, 0, 1], g: [0, 0, 35 * (2 * Math.PI / periodo) * Math.cos(fase(t))] }),
}

function sessao(id, mov, { parado = false, tremor = 0 } = {}) {
  definirExercicio(id)
  const res = { amostras: [], oscilacao: [], tremores: [], pausas: 0, ritmoSeg: periodo }
  for (let i = 0; i < 30 * HZ; i++) {
    const t = i / HZ
    const { a, g } = parado ? { a: [0, 0, 1], g: [0, 0, 0] } : mov(t)
    const tr = tremor * Math.sin(2 * Math.PI * 5 * t)
    receberPacote(pacote(a, [g[0] + tr, g[1] + tr * 0.5, g[2]]))
    if (i % 12 === 11) {
      const j = fecharJanela()
      if (i < HZ * 2) continue // os 2 primeiros segundos: filtros assentando
      res.amostras.push(Math.round(j.tamanho))
      res.oscilacao.push(j.oscilacao)
      res.tremores.push(Math.round(j.tremor))
    }
  }
  return res
}

const pulos = (v) => v.slice(1).reduce((s, x, i) => s + Math.abs(x - v[i]), 0) / (v.length - 1)
console.log('exercício'.padEnd(30), 'tamanho  ritmo  suavidade  nota   pulos/janela')
// aquece a orientação
for (let i = 0; i < 100; i++) receberPacote(pacote([0, 0, 1], [0, 0, 0]))
for (const [id, mov] of Object.entries(MOVIMENTOS)) {
  for (const [nome, op] of [['', {}], [' parado', { parado: true }], [' com tremor', { tremor: 25 }]]) {
    const s = sessao(id, mov, op)
    const a = avaliar(s, 60)
    console.log(`${id}${nome}`.padEnd(30), String(a.tamanho).padStart(7), String(a.ritmo).padStart(6), String(a.suavidade).padStart(10), String(a.nota).padStart(5), pulos(s.amostras).toFixed(1).padStart(10))
  }
}
