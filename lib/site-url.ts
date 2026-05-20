export function getConfiguredSiteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  return value ? value.replace(/\/+$/, "") : null;
}

export function buildPublicUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const siteUrl = getConfiguredSiteUrl();

  return siteUrl ? `${siteUrl}${normalizedPath}` : normalizedPath;
}
