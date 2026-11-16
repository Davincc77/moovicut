#!/usr/bin/env python3
"""Build app/data/place-lexicon.json. No model and no network at runtime.

Sources, fetched only when this script runs:
- Princeton WordNet 3.0 (WORDNET_TAR, default /tmp/wn.tar.gz)
- Open Multilingual Wordnet 1.4 (OMW_ZIP, default /tmp/omw.zip): por, cmn
German, French, Italian, and Japanese are not site languages, so OdeNet, WOLF, MultiWordNet, and the Japanese Wordnet are not read.

Ambiguous tags come from app/data/place-audit.json and from a lemma that also
belongs to a non-place synset.
"""
import json
import os
import re
import tarfile
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDIT_PATH = ROOT / 'app' / 'data' / 'place-audit.json'
OUT_PATH = ROOT / 'app' / 'data' / 'place-lexicon.json'
WORDNET_TAR = os.environ.get('WORDNET_TAR', '/tmp/wn.tar.gz')
OMW_ZIP = os.environ.get('OMW_ZIP', '/tmp/omw.zip')
ODENET_XML = os.environ.get('ODENET_XML', '/tmp/odenet.xml')

PLACE_ROOTS = {
    'building', 'room', 'facility', 'workplace', 'housing', 'way', 'road',
    'geographical area', 'body of water', 'geological formation', 'natural elevation',
    'tract', 'bridge', 'park', 'station', 'airport', 'harbor', 'harbour',
    'foundry', 'business office', 'print shop', 'printing shop', 'loft', 'shed',
    'workshop', 'shop', 'store', 'industrial plant', 'metalworks',
}
EXCLUDE_ROOTS = {
    'person', 'animal', 'food', 'substance', 'feeling', 'attribute',
    'act', 'event', 'time', 'color', 'colour', 'body part', 'anatomical structure',
    'chemical', 'artifact',
}
# artifact is broad (includes buildings). Do not exclude a synset that is also a place.
# The exclude walk is applied only when the synset is NOT in the place set.
# So artifact is not used as an exclude root. body part is.
EXCLUDE_ROOTS.discard('artifact')

OMW = {
    'pt': 'omw-1.4/por/wn-data-por.tab',
    'zh-Hans': 'omw-1.4/cow/wn-data-cmn.tab',
}
DE_SEEDS = [
    'Gebäude', 'Haus', 'Zimmer', 'Küche', 'Straße', 'Weg', 'Brücke', 'Park',
    'Bahnhof', 'Flughafen', 'Fluss', 'See', 'Berg', 'Wald', 'Strand', 'Hafen',
    'Kirche', 'Schule', 'Krankenhaus', 'Garten', 'Hof', 'Platz', 'Tunnel',
    'Insel', 'Tal', 'Wüste', 'Höhle', 'Werkstatt', 'Fabrik', 'Geschäft',
]
DE_EXCLUDE = ['Person', 'Tier', 'Pflanze', 'Nahrung', 'Gefühl', 'Farbe', 'Zeit', 'Stoff', 'Körperteil']
# Gap-fillers the walk missed before any blind-test report. Report vocabulary stays out;
# tests/supplement-vocab.test.mjs fails if one of those words is added back.
SUPPLEMENT = {
    'en': ['quay', 'pier', 'wharf', 'cafe', 'rink', 'boathouse', 'car wash', 'pawnshop', 'fire escape', 'sawmill', 'mine', 'hayloft', 'embankment', 'gym', 'bowling alley'],
    'pt': ['estufa', 'cais', 'piscina'],
    'zh-Hans': ['厨房', '温室', '码头', '咖啡馆', '车站'],
}


def fold(value):
    return str(value or '').strip().lower().replace('’', "'")


def load_audit():
    raw = json.loads(AUDIT_PATH.read_text())
    out = {}
    for kind in ('names', 'objects', 'materials', 'adjectives', 'garments', 'determiners'):
        out[kind] = {lang: {fold(word) for word in words} for lang, words in raw.get(kind, {}).items()}
    return out


def walk(children, roots):
    seen, stack = set(), list(roots)
    while stack:
        off = stack.pop()
        if off in seen:
            continue
        seen.add(off)
        stack.extend(children.get(off, []))
    return seen


def parse_wordnet(path):
    syn, children = {}, defaultdict(list)
    with tarfile.open(path) as tar:
        lines = tar.extractfile('dict/data.noun').read().decode('latin1').splitlines()
    for line in lines:
        if not line or line.startswith('  '):
            continue
        parts = line.split()
        if len(parts) < 6 or parts[2] != 'n':
            continue
        offset, wcnt = parts[0], int(parts[3], 16)
        words, i = [], 4
        for _ in range(wcnt):
            words.append(parts[i].replace('_', ' '))
            i += 2
        pcnt = int(parts[i])
        i += 1
        for _ in range(pcnt):
            if parts[i] == '@':
                children[parts[i + 1]].append(offset)
            i += 4
        syn[offset] = words
    return syn, children


def roots_for(syn, names):
    found = []
    for off, words in syn.items():
        if any(word.lower() in names for word in words):
            found.append(off)
    return found


def ok_lemma(lemma, language):
    text = lemma.strip()
    if not text or any(ch.isdigit() for ch in text):
        return False
    if language in ('ja', 'zh-Hans'):
        return 1 < len(text) <= 12 and '+' not in text and ' ' not in text
    if len(text) < 3 or len(text) > 40:
        return False
    if text.count(' ') > 2:
        return False
    return bool(re.fullmatch(r"[\w' -]+", text, re.UNICODE))


