# Place library

Moovicut decides places with a static library. Nothing is downloaded and no model runs when a story is planned.

A noun is either a **sure place** or **ambiguous**. A sure place can name the setting when it appears. An ambiguous word counts only inside a locative, or after an enter verb such as *entra* or *enters*: English `in` / `at` / `inside` / `into`, French `dans` / `au` / `à la`, Portuguese and Italian equivalents, Japanese `で` / `に` / `の中`, Chinese `在` / `去` / `到` plus `里` / `上` / `中` / `内`. Once a scene has a place, only a new locative sentence replaces it. The place is the whole noun phrase after the preposition, including a compound (`village pound`, `入江の番屋`), not only its first word. A time word, a verb, a pronoun, a body part, a garment, or an abstract noun is never that phrase, in English, French, Portuguese, Italian, Japanese, and Chinese. A Japanese compound such as 右の眉尻, and a loanword that only contains a venue syllable such as バー inside カバー, is not a place. An unlisted noun is kept only when the frame is locative, and the shot is flagged `place_unlisted`. A phrase that fails that test leaves the shot on the previous place, or on the generic setting, with `place_missing`. A place inside dialogue, a memory, a glance, or a destination the sentence does not reach does not move the scene. Chinese also reads `在…里/上/边`, `到…`, `来到…`, and a place suffix inside that frame. A place named in passing, behind something, or at the end of a valley does not. A later place is not copied onto earlier shots. A word someone holds, wears, or uses is never the place. An adjective, a garment, and a determiner or possessive (French *son*, Italian *suo*, Portuguese *seu*) are never the place. A person's name wins over a place word.

Ambiguous tags record the other sense: `name`, `object`, `material`, `adjective`, `garment`, or `other` (the lemma also belongs to a non-place synset). The audit lists live in `app/data/place-audit.json`. A library entry that is on the name, object, material, adjective, or garment lists and is tagged sure fails the audit test. A determiner on those lists must not be an entry at all.

## Licence of the shipped file

`app/data/place-lexicon.json` is a compilation. It includes ShareAlike material from OpenWN-PT (Portuguese, CC BY-SA). ShareAlike applies to that contribution, so the file is distributed under **Creative Commons Attribution-ShareAlike 4.0 International**. If you share the file or an adaptation of it, credit every source below and license the adaptation under CC BY-SA 4.0.

The other sources are not ShareAlike, and their own terms still apply to their entries. English WordNet entries keep the [WordNet licence](https://wordnet.princeton.edu/license-and-commercial-use). French WOLF entries stay available under CeCILL-C as well as under the compilation licence. Italian MultiWordNet entries are CC BY 3.0. The Japanese and Chinese WordNets use WordNet-style licences that require attribution.

## Sources and licences

| Language | Source | Licence |
|---|---|---|
| English | Princeton WordNet 3.0 noun hyponyms of place types (building, room, facility, road, water, landform, and the narrower roots in `scripts/build-place-lexicon.py`) | [WordNet licence](https://wordnet.princeton.edu/license-and-commercial-use) |
| French | WOLF, via Open Multilingual Wordnet 1.4, on those synsets | CeCILL-C |
| Portuguese | OpenWN-PT, via Open Multilingual Wordnet 1.4 | CC BY-SA |
| Italian | MultiWordNet, via Open Multilingual Wordnet 1.4 | CC BY 3.0 |
| Japanese | NICT Japanese Wordnet, via Open Multilingual Wordnet 1.4 | WordNet-style licence, attribution required |
| Chinese | Chinese Open Wordnet, via Open Multilingual Wordnet 1.4 | WordNet-style licence |

The library covers the six site languages: English, French, Portuguese, Italian, Japanese, and Chinese. German is not one of them. Open Multilingual Wordnet is the compilation of Francis Bond and Kyonghee Paik. Rebuild with WordNet at `WORDNET_TAR` and OMW at `OMW_ZIP`:

```sh
python3 scripts/build-place-lexicon.py
```

The committed file is `app/data/place-lexicon.json`. Counts per language are the `counts` field.

## Gaps

The walks are place-type hyponyms, not every noun and not every named town. A locative whose head is missing from that language's list still falls back to the unnamed setting. Wikidata was not merged: the public query service was rate-limiting this build, and Open Multilingual Wordnet already covers the six languages under licences that can be recorded per source.
