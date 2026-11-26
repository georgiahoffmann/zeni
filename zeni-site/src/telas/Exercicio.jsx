// Segue: fluxo-do-app.md, bloco 2 "Exercícios" (2.1 a 2.9), decisões 2, 5, 7, 9, 11, 12 e 17 de 25/11, e design-system.md
// 6.10, 6.11 e 6.15. O ZENI e a IA são simulados por regras simples (CLAUDE.md, escopo da v1). Sem LED, vibração, áudio
// ou música: o ritmo aparece só como pulso amarelo na tela.
// A série do dia tem 3 exercícios (um de cada grupo do catálogo, em src/simulacao.js), em TELA CHEIA.
// Estados: preparando (tela de carregamento) -> instrucao (animação de como fazer) -> andamento (2.4 a 2.7)
//          -> (próximo exercício: instrucao) ... -> depois do terceiro, a nota em modal (Avaliação).
//          pausado (2.8a) | repetindo (animação de novo, em pausa) | reconectando -> perguntando | encerrado (Terminar ou Voltar ao início no meio da série).
// "Terminar" no meio da série (provisório, decisão 12): encerra a sessão e volta à Home, sem nota. Os exercícios já
// concluídos ficam registrados como feitos, sem nota, e o em andamento é descartado.
// Casos de erro (tabela do fluxo): perda de sinal (reconexão), bateria fraca (aviso discreto no topo, o exercício
// continua) e muita dificuldade (pausa sozinho, mesma tela de Pausado, com o aviso urgente).
// Voz (decisões 5 e 11): "pausar", "continuar", "terminar" e "repetir" (src/voz.js). "Repetir" vai ao estado `repetindo`.
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import Aviso from '../componentes/Aviso.jsx'
import AcoesDuplas from '../componentes/AcoesDuplas.jsx'
import Botao from '../componentes/Botao.jsx'
import IndicadorVoz from '../componentes/IndicadorVoz.jsx'
import PainelInferior from '../componentes/PainelInferior.jsx'
import TelaCarregamento from '../componentes/TelaCarregamento.jsx'
import { useNavegacao } from '../navegacao.jsx'
import { aliviarDificuldade, aoBateriaFraca, aoMudarSinal, emDificuldade, serieDoDia } from '../simulacao.js'
import { zeniReal } from '../fluxo.js'
import * as dispositivo from '../zeni-dispositivo.js'
import { CHAVES, guardar, ler } from '../storage.js'
import { useComandosDeVoz } from '../voz.js'

// O personagem 3D (three) é pesado: só carrega ao entrar no exercício
const PersonagemExercicio = lazy(() => import('../componentes/PersonagemExercicio.jsx'))

const DURACAO_S = 30 // duração de cada exercício (E: 15 repetições de 2 s, também 30 s)
const RITMO_PADRAO_S = 1.6 // segundos por movimento, sem histórico (2.1a)
const PREPARO_MS = 2500 // tempo simulado de carregamento do exercício do dia
const AUTOPLAY_MS = 3000 // entre os exercícios da série: o próximo começa sozinho 3 s depois da instrução
const TENTATIVA_MS = 10000 // 10 s por tentativa de reconexão (decisão 2; ajustável com o hardware real)
const TENTATIVAS = 2
const DESFAZER_MS = 8000 // "Desfazer" por 8 segundos (design system, seção 7)
const BATERIA_MS = 10000 // quanto tempo o aviso discreto de bateria fica no topo
const JANELA_DIFICULDADE = 8 // últimas 8 amostras (2 s)
const LIMITE_DIFICULDADE = 25 // média abaixo disto = movimento muito pequeno

function ritmoHabitual(historico) {
  const recentes = historico.slice(-5).map((h) => h.ritmoSeg).filter(Number.isFinite)
  return recentes.length ? recentes.reduce((a, b) => a + b, 0) / recentes.length : RITMO_PADRAO_S
}

