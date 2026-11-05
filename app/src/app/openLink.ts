// Open a web link in the user's browser (the desktop app can't navigate its own window away).
import { isTauri } from '@tauri-apps/api/core';

export async function openLink(url: string) {
  if (isTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
  } else window.open(url, '_blank', 'noopener');
}
