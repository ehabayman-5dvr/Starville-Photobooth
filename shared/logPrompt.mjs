// Log only explicit prompt metadata; never pass credentials or image payloads.
export function logGenerationPrompt({ prompt, mode, variation, quality = 'Server configured', id = '', preview = false }) {
  const title = preview ? 'StarVille · Preview prompt (not sent)' : 'StarVille · Generation prompt';
  const details = {
    ...(id ? { 'Request ID': id } : {}),
    Mode: mode,
    Variation: variation,
    Model: 'gpt-image-2.5-flare',
    Quality: quality,
    'Image input': 'Participant selfie only',
  };
  if (typeof window !== 'undefined') {
    console.groupCollapsed(`%c✦ ${title}`, 'background: #075b62; color: #ffd2df; padding: 7px 12px; border-radius: 14px; font-weight: bold; font-size: 13px;');
    try {
      console.table(details);
      console.log('%c%s', 'color: #079aa5; font-size: 12px; line-height: 1.6;', prompt);
    } finally { console.groupEnd(); }
  } else {
    const color = process.env.NO_COLOR === undefined;
    const teal = color ? '\u001b[1;36m' : '';
    const pink = color ? '\u001b[1;35m' : '';
    const reset = color ? '\u001b[0m' : '';
    // One log entry keeps simultaneous requests' prompts together.
    console.info(`${pink}✦ ${title}${reset}\n${Object.entries(details).map(([key, value]) => `${teal}${key}:${reset} ${value}`).join('\n')}\n${teal}── Exact prompt ──${reset}\n${prompt}\n${pink}── End prompt ──${reset}`);
  }
}
