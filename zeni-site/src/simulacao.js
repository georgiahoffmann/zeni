// Simulação do ZENI (dispositivo) na v1: o sinal é gerado pelo app (CLAUDE.md, escopo da v1).
// Para a demonstração, no console do navegador:
//   zeniSimular.perderSinal()     -> o ZENI "perde o sinal" (o exercício entra em reconexão)
//   zeniSimular.recuperarSinal()  -> o sinal "volta"
//   zeniSimular.preencherHistorico() -> cria 12 exercícios de exemplo nos últimos 30 dias (para ver a evolução)
//   zeniSimular.limparHistorico()    -> apaga o histórico
//   zeniSimular.definirDia(n)        -> força o dia do ano (par: A, C, E; ímpar: B, D, F). Sem argumento, volta ao dia real
//   zeniSimular.bateriaFraca()       -> o ZENI avisa que a bateria está acabando (durante o exercício)
//   zeniSimular.muitaDificuldade()   -> o movimento fica bem pequeno e o app pausa o exercício sozinho
//   zeniSimular.lembrarAgora()       -> mostra o aviso de lembrete agora (o horário só muda de 30 em 30 min)
// O ZENI de verdade, por Bluetooth, está em src/zeni-dispositivo.js. Sem Bluetooth no navegador, vale esta simulação.
import { CHAVES, apagar, guardar } from './storage.js'

// Catálogo de exercícios (decisão 9 de 25/11). Nomes e legendas em linguagem leiga.
// `ritmoSeg`: se existir, o exercício tem ritmo fixo (E: 15 repetições, uma a cada 2 s = 30 s).
export const CATALOGO = [
  { id: 'A', grupo: 'amplitude', nome: 'Girar o punho', legenda: 'Cotovelo dobrado, ZENI de pé. Vire a palma para cima e para baixo, o máximo que conseguir.' },
  { id: 'B', grupo: 'amplitude', nome: 'Levantar até o ombro', legenda: 'Leve o ZENI da cintura até a altura do ombro e volte devagar.' },
  { id: 'C', grupo: 'ritmo', nome: 'No ritmo', legenda: 'Mexa o punho no tempo do pulso amarelo na tela.', ritmoSeg: 1.0 },
  { id: 'D', grupo: 'ritmo', nome: 'Tocar na mesa', legenda: 'Levante o ZENI e apoie de volta na mesa no tempo do pulso.', ritmoSeg: 1.2 },
  { id: 'E', grupo: 'energia', nome: 'Mesma força até o fim', legenda: 'Gire o punho 15 vezes, sempre na mesma velocidade, da primeira à última.', ritmoSeg: 2, repeticoes: 15 },
  { id: 'F', grupo: 'energia', nome: 'Lado a lado', legenda: 'Com o antebraço apoiado na mesa, vá de um lado para o outro sem parar no meio.' },
]
const ORDEM_DOS_GRUPOS = ['amplitude', 'ritmo', 'energia']

let diaForcado = null // para a demonstração: zeniSimular.definirDia(n)
export const diaDoAno = (data = new Date()) => diaForcado ?? Math.floor((data - new Date(data.getFullYear(), 0, 0)) / 86400000)

// Série do dia: um exercício de cada grupo, sempre nesta ordem. Dia par escolhe o primeiro do grupo, dia ímpar o segundo.
export function serieDoDia(dia = diaDoAno()) {
  const indice = dia % 2 === 0 ? 0 : 1
  return ORDEM_DOS_GRUPOS.map((g) => CATALOGO.filter((e) => e.grupo === g)[indice])
}

let sinal = true
const ouvintes = new Set()

export const sinalOk = () => sinal

function definirSinal(valor) {
  sinal = valor
  ouvintes.forEach((f) => f(valor))
}

// Bateria fraca: aviso avulso, o exercício continua
const ouvintesBateria = new Set()
export function aoBateriaFraca(f) {
  ouvintesBateria.add(f)
  return () => ouvintesBateria.delete(f)
}

// Muita dificuldade: enquanto ligada, os dados de movimento gerados ficam bem pequenos
let dificuldade = false
export const emDificuldade = () => dificuldade
export const aliviarDificuldade = () => {
  dificuldade = false
}

// O ZENI real (src/zeni-dispositivo.js) usa os mesmos eventos: as telas não sabem se é simulação ou Bluetooth.
export const emitirSinal = (valor) => definirSinal(valor)
export const emitirBateriaFraca = () => ouvintesBateria.forEach((f) => f())

export function aoMudarSinal(f) {
  ouvintes.add(f)
  return () => ouvintes.delete(f)
}

if (typeof window !== 'undefined') {
  window.zeniSimular = {
    perderSinal: () => definirSinal(false),
    recuperarSinal: () => definirSinal(true),
    bateriaFraca: () => ouvintesBateria.forEach((f) => f()),
    muitaDificuldade: () => {
      dificuldade = true
    },
    preencherHistorico: () => {
      const dia = 24 * 60 * 60 * 1000
      const exemplos = Array.from({ length: 12 }, (_, i) => {
        const nota = Math.round(52 + i * 2.5 + Math.random() * 10)
        return {
          quando: new Date(Date.now() - (11 - i) * 2.4 * dia).toISOString(),
          exercicio: 'subir-descer',
          duracaoSeg: 30,
          pausas: 0,
          terminouAntes: false,
          ritmoSeg: 1.6,
          nota,
          tamanho: nota,
          suavidade: Math.round(nota - 5 + Math.random() * 10),
          ritmo: Math.round(nota - 5 + Math.random() * 10),
          cansaco: false,
        }
      })
      guardar(CHAVES.historico, exemplos)
    },
    limparHistorico: () => apagar(CHAVES.historico),
    definirDia: (n) => {
      diaForcado = n ?? null
    },
    lembrarAgora: () => window.dispatchEvent(new Event('zeni:lembrete')),
  }
}
