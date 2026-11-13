export function cleanText(value) { return String(value || '').replace(/\s+/g, ' ').trim() }
export function sentence(value) { const text = cleanText(value).replace(/[,.;\s]+$/, ''); return text ? text.charAt(0).toUpperCase() + text.slice(1) : text }
