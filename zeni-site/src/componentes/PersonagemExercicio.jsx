// "Como fazer" em 3D: um personagem da cintura para cima (src/assets/zeni-personagem.glb, gerado por scripts/preparar-modelo.mjs
// a partir de "Wii fit - camisa lisa.glb": rig e animações feitos por código) com esqueleto e 6 animações em loop, uma por exercício (A a F, catálogo em src/simulacao.js). O exercício é feito com o braço direito; o nó Socket.R
// marca a palma da mão direita, e o ZENI entra como filho dele. A instrução precisa ser entendida sem ler texto.
// O ZENI é um LatheGeometry feito do perfil do modelo 3D (medidas em mm, escala 0,001). Não se carrega o STL.
// Aparência: material fosco (roughness 1), normais suavizadas, luz hemisférica + direcional fraca, sem sombras duras,
// fundo transparente, a cintura esmaecida no material (por vértice). As cores vêm dos tokens (tokens.css).
// Sem movimento (`parado`, "reduzir movimento"): só a pose inicial, parada, e nada de loop de renderização.
// Aba oculta: a renderização pausa.
// Modelo de origem: "Wii fit - camisa lisa.glb" (autoria e licença a confirmar). Ver docs/design-system.md.
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { clone as clonarComEsqueleto } from 'three/examples/jsm/utils/SkeletonUtils.js'
import modelo from '../assets/zeni-personagem.glb?url'
import { alturaDoZeni, conectado as zeniConectadoAgora, MODO_DO_EXERCICIO, rotacaoDoZeni } from '../zeni-dispositivo.js'

const CLIPES = {
  A: 'A_girar_o_punho',
  B: 'B_levantar_ate_o_ombro',
  C: 'C_no_ritmo',
  D: 'D_tocar_na_mesa',
  E: 'E_mesma_forca_ate_o_fim',
  F: 'F_lado_a_lado',
}
// Duração de cada clipe no contrato do app (docs/rig-atual.md, seção 3): o pulso amarelo de C (1,0 s) e D (1,2 s) e as
// pausas de A e B dependem delas. Ao carregar, o tempo de cada clipe é ajustado a estes valores, qualquer que seja a
// duração com que o arquivo foi exportado (o .glb não é editado).
const DURACAO_CLIPE_S = { A: 2.4, B: 3.2, C: 1.0, D: 1.2, E: 1.0, F: 1.6 }
const COM_MESA = ['D', 'F'] // exercícios com a mesa desenhada
const FADE_S = 0.4 // troca de animação com crossFadeTo

// Movimento calmo (público com Parkinson: nada brusco nem rápido). Os clipes já são suaves; por cima deles o tempo do clipe
// é remapeado aqui, sem clipe novo: velocidade menor, pausa curta nos pontos de virada (onde a velocidade já é zero, então
// não há solavanco) e partida gradual. O tronco, o pescoço e a cabeça não se mexem.
//   escala: velocidade do clipe (1 = a do arquivo). Em C e D fica 1, porque o ritmo é o do pulso amarelo (1,0 s e 1,2 s).
//   pausas: [tempo do clipe em s, segundos parado]. Só em pontos onde o clipe já para (A: viradas do punho; B: repouso e ombro).
//   F não para: a legenda pede para trocar de sentido sem parar no meio.
const CALMA = {
  A: { escala: 0.7, pausas: [[0.6, 0.6], [1.8, 0.6]] },
  B: { escala: 0.8, pausas: [[0, 0.5], [1.6, 0.8]] },
  F: { escala: 0.75, pausas: [] },
}
// Coluna, peito, pescoço e cabeça ficam em posição neutra e fixa: as tracks desses ossos são filtradas ao carregar o
// arquivo (o .glb não é editado). Só a cadeia do braço direito (clavícula, ombro, cotovelo, punho, mão) se move.
const OSSOS_FIXOS = ['Hips', 'Spine', 'Chest', 'Neck', 'Head']

const PARTIDA_S = 1.5 // a velocidade sobe de 0 a 100% nos primeiros segundos

