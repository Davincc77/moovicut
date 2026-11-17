import assert from 'node:assert/strict'

/** Visible headings, the footer, and form controls must clear the rail and the viewport. */
export async function assertStudioFits(page, label) {
  const issues = await page.evaluate(() => {
    const issues = []
    const railEl = document.querySelector('.workspace-sidebar')
    const railStyle = railEl ? getComputedStyle(railEl) : null
    const railBox = railEl ? railEl.getBoundingClientRect() : null
    const railOn = Boolean(railStyle && railStyle.display !== 'none' && railBox && railBox.width > 1 && railBox.height > 1)
    const railRight = railOn ? railBox.right : 0
    const main = document.querySelector('main')
    if (main && railOn) {
      const left = main.getBoundingClientRect().left
      if (left + 0.5 < railRight) issues.push(`main left ${Math.round(left)} is behind the rail ${Math.round(railRight)}`)
    }
    const footer = document.querySelector('footer')
    if (footer && railOn) {
      const left = footer.getBoundingClientRect().left
      if (left + 0.5 < railRight) issues.push(`footer left ${Math.round(left)} is behind the rail ${Math.round(railRight)}`)
    }
    const bars = [...document.querySelectorAll('body *')].filter(el => {
      if (el.closest('.side-sheet-scrim') || el.classList.contains('side-sheet-scrim')) return false
      if (el.closest('dialog')) return false
      const style = getComputedStyle(el)
      if (style.position !== 'fixed' && style.position !== 'sticky') return false
      if (style.display === 'none' || style.visibility === 'hidden') return false
      const box = el.getBoundingClientRect()
      return box.width > 48 && box.height > 28
    })
    const nodes = [...document.querySelectorAll('h1,h2,h3,footer,input,textarea,select,button,summary')]
    for (const node of nodes) {
      if (railEl && railEl.contains(node)) continue
      const style = getComputedStyle(node)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      const box = node.getBoundingClientRect()
      if (box.width < 2 || box.height < 2) continue
      const name = (node.getAttribute('aria-label') || node.innerText || node.tagName).replace(/\s+/g, ' ').trim().slice(0, 70)
      if (railOn && box.left + 0.5 < railRight && box.right > railRight + 0.5) issues.push(`behind rail: ${name}`)
      if (box.left < -1) issues.push(`clipped left: ${name}`)
      if (box.right > window.innerWidth + 1) issues.push(`past right edge ${Math.round(box.right)}: ${name}`)
      const seen = box.bottom > 0 && box.top < window.innerHeight
      if (!seen) continue
      for (const bar of bars) {
        if (bar === railEl || bar.contains(node) || node.contains(bar)) continue
        const barBox = bar.getBoundingClientRect()
        const overlapW = Math.min(box.right, barBox.right) - Math.max(box.left, barBox.left)
        const overlapH = Math.min(box.bottom, barBox.bottom) - Math.max(box.top, barBox.top)
        if (overlapW > 8 && overlapH > 12 && overlapH > box.height * 0.55) issues.push(`behind a sticky bar: ${name}`)
      }
    }
    if (document.documentElement.scrollWidth > window.innerWidth + 1) {
      issues.push(`scrollWidth ${document.documentElement.scrollWidth} > ${window.innerWidth}`)
    }
    return issues.slice(0, 14)
  })
  assert.deepEqual(issues, [], `${label}: ${issues.join(' | ')}`)
}
