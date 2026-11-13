<script setup>
import { X } from 'lucide-vue-next'
defineProps({ title:{type:String,required:true}, eyebrow:String, wide:Boolean })
const emit=defineEmits(['close'])
const route = useRoute()
const onStudio = computed(() => route.path.startsWith('/dashboard'))
const panel=ref(null)
let releaseFocus=()=>{}
onMounted(()=>{
 const previous=document.activeElement
 const previousOverflow=document.body.style.overflow
 document.body.style.overflow='hidden'
 const focusable=()=>[...(panel.value?.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled):not([type="hidden"]),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')||[])].filter(element=>!element.hidden&&element.getClientRects().length&&!element.closest('[inert]'))
 const initial=panel.value?.querySelector('input:not([type="hidden"]),textarea,select')||focusable()[0]||panel.value
 initial?.focus()
 const onKey=event=>{
  if(event.key==='Escape'){event.preventDefault();emit('close');return}
  if(event.key!=='Tab')return
  const items=focusable(),first=items[0],last=items.at(-1)
  if(!first){event.preventDefault();panel.value?.focus();return}
  if(event.shiftKey&&(document.activeElement===first||!panel.value?.contains(document.activeElement))){event.preventDefault();last?.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
 }
 const onFocus=event=>{if(panel.value&&!panel.value.contains(event.target))initial?.focus()}
 window.addEventListener('keydown',onKey);document.addEventListener('focusin',onFocus)
 releaseFocus=()=>{window.removeEventListener('keydown',onKey);document.removeEventListener('focusin',onFocus);document.body.style.overflow=previousOverflow;if(previous?.isConnected)previous.focus?.()}
})
onBeforeUnmount(()=>releaseFocus())
</script>
<template><Teleport to="body"><div class="shotboard-overlay modal-backdrop" @mousedown.self="emit('close')"><section ref="panel" class="modal" :class="{'modal-wide':wide,'studio-dialog':onStudio}" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1"><header class="modal-header"><div><p v-if="eyebrow" class="eyebrow">{{eyebrow}}</p><h2>{{title}}</h2></div><button class="icon-button" aria-label="Close dialog" @click="emit('close')"><X :size="20" /></button></header><div class="modal-content"><slot /></div></section></div></Teleport></template>
