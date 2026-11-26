// Decide para onde o botão "Começar o exercício" leva, conforme o que já foi feito neste aparelho.
// TODO (fluxo-do-app.md, ponto em aberto 3 "Primeiro uso e permissões"): a ordem PAR-Q e depois conectar o ZENI
// é provisória. O fluxograma não define o primeiro uso, nem os passos de permissão de microfone e Bluetooth.
import { CHAVES, ler } from './storage.js'
import * as dispositivo from './zeni-dispositivo.js'

export const triagemFeita = () => (ler(CHAVES.respostasParq, [])?.length ?? 0) >= 7
// ZENI real (Bluetooth): só conta como conectado enquanto a conexão está viva nesta página. Simulado: o que ficou guardado.
export const zeniReal = () => ler(CHAVES.zeni, null)?.real === true
export const zeniConectado = () => {
  const z = ler(CHAVES.zeni, null)
  if (z?.conectado !== true) return false
  return z.real ? dispositivo.conectado() : true
}

export function telaDoExercicio() {
  if (!triagemFeita()) return 'parq' // obrigatória antes do primeiro exercício (decisão 3)
  if (!zeniConectado()) return 'conectar'
  return 'exercicio'
}

// Bateria do ZENI em porcentagem. Real: a que o ZENI mede (null se ele não tiver o medidor de bateria). Simulada: 87.
export const BATERIA_SIMULADA = 87
export const bateriaDoZeni = () => (zeniReal() ? dispositivo.estadoAtual().bateria : (ler(CHAVES.zeni, null)?.bateria ?? BATERIA_SIMULADA))