// Divide um ciclo em trechos: andando no clipe ou parado. `real` = segundos reais do trecho.
function planoDoCiclo(duracao, escala, pausas) {
  const plano = []
  let t = 0
  for (const [em, parada] of [...pausas].sort((a, b) => a[0] - b[0])) {
    if (em > t) plano.push({ real: (em - t) / escala, de: t, ate: em })
    plano.push({ real: parada, de: em, ate: em })
    t = em
  }
  if (t < duracao) plano.push({ real: (duracao - t) / escala, de: t, ate: duracao })
  return { trechos: plano, ciclo: plano.reduce((a, x) => a + x.real, 0) }
}

// Tempo do clipe para uma fase (segundos reais) dentro do ciclo
function tempoDoClipe({ trechos, ciclo }, fase) {
  let f = fase % ciclo
  for (const x of trechos) {
    if (f <= x.real) return x.real === 0 ? x.de : x.de + ((x.ate - x.de) * f) / x.real
    f -= x.real
  }
  return trechos.at(-1).ate
}

// Perfil do ZENI: [z em mm da base ao topo, raio em mm]. Escala 0,001: 160 mm = 0,16 unidades.
const PERFIL_MM = [
  [0, 29.2], [10, 30.0], [20, 30.1], [30, 28.5], [40, 27.0], [50, 25.2], [60, 23.8], [70, 22.9], [80, 22.7],
  [90, 22.9], [100, 23.8], [110, 25.2], [120, 27.0], [130, 28.5], [140, 29.6], [150, 30.0], [160, 29.2],
]
const ESCALA = 0.001

// Encaixe do ZENI no Socket.R. A posição é o ajuste fino dentro da mão (espaço local do nó). A rotação não é fixa: é
// calculada ao carregar (encaixarZeni), para que em A, C e E, com o punho neutro (t = 0), o eixo longo fique na vertical.
const POSICAO_ZENI = [0, 0, 0]

// Câmera levemente de três quartos, enquadrando da cintura para cima
const VISTA = { posicao: [-0.85, 0.64, 2.15], alvo: [-0.05, 0.34, 0.15] }

const token = (nome) => getComputedStyle(document.documentElement).getPropertyValue(nome).trim()

// A malha do corpo é uma casca aberta (braços, mãos, pescoço e quadril sem tampa): com a face só de um lado (FrontSide) o
// fundo aparece por dentro. Por isso DoubleSide. O esmaecimento da cintura é feito aqui, por vértice, e não por máscara
// em CSS: só o tronco de baixo esmaece, braços e mãos (ossos Clavicle, UpperArm, Forearm, Hand) ficam sempre opacos.
const OSSOS_DO_BRACO = /^(Clavicle|UpperArm|Forearm|Hand|Fingers|Thumb)/
const FADE_DE = 0.14 // altura (em metros, na pose de repouso; Hips = 0) onde o tronco fica opaco
const FADE_ATE = -0.03 // e onde some

// Cor do corpo (26/11): cinza-100 em cima (cabeça e ombros) até cinza-200 perto da cintura, por vértice (atributo `color`).
const COR_ALTA_ATE = 0.6 // altura (m, Hips = 0) a partir da qual o corpo é todo cinza-100
const COR_BAIXA_DE = 0.05 // e abaixo da qual é todo cinza-200

function materialDoCorpo(corClara, corEscura, geo, esqueleto) {
  const pos = geo.attributes.position
  const idx = geo.attributes.skinIndex
  const pes = geo.attributes.skinWeight
  const fade = new Float32Array(pos.count)
  for (let i = 0; i < pos.count; i++) {
    let braco = 0
    for (let k = 0; k < 4; k++) {
      if (OSSOS_DO_BRACO.test(esqueleto.bones[[idx.getX, idx.getY, idx.getZ, idx.getW][k].call(idx, i)].name)) braco += [pes.getX, pes.getY, pes.getZ, pes.getW][k].call(pes, i)
    }
    const t = THREE.MathUtils.smoothstep(pos.getY(i), FADE_ATE, FADE_DE) // 0 embaixo, 1 em cima
    fade[i] = Math.min(1, t + Math.min(1, braco)) // braço pesa 1: nunca esmaece
  }
  geo.setAttribute('fade', new THREE.BufferAttribute(fade, 1))
  const cores = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    c.copy(corEscura).lerp(corClara, THREE.MathUtils.smoothstep(pos.getY(i), COR_BAIXA_DE, COR_ALTA_ATE))
    c.toArray(cores, i * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cores, 3))
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide, transparent: true })
  material.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float fade;\nvarying float vFade;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFade = fade;')
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vFade;').replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a *= vFade;')
  }
  return material
}

