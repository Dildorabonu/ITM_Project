// data: URL'ni fetch'siz Blob'ga aylantiradi — CSP `connect-src 'self'` data: ga
// fetch'ni bloklaydi. O'qib bo'lmasa null.
export function dataUrlToBlob(dataUrl: string): Blob | null {
  const m = /^data:([^,;]*)((?:;[^,;]*)*),([\s\S]*)$/.exec(dataUrl);
  if (!m) return null;
  const [, type, params, body] = m;

  if (!params.split(";").includes("base64")) {
    try {
      return new Blob([decodeURIComponent(body)], { type });
    } catch {
      return null;
    }
  }

  let binary: string;
  try {
    binary = atob(body);
  } catch {
    return null;
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}