const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
const semMovimento = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function Exercicio() {
  const { ir, voltarAoInicio } = useNavegacao()
  const [historico] = useState(() => ler(CHAVES.historico, []))
  const [serie] = useState(() => serieDoDia())
  const [ritmoHabitualSeg] = useState(() => ritmoHabitual(historico))
  const [parado] = useState(semMovimento)

  const [estado, setEstado] = useState('preparando')
  const [indice, setIndice] = useState(0) // 0 a 2: qual exercício da série
  const [tentativaBusca, setTentativaBusca] = useState(0)
  const [restam, setRestam] = useState(DURACAO_S)
  const [tamanho, setTamanho] = useState(50) // 0 a 100: o "tamanho do movimento" simulado
  const [tentativa, setTentativa] = useState(1)
  const [desfazer, setDesfazer] = useState(false)
  const [motivoPausa, setMotivoPausa] = useState('pessoa') // 'pessoa' | 'dificuldade'
  const [bateria, setBateria] = useState(false)
  const [ajuste, setAjuste] = useState(0) // "Ajustar o ZENI": quanto tempo já ficou parado de pé (0 a 1)

  const exercicio = serie[indice]
  const ritmoSeg = exercicio.ritmoSeg ?? ritmoHabitualSeg
  const duracao = DURACAO_S

  const restamRef = useRef(DURACAO_S)
  const indiceRef = useRef(0)
  const desdeAmostra = useRef(0) // a detecção de dificuldade só olha amostras depois da última pausa automática
  const dados = useRef({ amostras: [], oscilacao: [], tremores: [], pausas: 0 }) // do exercício em andamento
  const jaComecou = useRef(false) // para a reconexão saber se volta à instrução ou ao exercício
  const [real] = useState(zeniReal) // ZENI de verdade (Bluetooth) ou simulação
  useEffect(() => () => dispositivo.definirExercicio(null), []) // ao sair, o teste ao vivo volta ao modo geral
  const feitos = useRef([]) // exercícios concluídos nesta série

  const pausar = () => {
    dados.current.pausas += 1
    setMotivoPausa('pessoa')
    setEstado('pausado')
  }

  // Carregamento: espera simulada
  useEffect(() => {
    if (estado !== 'preparando') return undefined
    // ZENI real sem conexão (desligou entre a Home e aqui): já entra reconectando
    const id = setTimeout(() => setEstado(real && !dispositivo.conectado() ? 'reconectando' : 'instrucao'), PREPARO_MS)
    return () => clearTimeout(id)
  }, [estado, tentativaBusca, real])

  // "Ajustar o ZENI" (ZENI real): segurar de pé e parado por 1,5 s. Essa vira a posição de pé do fantasma e das medidas.
  const ajustar = () => {
    setAjuste(0)
    setEstado('ajustando')
    dispositivo
      .calibrarDePe(1500, setAjuste)
      .catch(() => {})
      .finally(() => setEstado((e) => (e === 'ajustando' ? 'instrucao' : e)))
  }

  // Começa um exercício: zera o relógio e os dados de movimento
  const comecar = () => {
    restamRef.current = duracao
    setRestam(duracao)
    dados.current = { amostras: [], oscilacao: [], tremores: [], pausas: 0 }
    desdeAmostra.current = 0
    jaComecou.current = true
    if (real) {
      dispositivo.definirExercicio(serie[indiceRef.current].id) // giro, vertical ou batida, conforme o exercício
      dispositivo.fecharJanela() // descarta o movimento de antes do Começar
      dispositivo.marcarReferencia() // a posição de agora é tomada como "de pé": dela partem o fantasma e as medidas
    }
    setEstado('andamento')
  }

  // Autoplay: do segundo exercício em diante, a instrução aparece e o exercício começa sozinho após 3 s (o botão Começar
  // continua na tela). O primeiro espera a pessoa tocar em Começar.
  useEffect(() => {
    if (estado !== 'instrucao' || indice === 0) return undefined
    const id = setTimeout(comecar, AUTOPLAY_MS)
    return () => clearTimeout(id)
  }, [estado, indice]) // eslint-disable-line react-hooks/exhaustive-deps -- `comecar` só usa refs e setters

  // Fim de um exercício: o próximo da série, ou a nota depois do terceiro
  const concluir = () => {
    feitos.current.push({
      exercicio: serie[indiceRef.current].id,
      amostras: dados.current.amostras,
      oscilacao: real ? dados.current.oscilacao : undefined,
      tremores: real ? dados.current.tremores : undefined,
      pausas: dados.current.pausas,
      duracaoSeg: duracao,
      ritmoSeg: serie[indiceRef.current].ritmoSeg ?? ritmoHabitualSeg,
    })
    if (indiceRef.current < serie.length - 1) {
      indiceRef.current += 1
      setIndice(indiceRef.current)
      jaComecou.current = false
      setEstado('instrucao')
    } else {
      ir('avaliacao', { resumo: { exercicios: feitos.current, ritmoSeg: ritmoHabitualSeg } })
    }
  }

  // 2.4 a 2.7: o ciclo do exercício. Com o ZENI real, os dados vêm do sensor (src/zeni-dispositivo.js, uma janela a
  // cada 250 ms); na simulação, são gerados pelo app.
  useEffect(() => {
    if (estado !== 'andamento') return undefined
    const t0 = Date.now()
    if (real) dispositivo.fecharJanela() // não conta o que aconteceu durante a pausa
    const dado = setInterval(() => {
      const t = (Date.now() - t0) / 1000
      let valor
      if (real) {
        const janela = dispositivo.fecharJanela()
        if (!janela) return // sem pacotes nesta janela: o sinal caiu, a reconexão cuida disso
        valor = janela.tamanho
        dados.current.oscilacao.push(Math.round(janela.oscilacao * 1000) / 1000)
        dados.current.tremores.push(Math.round(janela.tremor))
      } else {
        valor = emDificuldade()
          ? 8 + Math.random() * 10 // movimento muito pequeno (simulado)
          : 55 + 25 * Math.sin((2 * Math.PI * t) / ritmoSeg) + Math.random() * 8
      }
      const limitado = Math.max(0, Math.min(100, valor))
      setTamanho(limitado)
      const amostras = dados.current.amostras
      amostras.push(Math.round(limitado))

      // 2.5: o app percebe muita dificuldade e pausa sozinho (estado Pausado, 2.8a)
      const recentes = amostras.slice(Math.max(desdeAmostra.current, amostras.length - JANELA_DIFICULDADE))
      if (recentes.length === JANELA_DIFICULDADE && recentes.reduce((a, b) => a + b, 0) / JANELA_DIFICULDADE < LIMITE_DIFICULDADE) {
        desdeAmostra.current = amostras.length
        aliviarDificuldade()
        dados.current.pausas += 1
        setMotivoPausa('dificuldade')
        setEstado('pausado')
      }
    }, 250)
    const relogio = setInterval(() => {
      restamRef.current -= 1
      setRestam(restamRef.current)
      if (restamRef.current <= 0) concluir() // 2.7: o exercício acabou
    }, 1000)
    return () => {
      clearInterval(dado)
      clearInterval(relogio)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, ritmoSeg])

  // 2.4: o sinal do ZENI cai e volta (simulado, ver src/simulacao.js)
  useEffect(
    () =>
      aoMudarSinal((ok) => {
        if (!ok) setEstado((e) => (e === 'andamento' ? 'reconectando' : e))
        else {
          setEstado((e) => (e === 'reconectando' ? (jaComecou.current ? 'andamento' : 'instrucao') : e))
          setTentativa(1)
        }
      }),
    [],
  )

  // Bateria fraca (2.4): aviso discreto no topo; o exercício continua
  useEffect(() => aoBateriaFraca(() => setBateria(true)), [])
  useEffect(() => {
    if (!bateria) return undefined
    const id = setTimeout(() => setBateria(false), BATERIA_MS)
    return () => clearTimeout(id)
  }, [bateria])

  // Reconexão: duas tentativas de 10 s, depois pergunta (decisão 2)
  useEffect(() => {
    if (estado !== 'reconectando') return undefined
    const id = setTimeout(() => {
      if (tentativa < TENTATIVAS) setTentativa(tentativa + 1)
      else setEstado('perguntando')
    }, TENTATIVA_MS)
    return () => clearTimeout(id)
  }, [estado, tentativa])

  // "Desfazer" do Terminar: some sozinho depois de 8 s
  useEffect(() => {
    if (!desfazer) return undefined
    const id = setTimeout(() => setDesfazer(false), DESFAZER_MS)
    return () => clearTimeout(id)
  }, [desfazer])

  // Encerra a sessão no meio da série (provisório, decisão 12): os concluídos ficam registrados como feitos, sem nota;
  // o exercício em andamento é descartado. Volta à Home.
  const encerrarSessao = () => {
    if (feitos.current.length > 0) {
      const agora = new Date().toISOString()
      guardar(CHAVES.historico, [
        ...ler(CHAVES.historico, []),
        ...feitos.current.map((f) => ({ quando: agora, exercicio: f.exercicio, duracaoSeg: f.duracaoSeg, semNota: true })),
      ])
    }
    voltarAoInicio()
  }

  const terminar = () => {
    setDesfazer(true)
    setEstado('encerrado')
  }

  // "Repetir": pausa o exercício e mostra de novo a animação de como fazer. "Continuar" retoma de onde parou.
  const repetir = () => setEstado('repetindo')
  const continuar = () => setEstado('andamento')

  // Voz (decisão 5): pausar, continuar, terminar e repetir. Cada comando só vale no estado certo.
  const vozAtiva = estado === 'andamento' || estado === 'pausado' || estado === 'repetindo'
  const { ouvindo } = useComandosDeVoz(vozAtiva, {
    pausar: estado === 'andamento' ? pausar : undefined,
    continuar: estado === 'pausado' || estado === 'repetindo' ? continuar : undefined,
    terminar: vozAtiva ? terminar : undefined,
    repetir: estado === 'andamento' || estado === 'pausado' ? repetir : undefined,
  })

  if (estado === 'preparando') {
    return (
      <TelaCarregamento
        key={tentativaBusca}
        texto="Preparando o seu exercício de hoje"
        duracaoMs={PREPARO_MS}
        onTentarDeNovo={() => setTentativaBusca((t) => t + 1)}
        onVoltar={voltarAoInicio}
      />
    )
  }

  // 2.1 a 2.3: o exercício em tela cheia, já com a instrução em animação, e Começar
  if (estado === 'instrucao') {
    return (
      <PainelInferior
        titulo={`Exercício ${indice + 1} de ${serie.length}`}
        alturaTotal
        onFechar={() => {}}
        rodape={
          <>
            {real && (
              <Botao variante="vazado" onClick={ajustar}>
                Ajustar o ZENI
              </Botao>
            )}
            <AcoesDuplas voltar={{ rotulo: 'Voltar', onClick: encerrarSessao }} acao={{ rotulo: 'Começar', onClick: comecar }} />
          </>
        }
      >
        <div className="instrucao">
          <p className="instrucao-contador">{`Exercício ${indice + 1} de ${serie.length}`}</p>
          <h2 className="instrucao-nome">{exercicio.nome}</h2>
          <div className="instrucao-figura">
            <Suspense fallback={null}>
              <PersonagemExercicio exercicio={exercicio} parado={parado} pulso={exercicio.grupo === 'ritmo'} fantasma={real} />
            </Suspense>
          </div>
          <p className="instrucao-legenda">{exercicio.legenda}</p>
        </div>
      </PainelInferior>
    )
  }

  // Ajustar o ZENI: segurar de pé, parado
  if (estado === 'ajustando') {
    return (
      <PainelInferior
        titulo="Ajustar o ZENI"
        alturaTotal
        onFechar={() => setEstado('instrucao')}
        rodape={
          <Botao variante="voltar" onClick={() => setEstado('instrucao')}>
            Voltar
          </Botao>
        }
      >
        <h2 className="conectar-titulo">Segure o ZENI de pé</h2>
        <p className="conectar-texto">Do jeito que você vai começar, parado, por um instante.</p>
        <div className="teste-barra" role="progressbar" aria-label="Parado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ajuste * 100)}>
          <span className="teste-barra-rotulo">Parado</span>
          <span className="teste-barra-trilho">
            <span className="teste-barra-cheio" style={{ transform: `scaleX(${ajuste})` }} />
          </span>
        </div>
      </PainelInferior>
    )
  }

  // 6.11: reconectando, sem botões
  if (estado === 'reconectando') {
    return (
      <PainelInferior titulo="Reconectando" alturaTotal onFechar={() => {}}>
        <Aviso nivel="informacao" titulo="Reconectando ao ZENI…">
          Vai levar só um instante.
        </Aviso>
      </PainelInferior>
    )
  }

  // 6.11: duas tentativas falharam; sem limite de tempo
  if (estado === 'perguntando') {
    return (
      <PainelInferior
        titulo="Perdi o sinal do ZENI"
        alturaTotal
        onFechar={() => {}}
        rodape={
          <AcoesDuplas
            voltar={{ rotulo: 'Voltar ao início', onClick: encerrarSessao }}
            acao={{
              rotulo: 'Tentar de novo',
              onClick: () => {
                setTentativa(1)
                setEstado('reconectando')
              },
            }}
          />
        }
      >
        <h2 className="conectar-titulo">Perdi o sinal do ZENI. Quer tentar de novo?</h2>
      </PainelInferior>
    )
  }

  // 2.8a / 6.10: pausado, sem tempo limite
  if (estado === 'pausado') {
    return (
      <PainelInferior
        titulo="Exercício pausado"
        alturaTotal
        onFechar={() => {}}
        rodape={
          <>
            <Botao variante="vazado" onClick={repetir}>
              Repetir
            </Botao>
            <AcoesDuplas voltar={{ rotulo: 'Terminar', onClick: terminar }} acao={{ rotulo: 'Continuar', onClick: continuar }} />
          </>
        }
      >
        <IndicadorVoz ouvindo={ouvindo} />
        <h2 className="conectar-titulo">Exercício pausado</h2>
        {motivoPausa === 'dificuldade' ? (
          <Aviso nivel="urgente" titulo="O exercício foi pausado.">
            Vamos descansar um pouco.
          </Aviso>
        ) : (
          <p className="conectar-texto">Respire um pouco. Continue quando quiser.</p>
        )}
      </PainelInferior>
    )
  }

  // Repetir: a animação de como fazer, com o exercício em pausa. Continuar retoma de onde parou.
  if (estado === 'repetindo') {
    return (
      <PainelInferior
        titulo="Como fazer"
        alturaTotal
        onFechar={() => {}}
        rodape={
          <AcoesDuplas voltar={{ rotulo: 'Terminar', onClick: terminar }} acao={{ rotulo: 'Continuar', onClick: continuar }} />
        }
      >
        <IndicadorVoz ouvindo={ouvindo} />
        <div className="instrucao">
          <h2 className="instrucao-nome">{exercicio.nome}</h2>
          <div className="instrucao-figura">
            <Suspense fallback={null}>
              <PersonagemExercicio exercicio={exercicio} parado={parado} pulso={exercicio.grupo === 'ritmo'} fantasma={real} />
            </Suspense>
          </div>
          <p className="instrucao-legenda">{exercicio.legenda}</p>
        </div>
      </PainelInferior>
    )
  }

  // Terminar no meio da série: encerra, sem nota. Pode desfazer por 8 s (design system, seção 7).
  if (estado === 'encerrado') {
    return (
      <PainelInferior
        titulo="Exercício encerrado"
        alturaTotal
        onFechar={() => {}}
        rodape={
          <>
            <Botao variante="principal" onClick={encerrarSessao}>
              Voltar ao início
            </Botao>
            {desfazer && (
              <Botao
                variante="vazado"
                onClick={() => {
                  setDesfazer(false)
                  setEstado('pausado')
                }}
              >
                Desfazer
              </Botao>
            )}
          </>
        }
      >
        <h2 className="conectar-titulo">Exercício encerrado</h2>
        <p className="conectar-texto">Tudo bem. O que você já fez hoje fica guardado, sem nota.</p>
      </PainelInferior>
    )
  }

  // 2.4 a 2.6: em andamento, em tela cheia. O botão Pausar fica sempre na tela, na mesma posição.
  // O bulb amarelo ao fundo pulsa no tempo do ritmo; o tamanho do movimento muda a amplitude dele.
  return (
    <PainelInferior
      titulo="Exercício em andamento"
      alturaTotal
      onFechar={pausar}
      rodape={
        <Botao variante="secundario" onClick={pausar}>
          Pausar
        </Botao>
      }
    >
      {bateria && (
        <Aviso nivel="atencao" titulo="A bateria do ZENI está acabando.">
          Você pode continuar.
        </Aviso>
      )}
      <div className="andamento-topo">
        <IndicadorVoz ouvindo={ouvindo} />
        <p className="exercicio-tempo" aria-label={`Faltam ${restam} segundos`}>
          {mmss(restam)}
        </p>
      </div>
      <div className="andamento">
        <div
          className={`andamento-bulb${parado ? '' : ' andamento-bulb--pulsa'}`}
          style={{ '--guia-ritmo': `${ritmoSeg}s`, '--amplitude': tamanho / 100 }}
          aria-hidden="true"
        />
        <Suspense fallback={null}>
          <PersonagemExercicio exercicio={exercicio} parado={parado} fantasma={real} />
        </Suspense>
      </div>
    </PainelInferior>
  )
}