function criarZeni(cor) {
  const pontos = [new THREE.Vector2(0, 0), ...PERFIL_MM.map(([z, r]) => new THREE.Vector2(r * ESCALA, z * ESCALA)), new THREE.Vector2(0, 0.16)]
  let geo = new THREE.LatheGeometry(pontos, 48)
  geo.translate(0, -0.08, 0) // centro do ZENI na origem do encaixe
  geo.deleteAttribute('normal')
  geo.deleteAttribute('uv')
  geo = mergeVertices(geo) // vértices unidos, para as normais ficarem suaves
  geo.computeVertexNormals()
  const material = new THREE.MeshStandardMaterial({ color: cor, roughness: 1, metalness: 0 })
  return new THREE.Mesh(geo, material)
}

// Põe o ZENI de pé: com o clipe A em t = 0 (punho neutro), gira o ZENI no Socket.R até o eixo longo ficar na vertical do mundo.
function encaixarZeni(raiz, zeni, socket, clip) {
  const mixer = new THREE.AnimationMixer(raiz)
  mixer.clipAction(clip).play()
  mixer.setTime(0)
  raiz.updateMatrixWorld(true)
  zeni.quaternion.copy(socket.getWorldQuaternion(new THREE.Quaternion()).invert())
  mixer.stopAllAction()
  mixer.uncacheClip(clip)
  mixer.uncacheRoot(raiz)
}

// A altura mais baixa que a base do ZENI alcança em um clipe: onde a mesa fica (D e F).
function medirMesa(raiz, zeni, clip, socket) {
  const mixer = new THREE.AnimationMixer(raiz)
  mixer.clipAction(clip).play()
  const caixa = new THREE.Box3()
  const p = new THREE.Vector3()
  let achado = { y: Infinity, x: 0, z: 0 }
  for (let i = 0; i <= 24; i++) {
    mixer.setTime((clip.duration * i) / 24)
    raiz.updateMatrixWorld(true)
    caixa.setFromObject(zeni, true)
    if (caixa.min.y < achado.y) {
      socket.getWorldPosition(p)
      achado = { y: caixa.min.y, x: p.x, z: p.z }
    }
  }
  mixer.stopAllAction()
  mixer.uncacheClip(clip)
  mixer.uncacheRoot(raiz)
  return achado
}

// Fantasma do ZENI real: uma cópia translúcida virada como o ZENI de verdade está agora (inclinação absoluta; a direção
// em torno da vertical é zerada a cada Começar). O personagem é a pessoa, sem espelho.
// Cor: o quão perto o ZENI real está do CAMINHO da animação (a menor distância até qualquer pose do clipe, não até a pose
// daquele instante, para não punir quem está um pouco adiantado ou atrasado). Perto = verde, no meio = amarelo, longe =
// coral, com passagem suave. Em B e D (levantar e tocar na mesa), o fantasma também sobe e desce com a altura real,
// medida pela aceleração; nos outros, ele fica na mão do personagem (o sensor não mede posição, só giro e inclinação).
const PERTO_GRAUS = 15
const LONGE_GRAUS = 45

