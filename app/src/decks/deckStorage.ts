// Deck contents live in IndexedDB (a deck with images' data can outgrow
// localStorage). One object store, deck id -> the deck's .table JSON text.
const DB = 'table-decks';
const STORE = 'decks';

let db: Promise<IDBDatabase> | undefined;
function open(): Promise<IDBDatabase> {
  db ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open the deck library.'));
  });
  return db;
}

async function run<T>(mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const store = (await open()).transaction(STORE, mode).objectStore(STORE);
  return new Promise((resolve, reject) => {
    const req = act(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('The deck library could not be read or written.'));
  });
}

export const readDeck = (id: string) => run<string | undefined>('readonly', (s) => s.get(id) as IDBRequest<string | undefined>);
export const writeDeck = (id: string, text: string) => run('readwrite', (s) => s.put(text, id)).then(() => undefined);
export const removeDeck = (id: string) => run('readwrite', (s) => s.delete(id)).then(() => undefined);
