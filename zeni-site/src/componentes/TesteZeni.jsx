// Teste ao vivo do ZENI real: a pessoa mexe o ZENI e o desenho mexe junto. É assim que se confere, sem termos
// técnicos, que a conexão, o sensor de movimento e a bateria estão certos.
// Usado em Conectar (depois da posição inicial e em "Conexão com o ZENI" quando já está conectado).
import { Battery0Icon, Battery50Icon, Battery100Icon, CheckIcon, SignalIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import silhueta from '../assets/zeni-silhueta.svg'
import Botao from './Botao.jsx'
import { calibrarDePe, FLAG } from '../zeni-dispositivo.js'
import { useMovimentoAoVivo, useZeni } from '../usarZeni.js'

function Linha({ ok, Icone, children }) {
  return (
    <li className={`teste-linha${ok ? ' teste-linha--ok' : ''}`}>
      <span className="teste-linha-icone" aria-hidden="true">
        {ok ? <CheckIcon className="icone" /> : <Icone className="icone" />}
      </span>
      <span>{children}</span>
    </li>
  )
}

export function IconeBateria({ nivel, className }) {
  const Icone = nivel <= 25 ? Battery0Icon : nivel <= 60 ? Battery50Icon : Battery100Icon
  return <Icone className={className} aria-hidden="true" />
}

export default function TesteZeni() {
  const zeni = useZeni()
  const vivo = useMovimentoAoVivo({ janelas: true })
  const sentindo = zeni.conectado && vivo.recebendo && (zeni.flags & FLAG.sensorOk) !== 0
  const bateria = zeni.bateria
  // Dois desenhos com a inclinação ABSOLUTA do ZENI: como a pessoa vê (para a direita = direita dela) e de lado (a pessoa
  // à esquerda; para a direita = para longe dela). Limitada para não virar de ponta-cabeça.
  const lim = (v, m) => Math.max(-m, Math.min(m, v))
  const [ajuste, setAjuste] = useState(null) // null | número de 0 a 1 (segurando) | 'ok'
  const ajustar = async () => {
    setAjuste(0)
    try {
      await calibrarDePe(1500, setAjuste)
      setAjuste('ok')
    } catch {
      setAjuste(null)
    }
  }

  return (
    <div className="teste">
      <div className="teste-vistas" aria-hidden="true">
        <div className="teste-vista">
          <div className="teste-mostrador">
            <div className="teste-brilho" style={{ '--movimento': vivo.tamanho / 100 }} />
            <img className="teste-zeni" src={silhueta} alt="" style={{ transform: `rotate(${lim(vivo.lado, 170)}deg)` }} />
          </div>
          <span className="teste-vista-rotulo">Como você vê</span>
        </div>
        <div className="teste-vista">
          <div className="teste-mostrador">
            <div className="teste-brilho" style={{ '--movimento': vivo.tamanho / 100 }} />
            <span className="teste-voce">você</span>
            <img className="teste-zeni" src={silhueta} alt="" style={{ transform: `rotate(${lim(vivo.frente, 170)}deg)` }} />
          </div>
          <span className="teste-vista-rotulo">De lado</span>
        </div>
      </div>
      <p className="conectar-destaque">Mexa o ZENI: o desenho mexe junto.</p>
      <div className="teste-barra" role="meter" aria-label="Movimento" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(vivo.tamanho)}>
        <span className="teste-barra-rotulo">Movimento</span>
        <span className="teste-barra-trilho">
          <span className="teste-barra-cheio" style={{ transform: `scaleX(${vivo.tamanho / 100})` }} />
        </span>
      </div>
      <div className="teste-ajustar">
        <Botao variante="vazado" onClick={ajustar} desativado={typeof ajuste === 'number'}>
          {typeof ajuste === 'number' ? 'Segure de pé, parado…' : ajuste === 'ok' ? 'Pronto: esta é a posição de pé' : 'Ajustar o ZENI'}
        </Botao>
      </div>
      <ul className="teste-lista">
        <Linha ok={zeni.conectado} Icone={SignalIcon}>
          {zeni.conectado ? 'Conectado' : 'Procurando o ZENI…'}
        </Linha>
        <Linha ok={sentindo} Icone={SignalIcon}>
          {sentindo ? 'Sentindo o movimento' : 'Ainda não sinto o movimento'}
        </Linha>
        <li className="teste-linha teste-linha--ok">
          <span className="teste-linha-icone" aria-hidden="true">
            {bateria === null ? <Battery100Icon className="icone" /> : <IconeBateria nivel={bateria} className="icone" />}
          </span>
          <span>{bateria === null ? 'Bateria: sem medida neste ZENI' : `Bateria: ${bateria}%`}</span>
        </li>
      </ul>
    </div>
  )
}
