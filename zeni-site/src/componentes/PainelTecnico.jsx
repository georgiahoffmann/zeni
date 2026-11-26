// Painel técnico do ZENI real, só com `?tecnico` no endereço. Para a equipe conferir o protótipo: taxa de pacotes,
// perdas, ângulos, bateria, calibração e firmware. Não aparece para quem usa o app.
import { useMovimentoAoVivo, useZeni } from '../usarZeni.js'
import { calibrado, inclinacaoDoZeni, temFrente, ultimo } from '../zeni-dispositivo.js'

const CAL = ['nunca', 'medindo', 'ok', 'mexeu', 'sem sensor']

export default function PainelTecnico() {
  const z = useZeni()
  useMovimentoAoVivo() // atualiza a ~15 Hz
  const p = ultimo()
  const perda = z.pacotes ? ((z.perdidos / (z.pacotes + z.perdidos)) * 100).toFixed(1) : '0.0'
  const f = (v, n = 2) => (v ?? 0).toFixed(n).padStart(7)
  const inc = p ? inclinacaoDoZeni() : { lado: 0, frente: 0 }
  return (
    <div className="tecnico" aria-hidden="true">
      {`ZENI ${z.conectado ? `● ${z.nome}` : '○ desconectado'}  fw ${z.info?.fw ?? '-'}
${z.hz} Hz  perdidos ${z.perdidos} (${perda}%)
roll ${f(z.roll, 1)}°  pitch ${f(z.pitch, 1)}°  (sensor)
lado ${f(inc.lado, 1)}°  frente ${f(inc.frente, 1)}°  (ZENI)  montagem ${calibrado() ? (temFrente() ? 'completa' : 'só de pé') : 'nenhuma'}
acel ${f(p?.ax)} ${f(p?.ay)} ${f(p?.az)} g  |a| ${f(p ? Math.hypot(p.ax, p.ay, p.az) : 0)}
giro ${f(p?.gx, 1)} ${f(p?.gy, 1)} ${f(p?.gz, 1)} °/s
bateria ${z.bateria ?? 'sem medida'}  cal ${CAL[z.calibracao] ?? z.calibracao}  flags ${z.flags.toString(2).padStart(5, '0')}`}
    </div>
  )
}
