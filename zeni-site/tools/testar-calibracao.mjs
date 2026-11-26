// Teste da calibração sem hardware: sensor montado torto, dois passos, começo inclinado. Rodar: node tools/testar-calibracao.mjs
globalThis.localStorage={getItem:()=>null,setItem:()=>{}}
const m = await import('../src/zeni-dispositivo.js')
let seq=0, fake=0; performance.now = () => fake
const rot=(ax,deg)=>{const c=Math.cos(deg*Math.PI/180),s=Math.sin(deg*Math.PI/180);return ax==='x'?[[1,0,0],[0,c,-s],[0,s,c]]:ax==='y'?[[c,0,s],[0,1,0],[-s,0,c]]:[[c,-s,0],[s,c,0],[0,0,1]]}
const mul=(A,B)=>A.map(r=>B[0].map((_,j)=>r.reduce((s,v,k)=>s+v*B[k][j],0)))
const mv=(A,v)=>A.map(r=>r[0]*v[0]+r[1]*v[1]+r[2]*v[2])
const T=(A)=>A[0].map((_,i)=>A.map(r=>r[i]))
const R0=mul(rot('x',70),rot('z',40)) // sensor torto: vetor no ZENI -> vetor no sensor
// Pose P: ZENI -> mundo, no referencial da PESSOA: y cima, z = para longe da pessoa, x = esquerda da pessoa
const leitura=(P)=>mv(R0, mv(T(P),[0,1,0]))
function segura(P, seg){ const a=leitura(P); for(let i=0;i<seg*50;i++){ fake+=20; const d=new DataView(new ArrayBuffer(20)); d.setUint8(0,seq++&255); a.forEach((v,k)=>d.setInt16(2+k*2,Math.round(v*1000),true)); m.receberPacote(d)} }
const I=[[1,0,0],[0,1,0],[0,0,1]]
segura(I,3)
const p1=m.calibrarDePe(1000); segura(I,2); await p1
// inclinar 40° com a ponta para longe (+z), na mão: gira em torno de x (y -> z)
const p2=m.calibrarFrente(600); segura(rot('x',40),3); await p2
// começar o exercício segurando torto (15° para trás): não pode mudar a inclinação absoluta
segura(rot('x',-15),4); m.zerarDirecao()
for (const [nome,P] of [['de pé',I],['30° p/ longe',rot('x',30)],['30° p/ trás',rot('x',-30)],['30° p/ esquerda da pessoa',rot('z',-30)],['30° p/ direita',rot('z',30)]]) { segura(P,6); const i=m.inclinacaoDoZeni(); console.log(nome.padEnd(26),'lado',i.lado.toFixed(1).padStart(6),'frente',i.frente.toFixed(1).padStart(6)) }
