/**
 * Shown beside the idea field in Japanese and Simplified Chinese.
 * Matches detectCjk: quotes first (「」 『』 or "), otherwise a short Han name
 * immediately before は/が (Japanese, 1–4 characters) or 把/是 (Chinese, 1–3).
 */
export const CJK_NAME_TIPS = Object.freeze({
  ja: '名前は「」か『』で囲むか、かぎ括弧がないときは漢字1〜4字の直後に「は」か「が」を置いてください。それ以外の名前は読み取れません。',
  'zh-Hans': '人名请写在「」或『』里。不用引号时，请在一至三个字的名字后面紧跟「把」或「是」，否则读不出人名。'
})

export function cjkNameTip(locale) {
  return CJK_NAME_TIPS[locale] || ''
}