function FantasmaZeni({ zeni, trajetoria, exercicioId }) {
  const ref = useRef(null)
  const material = useRef(null)
  const cores = useMemo(
    () => ({ perto: new THREE.Color(token('--fantasma-perto')), meio: new THREE.Color(token('--fantasma-meio')), longe: new THREE.Color(token('--fantasma-longe')) }),
    [],
  )
  const tmp = useMemo(() => ({ alvo: new THREE.Quaternion(), p: new THREE.Vector3(), cor: new THREE.Color() }), [])
  const vertical = ['vertical', 'batida'].includes(MODO_DO_EXERCICIO[exercicioId])
  useFrame(() => {
    const f = ref.current
    if (!f) return
    f.visible = zeniConectadoAgora()
    if (!f.visible) return
    tmp.alvo.fromArray(rotacaoDoZeni())
    f.quaternion.slerp(tmp.alvo, 0.5) // suaviza um pouco o tremido na tela

    if (vertical && trajetoria) {
      f.position.copy(trajetoria.inicio)
      f.position.y += alturaDoZeni()
    } else {
      zeni.getWorldPosition(tmp.p)
      f.position.copy(tmp.p)
    }

    if (trajetoria && material.current) {
      let menor = Math.PI
      for (const q of trajetoria.poses) menor = Math.min(menor, 2 * Math.acos(Math.min(1, Math.abs(q.dot(tmp.alvo)))))
      const graus = THREE.MathUtils.radToDeg(menor)
      const t = THREE.MathUtils.clamp((graus - PERTO_GRAUS) / (LONGE_GRAUS - PERTO_GRAUS), 0, 1)
      if (t < 0.5) tmp.cor.copy(cores.perto).lerp(cores.meio, t * 2)
      else tmp.cor.copy(cores.meio).lerp(cores.longe, (t - 0.5) * 2)
      material.current.color.lerp(tmp.cor, 0.15)
      material.current.emissive.copy(material.current.color)
    }
  })
  return (
    // desenhado por cima da mão (depthTest desligado) e um pouco maior, para ler como um contorno brilhante
    <mesh ref={ref} geometry={zeni.geometry} renderOrder={10} scale={1.08}>
      <meshStandardMaterial ref={material} color={cores.meio} emissive={cores.meio} emissiveIntensity={0.5} roughness={1} metalness={0} transparent opacity={0.55} depthWrite={false} depthTest={false} />
    </mesh>
  )
}

// Poses do ZENI ao longo de um clipe (orientação no mundo), e onde ele está no começo: para a cor e a altura do fantasma
function medirTrajetoria(raiz, zeni, clip) {
  const mixer = new THREE.AnimationMixer(raiz)
  mixer.clipAction(clip).play()
  const poses = []
  let inicio = null
  for (let i = 0; i < 36; i++) {
    mixer.setTime((clip.duration * i) / 36)
    raiz.updateMatrixWorld(true)
    poses.push(zeni.getWorldQuaternion(new THREE.Quaternion()))
    if (i === 0) inicio = zeni.getWorldPosition(new THREE.Vector3())
  }
  mixer.stopAllAction()
  mixer.uncacheClip(clip)
  mixer.uncacheRoot(raiz)
  return { poses, inicio }
}

