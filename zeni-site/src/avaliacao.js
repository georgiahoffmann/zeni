// Avaliação simulada por regras simples (fluxo-do-app.md, 3.1 a 3.5). Sem IA de verdade na v1.
// Entrada: o resumo que o exercício entrega (amostras do "tamanho do movimento", de 0 a 100, a cada 250 ms).

export const AMOSTRAS_MINIMAS = 20 // menos de 5 s de movimento: curto demais para uma nota

const media = (v) => v.reduce((a, b) => a + b, 0) / (v.length || 1)
const limitar = (n) => Math.max(0, Math.min(100, Math.round(n)))

export function avaliar(resumo, metaAtual) {
  const { amostras, pausas, ritmoSeg, oscilacao, tremores } = resumo
  const real = Array.isArray(oscilacao) && oscilacao.length >= AMOSTRAS_MINIMAS

  // 3.1: tamanho, suavidade e ritmo
  const tamanho = limitar(media(amostras))

  // suavidade: quanto menos a medida "pula" de uma amostra para a outra, mais suave
  // ZENI real: o tremido rápido medido pelo sensor (3 a 12 Hz) diz direto o quanto o movimento foi suave
  const saltos = amostras.slice(1).map((v, i) => Math.abs(v - amostras[i]))
  const suavidade = real && tremores?.length ? limitar(100 - media(tremores)) : limitar(100 - media(saltos) * 4)

  // ritmo: período estimado pelos cruzamentos da média, comparado com o ritmo guiado
  // ZENI real: usa o movimento com sinal (vai e volta = um ciclo); o tamanho sozinho sobe duas vezes por ciclo.
  // Com histerese: só conta a virada quando o movimento passa de um lado ao outro de verdade (ruído parado não conta).
  const serie = real ? oscilacao : amostras
  const m = media(serie)
  const histerese = real ? 0.06 : 0
  let cruzamentos = 0
  let lado = 0
  for (const v of serie) {
    const novo = v - m > histerese ? 1 : v - m < -histerese ? -1 : lado
    if (lado !== 0 && novo !== lado) cruzamentos += 1
    lado = novo
  }
  const periodo = cruzamentos > 0 ? (serie.length * 0.25 * 2) / cruzamentos : ritmoSeg * 2
  const ritmo = limitar(100 - (Math.abs(periodo - ritmoSeg) / ritmoSeg) * 100)

  // 3.2: nota de 0 a 100
  const nota = limitar(tamanho * 0.4 + suavidade * 0.3 + ritmo * 0.3)

  // 3.3: mostrou cansaço? O movimento diminuiu na segunda metade, ou houve várias pausas.
  const metade = Math.floor(amostras.length / 2)
  const primeira = media(amostras.slice(0, metade))
  const segunda = media(amostras.slice(metade))
  const cansaco = segunda < primeira * 0.85 || pausas >= 2

  // 3.4: mantém ou aumenta a meta aos poucos (só sem cansaço e com nota boa)
  const aumentou = !cansaco && nota >= 70
  const meta = aumentou ? Math.min(100, metaAtual + 5) : metaAtual

  return { tamanho, suavidade, ritmo, nota, cansaco, aumentou, meta }
}

// Palavras calmas, sem cobrança (design system, seção 10)
export const palavra = (valor) => (valor >= 70 ? 'bom' : valor >= 40 ? 'regular' : 'pequeno')

// Nota da série (3 exercícios): média de tamanho do movimento, suavidade e ritmo; nota com os mesmos pesos.
// Cansaço: dois ou mais exercícios mostraram cansaço.
export function avaliarSerie(exercicios, metaAtual) {
  const partes = exercicios.map((e) => avaliar(e, metaAtual))
  const m = (campo) => limitar(media(partes.map((p) => p[campo])))
  const tamanho = m('tamanho')
  const suavidade = m('suavidade')
  const ritmo = m('ritmo')
  const nota = limitar(tamanho * 0.4 + suavidade * 0.3 + ritmo * 0.3)
  const cansaco = partes.filter((p) => p.cansaco).length >= 2
  const aumentou = !cansaco && nota >= 70
  const meta = aumentou ? Math.min(100, metaAtual + 5) : metaAtual
  return { tamanho, suavidade, ritmo, nota, cansaco, aumentou, meta }
}
