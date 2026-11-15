<script setup>
import { useId } from 'vue'
import { LOCALES } from '~/i18n/logic.js'
const { locale, setLocale } = useI18n()
const fieldId = useId()
</script>
<template>
  <div class="language-switcher">
    <label class="sr-only" :for="fieldId">{{ $t('Language') }}</label>
    <select :id="fieldId" class="language-switcher-select" :value="locale" :aria-label="$t('Language')" @change="setLocale($event.target.value)">
      <option v-for="item in LOCALES" :key="item.code" :value="item.code" :lang="item.htmlLang">{{ item.native }}</option>
    </select>
  </div>
</template>
