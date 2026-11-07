function copyWithSelection(text: string): boolean {
  const active = document.activeElement
  const selection = window.getSelection()
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange()) : []
  const field = document.createElement('textarea')
  field.value = text
  field.readOnly = true
  field.tabIndex = -1
  field.setAttribute('aria-hidden', 'true')
  Object.assign(field.style, {
    position: 'fixed', top: '0', left: '0', width: '1px', height: '1px',
    opacity: '0', fontSize: '16px', pointerEvents: 'none',
  })
  document.body.appendChild(field)
  try {
    field.focus({ preventScroll: true })
    field.select()
    field.setSelectionRange(0, text.length)
    // Compatibility fallback for the HTTP phone-development URL. Keep this
    // synchronous with the tap when the modern Clipboard API is unavailable.
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    field.remove()
    if (active instanceof HTMLElement) active.focus({ preventScroll: true })
    if (selection) {
      selection.removeAllRanges()
      ranges.filter((range) => range.commonAncestorContainer.isConnected).forEach((range) => selection.addRange(range))
    }
  }
}

export async function copyText(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch { /* Try selection-based copying before asking for manual copying. */ }
  }
  return copyWithSelection(text)
}