def sense_of(language, lemma, audit):
    key = fold(lemma)
    for kind in ('names', 'objects', 'materials', 'adjectives', 'garments', 'determiners'):
        if key in audit.get(kind, {}).get(language, ()):
            return {'names': 'name', 'objects': 'object', 'materials': 'material', 'adjectives': 'adjective', 'garments': 'garment', 'determiners': 'determiner'}[kind]
    return ''


def add_lemma(bucket, other, language, lemma, offset_is_place, audit):
    if not ok_lemma(lemma, language):
        return
    key = fold(lemma) if language not in ('ja', 'zh-Hans') else lemma.strip()
    slot = bucket[language].setdefault(key, {'place': False, 'other': False})
    if offset_is_place:
        slot['place'] = True
    else:
        slot['other'] = True
    listed = sense_of(language, key, audit)
    if listed:
        other[language][key] = listed


def read_omw(zip_path, place_offsets, audit, bucket, other):
    import zipfile
    with zipfile.ZipFile(zip_path) as zipped:
        for language, name in OMW.items():
            with zipped.open(name) as handle:
                for raw in handle.read().decode('utf-8', 'replace').splitlines():
                    if not raw or raw.startswith('#'):
                        continue
                    cols = raw.split('\t')
                    kind = cols[1]
                    if kind != 'lemma' and not kind.endswith(':lemma'):
                        continue
                    offset = cols[0]
                    if not offset.endswith('-n'):
                        continue
                    off = offset.split('-')[0]
                    is_place = off in place_offsets
                    # OMW writes one lemma with "+" or "_" between its words.
                    lemma = re.sub(r'\s+', ' ', cols[2].replace('+', ' ').replace('_', ' ')).strip()
                    add_lemma(bucket, other, language, lemma, is_place, audit)


def read_odenet(path, audit, bucket, other):
    lemmas = defaultdict(set)
    children = defaultdict(list)
    entry = re.compile(r'<Lemma writtenForm="([^"]+)" partOfSpeech="n"/>')
    sense = re.compile(r'synset="(odenet-\d+-n)"')
    relation = re.compile(r'''<Synset id=["'](odenet-\d+-n)["'].*?<SynsetRelation target=["'](odenet-\d+-n)["'] relType=["']hypernym["']''')
    with open(path, encoding='utf-8', errors='replace') as handle:
        for line in handle:
            if line.startswith('<LexicalEntry'):
                found = entry.search(line)
                if not found:
                    continue
                for syn in sense.findall(line):
                    lemmas[syn].add(found.group(1))
            elif line.startswith('<Synset'):
                found = relation.search(line)
                if found:
                    children[found.group(2)].append(found.group(1))
    def synsets_for(words):
        want = {fold(word) for word in words}
        return [syn for syn, forms in lemmas.items() if any(fold(form) in want for form in forms)]
    place = walk(children, synsets_for(DE_SEEDS))
    excluded = walk(children, synsets_for(DE_EXCLUDE))
    place -= excluded
    for syn, forms in lemmas.items():
        is_place = syn in place
        for form in forms:
            add_lemma(bucket, other, 'de', form, is_place, audit)


def tag_for(slot, listed):
    if listed:
        return f'a:{listed}'
    if slot['other']:
        return 'a:other'
    return 's'


def main():
    audit = load_audit()
    syn, children = parse_wordnet(WORDNET_TAR)
    place = walk(children, roots_for(syn, PLACE_ROOTS))
    excluded = walk(children, roots_for(syn, EXCLUDE_ROOTS))
    place -= excluded
    bucket = defaultdict(dict)
    listed_sense = defaultdict(dict)
    for off, words in syn.items():
        is_place = off in place
        for word in words:
            add_lemma(bucket, listed_sense, 'en', word, is_place, audit)
    for language, words in SUPPLEMENT.items():
        for word in words:
            add_lemma(bucket, listed_sense, language, word, True, audit)
    read_omw(OMW_ZIP, place, audit, bucket, listed_sense)
    tags = {}
    counts = {}
    for language, forms in bucket.items():
        kept = {}
        sure = ambiguous = 0
        for lemma, slot in forms.items():
            if not slot['place']:
                continue
            listed = listed_sense[language].get(lemma) or sense_of(language, lemma, audit)
            if listed == 'determiner':
                continue
            tag = tag_for(slot, listed)
            kept[lemma] = tag
            if tag == 's':
                sure += 1
            else:
                ambiguous += 1
        tags[language] = dict(sorted(kept.items(), key=lambda item: item[0]))
        counts[language] = {'sure': sure, 'ambiguous': ambiguous, 'total': sure + ambiguous}
    payload = {
        'name': 'moovicut-place-lexicon',
        'builtFrom': 'Princeton WordNet 3.0 place-type hyponyms; Open Multilingual Wordnet 1.4 lemmas for Portuguese and Chinese on those synsets. A lemma that also belongs to a non-place synset, or to the audit list of names, objects, or materials, is tagged ambiguous. French, Italian, and Japanese are not site languages, so those OMW wordnets are not read.',
        'license': 'CC BY-SA 4.0 for this compilation, because it includes OpenWN-PT (CC BY-SA). ShareAlike: if you share this file or an adaptation, credit the sources and use CC BY-SA 4.0. English: WordNet licence https://wordnet.princeton.edu/license-and-commercial-use . Portuguese OpenWN-PT: CC BY-SA. Chinese Open Wordnet: WordNet-style licence. See docs/place-library.md.',
        'attribution': 'Princeton University WordNet; Francis Bond and Kyonghee Paik, Open Multilingual Wordnet; OpenWN-PT; Chinese Open Wordnet.',
        'counts': counts,
        'lemmas': sorted(tags.get('en', {})),
        'tags': tags,
    }
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(counts, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
