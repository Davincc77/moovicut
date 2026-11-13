let notificationTimer
export function useNotifier() {
  const notification = useState('notification', () => null)
  function notify(message, type = 'success') {
    notification.value = { message, type }
    if (import.meta.client) { clearTimeout(notificationTimer); notificationTimer = setTimeout(() => { notification.value = null }, type === 'error' ? 6500 : 4000) }
  }
  function clearNotification() { notification.value = null }
  async function copyText(text, message = 'Prompt copied to clipboard') {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text)
      else throw new Error('Browser clipboard unavailable')
      notify(message); return true
    } catch {
      try {
        const input = document.createElement('textarea')
        input.value = text; input.style.position = 'fixed'; input.style.opacity = '0'
        document.body.appendChild(input); input.select()
        if (!document.execCommand('copy')) throw new Error('Copy is not available')
        input.remove(); notify(message); return true
      } catch { notify('Clipboard access was denied. Select the prompt and copy it manually.', 'error'); return false }
    }
  }
  function downloadText(name, text, type = 'application/json') {
    const blob = new Blob([text], { type }); const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = name
    document.body.appendChild(link); link.click(); link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 500); notify(`Saved ${name}`)
  }
  return { notification, notify, clearNotification, copyText, downloadText }
}
