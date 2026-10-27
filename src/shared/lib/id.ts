export const newId = () =>
  globalThis.crypto?.randomUUID?.() ||
  "a" + Date.now().toString(36) + Math.random().toString(36).slice(2);
