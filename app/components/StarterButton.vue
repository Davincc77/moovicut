<script setup>
import { ArrowUpRight } from 'lucide-vue-next'
const props = defineProps({ premise: String, model: { type: String, default: 'grok' }, compact: Boolean })
const router = useRouter()
const route = useRoute()
function choose() { router.push({ path: '/studio', query: { premise: props.premise, model: props.model } }) }
</script>
<template><button class="example-use-button" @click="choose">Use this story <ArrowUpRight :size="14" /></button></template>
