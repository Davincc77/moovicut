# Place library

Moovicut decides places with a static library. Nothing is downloaded and no model runs when a story is planned.

A noun is either a **sure place** or **ambiguous**. A sure place can be listed on the sheet when it appears. An ambiguous word counts only inside a locative, or after an arrival verb such as *entra*, *enters*, or *reaches*: English `in` / `at` / `inside` / `into`, Portuguese `em` / `no` / `na` / `dentro`. A shot's place is carried to later shots only when that place was named in a locative frame or by an arrival verb. A bare noun does not move the scene and does not fill an empty `where`. When `where` is empty, the prompt omits the PLACE line. The place is the whole noun phrase after the preposition, including a compound (`village pound`), not only its first word. A time word, a verb, a pronoun, a body part, a garment, a room surface (`wall`, `floor`, `parede`, `chão`), an object (`caixa registadora`), a clothing phrase, a language or nationality (`French`), an abstract noun, and the explicit non-places (`place`, `circle`, vehicle parts and devices such as `van speakers`) are never that phrase, in English and Portuguese. A rejected candidate is not carried. A movement verb plus a locative (`enters`, `goes to`, `walks onto`, `entra no`, `chega ao`, `vai para`) adopts the noun phrase even when it is not in the WordNet list. Extra sure places for that gap are lighthouse, sleeper compartment, sleeper car, dining car, red carpet, farol, mercado, tapete vermelho, compartimento, kiln, church, stage, cellar, forno, fornalha, palco, igreja, and adega. The same list also names stables, big top, hall, lake, yard, hut, cabin, cave, cavern, glacier, helipad, suite, and the Portuguese estábulo, picadeiro, lago, cabana, glaciar, gruta, caverna, and heliporto. A mirror, a crowd, sand, a desk, a carriage, a trapeze, air, and snow are not places, in English or Portuguese (`espelho`, `multidão`, `areia`). A smile or a look toward the sea does not leave the beach. A definite locative whose noun is not in the library still keeps that noun as the PLACE line. A description that names a new place replaces the place already carried. A description does not fill an empty where when it has no time cue. Common rooms that WordNet left ambiguous are also sure: conservatory, atrium, study, attic, gallery, workshop, lobby, sea, and ocean, and in Portuguese átrio, escritório, estufa, mar, praia, cais, bilheteira, and vinha. A watch, the object or the verb, is never a place. A beat whose subject is one of these places, and a movement such as crosses, wades into, caminha até, or vai para, replaces the place that was carried. Sea and beach stay different places. A description that also sets the time of day still keeps that place on the following shots. A description with no time cue does not fill an empty where. An unlisted noun is kept only when the frame is locative, and the shot is flagged `place_unlisted`. A phrase that fails that test leaves the shot on the previous cued place, or with an empty `where`. A place inside dialogue, a memory, a glance, or a destination the sentence does not reach does not move the scene. A place named in passing, behind something, or at the end of a valley does not. A later place is not copied onto earlier shots. A word someone holds, wears, or uses is never the place. An adjective, a garment, and a determiner or possessive (Portuguese *seu*) are never the place. A person's name wins over a place word.

A clothing phrase, a manner adverb (`in a hurry`), an idiom (`entra em cena`), and a label that would end on a preposition are not places. A trailing `com` or `with` plus a tool is stripped (`floresta com cantil` stays `floresta`). `at` / `in` / `to the` and `na` / `no` / `à` / `ao`, including inside a time-jump sentence, adopt the new place from that shot on. A description sentence that also sets the time of day keeps that place on the following shots. A part label never comes from a rejected place.

French, Italian, Japanese, and Chinese are not site languages. Their lemmas are not in the shipped file, and prose in those languages is not planned as those languages. Old `/zh` and `/zh-Hans` paths redirect to the English page.

Ambiguous tags record the other sense: `name`, `object`, `material`, `adjective`, `garment`, or `other` (the lemma also belongs to a non-place synset). The audit lists live in `app/data/place-audit.json`. A library entry that is on the name, object, material, adjective, or garment lists and is tagged sure fails the audit test. A determiner on those lists must not be an entry at all.

## Licence of the shipped file

`app/data/place-lexicon.json` is a compilation. It includes ShareAlike material from OpenWN-PT (Portuguese, CC BY-SA). ShareAlike applies to that contribution, so the file is distributed under **Creative Commons Attribution-ShareAlike 4.0 International**. If you share the file or an adaptation of it, credit every source below and license the adaptation under CC BY-SA 4.0.

The other sources are not ShareAlike, and their own terms still apply to their entries. English WordNet entries keep the [WordNet licence](https://wordnet.princeton.edu/license-and-commercial-use).

## Sources and licences

| Language | Source | Licence |
|---|---|---|
| English | Princeton WordNet 3.0 noun hyponyms of place types (building, room, facility, road, water, landform, and the narrower roots in `scripts/build-place-lexicon.py`) | [WordNet licence](https://wordnet.princeton.edu/license-and-commercial-use) |
| Portuguese | OpenWN-PT, via Open Multilingual Wordnet 1.4 | CC BY-SA |

| Language | Sure | Ambiguous | Total |
|---|---:|---:|---:|
| English | 1,915 | 716 | 2,631 |
| Portuguese | 780 | 271 | 1,051 |

3,682 entries. The library covers the two site languages: English and Portuguese. French, Italian, Japanese, Chinese, and German are not among them. Open Multilingual Wordnet is the compilation of Francis Bond and Kyonghee Paik. Rebuild with WordNet at `WORDNET_TAR` and OMW at `OMW_ZIP`:

```sh
python3 scripts/build-place-lexicon.py
```

The committed file is `app/data/place-lexicon.json`. Counts per language are the `counts` field.

## Gaps

The walks are place-type hyponyms, not every noun and not every named town. A locative whose head is missing from that language's list stays an unlisted place when the frame is a real locative, and otherwise leaves `where` empty. Wikidata was not merged: the public query service was rate-limiting this build, and Open Multilingual Wordnet covers Portuguese under a licence that can be recorded.
