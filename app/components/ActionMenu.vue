<script setup>
const props = defineProps({
  label: { type: String, required: true },
  menuLabel: { type: String, default: '' }
})
const open = ref(false)
const trigger = ref(null)
const menu = ref(null)
const portal = shallowRef('body')
const inDialog = ref(false)
const menuId = `action-menu-${Math.random().toString(36).slice(2, 9)}`

function bindPortal() {
  const dialog = trigger.value?.closest?.('dialog') || null
  // Only a modal sheet (the full-height phone dialog) sits in the top layer
  // above a body-level popover. A non-modal desktop sheet keeps the popover.
  const modal = Boolean(dialog && (dialog.classList.contains('is-modal') || dialog.matches?.(':modal')))
  inDialog.value = modal
  portal.value = modal ? dialog : 'body'
}

function items() {
  return [...(menu.value?.querySelectorAll('[role="menuitem"]:not([disabled])') || [])]
}

function place() {
  const button = trigger.value
  const pop = menu.value
  if (!button || !pop) return
  const rect = button.getBoundingClientRect()
  const width = pop.offsetWidth || 240
  const height = pop.offsetHeight || 240
  let left = Math.min(rect.left, window.innerWidth - width - 8)
  left = Math.max(8, left)
  let top = rect.bottom + 4
  if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 4)
  pop.style.left = `${left}px`
  pop.style.top = `${top}px`
}

async function openMenu(focusFirst = false) {
  bindPortal()
  const pop = menu.value
  if (!pop) return
  open.value = true
  await nextTick()
  // A phone sheet is a modal dialog in the top layer. A popover teleported to
  // body is painted over that sheet but the dialog keeps the hit test, so a
  // tap lands on the row underneath. Inside a dialog the menu is a normal
  // descendant and receives the tap.
  if (!inDialog.value && pop.showPopover && !pop.matches(':popover-open')) pop.showPopover()
  place()
  if (focusFirst) items()[0]?.focus()
}

function close(restore = true) {
  const pop = menu.value
  if (pop?.hidePopover && pop.matches?.(':popover-open')) pop.hidePopover()
  open.value = false
  if (restore) trigger.value?.focus()
}

function onDocPointer(event) {
  if (!open.value || !inDialog.value) return
  const target = event.target
  if (menu.value?.contains(target) || trigger.value?.contains(target)) return
  close(false)
}

function onToggle(event) {
  open.value = event.newState === 'open'
  if (event.newState === 'open') nextTick(place)
}

function onTriggerKey(event) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    openMenu(true)
  }
}

function onMenuKey(event) {
  const list = items()
  const index = list.indexOf(document.activeElement)
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    close(true)
    return
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || !list.length) return
  event.preventDefault()
  event.stopPropagation()
  if (event.key === 'Home') list[0].focus()
  else if (event.key === 'End') list.at(-1).focus()
  else if (event.key === 'ArrowDown') list[(index + 1 + list.length) % list.length].focus()
  else list[(index - 1 + list.length) % list.length].focus()
}

function onMenuClick(event) {
  const item = event.target.closest?.('[role="menuitem"]')
  if (!item || item.disabled) return
  queueMicrotask(() => close(true))
}

function onResize() { if (open.value) place() }
onMounted(() => {
  bindPortal()
  window.addEventListener('resize', onResize)
  document.addEventListener('pointerdown', onDocPointer)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  document.removeEventListener('pointerdown', onDocPointer)
})
</script>

<template>
  <button
    ref="trigger"
    class="action-menu-trigger"
    type="button"
    :aria-label="label"
    aria-haspopup="menu"
    :aria-expanded="open"
    :aria-controls="menuId"
    @click="open ? close(false) : openMenu(false)"
    @keydown="onTriggerKey"
  ><slot name="trigger">{{ label }}</slot></button>
  <Teleport :to="portal">
    <div
      :id="menuId"
      ref="menu"
      class="action-menu"
      :class="{ 'is-open': open && inDialog }"
      :popover="inDialog ? null : 'auto'"
      role="menu"
      :aria-label="menuLabel || label"
      @toggle="onToggle"
      @keydown="onMenuKey"
      @click="onMenuClick"
    ><slot /></div>
  </Teleport>
</template>
