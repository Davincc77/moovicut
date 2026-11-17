import test from 'node:test'
import assert from 'node:assert/strict'
import { dispatchAgentRequest } from '../server/agent-api.mjs'

function plan(body) {
  const response = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify(body)
  })
  return { status: response.status, body: JSON.parse(response.body) }
}

function prose(text, promptLanguage) {
  return plan({ input: 'prose', prose: text, promptLanguage, model: 'grok', compact: true })
}

function line(prompt, prefix) {
  return (prompt || '').split('\n').find(item => item.startsWith(prefix)) || ''
}

function lock(prompt, name) {
  return (prompt || '').split('\n').find(item => item.includes(`${name} —`)) || ''
}

const EFRÉM = 'Efrém Dias tem quarenta e quatro anos, barba curta, um casaco verde e um boné. Ao amanhecer, Efrém pilota o barco pelo rio. Efrém aponta para a margem. Efrém espera no posto de saúde. Ao meio-dia, Efrém descola com o avião sobre o rio. Efrém olha pela janela. De manhã Efrém abre a escola de surf. Efrém explica a maré.'
const QUILL = 'Quill Avery is a thirty-four-year-old tailor with slicked-back black hair, a green velvet blazer and a silver ring. Yara Holt is a twenty-seven-year-old courier with short dreadlocks, a denim jacket and a brown satchel. Quill irons his blazer in the workshop. Quill drops his ring on the floor. Yara picks up the ring. Yara gives the ring back to Quill. Quill puts the ring on. Later Quill loses a locket in the street. Quill hangs the compass. Quill searches his pockets.'
const SYBIL = 'Sybil Hart is a thirty-eight-year-old jeweller with a bob, an olive coat and a silver ring. Willa Pen is a twenty-nine-year-old courier with black hair and a grey coat. Sybil waits in the hall. Willa waits. Sybil hands the ring back to Willa Pen. Willa nods.'
const SYBIL_RETURN = 'Sybil Hart is a thirty-eight-year-old jeweller with a bob, an olive coat and a silver ring. Willa Pen is a twenty-nine-year-old courier with black hair and a grey coat. Sybil waits in the hall. Willa waits. Sybil returns the ring to Willa Pen. Willa nods.'
const TEODORA = 'Teodora Vaz tem vinte e nove anos, cabelo curto, um casaco verde, um apito e um cachecol. Teodora espera no cais. Teodora deixa cair o apito. Teodora perde o cachecol. Teodora acena.'
const TEODORA_CAIR = 'Teodora Vaz tem vinte e nove anos, cabelo curto, um casaco verde, um apito e um cachecol. Teodora espera no cais. Teodora deixa o apito cair. Teodora perde o cachecol. Teodora acena.'
const BELMIRO = 'Belmiro Caeiro tem trinta anos, cabelo curto, um casaco azul, espera no cais. Belmiro veste um impermeável amarelo. Belmiro tira o casaco. Belmiro põe um chapéu. Belmiro despe o chapéu. Belmiro acena.'
const QUINTA = 'Quinta Melo tem trinta anos, cabelo curto, um casaco azul e um pincel. Lurdes Pinto, a avó, tem sessenta e oito anos, cabelo branco, um vestido preto e uma bengala. Quinta ajuda a avó. Os dois pintam lado a lado. Quinta veste um impermeável amarelo. Quinta tira o casaco azul. Quinta acena.'
const INÊS = 'Inês Bravo tem trinta anos, cabelo curto, um casaco azul, espera no atelier. Odília Nunes, 68 anos, cabelo branco, vestido preto, é a avó. Valério Paes, 40 anos, barba curta, casaco cinzento, espera na porta. Inês ajuda a avó. Os dois pintam lado a lado.'

test('lowercase abre a escola de surf stays Escola de surf on the prose compact path', () => {
  const planned = prose(EFRÉM, 'pt')
  assert.equal(planned.status, 200, planned.body.message)
  const last = planned.body.shots.slice(-2)
  assert.equal(last.length, 2)
  for (const shot of last) {
    assert.match(line(shot.prompt, 'PLACE'), /Escola de surf/)
    assert.doesNotMatch(line(shot.prompt, 'PLACE'), /PLACE: Escola\./)
  }
  const english = prose('Nora Keel is forty, short hair, green coat, waits on the quay. Nora opens the surf school. Nora explains the tide.', 'en')
  assert.equal(english.status, 200, english.body.message)
  for (const shot of english.body.shots.slice(-2)) assert.match(line(shot.prompt, 'PLACE'), /Surf school/)
})

