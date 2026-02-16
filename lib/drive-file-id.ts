export function extractGoogleDriveFileId(input: string): string | null {
  const value = input.trim();
  if (!value) {
    return null;
  }

  // Already a likely Drive file ID.
  if (/^[a-zA-Z0-9_-]{10,}$/.test(value)) {
    return value;
  }

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const isDriveHost = host === "drive.google.com" || host.endsWith(".drive.google.com");
    const isDocsHost = host === "docs.google.com" || host.endsWith(".docs.google.com");
    if (!isDriveHost && !isDocsHost) {
      return null;
    }

    // Common forms:
    // - /file/d/<id>/view
    // - /open?id=<id>
    // - /uc?id=<id>
    // - /document/d/<id>/edit
    const pathMatch = url.pathname.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
    if (pathMatch?.[1]) {
      return pathMatch[1];
    }

    const queryId = url.searchParams.get("id");
    if (queryId && /^[a-zA-Z0-9_-]{10,}$/.test(queryId)) {
      return queryId;
    }

    return null;
  } catch {
    return null;
  }
}
