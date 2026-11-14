/** Anime / manga preset data. Add a genre object to extend the family. */
export default {
  id: 'anime',
  label: 'Anime / manga',
  defaultGenre: 'shonen',
  characters: 'Describe each person by signature hair, eye colour, and one iconic outfit. Repeat those three traits exactly in every shot.',
  genres: [
    { id: 'shonen', label: 'Shonen', visual: 'bold ink line art, flat cel colour, crisp black contours', palette: 'saturated primary colours and clean shadow shapes', lighting: 'graphic high-key light with hard cel shadows', lens: '35mm anime lens, deep focus', framing: 'dynamic action shots and expressive close-ups', pacing: 'fast beats with a held reaction frame', defaultCam: 'wide' },
    { id: 'shojo', label: 'Shojo', visual: 'fine ink line art, soft cel colour, delicate highlights', palette: 'pastel pinks, pearl whites, and warm blush', lighting: 'soft bloom and gentle rim light', lens: '50mm anime lens, shallow focus on the eyes', framing: 'expressive close-ups and quiet two-shots', pacing: 'gentle beats, room for a glance', defaultCam: 'close' },
    { id: 'seinen', label: 'Seinen', visual: 'detailed ink line art, muted cel colour, textured shadows', palette: 'olive, rust, and desaturated skin tones', lighting: 'low-key practical light with heavy cel shadow', lens: '40mm anime lens', framing: 'measured medium shots and tight inserts', pacing: 'slower beats, little decoration', defaultCam: 'medium' },
    { id: 'slice-of-life', label: 'Slice of life', visual: 'clean ink line art, gentle cel colour, everyday textures', palette: 'soft daylight colours and warm wood', lighting: 'even daytime cel light', lens: '35mm anime lens', framing: 'calm medium shots and small expressive close-ups', pacing: 'unhurried, one gesture at a time', defaultCam: 'medium' },
    { id: 'mecha', label: 'Mecha', visual: 'sharp mechanical line art, hard cel colour, panel highlights', palette: 'steel grey, warning orange, and deep blue', lighting: 'hard rim light on metal and cockpit practicals', lens: '24mm anime lens', framing: 'wide action shots and cockpit close-ups', pacing: 'impact beats, then a still lock', defaultCam: 'wide' },
    { id: 'fantasy', label: 'Fantasy', visual: 'storybook ink line art, rich cel colour, clear silhouettes', palette: 'jewel tones, moss green, and gold trim', lighting: 'motivated magical practicals with cel shadow', lens: '35mm anime lens', framing: 'wide establishing shots and hero close-ups', pacing: 'a reveal, then a held pose', defaultCam: 'wide' },
    { id: 'ghibli', label: 'Ghibli-like', visual: 'painted backgrounds, soft line art, hand-coloured cel faces', palette: 'watercolour greens, sky blue, and warm meal tones', lighting: 'natural painted daylight with soft shadow', lens: '35mm anime lens', framing: 'wide landscapes and gentle character close-ups', pacing: 'patient, wind and small gestures', defaultCam: 'wide' }
  ]
}