test('giving the ring back restores silver ring on the named person and later props stay out of the first lock', () => {
  const planned = prose(QUILL, 'en')
  assert.equal(planned.status, 200, planned.body.message)
  const first = lock(planned.body.shots[0].prompt, 'Quill Avery')
  assert.match(first, /silver ring/)
  assert.doesNotMatch(first, /locket|compass/)
  assert.doesNotMatch(first, /\b(gives|drops|picks|puts|loses|hangs|irons)\b/)
  const handed = planned.body.shots.find(shot => /gives the ring back/.test(shot.prompt))
  assert.match(lock(handed.prompt, 'Quill Avery'), /silver ring/)
  assert.doesNotMatch(lock(handed.prompt, 'Yara Holt'), /ring/)
  assert.doesNotMatch(lock(handed.prompt, 'Quill Avery'), /\bto Quill\b|back to/)
  assert.doesNotMatch(lock(handed.prompt, 'Yara Holt'), /\bto Quill\b|back to/)
  for (const shot of planned.body.shots) {
    assert.doesNotMatch(lock(shot.prompt, 'Quill Avery'), /\b(gives|drops|picks|puts|loses|hangs)\b/)
    assert.doesNotMatch(lock(shot.prompt, 'Yara Holt'), /\b(gives|drops|picks|puts|loses|hangs)\b/)
  }
  const portuguese = prose('Nuno Vale tem trinta e quatro anos, cabelo preto, um casaco verde e um anel de prata. Rita Gomes tem vinte e sete anos, cabelo curto, uma jaqueta e uma bolsa. Nuno deixa cair o anel. Rita pega o anel. Rita devolve o anel a Nuno. Nuno acena.', 'pt')
  const back = portuguese.body.shots.find(shot => /devolve o anel/.test(shot.prompt))
  assert.match(lock(back.prompt, 'Nuno Vale'), /anel/)
  assert.doesNotMatch(lock(back.prompt, 'Rita Gomes'), /anel/)
})

test('hands the ring back and returns the ring put silver ring on the receiver', () => {
  for (const text of [SYBIL, SYBIL_RETURN]) {
    const planned = prose(text, 'en')
    assert.equal(planned.status, 200, planned.body.message)
    const shot = planned.body.shots.find(item => /hands the ring back|returns the ring/.test(item.prompt))
    assert.match(lock(shot.prompt, 'Willa Pen'), /silver ring/)
    assert.doesNotMatch(lock(shot.prompt, 'Sybil Hart'), /ring/)
    for (const row of planned.body.shots) {
      assert.doesNotMatch(lock(row.prompt, 'Sybil Hart'), /to Willa Pen/)
      assert.doesNotMatch(lock(row.prompt, 'Willa Pen'), /to Willa Pen/)
    }
  }
  const portuguese = prose('Sara Luz tem trinta e oito anos, cabelo curto, um casaco verde e um anel de prata. Mia Cruz tem vinte e nove anos, cabelo preto, um casaco cinzento. Sara espera no salão. Mia espera. Sara devolve o anel a Mia Cruz. Mia acena.', 'pt')
  const shot = portuguese.body.shots.find(item => /devolve o anel/.test(item.prompt))
  assert.match(lock(shot.prompt, 'Mia Cruz'), /anel/)
  assert.doesNotMatch(lock(shot.prompt, 'Sara Luz'), /anel/)
  assert.doesNotMatch(shot.prompt, /to Mia|para Mia Cruz —/)
})

test('deixa cair and deixa o apito cair remove apito, and perde removes cachecol', () => {
  for (const text of [TEODORA, TEODORA_CAIR]) {
    const planned = prose(text, 'pt')
    assert.equal(planned.status, 200, planned.body.message)
    assert.match(lock(planned.body.shots[0].prompt, 'Teodora Vaz'), /apito/)
    assert.match(lock(planned.body.shots[0].prompt, 'Teodora Vaz'), /cachecol/)
    assert.doesNotMatch(lock(planned.body.shots[0].prompt, 'Teodora Vaz'), /\bum\b/)
    assert.doesNotMatch(lock(planned.body.shots[1].prompt, 'Teodora Vaz'), /apito/)
    assert.match(lock(planned.body.shots[1].prompt, 'Teodora Vaz'), /cachecol/)
    assert.doesNotMatch(lock(planned.body.shots[2].prompt, 'Teodora Vaz'), /cachecol|apito/)
    assert.doesNotMatch(lock(planned.body.shots[3].prompt, 'Teodora Vaz'), /cachecol|apito/)
  }
  const english = prose('Lena Voss is twenty-nine, short hair, green coat, a whistle and a scarf, waits on the quay. Lena drops the whistle. Lena loses the scarf. Lena waves.', 'en')
  assert.match(lock(english.body.shots[0].prompt, 'Lena Voss'), /whistle/)
  assert.doesNotMatch(lock(english.body.shots[1].prompt, 'Lena Voss'), /whistle/)
  assert.match(lock(english.body.shots[1].prompt, 'Lena Voss'), /scarf/)
  assert.doesNotMatch(lock(english.body.shots.at(-1).prompt, 'Lena Voss'), /whistle|scarf/)
})

