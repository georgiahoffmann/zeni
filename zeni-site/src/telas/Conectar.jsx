// Segue: fluxo-do-app.md, bloco 1 "Conectar com o ZENI" (1.1 a 1.6) e design-system.md 6.9 (tela de espera).
// 1.1 ligar o ZENI -> 1.2 procurando -> 1.3 conectado -> 1.4 apoiar na mesa -> 1.5 aprendendo a posição -> 1.6 pronto.
//
// Com Bluetooth no navegador, é o ZENI de verdade (src/zeni-dispositivo.js): a lista de aparelhos só abre depois de um
// toque, por isso há a tela "Ligue o ZENI" antes da busca. A posição inicial é medida pelo próprio ZENI: se ele se
// mexer durante os 3 segundos, a tela pede para tentar de novo. Depois, deitado com a ponta para longe: o app aprende o
// que é "para frente" (zeni-dispositivo.js, calibrarFrente). No fim, o teste ao vivo mostra que tudo funciona.
// Sem Bluetooth (iPhone no Safari, navegador antigo), a tela explica e oferece "Experimentar sem o ZENI", que segue a
// simulação da v1.
// TODO (fluxo-do-app.md, ponto em aberto 3): o pedido de permissão do Bluetooth é a própria lista do navegador.
import { CheckIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'
import AcoesDuplas from '../componentes/AcoesDuplas.jsx'
import Aviso from '../componentes/Aviso.jsx'
import Botao from '../componentes/Botao.jsx'
import PainelInferior from '../componentes/PainelInferior.jsx'
import TelaEspera from '../componentes/TelaEspera.jsx'
import GuiaPosicao from '../componentes/GuiaPosicao.jsx'
import TesteZeni from '../componentes/TesteZeni.jsx'
import { useNavegacao } from '../navegacao.jsx'
import { BATERIA_SIMULADA } from '../fluxo.js'
import { CHAVES, guardar } from '../storage.js'
import { useZeni } from '../usarZeni.js'
import * as dispositivo from '../zeni-dispositivo.js'

const BUSCA_MS = 3000 // tempo simulado da busca (só no modo sem Bluetooth)
const SEGUNDOS_NA_MESA = 3 // "Apoiar o ZENI na mesa por 3 segundos"

const SEM_SUPORTE = {
  iphone: 'No iPhone, o Safari não conversa com o ZENI. Abra este mesmo endereço no app Bluefy, que é gratuito.',
  navegador: 'Este navegador não conversa com o ZENI. Abra este mesmo endereço no Chrome.',
  inseguro: 'Abra o endereço que começa com https para conversar com o ZENI.',
}

export default function Conectar() {
  const { voltarAoInicio } = useNavegacao()
  const zeni = useZeni()
  const suporte = dispositivo.suporte()
  const [simulado, setSimulado] = useState(!suporte.ok && suporte.motivo === 'demonstracao')
  // inicio | sem-suporte | procurando | erro | conectado | aprendendo | mexeu | sem-sensor | pronto | ligado
  const [estado, setEstado] = useState(() => {
    if (suporte.ok) return dispositivo.conectado() ? 'ligado' : 'inicio'
    return suporte.motivo === 'demonstracao' ? 'procurando' : 'sem-suporte'
  })
  const [erro, setErro] = useState(null)
  const [tentativa, setTentativa] = useState(0)
  const [restam, setRestam] = useState(SEGUNDOS_NA_MESA)
  const [progresso, setProgresso] = useState(0)
  // Na mesa só na primeira vez (o ZENI aprende o repouso do giroscópio e guarda); depois, de pé na mão já basta.
  // "Posição inicial" no menu refaz tudo, com a mesa.
  const [naMesa, setNaMesa] = useState(true)
  // No passo de inclinar: o desenho para inclinado assim que o ZENI de verdade está inclinado
  const [inclinado, setInclinado] = useState(false)
  useEffect(() => {
    if (estado !== 'inclinar') return undefined
    const id = setInterval(() => setInclinado(dispositivo.estaInclinado()), 150)
    return () => clearInterval(id)
  }, [estado])

  // Simulação: a busca termina sozinha em "conectado"
  useEffect(() => {
    if (!simulado || estado !== 'procurando') return undefined
    const id = setTimeout(() => setEstado('conectado'), BUSCA_MS)
    return () => clearTimeout(id)
  }, [simulado, estado, tentativa])


  // Contagem dos 3 segundos. Real: o ZENI mede e responde; a contagem só acompanha.
  useEffect(() => {
    if (estado !== 'aprendendo') return undefined
    const id = setTimeout(() => setRestam((r) => Math.max(1, r - 1)), 1000)
    return () => clearTimeout(id)
  }, [estado, restam])

  const guardarConexao = () =>
    guardar(CHAVES.zeni, {
      conectado: true,
      real: !simulado,
      nome: simulado ? null : dispositivo.nomeDoAparelho(),
      bateria: simulado ? BATERIA_SIMULADA : null,
      posicaoInicial: new Date().toISOString(),
    })

  // Precisa vir direto do toque: o navegador só abre a lista de aparelhos assim
  const procurar = async () => {
    setErro(null)
    if (!(await dispositivo.bluetoothLigado())) {
      setErro('bluetooth-desligado')
      setEstado('erro')
      return
    }
    setEstado('procurando')
    try {
      await dispositivo.conectar()
      setNaMesa((dispositivo.estadoAtual().flags & dispositivo.FLAG.calibrado) === 0)
      setEstado('conectado')
    } catch (e) {
      if (e.message === 'cancelado') setEstado('inicio')
      else {
        setErro(e.message)
        setEstado('erro')
      }
    }
  }

  const aprender = async (mesa = naMesa) => {
    setNaMesa(mesa)
    setRestam(SEGUNDOS_NA_MESA)
    setProgresso(0)
    setEstado('aprendendo')
    if (simulado) {
      setTimeout(() => {
        guardarConexao()
        setEstado('pronto')
      }, SEGUNDOS_NA_MESA * 1000)
      return
    }
    if (!mesa) {
      // Só o "de pé", na mão: 1,5 s parado
      try {
        await dispositivo.calibrarDePe(1500, setProgresso)
      } catch {
        setEstado('mexeu')
        return
      }
      inclinar()
      return
    }
    try {
      // O ZENI mede o repouso do giroscópio (3 s) e, ao mesmo tempo, o app mede a gravidade: o "para cima" do ZENI
      const dePe = dispositivo.calibrarDePe(2000).then(
        () => true,
        () => false,
      )
      const r = await dispositivo.calibrar()
      if (r === 'ok' && !(await dePe)) {
        setEstado('mexeu')
        return
      }
      if (r !== 'ok') {
        setEstado(r === 'sem-sensor' ? 'sem-sensor' : 'mexeu')
        return
      }
    } catch {
      setErro('falhou')
      setEstado('erro')
      return
    }
    // Passo 1 feito: estava de pé e parado. Essa é a posição de pé de verdade (guardada no aparelho).
    inclinar()
  }

  // Passo 2: inclinar para longe da pessoa, na mão. Ensina ao app o que é "para frente" (fica guardado).
  const inclinar = async () => {
    setProgresso(0)
    setEstado('inclinar')
    try {
      await dispositivo.calibrarFrente(600, setProgresso)
      guardarConexao()
      setEstado('pronto')
    } catch {
      setEstado((e) => (e === 'inclinar' ? 'inclinar-demorou' : e))
    }
  }

  const pularInclinar = () => {
    guardarConexao()
    setEstado('pronto')
  }

  const experimentarSem = () => {
    setSimulado(true)
    setTentativa((t) => t + 1)
    setEstado('procurando')
  }

  // Caiu a conexão no meio do caminho: mostra o aviso calmo de "se desconectou" (Tentar de novo volta ao começo)
  const caiu = !simulado && !zeni.conectado && ['conectado', 'aprendendo', 'inclinar', 'inclinar-demorou', 'pronto', 'ligado'].includes(estado)
  const tela = caiu ? 'erro' : estado
  const motivo = caiu ? 'caiu' : erro

  if (tela === 'sem-suporte') {
    return (
      <PainelInferior
        titulo="Conectar o ZENI"
        rodape={<AcoesDuplas voltar={{ rotulo: 'Voltar', onClick: voltarAoInicio }} acao={{ rotulo: 'Experimentar sem o ZENI', onClick: experimentarSem }} />}
      >
        <h2 className="conectar-titulo">Conectar o ZENI</h2>
        <Aviso nivel="informacao" titulo="Falta um passo">
          {SEM_SUPORTE[suporte.motivo] ?? SEM_SUPORTE.navegador}
        </Aviso>
      </PainelInferior>
    )
  }

  if (tela === 'inicio') {
    return (
      <PainelInferior
        titulo="Conectar o ZENI"
        rodape={<AcoesDuplas voltar={{ rotulo: 'Voltar', onClick: voltarAoInicio }} acao={{ rotulo: 'Procurar', onClick: procurar }} />}
      >
        <h2 className="conectar-titulo">Ligue o ZENI</h2>
        <p className="conectar-texto">Deixe o ZENI ligado e perto do celular. Depois, toque em Procurar.</p>
        <p className="conectar-destaque">Na lista que abrir, escolha o ZENI.</p>
      </PainelInferior>
    )
  }

  if (tela === 'procurando') {
    return (
      <TelaEspera
        key={tentativa}
        texto={simulado ? 'Procurando o ZENI' : 'Conectando ao ZENI'}
        onTentarDeNovo={() => (simulado ? setTentativa((t) => t + 1) : setEstado('inicio'))}
        onVoltar={voltarAoInicio}
      />
    )
  }

  if (tela === 'erro') {
    const textos = {
      'bluetooth-desligado': ['O Bluetooth está desligado', 'Ligue o Bluetooth do celular e tente de novo.'],
      caiu: ['O ZENI se desconectou', 'Confira se ele está ligado e perto do celular.'],
    }
    const [titulo, texto] = textos[motivo] ?? ['Não consegui falar com o ZENI', 'Confira se ele está ligado e perto do celular, e tente de novo.']
    return (
      <PainelInferior
        titulo={titulo}
        rodape={<AcoesDuplas voltar={{ rotulo: 'Voltar', onClick: voltarAoInicio }} acao={{ rotulo: 'Tentar de novo', onClick: () => setEstado('inicio') }} />}
      >
        <h2 className="conectar-titulo">{titulo}</h2>
        <p className="conectar-texto">{texto}</p>
      </PainelInferior>
    )
  }

  if (tela === 'conectado') {
    return (
      <PainelInferior
        titulo="ZENI conectado"
        rodape={<AcoesDuplas voltar={{ rotulo: 'Voltar', onClick: voltarAoInicio }} acao={{ rotulo: 'Pronto', onClick: () => aprender() }} />}
      >
        <span className="selo" aria-hidden="true">
          <CheckIcon className="icone" />
        </span>
        <h2 className="conectar-titulo">Conectado</h2>
        {!simulado && zeni.bateria !== null && <p className="conectar-texto">{`Bateria do ZENI: ${zeni.bateria}%`}</p>}
        <p className="conectar-destaque">
          {naMesa || simulado ? 'Deixe o ZENI de pé na mesa, parado, e toque em Pronto.' : 'Segure o ZENI de pé, parado, e toque em Pronto.'}
        </p>
        {!simulado && <GuiaPosicao passo="de-pe" mesa={naMesa} />}
      </PainelInferior>
    )
  }

  if (tela === 'aprendendo') {
    return (
      <PainelInferior titulo="Posição inicial">
        <h2 className="conectar-titulo">Fique parado</h2>
        <p className="conectar-texto">O ZENI está aprendendo como fica de pé.</p>
        {!simulado && <GuiaPosicao passo="de-pe" mesa={naMesa} pronto />}
        {naMesa || simulado ? (
          <p className="conectar-numero" aria-live="polite">
            {restam}
          </p>
        ) : (
          <div className="teste-barra" role="progressbar" aria-label="Parado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progresso * 100)}>
            <span className="teste-barra-rotulo">Parado</span>
            <span className="teste-barra-trilho">
              <span className="teste-barra-cheio" style={{ transform: `scaleX(${progresso})` }} />
            </span>
          </div>
        )}
      </PainelInferior>
    )
  }

  if (tela === 'inclinar' || tela === 'inclinar-demorou') {
    return (
      <PainelInferior
        titulo="Agora incline o ZENI"
        rodape={
          <AcoesDuplas
            voltar={{ rotulo: 'Voltar', onClick: voltarAoInicio }}
            acao={tela === 'inclinar' ? { rotulo: 'Pular', onClick: pularInclinar } : { rotulo: 'Tentar de novo', onClick: inclinar }}
          />
        }
      >
        <h2 className="conectar-titulo">Agora incline o ZENI</h2>
        <p className="conectar-texto">Incline a ponta de cima para longe de você, como no desenho, e segure um instante.</p>
        <GuiaPosicao passo="inclinar" pronto={inclinado} />
        {tela === 'inclinar' ? (
          <div className="teste-barra" role="progressbar" aria-label="Aprendendo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progresso * 100)}>
            <span className="teste-barra-rotulo">{inclinado ? 'Segure' : 'Incline'}</span>
            <span className="teste-barra-trilho">
              <span className="teste-barra-cheio" style={{ transform: `scaleX(${progresso})` }} />
            </span>
          </div>
        ) : (
          <p className="conectar-destaque">Não percebi o ZENI inclinado. Tente de novo ou toque em Voltar.</p>
        )}
      </PainelInferior>
    )
  }

  if (tela === 'mexeu' || tela === 'sem-sensor') {
    const mexeu = tela === 'mexeu'
    return (
      <PainelInferior
        titulo={mexeu ? 'O ZENI se mexeu' : 'O ZENI não sente o movimento'}
        rodape={<AcoesDuplas voltar={{ rotulo: 'Voltar', onClick: voltarAoInicio }} acao={{ rotulo: 'Tentar de novo', onClick: () => aprender() }} />}
      >
        <h2 className="conectar-titulo">{mexeu ? 'O ZENI se mexeu' : 'O ZENI não sente o movimento'}</h2>
        <p className="conectar-texto">
          {mexeu
            ? naMesa
              ? 'Deixe o ZENI de pé na mesa, sem encostar, e tente de novo.'
              : 'Segure o ZENI de pé, o mais parado que conseguir, e tente de novo.'
            : 'Desligue e ligue o ZENI. Se continuar assim, ele precisa de conserto.'}
        </p>
      </PainelInferior>
    )
  }

  // Já conectado (aberto pelo menu "Conexão com o ZENI"): o teste ao vivo, com a opção de refazer a posição inicial
  if (tela === 'ligado') {
    return (
      <PainelInferior
        titulo="Conexão com o ZENI"
        rodape={
          <>
            <AcoesDuplas voltar={{ rotulo: 'Voltar', onClick: voltarAoInicio }} acao={{ rotulo: 'Posição inicial', onClick: () => aprender(true) }} />
            <Botao
              variante="vazado"
              onClick={() => {
                dispositivo.desconectar()
                guardar(CHAVES.zeni, { conectado: false })
                voltarAoInicio()
              }}
            >
              Desconectar
            </Botao>
          </>
        }
      >
        <h2 className="conectar-titulo">ZENI conectado</h2>
        <TesteZeni />
      </PainelInferior>
    )
  }

  // 1.6: pronto. Real: mostra o teste ao vivo antes de voltar.
  return (
    <PainelInferior
      titulo="Tudo pronto"
      rodape={
        <Botao variante="principal" onClick={voltarAoInicio}>
          Voltar ao início
        </Botao>
      }
    >
      <span className="selo" aria-hidden="true">
        <CheckIcon className="icone" />
      </span>
      <h2 className="conectar-titulo">Tudo pronto</h2>
      <p className="conectar-texto">O ZENI guardou a sua posição inicial.</p>
      {!simulado && <TesteZeni />}
    </PainelInferior>
  )
}
