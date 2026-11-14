/** Documentary preset data. Add a genre object to extend the family. */
export default {
  id: 'documentary',
  label: 'Documentary',
  defaultGenre: 'nature',
  characters: 'Describe people soberly: age, clothes, and what they are doing. No stylised effects and no beauty lighting.',
  voiceOver: 'Leave a voice-over slot for one sober sentence of narration. No on-screen text.',
  genres: [
    { id: 'nature', label: 'Nature', visual: 'observational documentary, natural colour, no effects', palette: 'true landscape colours', lighting: 'available natural light only', lens: '35mm documentary lens', framing: 'wide shots on a tripod, with room for the animal or place', pacing: 'patient observation', defaultCam: 'wide', cameraNote: 'Tripod or a very still handheld.' },
    { id: 'history', label: 'History', visual: 'observational documentary, natural colour, no effects', palette: 'archive-neutral colour, no grade', lighting: 'available natural light and existing practicals', lens: '35mm documentary lens', framing: 'wide context shots and simple interview frames', pacing: 'steady, explanatory', defaultCam: 'static', cameraNote: 'Tripod. Interview setup when a person speaks.' },
    { id: 'portrait', label: 'Portrait', visual: 'observational documentary, natural colour, no effects', palette: 'faithful skin tones, no beauty grade', lighting: 'window light or open shade', lens: '50mm documentary lens', framing: 'medium interview frames and quiet close details', pacing: 'held shots, time to listen', defaultCam: 'medium', cameraNote: 'Tripod interview setup, or gentle handheld.' },
    { id: 'investigation', label: 'Investigation', visual: 'observational documentary, natural colour, no effects', palette: 'unpolished available colour', lighting: 'available room light, no thriller grade', lens: '35mm documentary lens', framing: 'handheld coverage and plain interview frames', pacing: 'follow the person, do not dramatise', defaultCam: 'handheld', cameraNote: 'Handheld, or a locked interview frame.' },
    { id: 'travel', label: 'Travel', visual: 'observational documentary, natural colour, no effects', palette: 'true local colour', lighting: 'available daylight', lens: '28mm documentary lens', framing: 'wide place shots and walking coverage', pacing: 'a place, then a person in it', defaultCam: 'wide', cameraNote: 'Tripod for places, handheld while walking.' }
  ]
}