function Personagem({ exercicio, parado, vista, fantasma }) {
  const gltf = useGLTF(modelo, false, false)
  const invalidate = useThree((s) => s.invalidate)

  const { raiz, zeni, socket, corpos } = useMemo(() => {
    const raiz = clonarComEsqueleto(gltf.scene)
    const cinzaClaro = new THREE.Color(token('--cinza-100'))
    const cinzaEscuro = new THREE.Color(token('--cinza-200'))
    const corpos = []
    raiz.traverse((o) => {
      if (!o.isMesh) return
      const g = o.geometry.clone() // cópia própria: leva o atributo `fade` e pode ser descartada (as normais suaves já vêm no arquivo)
      o.geometry = g
      o.material = materialDoCorpo(cinzaClaro, cinzaEscuro, g, o.skeleton)
      corpos.push(o)
    })
    const socket = raiz.getObjectByName('SocketR') ?? raiz.getObjectByName('Socket.R') // o GLTFLoader tira o ponto do nome
    const zeni = criarZeni(token('--brand-bruma'))
    zeni.position.set(...POSICAO_ZENI)
    socket.add(zeni)
    encaixarZeni(raiz, zeni, socket, gltf.animations.find((c) => c.name === CLIPES.A))
    return { raiz, zeni, socket, corpos }
  }, [gltf])

  const mixer = useMemo(() => new THREE.AnimationMixer(raiz), [raiz])
  const atual = useRef(null)
  const movimento = useRef({ plano: null, fase: 0, decorrido: 0 })
  // clipes só com a cadeia do braço: sem as tracks de coluna, peito, pescoço e cabeça
  const clipes = useMemo(() => {
    return gltf.animations.map((c) => {
      const f = c.clone()
      f.tracks = f.tracks.filter((t) => !OSSOS_FIXOS.includes(t.name.split('.')[0]))
      const id = Object.keys(CLIPES).find((k) => CLIPES[k] === c.name)
      const k = id ? DURACAO_CLIPE_S[id] / c.duration : 1
      if (Math.abs(k - 1) > 1e-3) {
        for (const t of f.tracks) t.times = t.times.map((x) => x * k) // novo array: não mexe no clipe original
        f.resetDuration()
      }
      return f
    })
  }, [gltf])

  // Caminho do ZENI em cada clipe, para o fantasma
  const trajetorias = useMemo(() => {
    const t = {}
    for (const id of Object.keys(CLIPES)) t[id] = medirTrajetoria(raiz, zeni, clipes.find((c) => c.name === CLIPES[id]))
    return t
  }, [raiz, zeni, clipes])

  // Onde fica a mesa em D e F, medido no clipe
  const mesas = useMemo(() => {
    const m = {}
    for (const id of COM_MESA) m[id] = medirMesa(raiz, zeni, clipes.find((c) => c.name === CLIPES[id]), socket)
    return m
  }, [raiz, zeni, socket, clipes])

  // Cada exercício toca o seu clipe, com crossFadeTo de 0,4 s ao trocar
  useEffect(() => {
    const clip = clipes.find((c) => c.name === CLIPES[exercicio.id])
    const proxima = mixer.clipAction(clip)
    proxima.setLoop(THREE.LoopRepeat, Infinity)
    // O tempo do clipe é conduzido a mão (useFrame): timeScale 0, e `action.time` vem do plano do ciclo
    // E: mesma velocidade do começo ao fim, no ritmo do catálogo (ex.: 2 s por repetição)
    const calma = CALMA[exercicio.id]
    const escala = exercicio.repeticoes && exercicio.ritmoSeg ? clip.duration / exercicio.ritmoSeg : (calma?.escala ?? 1)
    movimento.current = { plano: planoDoCiclo(clip.duration, escala, calma?.pausas ?? []), fase: 0, decorrido: 0 }
    proxima.timeScale = 0
    proxima.reset().setEffectiveWeight(1).play()
    proxima.time = 0
    if (parado) {
      mixer.stopAllAction()
      proxima.reset().play()
      mixer.setTime(0) // pose inicial, parada
      proxima.paused = true
      atual.current = proxima
      invalidate()
      return
    }
    const anterior = atual.current
    if (anterior && anterior !== proxima) anterior.crossFadeTo(proxima, FADE_S, false)
    atual.current = proxima
    invalidate()
  }, [exercicio.id, exercicio.repeticoes, exercicio.ritmoSeg, clipes, mixer, parado, invalidate])

  useFrame((_, bruto) => {
    if (parado) return
    const dt = Math.min(bruto, 0.1)
    const m = movimento.current
    if (m.plano && atual.current) {
      m.decorrido += dt
      const q = Math.min(1, m.decorrido / PARTIDA_S)
      m.fase += dt * q * q * (3 - 2 * q) // partida gradual (smoothstep)
      atual.current.time = tempoDoClipe(m.plano, m.fase)
    }
    mixer.update(dt) // só cuida do crossFade, o tempo do clipe já foi posto
  })

  useEffect(
    () => () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(raiz)
      zeni.geometry.dispose()
      zeni.material.dispose()
      for (const c of corpos) {
        c.geometry.dispose()
        c.material.dispose()
      }
    },
    [mixer, raiz, zeni, corpos],
  )

  // a linha corre na horizontal da tela (direção "direita" da câmera no chão), não na do mundo
  const fx = vista.alvo[0] - vista.posicao[0]
  const fz = vista.alvo[2] - vista.posicao[2]
  const angulo = -Math.atan2(fx, -fz)
  const mesa = COM_MESA.includes(exercicio.id) ? mesas[exercicio.id] : null
  const corMesa = useMemo(() => token('--cinza-300'), [])
  return (
    <>
      <primitive object={raiz} />
      {fantasma && <FantasmaZeni zeni={zeni} trajetoria={trajetorias[exercicio.id]} exercicioId={exercicio.id} />}
      {mesa && (
        // linha de mesa suave, na altura onde a base do ZENI toca no ponto mais baixo do movimento
        <mesh position={[mesa.x, mesa.y - 0.005, mesa.z]} rotation={[0, angulo, 0]}>
          <boxGeometry args={[1.4, 0.01, 0.01]} />
          <meshStandardMaterial color={corMesa} roughness={1} metalness={0} />
        </mesh>
      )}
    </>
  )
}

