const DRIVE_FILE_ID_REGEX = /\/d\/([\w-]{10,})|[?&]id=([\w-]{10,})/i;

export const sanitizePhotoUrl = (value?: string | null): string => {
  if (!value) return '';

  let result = String(value).trim();
  if (!result) return '';

  if (
    (result.startsWith('"') && result.endsWith('"')) ||
    (result.startsWith("'") && result.endsWith("'"))
  ) {
    result = result.slice(1, -1).trim();
  }

  if ((result.startsWith('{') && result.endsWith('}')) || (result.startsWith('[') && result.endsWith(']'))) {
    try {
      const parsed = JSON.parse(result);

      if (Array.isArray(parsed)) {
        const firstString = parsed.find((item) => typeof item === 'string' && item.trim());
        if (typeof firstString === 'string') return firstString.trim();

        const firstObjectWithUrl = parsed.find(
          (item) => item && typeof item === 'object' && (typeof item.url === 'string' || typeof item.publicUrl === 'string'),
        ) as { url?: string; publicUrl?: string } | undefined;

        if (firstObjectWithUrl) return (firstObjectWithUrl.url || firstObjectWithUrl.publicUrl || '').trim();
      }

      if (parsed && typeof parsed === 'object') {
        const objectWithUrl = parsed as { url?: string; publicUrl?: string };
        if (typeof objectWithUrl.url === 'string') return objectWithUrl.url.trim();
        if (typeof objectWithUrl.publicUrl === 'string') return objectWithUrl.publicUrl.trim();
      }
    } catch {
      // Keep original value if it's not valid JSON.
    }
  }

  return result;
};

export const normalizePhotoUrl = (value?: string | null): string => {
  const sanitized = sanitizePhotoUrl(value);
  if (!sanitized) return '';
  if (sanitized.startsWith('data:')) return sanitized;

  const driveMatch = sanitized.match(DRIVE_FILE_ID_REGEX);
  const driveFileId = driveMatch?.[1] || driveMatch?.[2];
  if (driveFileId) {
    return `https://lh3.googleusercontent.com/d/${driveFileId}=w1600`;
  }

  if (sanitized.includes('dropbox.com')) {
    return sanitized
      .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
      .replace('?dl=0', '')
      .replace('?dl=1', '');
  }

  return sanitized;
};

export const getPhotoFallbackCandidates = (value?: string | null): string[] => {
  const sanitized = sanitizePhotoUrl(value);
  if (!sanitized) return [];

  const normalized = normalizePhotoUrl(sanitized);
  return Array.from(new Set([normalized, sanitized].filter(Boolean)));
};
