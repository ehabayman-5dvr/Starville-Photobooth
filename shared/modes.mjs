// References guide authored text and local preview samples only.
// Live generation sends the participant selfie as its only image input.
export const modes = {
  boss: {
    name: 'The Boss',
    variations: [
      { name: 'Creative Studio', file: 'The Boss/StarVille Creative Studio Selfie.png', scene: 'A bright, refined creative studio in a contemporary high-rise, mood boards, design sketches, warm wood, plants and expansive windows overlooking a modern city at golden hour.', outfit: 'Elegant, modest taupe smart-casual tailoring: a structured blazer over an opaque cream blouse or shirt, polished understated accessories.' },
      { name: 'Sunset Terrace', file: 'The Boss/StarVille Sunset Terrace Selfie.png', scene: 'An elegant rooftop terrace overlooking a sunlit city skyline and river at sunset, warm luminous peach sky, lush plants, sophisticated aspirational atmosphere.', outfit: 'Refined business-casual taupe or beige tailoring over a fully covering cream blouse or shirt; subtle sophisticated accessories.' },
      { name: 'Teal Studio', file: 'The Boss/Teal-Hued StarVille Studio Selfie.png', scene: 'A luminous contemporary skincare and creative studio, tasteful teal panels, warm neutral shelves, plants, soft daylight and elegant furnishings.', outfit: 'A beautifully tailored deep teal blazer over an opaque ivory blouse or shirt. Professional, confident and modest.' },
    ],
  },
  explorer: {
    name: 'The Explorer',
    variations: [
      { name: 'Above the Clouds', file: 'Explorer/StarVille Above the Clouds.png', scene: 'A breathtaking sunlit turquoise mountain lake above a sea of white clouds, alpine peaks, luminous blue sky, rich green slopes, airy optimistic atmosphere. Delicate translucent turquoise light ribbons sweep around the lower foreground.', outfit: 'A stylish fully zipped teal outdoor jacket, practical backpack straps and understated contemporary hiking clothing.' },
      { name: 'Crystal Grotto', file: 'Explorer/StarVille Crystal Grotto Selfie.png', scene: 'A radiant crystal grotto with translucent turquoise crystals, sparkling clear pools, glowing mineral terraces and daylight pouring through the open cavern above. Bright ethereal aqua light, never dark. Delicate translucent turquoise light ribbons in the lower foreground.', outfit: 'A stylish teal outdoor jacket fully covering the torso, practical backpack straps and contemporary adventure clothing.' },
      { name: 'Sunset Mountain', file: 'Explorer/StarVille Sunset Mountain Selfie.png', scene: 'A spectacular alpine viewpoint above a blue mountain lake, layered rugged peaks and forested slopes beneath a glowing peach-and-gold sunset. Warm light on the subject, luminous turquoise light ribbons in the lower foreground.', outfit: 'A sophisticated olive-green outdoor jacket zipped over a fully covering neutral top, with practical backpack straps.' },
    ],
  },
};

