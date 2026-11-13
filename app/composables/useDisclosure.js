export function toggleDisclosure(ref, value) {
  ref.value = ref.value === value ? null : value
}
export function toggleFlag(ref) { ref.value = !ref.value }
