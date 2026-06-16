export function setCookie(name: string, value: string, maxAgeSeconds?: number) {
  if (typeof window === 'undefined') return;
  let cookieString = `${name}=${encodeURIComponent(value)}; path=/; SameSite=Strict`;
  if (maxAgeSeconds) {
    cookieString += `; max-age=${maxAgeSeconds}`;
  }
  if (window.location.protocol === 'https:') {
    cookieString += '; Secure';
  }
  document.cookie = cookieString;
}

export function getCookie(name: string): string | null {
  if (typeof window === 'undefined') return null;
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
  }
  return null;
}

export function eraseCookie(name: string) {
  setCookie(name, '', -1);
}
