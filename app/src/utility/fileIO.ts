// Platform file access. In the desktop app: native dialogs + the Rust file
// commands. In a browser: the File System Access API where there is one
// (Chrome, Edge), so Save writes back to the opened file; elsewhere a file
// picker to open and a download to save.
import { invoke, isTauri } from '@tauri-apps/api/core';
import { ask, open, save } from '@tauri-apps/plugin-dialog';

// ---- File System Access API (not in TypeScript's DOM types yet) ----
interface PickerType {
  description: string;
  accept: Record<string, string[]>;
}
interface FsWindow {
  showOpenFilePicker?: (options: { types: PickerType[]; multiple?: boolean }) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (options: { suggestedName: string; types: PickerType[] }) => Promise<FileSystemFileHandle>;
}
interface WritableHandle {
  createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }>;
}
const fsWindow = window as unknown as FsWindow;
const pickerTypes = (kind: 'table' | 'txt'): PickerType[] =>
  kind === 'table'
    ? [{ description: 'Table', accept: { 'application/json': ['.table'] } }]
    : [{ description: 'Text', accept: { 'text/plain': ['.txt'] } }];
const isCancel = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

/**
 * Browser only: the handle of the file a "path" (its name) came from, so a later
 * Save can write back to it. Keyed by an id, since the browser never shows full paths.
 */
const handles = new Map<string, FileSystemFileHandle>();
let nextHandle = 0;
function remember(handle: FileSystemFileHandle): string {
  const path = `${handle.name}#${++nextHandle}`;
  handles.set(path, handle);
  return path;
}

async function writeHandle(handle: FileSystemFileHandle, text: string) {
  const writable = await (handle as unknown as WritableHandle).createWritable();
  await writable.write(text);
  await writable.close();
}

export interface PickedFile {
  /** Full path in the desktop app; just the file name in the browser. */
  path: string;
  text: string;
}

const TABLE_FILTER = { name: 'Table', extensions: ['table'] };

export async function pickTableFile(): Promise<PickedFile | null> {
  if (isTauri()) {
    const path = await open({ multiple: false, directory: false, filters: [TABLE_FILTER] });
    if (!path) return null;
    return { path, text: await invoke<string>('read_text_file', { path }) };
  }
  if (fsWindow.showOpenFilePicker) {
    try {
      const [handle] = await fsWindow.showOpenFilePicker({ types: pickerTypes('table'), multiple: false });
      return { path: remember(handle), text: await (await handle.getFile()).text() };
    } catch (e) {
      if (isCancel(e)) return null;
      throw e;
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.table';
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? { path: file.name, text: await file.text() } : null);
    };
    input.click();
  });
}

/**
 * Save text. With a known path (desktop only) it writes straight there;
 * otherwise it asks where. Returns the path written, or null if cancelled.
 */
export async function saveTextFile(
  text: string,
  options: { path?: string | null; suggestedName: string; kind: 'table' | 'txt' },
): Promise<string | null> {
  const filter = options.kind === 'table' ? TABLE_FILTER : { name: 'Text', extensions: ['txt'] };
  if (isTauri()) {
    const path = options.path ?? (await save({ defaultPath: options.suggestedName, filters: [filter] }));
    if (!path) return null;
    await invoke('write_text_file', { path, contents: text });
    return path;
  }
  if (fsWindow.showSaveFilePicker) {
    try {
      const known = options.path ? handles.get(options.path) : undefined;
      const handle = known ?? (await fsWindow.showSaveFilePicker({ suggestedName: options.suggestedName, types: pickerTypes(options.kind) }));
      await writeHandle(handle, text);
      return known ? options.path! : remember(handle);
    } catch (e) {
      if (isCancel(e)) return null;
      throw e;
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = options.suggestedName;
  a.click();
  URL.revokeObjectURL(url);
  return options.suggestedName;
}

export async function confirmDiscard(message: string): Promise<boolean> {
  if (isTauri()) return ask(message, { title: 'Unsaved changes', kind: 'warning', okLabel: 'Discard', cancelLabel: 'Cancel' });
  return window.confirm(message);
}

/** Ask before something that can't be undone. */
export async function confirmAction(message: string, title: string, okLabel: string): Promise<boolean> {
  if (isTauri()) return ask(message, { title, kind: 'warning', okLabel, cancelLabel: 'Cancel' });
  return window.confirm(message);
}

/** A file-name-safe version of the deck name. */
export function fileNameFor(deckName: string, extension: string): string {
  const base = deckName.trim().replace(/[\\/:*?"<>|]+/g, '').slice(0, 80) || 'Untitled deck';
  return `${base}.${extension}`;
}