const artDirection = {
  boss: [
    {
      lighting: 'Warm late-afternoon window light, soft golden edges and neutral fill on the face. Natural skin texture and soft, realistic shadows.',
      palette: 'Taupe, ivory, honey-toned wood and peach sunset, with restrained teal accents.',
      composition: 'An intimate arm-length upper-body portrait, preserving the captured gesture and recognizable posture. Surround the participant with an airy creative workspace: layered unlettered mood boards, a tidy worktable, a cream chair, a leafy plant and tall windows onto the distant skyline. Keep the upper center uncluttered.',
    },
    {
      lighting: 'Low golden sunlight over the city and river, gentle warm highlights on clothing and soft daylight fill that keeps the participant’s natural facial details clear.',
      palette: 'Champagne beige, warm cream, amber and soft peach, with deep green plants and cooler distant city tones.',
      composition: 'A close portrait on a refined high-rise terrace, with the participant prominent below an expansive skyline. Use the glass wall, slender railing, potted plants and neutral seating to establish depth. Preserve the captured pose; leave a quiet patch of upper-center sunset sky.',
    },
    {
      lighting: 'Soft window daylight mixed with warm diffuse interior illumination. Open shadows and gentle highlights, bright and calm rather than dramatic.',
      palette: 'Signature deep teal, ivory, warm beige, muted wood and botanical green.',
      composition: 'A close upper-body portrait in a boutique skincare and creative studio. Frame the participant with clean teal architectural panels, cream shelving, unbranded bottles, flowers and a softly textured chair. Preserve the captured pose and keep the upper center visually simple. No readable product labels or wall signage.',
    },
  ],
  explorer: [
    {
      lighting: 'Clear bright mountain daylight, soft warm sunlight from one side and glowing cloud edges. Balanced natural light on the face and crisp jacket detail.',
      palette: 'Luminous turquoise, aqua, clear sky blue, cloud white, alpine green and deep teal clothing.',
      composition: 'An immersive close adventure portrait with the participant prominent in the lower-middle and an expansive mountain vista behind. Layer green rocky slopes, a turquoise lake and jagged peaks rising above a sea of white clouds. Preserve the captured pose and selfie perspective. Fine translucent aqua ribbons sweep around the lower foreground, never across faces; reserve upper-center sky for the logo.',
    },
    {
      lighting: 'Abundant soft daylight through the open cavern roof, sparkling crystal highlights and luminous aqua reflections, with neutral fill on the face. Airy and bright throughout, never a dark cave.',
      palette: 'Crystal white, luminous aqua, turquoise, restrained moss green and deep teal clothing.',
      composition: 'A close portrait surrounded by faceted turquoise crystals and delicate hanging mineral formations. Pale mineral terraces and clear pools recede into the grotto, with small mossy edges and a bright opening above. Maintain the captured pose. Fine translucent aqua ribbons arc through the lower foreground without covering people; leave a simple bright upper-center opening.',
    },
    {
      lighting: 'Warm golden-hour light skimming the landscape, gentle sunlight on the participant and neutral sky fill that preserves natural skin tone. Soft shadows and luminous distant haze.',
      palette: 'Olive and forest green, lake blue, warm gold, peach and pale pink, with subtle luminous turquoise accents.',
      composition: 'An intimate close adventure portrait above an elongated blue mountain lake, forested valleys and layered rugged ridgelines. Low alpine shrubs and rocks add foreground texture; peach clouds and a gold sunset lie toward one side. Preserve the captured pose and selfie perspective. Delicate turquoise ribbons sweep through the lower foreground, clear of faces; leave uncluttered upper-center sky.',
    },
  ],
};

export function buildPrompt(mode, variation) {
  const selected = modes[mode]?.variations[variation];
  if (!selected) throw new Error('Invalid mode or variation.');
  const direction = artDirection[mode][variation];
  return `Create a premium photorealistic StarVille future-self portrait, vertical 9:16.
The single input image is the participant selfie and the ONLY source of personal identity. Construct the clothing and environment from the text instructions below.
Preserve every person actually present in the selfie, their exact identity, apparent age, natural skin tone, facial structure, eyes, nose, lips, expression, gaze, facial hair and distinguishing details. No beautification, smoothing, slimming, face averaging or extra people. The source selfie is authoritative; do not infer a different gender or age.
Keep natural exposed hair unchanged. If a participant wears a hijab or other religious/cultural headcover, preserve it respectfully and fully; coordinate its fabric with the outfit. Do not add a headcover to someone who is not wearing one. Adapt the outfit naturally to each participant's existing presentation. Fully cover chest, torso and shoulders with opaque clothing.
Change ONLY the clothing and setting. ${selected.outfit}
SETTING: ${selected.scene}
LIGHTING: ${direction.lighting}
COLOR PALETTE: ${direction.palette}
COMPOSITION: ${direction.composition}
Maintain a natural selfie perspective and recognizable pose; preserve all participants within the frame. Harmonize realistic lighting, shadows, fabric and skin. Premium photographic detail. No cartoon rendering, heavy armor, spacesuits, distorted hands or changed expression.
Scene styling must never override identity preservation, change expressions or remove a person. Keep decorative scenery and light effects around or behind people, never over faces.
Leave clear uncluttered space around the top center (approximately 12% down) for a brand logo that will be added afterwards. Do not render ANY text, letters, logos, watermarks, signage or brand marks.`;
}