test('veste, tira, põe, and despe version a full-name outfit from that shot', () => {
  const planned = prose(BELMIRO, 'pt')
  assert.equal(planned.status, 200, planned.body.message)
  assert.match(lock(planned.body.shots[0].prompt, 'Belmiro Caeiro'), /casaco azul/)
  assert.doesNotMatch(lock(planned.body.shots[0].prompt, 'Belmiro Caeiro'), /impermeável|chapéu/)
  assert.match(lock(planned.body.shots[1].prompt, 'Belmiro Caeiro'), /impermeável amarelo/)
  assert.match(lock(planned.body.shots[1].prompt, 'Belmiro Caeiro'), /casaco azul/)
  assert.doesNotMatch(lock(planned.body.shots[2].prompt, 'Belmiro Caeiro'), /casaco/)
  assert.match(lock(planned.body.shots[2].prompt, 'Belmiro Caeiro'), /impermeável/)
  assert.match(lock(planned.body.shots[3].prompt, 'Belmiro Caeiro'), /chapéu/)
  assert.doesNotMatch(lock(planned.body.shots[3].prompt, 'Belmiro Caeiro'), /\bpõe\b|\bveste\b/)
  assert.doesNotMatch(lock(planned.body.shots[4].prompt, 'Belmiro Caeiro'), /chapéu/)
  assert.match(lock(planned.body.shots[5].prompt, 'Belmiro Caeiro'), /impermeável/)
  assert.doesNotMatch(lock(planned.body.shots[5].prompt, 'Belmiro Caeiro'), /casaco|chapéu/)
  const english = prose('Owen Hart is thirty, short hair, a blue coat, waits on the quay. Owen puts on a yellow raincoat. Owen takes off the coat. Owen waves.', 'en')
  const wear = english.body.shots.find(shot => /yellow raincoat/.test(shot.prompt))
  assert.match(lock(wear.prompt, 'Owen Hart'), /yellow raincoat/)
  assert.match(lock(english.body.shots.at(-1).prompt, 'Owen Hart'), /raincoat/)
  assert.doesNotMatch(lock(english.body.shots.at(-1).prompt, 'Owen Hart'), /blue coat/)
})

test('a second full name versions the same way and Os dois is the previous pair', () => {
  const planned = prose(QUINTA, 'pt')
  assert.equal(planned.status, 200, planned.body.message)
  const wear = planned.body.shots.find(shot => /impermeável amarelo/.test(shot.prompt))
  assert.match(lock(wear.prompt, 'Quinta Melo'), /impermeável amarelo/)
  assert.match(lock(wear.prompt, 'Quinta Melo'), /casaco azul/)
  const last = lock(planned.body.shots.at(-1).prompt, 'Quinta Melo')
  assert.match(last, /impermeável/)
  assert.doesNotMatch(last, /casaco/)
  assert.match(last, /pincel/)
  const pair = prose(INÊS, 'pt')
  const both = pair.body.shots.find(shot => /pintam lado a lado/.test(shot.prompt))
  assert.match(lock(both.prompt, 'Inês Bravo'), /casaco azul/)
  assert.match(lock(both.prompt, 'Odília Nunes'), /vestido preto/)
  assert.equal(lock(both.prompt, 'Valério Paes'), '')
  const english = prose('Ines Bravo is thirty, short hair, a blue coat, waits in the studio. Odilia Nunes is 68, white hair, a black dress, and is the grandmother. Valerio Paes is 40, short beard, a grey coat, waits at the door. Ines helps the grandmother. Both paint side by side.', 'en')
  const painted = english.body.shots.find(shot => /paint side by side/.test(shot.prompt))
  assert.match(lock(painted.prompt, 'Ines Bravo'), /blue coat/)
  assert.match(lock(painted.prompt, 'Odilia Nunes'), /black dress/)
  assert.equal(lock(painted.prompt, 'Valerio Paes'), '')
})

