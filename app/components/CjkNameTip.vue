<script>
import { defineComponent, h } from 'vue'
import { cjkNameTip } from '~/utils/cjk-name-tip.js'

export default defineComponent({
  name: 'CjkNameTip',
  props: {
    locale: { type: String, default: '' }
  },
  setup(props) {
    return () => {
      const text = cjkNameTip(props.locale)
      if (!text) return ''
      return h('p', { class: 'studio-soft-hint', 'data-cjk-name-tip': '' }, text)
    }
  }
})
</script>
