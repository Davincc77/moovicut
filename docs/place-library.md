# Place library

Moovicut decides places with a static library. Nothing is downloaded and no model runs when a story is planned.

A noun is either a **sure place** or **ambiguous**. A sure place can name the setting when it appears. An ambiguous word counts only inside a locative, or after an enter verb such as *entra* or *enters*: English `in` / `at` / `inside` / `into`, Portuguese `em` / `no` / `na` / `dentro`, Chinese `在` / `去` / `到` plus `里` / `上` / `中` / `内`. Once a scene has a place, only a new locative sentence replaces it. The place is the whole noun phrase after the preposition, including a compound (`village pound`), not only its first word. A time word, a verb, a pronoun, a body part, a garment, or an abstract noun is never that phrase, in English, Portuguese, and Chinese. An unlisted noun is kept only when the frame is locative, and the shot is flagged `place_unlisted`. A phrase that fails that test leaves the shot on the previous place, or on the generic setting, with `place_missing`. A place inside dialogue, a memory, a glance, or a destination the sentence does not reach does not move the scene. Chinese also reads `在…里/上/边`, `到…`, `来到…`, and a place suffix inside that frame. A place named in passing, behind something, or at the end of a valley does not. A later place is not copied onto earlier shots. A word someone holds, wears, or uses is never the place. An adjective, a garment, and a determiner or possessive (Portuguese *seu*) are never the place. A person's name wins over a place word.

French, Italian, and Japanese are not site languages. Their lemmas are not in the shipped file, and prose in those languages is not planned as those languages.

Ambiguous tags record the other sense: `name`, `object`, `material`, `adjective`, `garment`, or `other` (the lemma also belongs to a non-place synset). The audit lists live in `app/data/place-audit.json`. A library entry that is on the name, object, material, adjective, or garment lists and is tagged sure fails the audit test. A determiner on those lists must not be an entry at all.

## Licence of the shipped file

`app/data/place-lexicon.json` is a compilation. It includes ShareAlike material from OpenWN-PT (Portuguese, CC BY-SA). ShareAlike applies to that contribution, so the file is distributed under **Creative Commons Attribution-ShareAlike 4.0 International**. If you share the file or an adaptation of it, credit every source below and license the adaptation under CC BY-SA 4.0.

The other sources are not ShareAlike, and their own terms still apply to their entries. English WordNet entries keep the [WordNet licence](https://wordnet.princeton.edu/license-and-commercial-use). Chinese Open Wordnet entries use a WordNet-style licence that requires attribution.

## Sources and licences

| Language | Source | Licence |
|---|---|---|
| English | Princeton WordNet 3.0 noun hyponyms of place types (building, room, facility, road, water, landform, and the narrower roots in `scripts/build-place-lexicon.py`) | [WordNet licence](https://wordnet.princeton.edu/license-and-commercial-use) |
| Portuguese | OpenWN-PT, via Open Multilingual Wordnet 1.4 | CC BY-SA |
| Chinese | Chinese Open Wordnet, via Open Multilingual Wordnet 1.4 | WordNet-style licence |

| Language | Sure | Ambiguous | Total |
|---|---:|---:|---:|
| English | 1,912 | 716 | 2,628 |
| Portuguese | 780 | 270 | 1,050 |
| Chinese | 1,076 | 133 | 1,209 |

4,887 entries. The library covers the three site languages: English, Portuguese, and Chinese. French, Italian, Japanese, and German are not among them. Open Multilingual Wordnet is the compilation of Francis Bond and Kyonghee Paik. Rebuild with WordNet at `WORDNET_TAR` and OMW at `OMW_ZIP`:

```sh
python3 scripts/build-place-lexicon.py
```

The committed file is `app/data/place-lexicon.json`. Counts per language are the `counts` field.

## Gaps

The walks are place-type hyponyms, not every noun and not every named town. A locative whose head is missing from that language's list still falls back to the unnamed setting. Wikidata was not merged: the public query service was rate-limiting this build, and Open Multilingual Wordnet covers Portuguese and Chinese under licences that can be recorded per source.
