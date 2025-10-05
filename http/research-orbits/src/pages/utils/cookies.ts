// src/utils/cookies.ts
export function getCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

export function setSessionCookie(name: string, value: string, path = "/") {
  // session cookie: no Expires / Max-Age
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=${path}; samesite=lax`;
}
