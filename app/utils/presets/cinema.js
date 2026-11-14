/** Cinema preset data. Add a genre object to extend the family. */
export default {
  id: 'cinema',
  label: 'Cinema',
  defaultGenre: 'drama',
  characters: 'Describe each person with a constant age, face, and outfit. Keep the face and clothes identical in every shot.',
  genres: [
    { id: 'thriller', label: 'Thriller', visual: 'realistic photographic cinema, fine grain', palette: 'cool steel and sparse warm practicals', lighting: 'low-key contrast with a single motivated source', lens: '35mm spherical lens', framing: 'tight coverage and uneasy inserts', pacing: 'short beats, late reveals', defaultCam: 'close' },
    { id: 'comedy', label: 'Comedy', visual: 'realistic photographic cinema, clean colour', palette: 'bright wardrobe colours against a neutral room', lighting: 'high-key soft light, readable faces', lens: '40mm spherical lens', framing: 'medium shots that leave room for a reaction', pacing: 'setup, escalation, held reaction', defaultCam: 'medium' },
    { id: 'scifi', label: 'Sci-fi', visual: 'realistic photographic cinema, practical technology', palette: 'cool cyan, graphite, and one warm practical', lighting: 'motivated practicals and soft fill', lens: '35mm spherical lens', framing: 'wide geography, then a detail insert', pacing: 'measured discovery', defaultCam: 'wide' },
    { id: 'horror', label: 'Horror', visual: 'realistic photographic cinema, restrained grain', palette: 'desaturated colour and deep black', lighting: 'underexposed practicals, darkness held', lens: '35mm spherical lens', framing: 'slow push-ins and withheld wide shots', pacing: 'long holds, one reveal', defaultCam: 'close' },
    { id: 'drama', label: 'Drama', visual: 'realistic photographic cinema, natural skin', palette: 'muted earth tones and soft contrast', lighting: 'soft window light', lens: '50mm spherical lens', framing: 'medium shots and sincere close-ups', pacing: 'quiet beats, a small change', defaultCam: 'medium' },
    { id: 'western', label: 'Western', visual: 'realistic photographic cinema, sun and dust', palette: 'dust gold, denim blue, and hard sky', lighting: 'hard sun and open shade', lens: '40mm spherical lens', framing: 'wide landscapes and eye-level standoffs', pacing: 'long looks, then a move', defaultCam: 'wide' },
    { id: 'noir', label: 'Film noir', visual: 'realistic photographic cinema, rich blacks', palette: 'black, wet grey, and a single neon accent', lighting: 'hard key, deep shadow, wet reflections', lens: '40mm spherical lens', framing: 'low angles and shadowed close-ups', pacing: 'slow approach, sharp turn', defaultCam: 'medium' },
    { id: 'romance', label: 'Romance', visual: 'realistic photographic cinema, soft skin', palette: 'warm blush, cream, and evening gold', lighting: 'soft warm key and gentle backlight', lens: '50mm spherical lens', framing: 'close two-shots and tender inserts', pacing: 'unhurried glances', defaultCam: 'close' },
    { id: 'action', label: 'Action', visual: 'realistic photographic cinema, readable motion', palette: 'natural colour with a strong location accent', lighting: 'clear sun or motivated night practicals', lens: '35mm spherical lens', framing: 'tracking shots and clear wide geography', pacing: 'one move at a time, readable cuts', defaultCam: 'tracking' }
  ]
}
