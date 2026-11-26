import { useEffect, useRef, useState } from 'react'
import Abertura from './componentes/Abertura.jsx'
import PainelTecnico from './componentes/PainelTecnico.jsx'
import AvisoLembrete from './componentes/AvisoLembrete.jsx'
import { telaDoExercicio } from './fluxo.js'
import { lembreteDeAgora, lerLembretes } from './lembretes.js'
import AvisoWeb from './telas/AvisoWeb.jsx'
import { NavegacaoProvider, useNavegacao } from './navegacao.jsx'
import EmConstrucao from './telas/EmConstrucao.jsx'
import { TELAS } from './telas/index.js'
import { reconectarLembrado } from './zeni-dispositivo.js'

const TECNICO = new URLSearchParams(window.location.search).has('tecnico')

function Telas() {
  const { tela, ir } = useNavegacao()
  const Home = TELAS.home
  const Atual = TELAS[tela.nome] ?? EmConstrucao
  const painelAberto = tela.nome !== 'home'
  const [abrindo, setAbrindo] = useState(true) // tela de entrada: ao abrir o app e ao tocar no logo da Home (26/11)
  useEffect(() => {
    const rever = () => setAbrindo(true)
    window.addEventListener('zeni:abertura', rever)
    return () => window.removeEventListener('zeni:abertura', rever)
  }, [])

  // ZENI real: se o navegador lembra dele (Chrome), reconecta sozinho ao abrir o app, sem a lista de aparelhos
  useEffect(() => {
    reconectarLembrado()
  }, [])

  // Lembretes: a cada 15 s vê se algum é para este minuto (só com o app aberto na v1)
  const [lembrete, setLembrete] = useState(null)
  const ultimo = useRef('')
  useEffect(() => {
    const id = setInterval(() => {
      const agora = new Date()
      const achado = lembreteDeAgora(lerLembretes(), agora)
      const chave = achado ? `${agora.toDateString()} ${achado.hora}` : ''
      if (achado && chave !== ultimo.current) {
        ultimo.current = chave
        setLembrete(achado)
      }
    }, 15000)
    const agoraMesmo = () => setLembrete({ hora: 'agora' }) // para a demonstração (src/simulacao.js)
    window.addEventListener('zeni:lembrete', agoraMesmo)
    return () => {
      clearInterval(id)
      window.removeEventListener('zeni:lembrete', agoraMesmo)
    }
  }, [])

  return (
    <div className="app">
      {abrindo && <Abertura onFim={() => setAbrindo(false)} />}
      {TECNICO && <PainelTecnico />}
      {/* A Home fica por baixo do painel; enquanto ele está aberto, não recebe toque nem foco. */}
      <div inert={painelAberto}>
        <Home />
      </div>
      {painelAberto && <Atual {...tela.params} />}
      {lembrete && tela.nome !== 'exercicio' && (
        <AvisoLembrete
          onComecar={() => {
            setLembrete(null)
            ir(telaDoExercicio())
          }}
          onDispensar={() => setLembrete(null)}
        />
      )}
    </div>
  )
}

// Computador = tela larga com mouse (ponteiro preciso). Celular e tablet em pé seguem para o app.
// iPad (com ou sem mouse) tem toque (maxTouchPoints > 0) e fica no app; só o computador sem toque vê o aviso.
const CONSULTA_COMPUTADOR = '(min-width: 900px) and (pointer: fine)'
// Com `?tecnico`, o computador abre o app (a equipe testa o ZENI pelo Chrome do notebook).
const ehComputador = () => !TECNICO && window.matchMedia(CONSULTA_COMPUTADOR).matches && navigator.maxTouchPoints === 0

export default function App() {
  const [computador, setComputador] = useState(ehComputador)
  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA_COMPUTADOR)
    const mudou = () => setComputador(ehComputador())
    consulta.addEventListener('change', mudou)
    return () => consulta.removeEventListener('change', mudou)
  }, [])
  if (computador) return <AvisoWeb />
  return (
    <NavegacaoProvider>
      <Telas />
    </NavegacaoProvider>
  )
}