// Área larga e baixa (tela de instrução): a câmera chega mais perto e olha um pouco mais para baixo, para a figura não ficar
// pequena. Na tela cheia do exercício (alta e estreita) a vista é a de `VISTA`, sem mudança.
function Camera({ vista }) {
  const { camera, size, invalidate } = useThree()
  useEffect(() => {
    const aspecto = size.width / size.height
    const k = THREE.MathUtils.clamp(1 - (aspecto - 0.56) * 0.2, 0.78, 1)
    const alvo = new THREE.Vector3(...vista.alvo)
    camera.position.copy(alvo).addScaledVector(new THREE.Vector3(...vista.posicao).sub(alvo), k)
    alvo.y -= (1 - k) * 0.18
    camera.lookAt(alvo)
    invalidate()
  }, [camera, size, vista, invalidate])
  return null
}

function Luzes() {
  const ceu = useMemo(() => token('--white'), [])
  const chao = useMemo(() => token('--cinza-100'), [])
  return (
    <>
      <hemisphereLight args={[ceu, chao, 2.3]} />
      <directionalLight position={[-1.2, 2, 2.2]} intensity={0.7} />
    </>
  )
}

// `fantasma`: mostra o ZENI real (translúcido) junto da animação. Só com o ZENI de verdade conectado.
export default function PersonagemExercicio({ exercicio, parado, pulso = false, vista = VISTA, fantasma = false }) {
  const [visivel, setVisivel] = useState(() => !document.hidden)
  useEffect(() => {
    const f = () => setVisivel(!document.hidden)
    document.addEventListener('visibilitychange', f)
    return () => document.removeEventListener('visibilitychange', f)
  }, [])

  return (
    <div className="personagem" role="img" aria-label={`${exercicio.nome}: ${exercicio.legenda}`}>
      {pulso && (
        <div className="personagem-pulso andamento-bulb andamento-bulb--pulsa" style={{ '--guia-ritmo': `${exercicio.ritmoSeg}s`, '--amplitude': 0.5 }} aria-hidden="true" />
      )}
      <div className="personagem-quadro">
      <Canvas
        dpr={[1, 2]} // devicePixelRatio limitado a 2
        frameloop={!visivel ? 'never' : parado && !fantasma ? 'demand' : 'always'}
        gl={{ alpha: true, antialias: true }}
        camera={{ position: vista.posicao, fov: 29, near: 0.1, far: 20 }}
        onCreated={({ camera }) => camera.lookAt(...vista.alvo)}
      >
        <Camera vista={vista} />
        <Luzes />
        <Suspense fallback={null}>
          <Personagem exercicio={exercicio} parado={parado} vista={vista} fantasma={fantasma} />
        </Suspense>
      </Canvas>
      </div>
    </div>
  )
}
