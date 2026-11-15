# Local name checker

The optional checker is [julian-schelb/roberta-ner-multilingual](https://huggingface.co/julian-schelb/roberta-ner-multilingual), an XLM-RoBERTa model fine-tuned on WikiANN for person, location, and organisation. It covers English, German, French, Chinese, Italian, Portuguese, and Japanese.

Moovicut does not call it as a paid API. `app/utils/ner-verifier.js` loads it in-process with Transformers.js only when the weights are installed. Set `MOOVICUT_NER=0`, or pass `verifier: false` on `POST /api/v1/storyboard`, to stay on the rules. If the weights are missing or the load fails, the rules stand and the response is unchanged.

The model only confirms or vetoes a name the rules already proposed. A span it does not recognise is left as the rules decided.

## Licence

The model card lists the WikiANN / XLM-RoBERTa lineage. Check the card before redistributing weights. This repository does not vendor the weights. The conversion below is local and optional.

## Convert once

```sh
pip install transformers optimum[onnxruntime]
optimum-cli export onnx --model julian-schelb/roberta-ner-multilingual /tmp/roberta-ner-onnx
# Quantise for CPU if you want a smaller file:
# optimum-cli onnxruntime quantize --onnx_model /tmp/roberta-ner-onnx --avx2 -o /tmp/roberta-ner-q8
```

Point Transformers.js at that folder, or at a Xenova ONNX build of the same model if one is published. `scripts/measure-ner.mjs` prints cold-start time, one-request latency, and heap used when the weights load, and prints `fallback` when they do not.

Japanese and Chinese names without capitals still come from the existing 「」 / は・が / 把・是 rules. A kuromoji or jieba tagger is not bundled; the rules already propose those candidates, and the checker can veto them when it is loaded.
