const REQUIRED_WARNING = new Set(['empty_who', 'empty_where', 'empty_characters', 'empty_places', 'sheets_missing'])
const OPTIONAL_WARNING = new Set(['too_many_actions', 'several_actions', 'conflicting_camera', 'duration_unsupported', 'prompt_too_long', 'aspect_unsupported', 'unresolved_character', 'unresolved_place', 'missing_framing', 'missing_lock', 'unknown_character', 'undeclared_wardrobe', 'conflicting_trait', 'wardrobe_state', 'unannounced_place', 'unannounced_time', 'lock_version', 'short_board', 'part_split_inside_scene', 'name_without_sheet'])

/** none: informational. optional: a suggestion. required: the board is missing a field. */
export function warningAction(code) {
  if (REQUIRED_WARNING.has(code)) return 'required'
  if (OPTIONAL_WARNING.has(code)) return 'optional'
  return 'none'
}
