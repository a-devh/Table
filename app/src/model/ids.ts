// Unique ids for everything the app creates (cards, copies, fences, tags).
let nextId = 1;
export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${nextId++}`;
