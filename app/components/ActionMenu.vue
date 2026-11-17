<script setup>
const props = defineProps({
  label: { type: String, required: true },
  menuLabel: { type: String, default: '' }
})
const open = ref(false)
const trigger = ref(null)
const menu = ref(null)
const menuId = `action-menu-${Math.random().toString(36).slice(2, 9)}`

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
  const pop = menu.value
  if (!pop) return
  if (pop.showPopover && !pop.matches(':popover-open')) pop.showPopover()
  open.value = true
  await nextTick()
  place()
  if (focusFirst) items()[0]?.focus()
}

function close(restore = true) {
  const pop = menu.value
  if (pop?.hidePopover && pop.matches(':popover-open')) pop.hidePopover()
  open.value = false
  if (restore) trigger.value?.focus()
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
onMounted(() => window.addEventListener('resize', onResize))
onBeforeUnmount(() => window.removeEventListener('resize', onResize))
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
  <Teleport to="body">
    <div
      :id="menuId"
      ref="menu"
      class="action-menu"
      popover="auto"
      role="menu"
      :aria-label="menuLabel || label"
      @toggle="onToggle"
      @keydown="onMenuKey"
      @click="onMenuClick"
    ><slot /></div>
  </Teleport>
</template>
