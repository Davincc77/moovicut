# Place library

Moovicut decides places with a static library. Nothing is downloaded and no model runs when a story is planned.

A noun is either a **sure place** or **ambiguous**. A sure place can name the setting when it appears. An ambiguous word counts only inside a locative: English `in` / `at` / `inside`, French `dans` / `au` / `à la`, German `in` / `im` / `auf`, Portuguese and Italian equivalents, Japanese `で` / `に` / `の中`, Chinese `在` plus `里` / `上` / `中` / `内`. Once a scene has a place, only a new locative sentence replaces it. A word someone holds, wears, or uses is never the place. A person's name wins over a place word.

Ambiguous tags record the other sense: `name`, `object`, `material`, or `other` (the lemma also belongs to a non-place synset). The audit lists live in `app/data/place-audit.json`. A library entry that is on those lists and is not tagged ambiguous fails `every library word that is also a common name, object, or material is tagged ambiguous`.

## Sources and licences

| Language | Source | Licence |
|---|---|---|
| English | Princeton WordNet 3.0 noun hyponyms of place types (building, room, facility, road, water, landform, and the narrower roots in `scripts/build-place-lexicon.py`) | [WordNet licence](https://wordnet.princeton.edu/license-and-commercial-use) |
| French | WOLF, via Open Multilingual Wordnet 1.4, on those synsets | CeCILL-C |
| Portuguese | OpenWN-PT, via Open Multilingual Wordnet 1.4 | CC BY-SA |
| Italian | MultiWordNet, via Open Multilingual Wordnet 1.4 | CC BY 3.0 |
| Japanese | Japanese Wordnet (NICT), via Open Multilingual Wordnet 1.4 | WordNet-style licence, attribution required |
| Chinese | Chinese Open Wordnet, via Open Multilingual Wordnet 1.4 | WordNet-style licence |
| German | OdeNet 1.3 hyponyms of place seeds (Gebäude, Zimmer, Straße, Gewässer, and the other seeds in the build script) | CC BY-SA 4.0 |

Open Multilingual Wordnet is the compilation of Francis Bond and Kyonghee Paik. OdeNet is Melanie Siegel and Francis Bond. Rebuild with WordNet at `WORDNET_TAR`, OMW at `OMW_ZIP`, and OdeNet at `ODENET_XML`:

```sh
python3 scripts/build-place-lexicon.py
```

The committed file is `app/data/place-lexicon.json`. Counts per language are the `counts` field.

## Gaps

The walks are place-type hyponyms, not every noun and not every named town. A locative whose head is missing from that language's list still falls back to the unnamed setting. German adverbs that share a spelling with a noun (`weg`) are not treated as a place unless the noun is capitalised or the phrase is locative. Wikidata was not merged: the public query service was rate-limiting this build, and OdeNet plus Open Multilingual Wordnet already cover the seven languages under licences that can be recorded per source.
