// Desenho de como posicionar o ZENI em cada passo da calibração, visto de lado: a pessoa à esquerda, a mesa embaixo.
//   de-pe   o ZENI de pé na mesa, parado
//   inclinar  o ZENI, na mão, inclina uns 40° para longe da pessoa e volta (em loop)
// `mesa`: desenha a mesa (no de pé da primeira vez). `pronto`: o passo já foi reconhecido (mostra a posição final).
import silhueta from '../assets/zeni-silhueta.svg'

const MESA_Y = 150
const BASE_X = 160
const L = 36 // largura do desenho do ZENI
const A = 91 // altura (proporção do ZENI: 160 × 60 mm)

export default function GuiaPosicao({ passo, pronto = false, mesa = false }) {
  const deitar = passo === 'inclinar'
  return (
    <svg className={`guia${deitar ? ' guia--deitar' : ''}${pronto ? ' guia--pronto' : ''}`} viewBox="0 20 320 165" role="img"
      aria-label={deitar ? 'Incline a ponta de cima do ZENI para longe de você' : 'O ZENI de pé, parado'}>
      {/* você */}
      <g className="guia-voce">
        <circle cx="46" cy="84" r="14" />
        <path d="M20 150 C20 118 31 106 46 106 C61 106 72 118 72 150 Z" />
        <text x="46" y="172" textAnchor="middle">você</text>
      </g>
      {/* mesa */}
      {mesa && <line className="guia-mesa" x1="100" y1={MESA_Y} x2="306" y2={MESA_Y} />}
      {/* o ZENI: inclina em torno da base, como na mão */}
      <g className="guia-zeni" style={{ transformOrigin: `${BASE_X}px ${MESA_Y}px` }}>
        <image href={silhueta} x={BASE_X - L / 2} y={MESA_Y - A} width={L} height={A} />
      </g>
      {deitar && (
        <g className="guia-seta">
          <path d="M168 44 Q 214 38 236 70" />
          <path d="M236 70 l-11 -4 M236 70 l1 -12" />
          <text x="214" y="34" textAnchor="middle">para longe de você</text>
        </g>
      )}
    </svg>
  )
}