test('holds, segura, and mostra add the noun from that shot', () => {
  const portuguese = prose('Heitor, 62 anos, careca, cachecol cinzento, traz um cachimbo e um chapéu, espera na loja. Heitor segura o lápis. Heitor mostra as argolas. Heitor acena.', 'pt')
  assert.doesNotMatch(lock(portuguese.body.shots[0].prompt, 'Heitor'), /lápis|argolas/)
  assert.match(lock(portuguese.body.shots[1].prompt, 'Heitor'), /lápis/)
  assert.doesNotMatch(lock(portuguese.body.shots[1].prompt, 'Heitor'), /argolas|segura|mostra/)
  assert.match(lock(portuguese.body.shots.at(-1).prompt, 'Heitor'), /lápis/)
  assert.match(lock(portuguese.body.shots.at(-1).prompt, 'Heitor'), /argolas/)
  const english = prose('Mara Quinn is thirty, short hair, grey coat, waits in the shop. Mara holds the pencil. Mara shows the earrings. Mara waves.', 'en')
  assert.doesNotMatch(lock(english.body.shots[0].prompt, 'Mara Quinn'), /pencil|earring/)
  assert.match(lock(english.body.shots[1].prompt, 'Mara Quinn'), /pencil/)
  assert.doesNotMatch(lock(english.body.shots[1].prompt, 'Mara Quinn'), /earring/)
  const shown = lock(english.body.shots[2].prompt, 'Mara Quinn')
  assert.match(shown, /earrings/)
  assert.doesNotMatch(shown, /shows|holds/)
})

test('Naquela noite and That night are night, and a bata plus lantern is not a fragment', () => {
  const night = prose('Inês, 30 anos, cabelo curto, casaco azul, espera no cais ao entardecer. Naquela noite Inês acende a lanterna. That night Inês acena.', 'pt')
  assert.match(line(night.body.shots[0].prompt, 'LIGHT'), /crepúsculo|Crepúsculo/)
  assert.match(line(night.body.shots[1].prompt, 'LIGHT'), /Noite/)
  assert.doesNotMatch(line(night.body.shots[1].prompt, 'LIGHT'), /crepúsculo|Crepúsculo/)
  assert.match(line(night.body.shots[2].prompt, 'LIGHT'), /Noite/)
  const smock = prose('Lurdes tem sessenta anos, cabelo branco, uma bata branca e lanterna, espera no posto. Lurdes acena.', 'pt')
  const worn = lock(smock.body.shots[0].prompt, 'Lurdes')
  assert.match(worn, /bata branca/)
  assert.match(worn, /lanterna/)
  assert.doesNotMatch(worn, /branca e lanterna|,\s*com\b|\bcom,/)
  const english = prose('Helen is forty, short hair, a grey coat, waits in the hall at dusk. That night Helen lights the lamp. Helen waves.', 'en')
  assert.match(line(english.body.shots[1].prompt, 'LIGHT'), /Night/)
  assert.doesNotMatch(line(english.body.shots[1].prompt, 'LIGHT'), /Dusk/)
})

test('a move from the dining car or the bilheteira replaces the carried place', () => {
  const english = prose('Owen, 44, grey beard, navy coat, waits in the dining car. Owen enters the sleeper compartment. Owen sits.', 'en')
  assert.match(line(english.body.shots[0].prompt, 'PLACE'), /Dining car/)
  assert.match(line(english.body.shots[1].prompt, 'PLACE'), /Sleeper compartment/)
  assert.match(line(english.body.shots[2].prompt, 'PLACE'), /Sleeper compartment/)
  assert.doesNotMatch(line(english.body.shots[2].prompt, 'PLACE'), /Dining car/)
  const portuguese = prose('Teresa, 40 anos, cabelo preto, casaco azul, espera na bilheteira. Teresa sobe ao palco. Teresa acena.', 'pt')
  assert.match(line(portuguese.body.shots[0].prompt, 'PLACE'), /Bilheteira/)
  assert.match(line(portuguese.body.shots[1].prompt, 'PLACE'), /Palco/)
  assert.match(line(portuguese.body.shots[2].prompt, 'PLACE'), /Palco/)
  assert.doesNotMatch(line(portuguese.body.shots[2].prompt, 'PLACE'), /Bilheteira/)
})
