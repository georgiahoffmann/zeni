// Segue: fluxo-do-app.md, seção "Tela inicial (Home)", H.3, com a decisão da autora da Home:
// em cima, uma faixa com os dados de saúde; embaixo, evolução (esquerda) e exercício (direita);
// Personalizar como ícone no canto.
// Topo (decisões 10, 13 e 16 de 25/11): avatar com menu (Personalizar e Conexão com o ZENI) e pílula do ZENI.
// Layout (25/11): tudo encostado no rodapé; o espaço que sobra no topo é preenchido pelo gradiente em bulb.
import { useEffect, useState } from 'react'
import { ChartBarIcon, PlayCircleIcon } from '@heroicons/react/24/outline'
import AvisoConexao from '../componentes/AvisoConexao.jsx'
import logo from '../assets/zeni-logo.svg'
import MenuAvatar from '../componentes/MenuAvatar.jsx'
import { IconeBateria } from '../componentes/TesteZeni.jsx'
import { bateriaDoZeni, telaDoExercicio, zeniConectado } from '../fluxo.js'
import { useNavegacao } from '../navegacao.jsx'
import { CHAVES, ler } from '../storage.js'
import { useZeni } from '../usarZeni.js'

// PROVISÓRIO: a ordem e o formato dos destinos são decisão do grupo
// (fluxo-do-app.md, "O fluxograma não define a ordem nem o formato"; design system, pendência 11).
// Para mudar, basta reordenar este array ou trocar o `gradiente`.
// `tela` pode ser uma função: o exercício passa antes pela triagem e pela conexão (src/fluxo.js).
// A ordem do array é a ordem na tela, da esquerda para a direita. Só o exercício usa o amarelo.
const DESTINOS = [
  { id: 'evolucao', titulo: 'Minha\nevolução', tela: 'evolucao', gradiente: 'azul', Icone: ChartBarIcon },
  { id: 'exercicio', titulo: 'Começar o exercício', tela: telaDoExercicio, gradiente: 'amarelo', Icone: PlayCircleIcon },
]

// TODO: os dados reais virão do MPU (sensor de movimento do ZENI). Por enquanto, o último exercício
// guardado no aparelho (fluxo-do-app.md, 3.1). Sem histórico, o número fica como "–" (estado vazio).
const DADOS = [
  { id: 'suavidade', rotulo: 'suavidade' },
  { id: 'ritmo', rotulo: 'ritmo' },
]

// Duração da contagem: lê --dur-count do tokens.css. Com "reduzir movimento" o token vale 0ms.
function duracaoDaContagem() {
  const bruto = getComputedStyle(document.documentElement).getPropertyValue('--dur-count').trim()
  const ms = bruto.endsWith('ms') ? parseFloat(bruto) : parseFloat(bruto) * 1000
  return Number.isFinite(ms) ? ms : 0
}

// Conta de 0 até `alvo`. Sem alvo (estado vazio) ou sem movimento, devolve o valor direto.
function useContagem(alvo) {
  const [valor, setValor] = useState(0)
  const [duracao] = useState(duracaoDaContagem)
  useEffect(() => {
    if (typeof alvo !== 'number' || duracao <= 0) return undefined
    let quadro
    const inicio = performance.now()
    const passo = (agora) => {
      const t = Math.min((agora - inicio) / duracao, 1)
      setValor(Math.round(alvo * (1 - (1 - t) ** 3))) // desacelera no fim
      if (t < 1) quadro = requestAnimationFrame(passo)
    }
    quadro = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(quadro)
  }, [alvo, duracao])
  return duracao <= 0 ? alvo : valor
}

// Pílula do ZENI: com conexão, o nível de bateria; sem conexão, só "ZENI desconectado" (decisão 16 de 25/11).
// ZENI real: acompanha a conexão e a bateria ao vivo. Se o ZENI não mede a bateria, mostra "ZENI conectado".
function PilulaZeni() {
  useZeni() // re-renderiza quando a conexão ou a bateria do ZENI real mudam
  if (!zeniConectado()) {
    return (
      <p className="pilula pilula--desconectado" role="status">
        ZENI desconectado
      </p>
    )
  }
  const nivel = bateriaDoZeni()
  if (nivel === null || nivel === undefined) {
    return (
      <p className="pilula" role="status">
        ZENI conectado
      </p>
    )
  }
  return (
    <p className={`pilula${nivel <= 20 ? ' pilula--fraca' : ''}`} role="status">
      <IconeBateria nivel={nivel} className="icone pilula-icone" />
      <span className="sr-only">Bateria do ZENI: </span>
      {nivel}%
    </p>
  )
}

function Dado({ rotulo, valor, ordem }) {
  const temValor = typeof valor === 'number'
  const contado = useContagem(valor)
  return (
    <div className={`dado${temValor ? ' dado--com-valor' : ''}`}>
      <p className="dado-numero">{temValor ? contado : '–'}</p>
      <p className="dado-rotulo entrada" style={{ '--i': ordem + 1 }}>
        {rotulo}
      </p>
    </div>
  )
}

export default function Home() {
  const { ir } = useNavegacao()
  // Exercícios encerrados antes do fim ficam registrados sem nota: o dashboard mostra o último que tem números
  const ultimo = ler(CHAVES.historico, []).findLast((h) => Number.isFinite(h.nota))
  return (
    <main className="tela tela--home">
      <AvisoConexao />
      <header className="home-topo">
        <button type="button" className="home-logo-botao" aria-label="ZENI: ver a tela de entrada" onClick={() => window.dispatchEvent(new Event('zeni:abertura'))}>
          <span className="home-logo" aria-hidden="true" style={{ '--logo': `url(${logo})` }} />
        </button>
        <div className="home-topo-direita">
          <PilulaZeni />
          <MenuAvatar
            itens={[
              { id: 'personalizar', rotulo: 'Personalizar', onEscolher: () => ir('personalizar') },
              { id: 'conexao', rotulo: 'Conexão com o ZENI', onEscolher: () => ir('conectar') },
            ]}
          />
        </div>
      </header>
      {/* Espaço livre entre o topo e o dashboard; o fundo é o gradiente da Home (26/11) */}
      <div className="home-bulb" aria-hidden="true" />
      <section className="home-dados" aria-label="Seus dados de saúde">
        {DADOS.map((d, i) => (
          <Dado key={d.id} rotulo={d.rotulo} valor={ultimo?.[d.id]} ordem={i} />
        ))}
      </section>
      <div className="home-grade">
        {DESTINOS.map((d, i) => (
          <button
            key={d.id}
            type="button"
            className={`cartao cartao--${d.gradiente}`}
            onClick={() => ir(typeof d.tela === 'function' ? d.tela() : d.tela)}
          >
            <d.Icone className="icone cartao-icone entrada" style={{ '--i': i + 3 }} aria-hidden="true" />
            <span className="cartao-titulo entrada" style={{ '--i': i + 3 }}>
              {d.titulo}
            </span>
          </button>
        ))}
      </div>
    </main>
  )
}
