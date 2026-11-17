/** Deterministic scene cuts. Closed word lists only. No model call. */
import { cleanText } from './text.js'
import { enteredPlace, extendsPlace, finishCarriedPlace, heldPlaceNoun, isNonPlaceNoun, isRejectedPlace, locativeHeads, movementPlace, placeTag, preferPlaceHead, settingName, tidyPlaceLemma } from './place-lexicon.js'
import { foldName } from './scenario.js'
import { splitActionText } from './action-split.js'

const LOCALES = ['en', 'fr', 'pt', 'it', 'ja']

/** Connectors, pronouns, and time or sequence words. Never a character name. */
const FUNCTION = Object.freeze({
  en: ['the', 'a', 'an', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'our', 'their', 'this', 'that', 'these', 'those', 'then', 'than', 'so', 'and', 'but', 'or', 'if', 'when', 'while', 'after', 'before', 'later', 'next', 'once', 'only', 'just', 'still', 'already', 'now', 'today', 'tomorrow', 'yesterday', 'suddenly', 'finally', 'in', 'on', 'at', 'to', 'from', 'into', 'over', 'with', 'without', 'of', 'for', 'by', 'as', 'there', 'here', 'its', 'suddenly'],
  fr: ['le', 'la', 'les', 'un', 'une', 'des', 'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'lui', 'leur', 'moi', 'toi', 'ce', 'cette', 'ces', 'son', 'sa', 'ses', 'mon', 'ma', 'mes', 'et', 'mais', 'ou', 'donc', 'or', 'ni', 'car', 'puis', 'ensuite', 'alors', 'soudain', 'enfin', 'donc', 'hier', 'demain', 'aujourd', 'hui', 'apres', 'avant', 'plus', 'tard', 'lendemain', 'dans', 'sur', 'sous', 'avec', 'sans', 'pour', 'par', 'chez', 'au', 'aux', 'du', 'en', 'vers', 'pendant', 'toujours', 'jamais', 'ici', 'quand', 'comme', 'si'],
  pt: ['o', 'a', 'os', 'as', 'um', 'uma', 'eu', 'tu', 'ele', 'ela', 'nos', 'voce', 'eles', 'elas', 'meu', 'minha', 'seu', 'sua', 'e', 'mas', 'ou', 'depois', 'entao', 'de', 'repente', 'subitamente', 'enfim', 'ontem', 'amanha', 'hoje', 'mais', 'tarde', 'no', 'na', 'nos', 'nas', 'em', 'por', 'para', 'com', 'sem', 'so', 'apenas', 'ainda', 'ja', 'agora', 'quando', 'se', 'ao', 'aos', 'à', 'às', 'pela', 'pelo', 'do', 'da', 'dos', 'das'],
  it: ['il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'una', 'uno', 'io', 'tu', 'lui', 'lei', 'noi', 'voi', 'loro', 'mio', 'tuo', 'suo', 'e', 'ma', 'o', 'poi', 'quindi', 'allora', 'improvvisamente', 'infine', 'ieri', 'domani', 'oggi', 'dopo', 'prima', 'piu', 'tardi', 'nel', 'nella', 'in', 'su', 'sul', 'con', 'senza', 'per', 'da', 'solo', 'ancora', 'gia', 'adesso', 'quando', 'se'],
  ja: ['それから', 'そして', 'その後', 'すると', '突然', 'ついに', '次の日', '翌日', 'あとで', '今朝', '今夜'],
  'zh-Hans': ['然后', '接着', '随后', '于是', '突然', '终于', '后来', '第二天', '次日', '之后', '今晚', '今早']
})

const FUNCTION_SET = Object.freeze(Object.fromEntries(
  LOCALES.map(code => [code, new Set(FUNCTION[code].map(word => foldName(word)))])
))

/** Articles, determiners, and prepositions. Never a place cue on their own. */
const EXTRA_CUE_STOP = new Set(['el', 'los', 'las', 'del', 'della', 'dei', 'delle', 'do', 'da', 'dos', 'das', 'de', 'der', 'die', 'das', 'dem', 'den', 'des', 'through', 'inside', 'outside', 'within', 'onto', 'upon', 'across', 'along', 'about', 'around', 'near', 'zum', 'zur', 'einem', 'einer', 'eines', 'num', 'numa', 'pelo', 'pela', 'nel', 'nello', 'sul', 'sullo', 'sulla'].map(word => foldName(word)))

/** Body parts, clothing, and abstract nouns. Never a place. */
const NOT_A_PLACE = new Set([
  'hand', 'hands', 'eye', 'eyes', 'face', 'hair', 'head', 'arm', 'arms', 'leg', 'legs', 'foot', 'feet', 'finger', 'fingers', 'mouth', 'ear', 'ears', 'nose', 'back', 'shoulder', 'eyebrow', 'brow', 'sourcil', 'yeux', 'oeil', 'main', 'mains', 'visage', 'cheveux', 'tete', 'bras', 'jambe', 'pied', 'dos', 'epaule', 'bouche', 'oreille',
  'olho', 'olhos', 'mao', 'maos', 'rosto', 'cabelo', 'cabeca', 'braco', 'perna', 'pe', 'costas', 'sobrancelha',
  'auge', 'augen', 'hand', 'haende', 'gesicht', 'haar', 'kopf', 'arm', 'bein', 'fuss', 'ruecken', 'braue',
  'occhio', 'occhi', 'mano', 'mani', 'viso', 'capelli', 'testa', 'braccio', 'gamba', 'piede', 'schiena', 'sopracciglio',
  'a', 'ae', 'hand', 'gesiicht', 'hoer', 'kapp', 'been', 'fouss', 'reck',
  'coat', 'jacket', 'sweater', 'shirt', 'dress', 'skirt', 'scarf', 'hat', 'cap', 'boots', 'shoes', 'bag', 'sleeve', 'pocket', 'apron', 'ring', 'glove', 'manteau', 'pull', 'veste', 'robe', 'echarpe', 'chapeau', 'casquette', 'bottes', 'sac', 'manche', 'poche', 'tablier', 'bague', 'gant', 'cire', 'ärmel', 'armel',
  'casaco', 'camisa', 'vestido', 'cachecol', 'chapeu', 'bolsa', 'manga', 'bolso', 'avental', 'anel',
  'mantel', 'pullover', 'hemd', 'kleid', 'schal', 'hut', 'tasche', 'aermel', 'schuerze', 'ring',
  'cappotto', 'maglione', 'camicia', 'vestito', 'sciarpa', 'cappello', 'borsa', 'manica', 'tasca', 'grembiule', 'anello',
  'mantel', 'pulli', 'hemd', 'kleed', 'schal', 'hutt', 'tasch', 'aermel',
  'silence', 'light', 'darkness', 'distance', 'drawing', 'photo', 'photograph', 'letter', 'envelope', 'paper', 'name', 'voice', 'dream', 'memory', 'thought', 'silence', 'lumiere', 'obscurite', 'loin', 'dessin', 'photo', 'lettre', 'enveloppe', 'papier', 'nom', 'voix', 'reve', 'souvenir', 'pensee', 'silence',
  'silencio', 'luz', 'escuro', 'distancia', 'desenho', 'carta', 'envelope', 'nome', 'voz', 'sonho',
  'stille', 'licht', 'dunkelheit', 'ferne', 'zeichnung', 'brief', 'umschlag', 'name', 'stimme', 'traum',
  'silenzio', 'luce', 'buio', 'distanza', 'disegno', 'lettera', 'busta', 'nome', 'voce', 'sogno',
  'rou', 'liicht', 'donkel', 'distanz', 'zeechnung', 'bréif', 'numm', 'stëmm',
  'window', 'door', 'table', 'glass', 'cup', 'bottle', 'counter', 'fridge', 'lamp', 'drawer', 'clock', 'watch', 'watches', 'ticket', 'fenetre', 'porte', 'table', 'verre', 'tasse', 'bouteille', 'comptoir', 'frigo', 'lampe', 'tiroir', 'horloge', 'billet', 'relogio',
  'janela', 'porta', 'mesa', 'copo', 'balcao', 'geladeira', 'lampada', 'gaveta',
  'fenster', 'tur', 'tisch', 'glas', 'tasse', 'theke', 'kuehlschrank', 'lampe', 'schublade',
  'finestra', 'porta', 'tavolo', 'bicchiere', 'bancone', 'frigo', 'lampada', 'cassetto',
  'fënster', 'dir', 'dësch', 'glas', 'taass', 'frigo', 'lamp',
  '目', '眼', '眼睛', '沈黙', '沉默', '光',
  'place', 'circle', 'circulo', 'lugar', 'speaker', 'speakers', 'altifalante', 'altifalantes', 'van', 'carrinha', 'furgao', 'wheel', 'wheels', 'roda', 'rodas', 'engine', 'motor', 'dashboard', 'radio', 'headlight', 'headlights', 'bumper', 'tyre', 'tire', 'microphone', 'laptop', 'monitor', 'amplifier', 'horn', 'brake', 'brakes', 'exhaust', 'steering', 'seatbelt'
].map(word => foldName(word)))

const MEMORY = Object.freeze({
  en: /(?:^|[^\p{L}])(?:re)?(?:think|thought|recall|remember|dream|wonder|imagin|talk)(?:ing|ed|es|s)?(?![\p{L}])[^.]{0,48}$/iu,
  fr: /(?:^|[^\p{L}])(?:se\s+|s['’])?(?:re|r['’])?(?:pens|song|souvien|rappel|rêv|rev|évoqu|evoqu|parl)[\p{L}'’]*[^.]{0,48}$/iu,
  pt: /(?:^|[^\p{L}])(?:re)?(?:pens|lembr|record|sonh|fal)[\p{L}'’]*[^.]{0,48}$/iu,
  it: /(?:^|[^\p{L}])(?:ri)?(?:pens|ricord|sogn|parl)[\p{L}'’]*[^.]{0,48}$/iu,
  ja: /(思い返す|思い出す|思い出|回想|考える|考え|夢を見|夢見る|話す|話した)[^。]{0,24}$/,
  'zh-Hans': /(回想起|想起|记得|回忆|想到|梦见|做梦|谈到|说起)[^。]{0,24}$/
})

const GLANCE = Object.freeze({
  en: /\b(glances?|glancing|peeks?|peering|looks?\s+toward|looking\s+toward|looks?\s+at|smiles?\s+at|smiling\s+at|stares?\s+at|gazes?\s+at|grins?\s+at|waves?\s+at|nods?\s+at)\b[^.]{0,48}$/i,
  fr: /\b(jette un regard|jeter un regard|regarde vers|regard vers|aperçoit|apercoit|sans quitter)\b[^.]{0,60}$/i,
  pt: /\b(olha para|olha em direção|sem sair|dá uma olhada|sorri para|sorri ao|sorri à|acena para)\b[^.]{0,48}$/i,
  it: /\b(guarda verso|dà un'occhiata|da un'occhiata|senza lasciare)\b[^.]{0,48}$/i,
  ja: /(ちらっと|目をやる|見やる)[^。]{0,24}$/,
  'zh-Hans': /(看向|瞥向|望向|没有离开)[^。]{0,24}$/
})

const LOCATIVE = Object.freeze({
  en: /(?:^|[^\p{L}])(?:in|at|on|onto|upon|to|inside|through|into|within|outside|reaches|reach)\s+(?:the\s+|a\s+|an\s+|her\s+|his\s+|their\s+)?(?:(?:old|little|small|tiny|narrow|big|large|young|new|tin)\s+){0,3}$/iu,
  fr: /(?:^|[^\p{L}])(?:dans|à|a|au|aux|chez|sur)\s+(?:la\s+|le\s+|les\s+|l['’]|un\s+|une\s+|des\s+|du\s+)?(?:(?:vieux|vieille|petit|petite|grand|grande)\s+){0,2}$/iu,
  pt: /\b(?:em|no|na|nos|nas|num|numa|ao|à|aos|às|dentro|chega|entra)\s+(?:o\s+|a\s+|os\s+|as\s+|um\s+|uma\s+)?(?:(?:velho|velha|pequeno|pequena|grande|antigo)\s+){0,2}$/iu,
  it: /\b(?:in|nel|nello|nella|negli|nelle|sul|sullo|sulla|sui|sugli|sulle|al|allo|alla|ai|agli|alle|dentro|entra|entro|arriva)\s+(?:il\s+|lo\s+|la\s+|i\s+|gli\s+|le\s+|l['’]|un\s+|una\s+)?(?:(?:vecchio|vecchia|piccolo|piccola|grande|antico|antica)\s+){0,2}$/iu,
  ja: /(?:で|に|へ)[^。]{0,16}$/,
  'zh-Hans': /(?:在|到)[^。]{0,16}$/
})

const WEAK_PLACE = Object.freeze({
  en: /\b(?:toward|towards|near|around|by|across)\s+(?:the\s+|a\s+|her\s+|his\s+)?(?:[\p{L}'’-]+\s+){0,4}$/iu,
  fr: /\b(?:vers|près|pres|autour|en face)\s+(?:de\s+|du\s+|de\s+la\s+|des\s+|l['’])?(?:[\p{L}'’-]+\s+){0,4}$/iu,
  pt: /\b(?:para|perto|em volta|em frente)\s+(?:de\s+|do\s+|da\s+)?(?:[\p{L}'’-]+\s+){0,4}$/iu,
  it: /\b(?:verso|vicino|intorno|di fronte)\s+(?:a\s+|al\s+|alla\s+|di\s+)?(?:[\p{L}'’-]+\s+){0,4}$/iu,
  ja: /(?:の方|へ向か)[^。]{0,12}$/,
  'zh-Hans': /(?:朝着|附近|对面)[^。]{0,12}$/
})

const SEQUENCE = Object.freeze({
  en: /\b(then|after that|so|suddenly|finally|next)\b/i,
  fr: /\b(puis|ensuite|alors|soudain|enfin|donc)\b/i,
  pt: /\b(depois|então|entao|de repente|subitamente|enfim|em seguida)\b/i,
  it: /\b(poi|quindi|allora|improvvisamente|infine|dopodiché|dopodiche)\b/i,
  ja: /(それから|そして|その後|突然|ついに|次に)/,
  'zh-Hans': /(然后|接着|随后|于是|突然|终于|后来)/
})

const TIME_RULES = [
  { re: /(?<![\p{L}])(late that night|later that night|that night|tonight|last night|tard cette nuit|cette nuit-là|cette nuit|esta noite|essa noite|hoje à noite|heute nacht|heute abend|stanotte|quella notte|haut an der nuecht|その夜|夜遅く|那天夜里|那天晚上|深夜)(?![\p{L}])/iu, id: 'that-night', jump: 'part', light: 'night' },
  { re: /(?<![\p{L}])(in the morning|one morning|early morning|at sunrise|sunrise|dans la matinée|au lever du soleil|de manhã|ao nascer do sol|am morgen|bei sonnenaufgang|di mattina|all'alba|日の出|日出)(?![\p{L}])/iu, id: 'in-the-morning', jump: 'part', light: 'dawn' },
  { re: /(?<![\p{L}])(in the evening|at evening|le soir|à la tombée|am abend|di sera|di sera|夕方|傍晚)(?![\p{L}])/iu, id: 'in-the-evening', jump: 'part', light: 'dusk' },
  { re: /(?<![\p{L}])(at night|in the night|by night|la nuit|de noite|nachts|in der nacht|di notte|an der nuecht)(?![\p{L}])/iu, id: 'at-night', jump: 'part', light: 'night' },
  { re: /(?<![\p{L}])(that morning|this morning|early that morning|ce matin-là|ce matin|esta manhã|hoje de manhã|heute morgen|stamattina|haut de moien|その朝|那天早上|那天早晨)(?![\p{L}])/iu, id: 'that-morning', jump: 'part', light: 'dawn' },
  { re: /(?<![\p{L}])(that afternoon|this afternoon|cet après-midi|cet apres-midi|à tarde|a tarde|heute nachmittag|nel pomeriggio|その午後|那天下午)(?![\p{L}])/iu, id: 'that-afternoon', jump: 'part', light: 'day' },
  { re: /(?<![\p{L}])(this evening|that evening|ce soir-là|ce soir|hoje à noite|heute abend|stasera|haut owes|その夕方|那天傍晚)(?![\p{L}])/iu, id: 'that-evening', jump: 'part', light: 'dusk' },
  { re: /(?<![\p{L}])(le lendemain|au lendemain|the next day|no dia seguinte|am nächsten tag|am naechsten tag|il giorno dopo|den aneren dag|次の日|翌日|第二天|次日)(?![\p{L}])/iu, id: 'next-day', jump: 'day' },
  { re: /(?<![\p{L}])(trois jours plus tard|trois jours après|trois jours apres|three days later|três dias depois|tres dias depois|drei tage später|drei tage spater|tre giorni dopo|dräi deeg drop|dräi deeg méi spéit|三日後|三天后|三天之后)(?![\p{L}])/iu, id: 'plus-3d', jump: 'day' },
  { re: /(?<![\p{L}])(à l['’]aube|a l['’]aube|at dawn|au petit matin|en début de matinée|ao amanhecer|im morgengrauen|all['’]alba|am muergrauen|夜明け|黎明|拂晓)(?![\p{L}])/iu, id: 'dawn', jump: 'part', light: 'dawn' },
  { re: /(?<![\p{L}])(à la nuit tombée|a la nuit tombee|la nuit tombe|at nightfall|nightfall|ao anoitecer|bei einbruch der nacht|al calar della notte|bei der nuecht|夜になる|夜幕降临|入夜)(?![\p{L}])/iu, id: 'nightfall', jump: 'part', light: 'night' },
  { re: /(?<![\p{L}])(au crépuscule|au crepuscule|at dusk|ao crepúsculo|ao crepusculo|in der dämmerung|in der dammerung|al crepuscolo|an der dämmerung|黄昏|夕暮れ)(?![\p{L}])/iu, id: 'dusk', jump: 'part', light: 'dusk' },
  { re: /(?<![\p{L}])(en début de soirée|en debut de soiree|début de soirée|debut de soiree|in the early evening|early evening|ao início da noite|am frühen abend|in prima serata|fréi owes|夕方|傍晚)(?![\p{L}])/iu, id: 'evening', jump: 'part', light: 'dusk' },
  { re: /(?<![\p{L}])(vers midi|à midi|a midi|at noon|ao meio-dia|zu mittag|a mezzogiorno|géint mëtteg|正午ごろ|中午|正午)(?![\p{L}])/iu, id: 'noon', jump: 'part', light: 'day' },
  { re: /(?<![\p{L}])((?:two|three|four|five|six|seven|eight|nine|ten|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|\d+)\s+(?:days|jours|dias|tage|giorni|deeg)\s+(?:later|plus tard|après|apres|depois|später|spater|dopo|drop))(?![\p{L}])/iu, id: 'days-later', jump: 'day' },
  { re: /(?<![\p{L}])(plus tard|later|mais tarde|später|spater|più tardi|piu tardi|méi spéit|mei speit|あとで|后来)(?![\p{L}])/iu, id: 'later', jump: 'later' },
  { re: /(?<![\p{L}])(perto da meia-noite|pela meia-noite|à meia-noite|a meia-noite|de meia-noite|meia-noite|meia noite)(?![\p{L}])/iu, id: 'meia-noite', jump: 'part', light: 'night' },
  { re: /(?<![\p{L}])(de madrugada|na madrugada|alta madrugada|pela madrugada|madrugada)(?![\p{L}])/iu, id: 'madrugada', jump: 'part', light: 'night' },
  { re: /(?<![\p{L}])(à noite|a noite|de noite|pela noite|na noite|à noitinha|a noitinha|de noitinha)(?![\p{L}])/iu, id: 'a-noite', jump: 'part', light: 'night' },
  { re: /(?<![\p{L}])(ao luar|à luz da lua|a luz da lua)(?![\p{L}])/iu, id: 'luar', jump: 'part', light: 'night' },
  { re: /(?<![\p{L}])(ao entardecer|no entardecer|ao crepúsculo|ao crepusculo|no crepúsculo|no crepusculo|pelo crepúsculo|pelo crepusculo|crepúsculo|crepusculo|entardecer|ao pôr do sol|ao por do sol|pôr do sol|por do sol|at sunset)(?![\p{L}])/iu, id: 'pt-dusk', jump: 'part', light: 'dusk' },
  { re: /(?<![\p{L}])(ao anoitecer|no anoitecer|anoitecer)(?![\p{L}])/iu, id: 'pt-nightfall', jump: 'part', light: 'night' },
  { re: /(?<![\p{L}])noite(?![\p{L}])/iu, id: 'noite', jump: 'part', light: 'night' },
  { re: /(?<![\p{L}])(the next morning|next morning|na manhã seguinte|na manha seguinte|manhã seguinte|manha seguinte|de manhã|de manha|pela manhã|pela manha|na manhã|na manha|esta manhã|esta manha|nessa manhã|nessa manha|ao raiar do dia|by morning)(?![\p{L}])/iu, id: 'next-morning', jump: 'part', light: 'dawn' },
  { re: /(?<![\p{L}])(amanhecer|manhã|manha|morning|sunrise|dawn)(?![\p{L}])/iu, id: 'morning-word', jump: 'part', light: 'dawn' }
]

const CLOCK = Object.freeze({
  en: /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/i,
  fr: /(?<![\p{L}])à\s*(\d{1,2})\s*h\s*(\d{2})?/iu,
  pt: /\bàs\s*(\d{1,2})\s*h\s*(\d{2})?/i,
  it: /\balle\s*(\d{1,2})(?::(\d{2}))?/i,
  ja: /(\d{1,2})時(\d{1,2})?分?/,
  'zh-Hans': /(\d{1,2})点(\d{1,2})?分?/
})

const OPEN_PLACE = Object.freeze({
  en: /\b(?:opens?|enters?)\s+(?:her\s+|his\s+|the\s+|a\s+|an\s+)?(?:tiny\s+|small\s+|little\s+)?$/i,
  fr: /\b(?:ouvre|ouvrir|entre au|entre à|entre a)\s+(?:la\s+|le\s+|l['’]|son\s+|sa\s+|un\s+|une\s+)?(?:petit\s+|petite\s+)?$/i,
  pt: /\b(?:abre|entra n[oa])\s+(?:o\s+|a\s+|um\s+|uma\s+)?$/i,
  it: /\b(?:apre|entra nel|entra nella)\s+(?:il\s+|lo\s+|la\s+|un\s+|una\s+)?$/i,
  ja: /$/,
  'zh-Hans': /$/
})

const WEAR_VERB = /(?<![\p{L}])(porte|portent|wears?|trägt|tragt|indossa|dréit|dreit|穿着|身着|着ている)(?![\p{L}])/giu
const DOOR_NOUN = /\b(?:la|le|une|sa|son|cette|the|a|an|der|die|das)\s+porte\b/giu

const BUILTIN_VERBS = Object.freeze({
  en: ['reads', 'read', 'sets', 'set', 'stands', 'stand', 'tidies', 'tidy', 'folds', 'fold', 'switches', 'switch', 'takes', 'take', 'opens', 'open', 'pours', 'pour', 'waits', 'wait', 'comes', 'come', 'leaves', 'leave', 'looks', 'look', 'says', 'say', 'smiles', 'smile', 'closes', 'close', 'hands', 'hand', 'finds', 'find', 'compare', 'compares', 'sits', 'sit', 'puts', 'put', 'walks', 'walk', 'stops', 'stop', 'checks', 'check', 'answers', 'answer', 'watch', 'watches', 'steps', 'step', 'pulls', 'pull', 'stays', 'stay', 'remains', 'remain', 'pushes', 'push', 'lifts', 'lift', 'holds', 'hold', 'arrives', 'arrive', 'shuts', 'shut', 'listens', 'listen', 'unrolls', 'unroll', 'points', 'point', 'talks', 'talk', 'enters', 'enter', 'returns', 'return', 'knocks', 'knock', 'laughs', 'laugh', 'boards', 'board', 'meets', 'meet', 'gives', 'give', 'rides', 'turns', 'follows', 'crosses', 'drinks', 'writes', 'calls', 'runs', 'sits', 'waves', 'wave', 'mends', 'mend', 'applauds', 'applaud', 'bows', 'bow', 'kneels', 'kneel', 'nods', 'nod', 'claps', 'clap', 'yawns', 'yawn', 'leads', 'lead', 'practises', 'practise', 'practices', 'practice'],
  fr: ['lit', 'pose', 'leve', 'range', 'eteint', 'ouvre', 'verse', 'attend', 'entre', 'laisse', 'cherche', 'dit', 'sourit', 'referme', 'tend', 'boit', 'repose', 'retrouve', 'comparent', 'glisse', 'restent', 'ajuste', 'assoient', "s'assoient", 'assied', 'assoit', 'sort', 'regarde', 'apporte', 'pousse', 'releve', 'allume', 'arrive', 'ferme', 'ecoute', 'deroule', 'montre', 'parlent', 'enfilent', 'marche', 'marchent', 'arrete', 'relit', 'reste', 'repondent', 'reprennent', 'regardent', 'approche', 'serre', 'pense', 'sont', 'arrose', 'achete'],
  pt: ['entrega', 'lê', 'le', 'afasta', 'observa', 'abre', 'entra', 'poe', 'diz', 'sorri', 'fecha', 'anda', 'espera', 'pega', 'veste', 'vestem', 'acena', 'aplaude', 'ajoelha', 'boceja', 'lava', 'lavam', 'caminha', 'traz', 'leva', 'tira'],
  it: ['porge', 'legge', 'allontana', 'guarda', 'entra', 'esce', 'apre', 'dice', 'sorride', 'chiude', 'cammina', 'aspetta'],
  ja: ['渡す', '渡した', '読む', '読んだ', '歩き去る', '歩いて', '見る', '見た', '笑う', '入る', '出る', '開ける', '置く', '言う', '座る'],
  'zh-Hans': ['交给', '读了', '读', '走开', '看着', '看', '笑', '走进', '打开', '递给', '说', '坐下', '放下']
})

const NUMBERS = Object.freeze({
  en: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'],
  fr: ['zero', 'un', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'cent', 'premier', 'premiere', 'deuxieme', 'troisieme', 'second', 'seconde'],
  pt: ['zero', 'um', 'uma', 'dois', 'duas', 'tres', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'cem', 'primeiro', 'primeira', 'segundo', 'segunda', 'terceiro', 'terceira'],
  it: ['zero', 'uno', 'una', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci', 'undici', 'dodici', 'venti', 'trenta', 'quaranta', 'cinquanta', 'cento', 'primo', 'prima', 'secondo', 'seconda', 'terzo', 'terza'],
  ja: ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '百', '千', '一つ', '二つ', '三つ', '第一', '第二', '第三'],
  'zh-Hans': ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '百', '千', '零', '第一', '第二', '第三', '两']
})
const NUMBER_SET = Object.freeze(Object.fromEntries(LOCALES.map(code => [code, new Set(NUMBERS[code].map(word => foldName(word)))])))

/** Cardinal and ordinal number words, and digit tokens. Never a character. */
export function isNumberWord(token, language = 'en') {
  const raw = String(token || '').trim()
  if (!raw) return false
  if (/^\d+$/u.test(raw)) return true
  const key = foldName(raw)
  if (!key) return false
  if (NUMBER_SET[language]?.has(key)) return true
  if (language !== 'en' && NUMBER_SET.en.has(key)) return true
  if (language !== 'fr' && NUMBER_SET.fr.has(key)) return true
  return [...LOCALES].some(code => NUMBER_SET[code].has(key) && key.length > 2)
}

const VENUES = Object.freeze({
  en: ['bookshop', 'bookstore', 'book shop', 'shop', 'store', 'cafe', 'café', 'coffee shop', 'bar', 'restaurant', 'bakery', 'pharmacy', 'chemist', 'hotel', 'cinema', 'movie theater', 'museum', 'gallery', 'studio', 'garage', 'market', 'library', 'theatre', 'theater', 'pub', 'inn', 'bistro', 'diner'],
  fr: ['librairie', 'boutique', 'magasin', 'café', 'cafe', 'bar', 'restaurant', 'boulangerie', 'pharmacie', 'hôtel', 'hotel', 'cinéma', 'cinema', 'musée', 'musee', 'galerie', 'studio', 'garage', 'marché', 'bibliothèque', 'bibliotheque', 'bistrot', 'auberge', 'brasserie'],
  pt: ['livraria', 'loja', 'café', 'cafe', 'bar', 'restaurante', 'padaria', 'farmácia', 'farmacia', 'hotel', 'cinema', 'museu', 'galeria', 'estúdio', 'estudio', 'garagem', 'mercado', 'biblioteca', 'mercearia'],
  it: ['libreria', 'negozio', 'caffè', 'caffe', 'bar', 'ristorante', 'panetteria', 'farmacia', 'hotel', 'albergo', 'cinema', 'museo', 'galleria', 'studio', 'garage', 'officina', 'mercato', 'biblioteca', 'osteria'],
  ja: ['本屋', '書店', 'カフェ', 'バー', 'レストラン', 'パン屋', '薬局', 'ホテル', '映画館', '博物館', '美術館', 'ギャラリー', '工作室', 'ガレージ', '市場'],
  'zh-Hans': ['书店', '商店', '咖啡馆', '咖啡店', '酒吧', '餐厅', '饭馆', '面包店', '药店', '药房', '酒店', '旅馆', '电影院', '博物馆', '美术馆', '画廊', '工作室', '车库', '市场']
})

export function isVenueType(token, language = 'en') {
  const key = foldName(token)
  if (!key) return false
  const list = VENUES[language] || []
  if (list.some(item => foldName(item) === key)) return true
  return list.some(item => foldName(item) === key)
}

function venuePattern(language) {
  const types = (VENUES[language] || []).flatMap(item => {
    const upper = item.replace(/^\p{L}/u, char => char.toUpperCase())
    return upper === item ? [item] : [item, upper]
  }).sort((a, b) => b.length - a.length)
  return types.map(item => item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
}

const NAME_ARTICLE = /^(?:Le|La|Les|The|Der|Die|Das|El|Il)$/u

function tidyVenueName(value) {
  const tokens = cleanText(String(value || '').replace(/^(?:the|le|la|les|der|die|das|el|il|o|a|in|im|am)\s+/, '')).split(/\s+/).filter(Boolean)
  return tokens.filter((token, index) => {
    if (isNumberWord(token)) return false
    if (!isFunctionWord(token)) return true
    if (!/^\p{Lu}/u.test(token)) return false
    if (index > 0) return true
    return NAME_ARTICLE.test(token) && tokens.slice(index + 1).some(item => /^\p{Lu}/u.test(item) && !isFunctionWord(item))
  }).join(' ')
}

function collectVenues(source, language, found) {
  const types = venuePattern(language)
  if (!types) return
  const push = (name, type, start, end) => {
    const clean = tidyVenueName(name)
    if (!clean) return
    const existing = found.find(item => foldName(item.name) === foldName(clean))
    if (existing) {
      if (!existing.spans.some(([from]) => from === start)) existing.spans.push([start, end])
      return
    }
    const tokens = clean.match(/[\p{L}][\p{L}'’-]+/gu) || []
    const nameTokens = tokens.filter(token => !isVenueType(token, language) && !isFunctionWord(token, language) && !isNumberWord(token, language))
    if (!nameTokens.length) return
    const lastToken = nameTokens.at(-1)
    const tokenAt = source.slice(start, end).lastIndexOf(lastToken)
    if (tokenAt >= 0) {
      const afterToken = source.slice(start + tokenAt + lastToken.length, start + tokenAt + lastToken.length + 24)
      if (/^\s+(?:checks|walks|pours|waits|opens|lifts|sits|stands|reads|turns|enters|leaves|holds|waves|applauds|bows|kneels|nods|claps|acena|aplaude)\b/i.test(afterToken)) return
    }
    found.push({
      name: clean.replace(/^\p{Ll}/u, char => char.toUpperCase()),
      type,
      description: language === 'fr' ? `un ${type}` : `a ${type}`,
      keys: [clean],
      spans: [[start, end]],
      nameTokens
    })
  }
  if (language === 'ja' || language === 'zh-Hans') {
    const re = new RegExp(types, 'gu')
    const stop = /[在的了是把与和ではがを]/u
    for (const match of source.matchAll(re)) {
      const type = match[0]
      if (language === 'ja') {
        const prev = source[match.index - 1] || ''
        const next = source[match.index + type.length] || ''
        if (/\p{Script=Katakana}/u.test(prev) || /\p{Script=Katakana}/u.test(next)) continue
      }
      const before = source.slice(Math.max(0, match.index - 4), match.index)
      const after = source.slice(match.index + type.length, match.index + type.length + 4)
      let properBefore = (before.match(/[\p{Script=Han}\p{Script=Katakana}]{1,4}$/u) || [''])[0]
      const cut = properBefore.search(stop)
      if (cut >= 0) properBefore = properBefore.slice(cut + 1)
      let properAfter = (after.match(/^[\p{Script=Han}\p{Script=Katakana}]{1,4}/u) || [''])[0]
      if (/^(?:等|看|走|拿|说|坐|站|出|回|来|去|打|开|关|读|写)/u.test(properAfter)) properAfter = ''
      const end = properAfter.search(stop)
      if (end >= 0) properAfter = properAfter.slice(0, end)
      const proper = properBefore || properAfter
      if (!proper || isNumberWord(proper, language) || /^[小大新旧雨的了是把]$/u.test(proper)) continue
      const phrase = properBefore ? `${properBefore}${type}` : `${type}${properAfter}`
      const start = properBefore ? match.index - properBefore.length : match.index
      push(phrase, type, start, start + phrase.length)
    }
    return
  }
  const name = "[\\p{Lu}][\\p{L}'’-]{1,40}(?:['’]s)?"
  const phrase = `(?:the\\s+|le\\s+|la\\s+|der\\s+|die\\s+|das\\s+)?(?:${name})(?:\\s+${name}){0,2}`
  const typeThenName = new RegExp(`(?<![\\p{L}])(${types})\\s+(${phrase})`, 'gu')
  const nameThenType = new RegExp(`(${phrase})\\s+(${types})(?![\\p{L}])`, 'gu')
  for (const match of source.matchAll(typeThenName)) push(`${match[1]} ${tidyVenueName(match[2])}`, match[1], match.index, match.index + match[0].length)
  for (const match of source.matchAll(nameThenType)) push(`${tidyVenueName(match[1])} ${match[2]}`, match[2], match.index, match.index + match[0].length)
}

/** A shop or venue type plus a proper name, in either order. The whole phrase is a place. */
export function namedVenues(text, language = 'en') {
  const source = String(text || '')
  const found = []
  collectVenues(source, languageOf(language), found)
  return found
}

export function inNamedVenue(text, index, language = 'en') {
  return namedVenues(text, language).some(place => place.spans.some(([start, end]) => index >= start && index < end))
}

export function isFunctionWord(token, language = 'en') {
  const key = foldName(token)
  if (!key) return false
  if (isNumberWord(token, language)) return true
  if (FUNCTION_SET[language]?.has(key)) return true
  if (language !== 'en' && FUNCTION_SET.en.has(key)) return true
  if (language !== 'fr' && FUNCTION_SET.fr.has(key)) return true
  return false
}

/** A cue key that is only an article, determiner, preposition, or other stopword, in any site language. */
export function isCueStopword(token) {
  const parts = foldName(token).split(/\s+/).filter(Boolean)
  if (!parts.length) return true
  return parts.every(part => EXTRA_CUE_STOP.has(part) || LOCALES.some(code => FUNCTION_SET[code].has(part) || isNumberWord(part, code)))
}

export function isNeverPlace(token) {
  const key = foldName(token)
  if (!key) return false
  if (NOT_A_PLACE.has(key) || isNonPlaceNoun(token) || isRejectedPlace(token)) return true
  return key.split(/\s+/).some(part => NOT_A_PLACE.has(part) || isNonPlaceNoun(part))
}

export function quoteSpans(text) {
  const spans = []
  const source = String(text || '')
  const re = /«[^»]*»|“[^”]*”|"[^"]*"|「[^」]*」|『[^』]*』/g
  for (const match of source.matchAll(re)) spans.push([match.index, match.index + match[0].length])
  return spans
}

export function inSpans(index, spans) {
  return spans.some(([start, end]) => index >= start && index < end)
}

export function isQuotedOrRemembered(text, index, language = 'en') {
  const source = String(text || '')
  if (inSpans(index, quoteSpans(source))) return true
  const before = source.slice(Math.max(0, index - 64), index)
  const pattern = MEMORY[languageOf(language)]
  if (!pattern) return false
  pattern.lastIndex = 0
  return pattern.test(before)
}

/** A place inside speech, memory, or a glance does not move the scene. */
export function mentionMovesScene(text, index, language = 'en') {
  if (isQuotedOrRemembered(text, index, language)) return false
  const before = String(text || '').slice(Math.max(0, index - 64), index)
  return !clauseLooks(before, language, GLANCE)
}

export function sentencesOf(text) {
  const source = String(text || '').replace(/\r\n/g, '\n')
  const spans = quoteSpans(source)
  const parts = []
  let start = 0
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    if (!/[.!?。！？]/.test(char) || inSpans(i, spans)) continue
    const next = source[i + 1] || ''
    if (next && !/\s/.test(next) && next !== '\n') continue
    const piece = source.slice(start, i + 1).trim()
    if (piece) parts.push(piece)
    start = i + 1
  }
  const tail = source.slice(start).trim()
  if (tail) parts.push(tail)
  return parts.flatMap(part => part.split(/\n+/).map(item => item.trim()).filter(Boolean))
}

function languageOf(language) {
  return LOCALES.includes(language) ? language : 'en'
}

function windowBefore(sentence, index) {
  return sentence.slice(Math.max(0, index - 70), index)
}

function mentionedIn(sentence, key) {
  const folded = foldName(sentence)
  const needle = foldName(key)
  if (!needle) return []
  const hits = []
  const re = new RegExp(`(?:^|[^\\p{L}])(${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=[^\\p{L}]|$)`, 'gu')
  for (const match of folded.matchAll(re)) hits.push(match.index + match[0].indexOf(match[1]))
  return hits
}

function clauseLooks(before, language, table) {
  const pattern = table[languageOf(language)]
  if (!pattern) return false
  pattern.lastIndex = 0
  return pattern.test(before)
}

function placeKeys(place) {
  const keys = []
  const name = cleanText(place?.name)
  if (name) keys.push(name)
  ;(place?.keys || []).forEach(key => { if (key) keys.push(key) })
  return keys
    .map(key => cleanText(key))
    .filter(Boolean)
    .sort((a, b) => foldName(b).length - foldName(a).length)
}

function findKeyHits(sentence, key, language = 'en') {
  if (language === 'ja' || language === 'zh-Hans') {
    const hits = []
    let from = 0
    const source = String(sentence || '')
    while (from < source.length) {
      const index = source.indexOf(key, from)
      if (index < 0) break
      hits.push(index)
      from = index + key.length
    }
    return hits
  }
  const needle = String(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(?<![\\p{L}])(${needle})(?![\\p{L}])`, 'giu')
  const hits = []
  for (const match of String(sentence || '').matchAll(re)) {
    if (foldName(match[1]) !== foldName(key)) continue
    hits.push(match.index)
  }
  return hits
}

function collectPlaceCues(sentence, language, places) {
  const spans = quoteSpans(sentence)
  const hits = []
  for (const place of places || []) {
    if (place.name.split(/\s+/).length < 2 && isNeverPlace(place.name)) continue
    for (const key of placeKeys(place)) {
      if ((key.split(/\s+/).length < 2 && isNeverPlace(key)) || isCueStopword(key)) continue
      for (const index of findKeyHits(sentence, key, language)) {
        if (inSpans(index, spans)) continue
        const before = windowBefore(sentence, index)
        const lead = before.trim().split(/\s+/).at(-1) || ''
        if (/^(?:en|of|de)$/i.test(lead) && /^(?:bois|wood|métal|metal|cuir|leather|laine|wool|verre|glass|pierre|stone|acier|steel|coton|cotton|soie|silk)$/i.test(foldName(key))) continue
        const after = sentence.slice(index, index + key.length + 4)
        if (clauseLooks(before, language, MEMORY)) continue
        const afterClause = sentence.slice(index, Math.min(sentence.length, index + key.length + 16))
        if ((language === 'ja' || language === 'zh-Hans') && /(思い出す|考える|話す|想起|记得|想到|梦见|说起|ちらっと|望向|看向|没有离开)/.test(afterClause)) continue
        if (clauseLooks(before, language, GLANCE)) continue
        if (/\b(?:across|d['’]en face)\s+(?:the\s+|la\s+|le\s+)?$/i.test(before)) continue
        const afterKey = sentence.slice(index + key.length)
        const locative = clauseLooks(before, language, LOCATIVE) || (language === 'ja' && /^(?:で|に|へ|の中|を)/.test(afterKey)) || (language === 'zh-Hans' && (/^(?:里|上|中|内|边|旁)/.test(afterKey) || /(?:在|去|到|来到)/.test(before)))
        const towardOnly = /(?:^|[^\p{L}])(?:to|into|onto|zum|zur|ins|vers|para|verso)\s+(?:the\s+|a\s+|an\s+|der\s+|die\s+|das\s+|dem\s+|den\s+|o\s+|il\s+|lo\s+|la\s+|le\s+)?$/iu.test(before)
        const arrived = /(?:go(?:es|ing|ne)?|went|return(?:s|ed|ing)?|board(?:s|ed|ing)?|pilot(?:s|ed|ing)?|pilota(?:m|r|ndo)?|embarca(?:m|r|ndo)?|walk(?:s|ed|ing)?|climb(?:s|ed|ing)?|enter(?:s|ed|ing)?|reach(?:es|ed|ing)?|come[s]?|came|arriv|step(?:s|ped)?|descend(?:s|ed|ing)?|crawl(?:s|ed|ing)?|creep(?:s|ing)?|crept|duck(?:s|ed|ing)?|squeeze[sd]?|squeezing|slide[sd]?|sliding|clamber(?:s|ed|ing)?|rasteja(?:m|r|ndo)?|geht|gehen|ging|komm(?:t|en)|kam|betritt|betrat|erreicht|entra|chega|vai|\bva\b|arrive|entre|monte)/iu.test(sentence.slice(Math.max(0, index - 48), index))
        if (heldPlaceNoun(sentence, index)) continue
        const opener = clauseLooks(before, language, OPEN_PLACE)
        const weak = clauseLooks(before, language, WEAK_PLACE)
        if (!locative && !opener && !weak) continue
        if (/^(?:\s+\p{L}[\p{L}'’-]*){0,3}\s+(?:window|door|table|wall|sill|pane|glass|frame|ledge|counter|desk|shutter|fenêtre|fenetre|porte|fenster|finestra|fënster|窗户|窗|窓)/iu.test(afterKey)) continue
        const cueStart = Math.max(0, index - 28)
        const cue = cleanText(sentence.slice(cueStart, index + key.length))
        hits.push({ name: place.name, key, cue, uncertain: Boolean((weak && !locative && !opener) || (towardOnly && !arrived)), index })
      }
    }
  }
  return hits
}

function preferFirmCue(best, hit) {
  if (!best) return hit
  const generic = isCueStopword(hit.key)
  const bestGeneric = isCueStopword(best.key)
  if (generic !== bestGeneric) return generic ? best : hit
  if (hit.index > best.index || (hit.index === best.index && hit.key.length > best.key.length)) return hit
  return best
}

/** A firm locative wins over a toward-cue in the same sentence. A real place noun beats a generic token. Lexicon places supply toward-cues only. */
export function findPlaceCue(sentence, language, places, lexicon = []) {
  const adopted = collectPlaceCues(sentence, language, places)
  const firm = adopted.filter(hit => !hit.uncertain)
  if (firm.length) return firm.reduce(preferFirmCue, null)
  const weak = [...adopted, ...collectPlaceCues(sentence, language, lexicon)].filter(hit => hit.uncertain)
  return weak.reduce((best, hit) => (!best || hit.index > best.index ? hit : best), null)
}

export function placeMentionIsReal(text, key, language = 'en') {
  if (isNeverPlace(key)) return false
  return collectPlaceCues(String(text || ''), language, [{ name: key, keys: [key] }]).some(hit => !hit.uncertain)
}

function clockOf(sentence, language) {
  const pattern = CLOCK[languageOf(language)]
  if (!pattern) return null
  const match = sentence.match(pattern)
  if (!match) return null
  let hour = Number(match[1])
  const minute = Number(match[2] || 0)
  const marker = String(match[3] || '').toLowerCase()
  if (!Number.isInteger(hour) || hour > 24 || minute > 59) return null
  if (marker.startsWith('p') && hour < 12) hour += 12
  if (marker.startsWith('a') && hour === 12) hour = 0
  return { hour, minute, minutes: hour * 60 + minute, cue: cleanText(match[0]) }
}

export function cueLight(sentence, language = 'en') {
  const cue = timeCues(sentence, language).find(item => item.light)
  return cue?.light || ''
}

function timeCues(sentence, language) {
  const cues = []
  for (const rule of TIME_RULES) {
    const match = sentence.match(rule.re)
    if (!match) continue
    cues.push({ id: rule.id, jump: rule.jump, light: rule.light || '', cue: cleanText(match[0]) })
  }
  const clock = clockOf(sentence, language)
  if (clock) cues.push({ id: 'clock', jump: 'clock', light: clock.hour < 6 || clock.hour >= 21 ? 'night' : clock.hour < 9 ? 'dawn' : clock.hour >= 18 ? 'dusk' : 'day', cue: clock.cue, minutes: clock.minutes })
  return cues
}

function sequenceCue(sentence, language) {
  const pattern = SEQUENCE[languageOf(language)]
  if (!pattern) return ''
  const match = sentence.match(pattern)
  return match ? cleanText(match[0]) : ''
}

function verbTokens(sentence) {
  return foldName(sentence).match(/[\p{L}][\p{L}'’-]+/gu) || []
}

const FR_ENDING = /(?:èrent|erent|aient|ions|iez|ent|ons|ez|ais|ait|ées|ees|ée|ee|es|e)$/u
const EN_ENDING = /(?:ing|ed|es|s)$/u

function verbStem(token) {
  const text = foldName(token)
  if (!text) return ''
  const french = text.replace(FR_ENDING, '')
  if (french.length >= 3 && french !== text) return french
  const english = text.replace(EN_ENDING, '')
  if (english.length >= 3 && english !== text) return english
  return text
}

/** A listed form covers English -s/-es/-ed/-ing and French -e/-es/-ent/-ons/-ez/-ait, either way. */
export function matchesVerb(token, lemmas) {
  const text = foldName(token)
  if (!text || text.length < 2) return false
  if (lemmas.has(text)) return true
  const stem = verbStem(text)
  if (stem.length < 3) return false
  if (lemmas.has(stem) || lemmas.has(`${stem}e`) || lemmas.has(`${stem}er`) || lemmas.has(`${stem}re`) || lemmas.has(`${stem}ir`)) return true
  for (const lemma of lemmas) {
    if (verbStem(lemma) === stem) return true
  }
  return false
}

function hasAction(sentence, language, extra) {
  const lemmas = new Set([...(BUILTIN_VERBS[languageOf(language)] || []), ...(extra || []), 'eat', 'buy', 'lift', 'throw', 'raise', 'discover', 'dance', 'soulever', 'lancer', 'decouvrir', 'manger', 'acheter', 'danser'].map(foldName))
  const tokens = verbTokens(sentence)
  if (tokens.some(token => matchesVerb(token, lemmas))) return true
  if (language === 'ja' || language === 'zh-Hans') {
    return (BUILTIN_VERBS[language] || []).some(verb => sentence.includes(verb))
  }
  return false
}

const LOOK = new Set(['hair', 'cheveux', 'cabelo', 'haar', 'capelli', 'hoer', 'glasses', 'lunettes', 'oculos', 'brille', 'occhiali', 'beard', 'barbe', 'barba', 'bart', 'coat', 'manteau', 'casaco', 'mantel', 'cappotto', 'apron', 'tablier', 'avental', 'schuerze', 'grembiule', 'eyes', 'yeux', 'olhos', 'augen', 'occhi', 'face', 'visage', 'rosto', 'gesicht', 'viso', 'sweater', 'pull', 'pullover', 'maglione', 'shirt', 'chemise', 'camisa', 'hemd', 'camicia', 'dress', 'robe', 'vestido', 'kleid', 'vestito', 'hat', 'chapeau', 'hut', 'cappello', 'casquette', 'cap', 'scarf', 'echarpe', 'cachecol', 'schal', 'sciarpa', 'jacket', 'veste', 'boots', 'bottes', 'shoes', 'souliers'].map(word => foldName(word)))

const STRONG_ACTION = /\b(walks?|runs?|enters?|leaves?|opens?|pours?|sits?|stands?|reads?|turns?|crosses?|gives?|hands?|waits?|checks?|lifts?|holds?|follows?|yawns?|leads?|practises?|practices?|writes?|comes?|entre|sort|ouvre|verse|marche|lit|regarde|attend|porte|prend|donne|revient|boceja|lava|acende|acendem|pinta|pintam|ajuda|ajudam|senta|sentam|mostra|mostram|segura|seguram|perde|perdem)\b/iu

const WARDROBE_SENTENCE = /(?<![\p{L}])(?:veste|vestem|põe|poe|põem|poem|tira|tiram|despe|despem|vestir|despir|puts?\s+on|takes?\s+off|take\s+off)(?![\p{L}])/iu
const WARDROBE_NOUN = /(?<![\p{L}])(?:impermeável|impermeavel|casaco|jaqueta|camisola|colete|vestido|camisa|blusa|saia|calças|calcas|avental|fato|farda|capa|gabardina|chapéu|chapeu|cachecol|lenço|lenco|coat|jacket|scarf|hat|cloak|apron|dress|shirt|sweater|parka|boots?)(?![\p{L}])/iu

/** A put-on or take-off after the story has started. It versions the outfit instead of staying a portrait. */
export function isWardrobeSentence(sentence) {
  return WARDROBE_SENTENCE.test(sentence) && WARDROBE_NOUN.test(sentence)
}

function leaveChanges(sentence) {
  return /(?<![\p{L}])(?:leaves?|leaving|left|exits?|sai|saem|saindo|sair)(?![\p{L}])/iu.test(sentence)
}

/** A sentence that only introduces a person. It fills the sheet and is not a shot. */
export function isPortraitSentence(sentence) {
  const raw = String(sentence || '').trim()
  if (!raw || STRONG_ACTION.test(raw)) return false
  if (/^\p{Lu}[\p{L}'’.-]+(?:\s+\p{Lu}[\p{L}'’.-]+){0,3}\s*,\s*\d{1,3}\b/u.test(raw)) return true
  if (/\b(?:\d{1,3}\s*(?:Jahre|anni|anos|ans|years)|岁|歲)\b/u.test(raw) && /[，,]/u.test(raw)) return true
  if (isLookIntro(raw)) return true
  if (/^\p{Lu}[\p{L}'’-]{1,40}(?:\s+\p{Lu}[\p{L}'’-]{1,40}){0,2}\s+is\s+/u.test(raw)) return true
  if (STORY_ACT.test(raw)) return false
  if (/^(?:she|he|they|elle|il|ela|ele)\s+(?:has|have|had|wears?|wore|is wearing|veste|usa|tem|têm)\b/iu.test(raw)) return true
  if (/^\p{Lu}[\p{L}'’-]{1,40}(?:\s+\p{Lu}[\p{L}'’-]{1,40}){0,2}\s+(?:tem|têm|veste|vestem|usa|usam|has|have|wears?|wore)\b/iu.test(raw)) return !isDefiniteDressing(raw)
  if (/\b(?:nephew|niece|brother|sister|cousin|son|daughter|mother|father|uncle|aunt|neveu|nièce|niece|cousine|frère|soeur|sœur)\s+(?:\p{Lu}[\p{L}'’-]+\s+){1,3}is\b/iu.test(raw)) return true
  return false
}

/** A name plus a list of looks. It fills the cast and is not a shot. */
function isLookIntro(sentence) {
  const raw = String(sentence || '').trim()
  if (!/,/u.test(raw) || !/^[\p{Lu}]/u.test(raw)) return false
  const first = (raw.match(/^[\p{L}][\p{L}'’-]+/u) || [''])[0]
  if (!first || isFunctionWord(first) || isNumberWord(first)) return false
  return verbTokens(raw).filter(token => LOOK.has(token)).length >= 2
}

const COPULA_SETTING = /(?<![\p{L}])(?:is|are|was|were|está|esta|estão|estao|são|sao|fica|ficam)(?![\p{L}])/iu
const QUIET_SETTING = /(?<![\p{L}])(?:quiet|silent|still|empty|calm|calmo|calma|vazio|vazia|silencioso|silenciosa|escuro|escura|deserto|deserta)(?![\p{L}])/iu
const APPEARANCE_LEAD = /^(?:she|he|they|ela|ele|eles|elas)\s+(?:has|have|had|wears?|wore|is wearing|carries|carrying|holds?|holding|veste|usam|usa|traz|tem|têm|leva|levam)\b/iu
const STORY_ACT = /(?<![\p{L}])(?:walks?|runs?|enters?|leaves?|opens?|pours?|sits?|stands?|reads?|turns?|gives?|hands?|waits?|lifts?|follows?|arrives?|meets?|boards?|checks?|calls?|smiles?|says?|applauds?|bows?|kneels?|nods?|claps?|yawns?|leads?|practises?|practices?|writes?|pushes?|abre|fecha|entra|sai|caminha|corre|espera|pega|lê|le|diz|sorri|entrega|observa|acende|acendem|pinta|pintam|ajuda|ajudam|sobe|desce|chama|cumprimenta|acena|aplaude|ajoelha|senta|sentam|boceja|lava|lavam|mostra|mostram|segura|seguram|perde|perdem)(?![\p{L}])/iu

function isDefiniteDressing(sentence) {
  return /(?<![\p{L}])(?:veste|vestem)(?![\p{L}])\s+(?:o|a|os|as)\s+\p{L}/iu.test(sentence)
}

/** A sentence that only sets place, time, or appearance. It is context, not a shot. */
export function isDescriptionSentence(sentence) {
  const raw = String(sentence || '').trim()
  if (!raw || STORY_ACT.test(raw) || STRONG_ACTION.test(raw)) return false
  if (isPortraitSentence(raw) || isCastLine(raw)) return true
  if (APPEARANCE_LEAD.test(raw)) return true
  return COPULA_SETTING.test(raw) && QUIET_SETTING.test(raw)
}

/** A costume line wears clothes. "ouvre la porte" and "dans sa veste" are not costume lines. */
export function isCastLine(sentence) {
  if ((String(sentence || '').match(/,/g) || []).length < 2) return false
  DOOR_NOUN.lastIndex = 0
  const stripped = String(sentence || '').replace(DOOR_NOUN, ' ')
  WEAR_VERB.lastIndex = 0
  for (const match of stripped.matchAll(WEAR_VERB)) {
    const before = stripped.slice(Math.max(0, match.index - 16), match.index)
    if (/\b(?:la|le|les|un|une|des|du|de|dans|sur|sous|avec|the|a|an|his|her|sa|son|der|die|das)\s+$/iu.test(before)) continue
    return true
  }
  return false
}

function samePlace(a, b) {
  if (!a || !b) return false
  const left = foldName(a)
  const right = foldName(b)
  return left === right || left.includes(right) || right.includes(left)
}

const GENERIC_SUBJECT = new Set(['room', 'place', 'space', 'area', 'air', 'light', 'scene', 'sala', 'lugar', 'quarto', 'espaco', 'espaço', 'ar', 'luz', 'cena', 'setting'])

/** The place a sentence names as its subject. "The dining car rattles" is the dining car. A bare "room" does not replace a place already set. */
export function subjectPlace(sentence, language = 'en', places = []) {
  const lead = String(sentence || '').match(/^(?:the|a|an|o|os|as|um|uma)\s+(.+)$/iu)
  if (!lead) return ''
  const words = lead[1].replace(/[.,;:!?].*$/u, '').split(/\s+/).filter(Boolean)
  if (words.length < 2) return ''
  for (let size = Math.min(4, words.length - 1); size >= 1; size -= 1) {
    const raw = tidyPlaceLemma(words.slice(0, size).join(' '))
    const next = words[size]
    if (!raw || isRejectedPlace(raw) || isNeverPlace(raw) || GENERIC_SUBJECT.has(foldName(raw))) continue
    if (next && extendsPlace(next, language)) continue
    const key = foldName(raw)
    const known = (places || []).find(place => [place?.name, ...(place?.keys || [])].some(item => foldName(item) === key))
    if (known?.name && !isRejectedPlace(known.name) && !GENERIC_SUBJECT.has(foldName(known.name))) return known.name
    const named = settingName(raw, language)
    if (named) return named
  }
  return ''
}

/** Light in effect after this sentence. A new time cue replaces the old light, and a cue with no light clears it. */
export function lightAfterCue(sentence, language = 'en', current = '') {
  const cues = timeCues(sentence, language)
  if (!cues.length) return current || ''
  const lit = cues.filter(item => item.light)
  return lit.length ? lit[lit.length - 1].light : ''
}

function applyTime(cues, state) {
  let changed = false
  if (cues.length) {
    const lit = cues.filter(item => item.light)
    const next = lit.length ? lit[lit.length - 1].light : ''
    if (next && !state.firstLight && !state.started) state.firstLight = next
    state.light = next
  }
  for (const cue of cues) {
    state.timeLabel = cue.cue
    if (cue.jump === 'clock') {
      const close = state.minutes != null && Math.abs(cue.minutes - state.minutes) <= 15
      if (state.started && !close) changed = true
      state.minutes = cue.minutes
      state.timeId = `clock-${cue.minutes}`
      continue
    }
    if (!state.started) {
      state.timeId = cue.id
      continue
    }
    if (state.timeId !== cue.id) {
      changed = true
      state.timeId = cue.id
      if (cue.jump === 'day') state.minutes = null
    }
  }
  return { changed }
}

function actionText(sentence) {
  return cleanText(sentence).replace(/^[,;:\s]+/, '').replace(/[.!?。！？]+$/, '')
}

/**
 * Split free prose into shots. At most one scene cut per sentence.
 * A place or time change opens a scene. A sequence word alone opens a shot.
 */
export function splitNarrative(text, options = {}) {
  const language = languageOf(options.language || 'en')
  const places = options.places || []
  const lexicon = options.lexicon || []
  const characters = options.characters || []
  const extraVerbs = options.verbs || []
  const enabled = options.splitScenes !== false
  const shots = []
  const cuts = []
  const state = { place: '', outside: '', timeId: '', timeLabel: '', minutes: null, light: '', firstLight: '', started: false, sceneId: 0 }
  let pending = []
  const names = characters.map(item => item.name).filter(Boolean)

  let center = ''
  function whoIn(sentence) {
    const found = names.filter(name => new RegExp(`(?<![\\p{L}])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'iu').test(sentence))
    if (found.length === 1) {
      center = found[0]
      return { who: found[0], flag: '' }
    }
    if (found.length > 1) {
      center = ''
      return { who: found.slice(0, 2).join(language === 'fr' ? ' et ' : ' and '), flag: '' }
    }
    if (/^\s*(she|he|elle|il|sie|er|ela|ele|lei|lui)\b/iu.test(sentence)) {
      return center ? { who: center, flag: 'who_pronoun' } : { who: '', flag: 'who_unresolved' }
    }
    return { who: '', flag: 'who_missing' }
  }

  sentencesOf(text).forEach(sentence => {
    if (typeof options.skip === 'function' && options.skip(sentence)) {
      const place = findPlaceCue(sentence, language, places, lexicon)
      if (place && !place.uncertain) state.place = place.name
      const times = timeCues(sentence, language)
      if (times.length) {
        state.timeId = times[0].id
        state.timeLabel = times.map(item => item.cue).join(', ')
        if (times[0].light) state.light = times[0].light
        const clock = times.find(item => item.jump === 'clock')
        if (clock) state.minutes = clock.minutes
      }
      return
    }
    const place = findPlaceCue(sentence, language, places, lexicon)
    const times = timeCues(sentence, language)
    const sequence = sequenceCue(sentence, language)
    const cast = isCastLine(sentence)
    const wardrobeLater = state.started && isWardrobeSentence(sentence)
    const portrait = isPortraitSentence(sentence) && !wardrobeLater
    const described = isDescriptionSentence(sentence) && !wardrobeLater
    const action = hasAction(sentence, language, extraVerbs) && !cast && !portrait && !described
    let firmPlace = place && !place.uncertain && !isRejectedPlace(place.name) ? place : null
    if (!firmPlace) {
      const headed = preferPlaceHead(locativeHeads(sentence, language).filter(item => item.moves !== false && !isNonPlaceNoun(item.lemma) && !isRejectedPlace(item.lemma) && mentionMovesScene(sentence, item.index, language)), sentence)
      if (headed && !(headed.soft && state.place)) firmPlace = { name: headed.name, key: headed.lemma, cue: headed.name, uncertain: false, unlisted: headed.tag === 'unlisted' }
    }
    if (!firmPlace) {
      const entered = enteredPlace(sentence, language)
      if (entered && !isRejectedPlace(entered)) firmPlace = { name: entered, key: entered, cue: entered, uncertain: false }
    }
    if (!firmPlace) {
      const venue = namedVenues(sentence, language).find(item => String(item.name || '').split(/\s+/).length > 1)
      if (venue && !isRejectedPlace(venue.name)) firmPlace = { name: venue.name, key: venue.name, cue: venue.name, uncertain: false }
    }
    const words = verbTokens(sentence).length
    const cueOnly = !action && !cast && !firmPlace && (times.length > 0 || Boolean(sequence)) && words <= 5
    if (cast || portrait || described) {
      const subject = described ? subjectPlace(sentence, language, places) : ''
      if (firmPlace && !isRejectedPlace(firmPlace.name)) {
        const carried = finishCarriedPlace(sentence, firmPlace.name, state.place, state.outside)
        state.place = carried.where
        state.outside = carried.outside
      } else if (subject && (times.length || state.place)) state.place = subject
      if (times.length) applyTime(times, state)
      return
    }
    if (!firmPlace) {
      const subject = subjectPlace(sentence, language, places)
      if (subject && !isRejectedPlace(subject)) firmPlace = { name: subject, key: subject, cue: subject, uncertain: false }
    }
    if (!firmPlace) {
      const nested = String(sentence || '').match(/(?:água|agua|water|neve|snow|gelo|ice)\s+(?:de|do|da|dos|das|of)\s+(?:a\s+|o\s+|the\s+)?([\p{L}'’-]+)/iu)
      if (nested) {
        const name = settingName(nested[1], language)
        if (name && !isRejectedPlace(name)) firmPlace = { name, key: name, cue: name, uncertain: false }
      }
    }
    if (!firmPlace) {
      const moved = movementPlace(sentence, language)
      const at = moved ? String(sentence).toLowerCase().indexOf(moved.toLowerCase()) : -1
      if (moved && !isRejectedPlace(moved) && (at < 0 || mentionMovesScene(sentence, at, language))) {
        firmPlace = { name: moved, key: moved, cue: moved, uncertain: false }
      }
    }
    if (cueOnly) {
      const headed = preferPlaceHead(locativeHeads(sentence, language).filter(item => item.moves !== false && !isNonPlaceNoun(item.lemma) && !isRejectedPlace(item.lemma) && mentionMovesScene(sentence, item.index, language)), sentence)
      pending.push({
        place: headed ? { name: headed.name, key: headed.lemma, cue: headed.name, uncertain: false } : null,
        times,
        sequence,
        sentence
      })
      return
    }
    if (!action && !firmPlace && !times.length && !sequence && (words < 3 || isLookIntro(sentence))) return
    const pendingPlaces = pending.map(item => item.place).filter(item => item && !item.uncertain)
    let bundledPlace = firmPlace || pendingPlaces[pendingPlaces.length - 1] || (place && place.uncertain ? place : null)
    const bundledTimes = [...pending.flatMap(item => item.times), ...times]
    const bundledSequence = sequence || pending.map(item => item.sequence).filter(Boolean)[0] || ''
    pending = []
    let sceneCut = false
    let uncertain = false
    const reasons = []
    const personOwns = label => names.some(name => {
      const folded = foldName(name)
      const key = foldName(label)
      return key && (folded === key || folded.split(/\s+/).includes(key))
    })
    if (bundledPlace && (personOwns(bundledPlace.name) || personOwns(bundledPlace.key) || isRejectedPlace(bundledPlace.name))) bundledPlace = null
    if (bundledPlace && !samePlace(bundledPlace.name, state.place)) {
      if (bundledPlace.uncertain) {
        uncertain = true
        reasons.push(`Uncertain place cue: ${bundledPlace.cue}`)
      } else {
        sceneCut = true
        state.place = bundledPlace.name
        reasons.push(`Place cue: ${bundledPlace.cue}`)
      }
    }
    const adjusted = finishCarriedPlace(sentence, state.place, state.place, state.outside)
    if (adjusted.where && !samePlace(adjusted.where, state.place)) {
      sceneCut = true
      state.place = adjusted.where
      reasons.push(`Place cue: ${adjusted.where}`)
    } else if (!adjusted.where && state.place && leaveChanges(sentence)) {
      sceneCut = true
      state.place = ''
    }
    state.outside = adjusted.outside
    if (bundledTimes.length) {
      const next = applyTime(bundledTimes, state)
      if (next.changed && enabled) {
        sceneCut = true
        reasons.push(`Time cue: ${bundledTimes.map(item => item.cue).join(', ')}`)
      }
    }
    if (!state.started) {
      state.started = true
      state.sceneId = 1
      sceneCut = false
    } else if (sceneCut && enabled) state.sceneId += 1
    else if (!enabled) sceneCut = false
    const uncertainOnly = uncertain && !sceneCut
    const shotCut = Boolean(enabled && !sceneCut && !uncertainOnly && bundledSequence)
    const cue = sceneCut || uncertainOnly
      ? (bundledPlace?.uncertain ? bundledPlace.cue : (reasons[0]?.replace(/^[^:]+:\s*/, '') || bundledSequence))
      : bundledSequence
    const reason = sceneCut || uncertainOnly
      ? reasons.join('; ')
      : (shotCut ? `Sequence cue: ${bundledSequence}` : '')
    if ((sceneCut || uncertainOnly) && enabled) {
      cuts.push({
        shotIndex: shots.length,
        order: shots.length + 1,
        cue,
        reason: uncertainOnly ? `Uncertain. ${reason}` : reason,
        uncertain: uncertainOnly,
        kind: 'scene',
        place: state.place,
        time: state.timeLabel || ''
      })
    } else if (shotCut) {
      cuts.push({
        shotIndex: shots.length,
        order: shots.length + 1,
        cue: bundledSequence,
        reason: `Sequence cue: ${bundledSequence}`,
        uncertain: false,
        kind: 'shot',
        place: state.place,
        time: state.timeLabel || ''
      })
    }
    const spoken = whoIn(sentence)
    const bits = splitPieces(actionText(sentence), language, extraVerbs)
    const statedLight = cueLight(sentence, language)
    bits.forEach((bit, index) => {
      const opening = index === 0
      const person = whoIn(bit)
      const flags = []
      const whoFlag = person.who ? person.flag : spoken.flag
      if (whoFlag) flags.push({ field: 'who', code: whoFlag })
      if (state.place && !(place && !place.uncertain && foldName(place.name) === foldName(state.place))) flags.push({ field: 'where', code: 'place_carried' })
      if (place?.unlisted || places.find(item => foldName(item.name) === foldName(state.place))?.unlisted) flags.push({ field: 'where', code: 'place_unlisted' })
      if (state.light && !statedLight) flags.push({ field: 'light', code: 'light_carried' })
      shots.push({
        who: person.who || spoken.who,
        where: state.place,
        what: bit,
        source: sentence,
        flags,
        timeLabel: state.timeLabel || '',
        light: state.light || '',
        sceneId: state.sceneId || 1,
        sceneCut: Boolean(opening && sceneCut && enabled && !uncertainOnly),
        cutCue: opening ? cue : '',
        cutReason: opening ? (sceneCut || uncertainOnly ? (uncertainOnly ? `Uncertain. ${reasons.join('; ')}` : reasons.join('; ')) : (shotCut ? `Sequence cue: ${bundledSequence}` : '')) : '',
        cutUncertain: Boolean(opening && uncertainOnly),
        cutKind: opening ? (sceneCut || uncertainOnly ? 'scene' : (shotCut ? 'shot' : '')) : ''
      })
    })
  })
  return { shots, cuts, place: state.place, time: state.timeLabel, light: state.light, firstLight: state.firstLight }
}

function splitPieces(text, language, extraVerbs) {
  const english = splitActionText(text)
  if (english.length >= 2) return english
  if (language !== 'fr' && language !== 'pt' && language !== 'it') return [text]
  const pattern = language === 'pt' ? /\s+\b(?:e depois|e então|e)\b\s+/i : language === 'it' ? /\s+\b(?:e poi|e)\b\s+/i : /\s+\b(?:et puis|puis|et)\b\s+/i
  const parts = text.split(pattern).map(part => part.trim()).filter(Boolean)
  if (parts.length < 2) return [text]
  if (!parts.every(part => hasAction(part, language, extraVerbs) || splitActionText(part).length >= 1)) return [text]
  return parts
}

/** A user merge drops a scene boundary. A split promotes a shot cue into a scene. */
export function editCut(cuts, index, mode) {
  const next = (cuts || []).map(cut => ({ ...cut }))
  const cut = next[index]
  if (!cut) return next
  if (mode === 'merge') {
    cut.kind = 'shot'
    cut.uncertain = false
    cut.merged = true
    cut.reason = `Merged. ${cut.reason || cut.cue || ''}`.trim()
  } else if (mode === 'split') {
    cut.kind = 'scene'
    cut.merged = false
    cut.reason = cut.uncertain ? `Uncertain. Split. ${cut.cue || ''}` : `Split. ${cut.reason || cut.cue || ''}`
  }
  return next
}

export function supportedCueLanguages() {
  return [...LOCALES]
}

const CAST_WARNING = Object.freeze({
  en: { missing_look: name => `No look found for ${name}.`, missing_outfit: name => `No outfit found for ${name}.` },
  pt: { missing_look: name => `Nenhuma aparência encontrada para ${name}.`, missing_outfit: name => `Nenhuma roupa encontrada para ${name}.` },
  'zh-Hans': { missing_look: name => `没有找到 ${name} 的外形。`, missing_outfit: name => `没有找到 ${name} 的服装。` }
})

export function proseWarningMessage(warning, language = 'en') {
  const catalog = CAST_WARNING[language] || CAST_WARNING.en
  const format = catalog[warning?.code]
  if (!format || !warning?.name) return warning?.message || ''
  return format(warning.name)
}
