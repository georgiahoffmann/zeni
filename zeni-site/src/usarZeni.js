// Hook para as telas que mostram o ZENI real ao vivo (pílula, conexão, teste, painel técnico).
// Re-renderiza quando o estado muda (conexão, bateria, calibração). Os ângulos vêm de `useMovimentoAoVivo`.
import { useEffect, useState, useSyncExternalStore } from 'react'
import * as zeni from './zeni-dispositivo.js'

let versao = 0
const assinar = (avisar) =>
  zeni.aoMudarEstado(() => {
    versao += 1
    avisar()
  })

export function useZeni() {
  useSyncExternalStore(assinar, () => versao)
  return { ...zeni.estadoAtual(), conectado: zeni.conectado(), info: zeni.infoDoFirmware() }
}

// Ângulos e movimento ao vivo, a ~15 quadros por segundo (não re-renderiza a cada pacote de 50 Hz).
// `janelas`: true quando esta tela é a dona das janelas de movimento (fora do exercício).
export function useMovimentoAoVivo({ janelas = false } = {}) {
  const [vivo, setVivo] = useState({ roll: 0, pitch: 0, lado: 0, frente: 0, tamanho: 0, tremor: 0, recebendo: false })
  useEffect(() => {
    let ultimaJanela = { tamanho: 0, tremor: 0 }
    const id = setInterval(() => {
      const p = zeni.ultimo()
      if (janelas) ultimaJanela = zeni.fecharJanela() ?? ultimaJanela
      const inclinacao = p ? zeni.inclinacaoDoZeni() : { lado: 0, frente: 0 }
      setVivo({
        roll: p?.roll ?? 0,
        pitch: p?.pitch ?? 0,
        lado: inclinacao.lado,
        frente: inclinacao.frente,
        tamanho: ultimaJanela.tamanho,
        tremor: ultimaJanela.tremor,
        recebendo: !!p && performance.now() - p.t < 500,
      })
    }, 66)
    return () => clearInterval(id)
  }, [janelas])
  return vivo
}
