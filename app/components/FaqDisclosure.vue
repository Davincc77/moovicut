<script setup>
import { ref, useId } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
const props = defineProps({ question: { type: String, required: true }, answer: { type: String, required: true } })
const open = ref(false)
const id = useId()
const questionId = `faq-question-${id}`
const answerId = `faq-answer-${id}`
</script>
<template><article class="faq-item" :class="{open}"><h3 class="faq-question"><button type="button" :id="questionId" :aria-expanded="open" :aria-controls="answerId" @click="open=!open"><span>{{ props.question }}</span><ChevronDown :size="16" aria-hidden="true" /></button></h3><div v-show="open" :id="answerId" class="faq-answer" role="region" :aria-labelledby="questionId"><p>{{ props.answer }}</p></div></article></template>
