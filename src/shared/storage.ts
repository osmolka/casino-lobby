// localStorage can throw on access (privacy mode, blocked cookies, quota). Never let it break the app.
export function storageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore: the choice just won't persist.
  }
}
