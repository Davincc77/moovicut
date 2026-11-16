/**
 * Shown beside the idea field in Simplified Chinese.
 * Matches detectCjk: quotes first (「」 『』 or "), otherwise one to three
 * characters immediately before 把 or 是.
 */
export const CJK_NAME_TIPS = Object.freeze({
  'zh-Hans': '人名请写在「」或『』里。不用引号时，请在一至三个字的名字后面紧跟「把」或「是」，否则读不出人名。'
})

export function cjkNameTip(locale) {
  return CJK_NAME_TIPS[locale] || ''
}
