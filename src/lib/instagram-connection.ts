export type InstagramConnectionMethod =
  | "instagram_login"
  | "facebook_login"
  | "meta_developer_token"
  | "unknown";

export type InstagramProviderData = {
  connectionMethod?: string;
  pageId?: string;
  pageName?: string;
  pageTasks?: string[];
  apiHost?: string;
};

export function parseInstagramProviderData(value?: string | null): InstagramProviderData {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed as InstagramProviderData : {};
  } catch {
    return {};
  }
}

export function instagramConnectionMethod(value?: string | null): InstagramConnectionMethod {
  const method = parseInstagramProviderData(value).connectionMethod;
  if (method === "facebook_login") return "facebook_login";
  if (method === "instagram_login") return "instagram_login";
  if (method === "meta_developer_token") return "meta_developer_token";
  // Older Loomic accounts were created before connectionMethod was stored.
  // They used the Instagram Login graph host, so keep that behavior.
  return "unknown";
}

export function instagramGraphBase(value?: string | null): string {
  const version = process.env.META_GRAPH_API_VERSION ?? "v26.0";
  return instagramConnectionMethod(value) === "facebook_login"
    ? `https://graph.facebook.com/${version}`
    : `https://graph.instagram.com/${version}`;
}

export function supportsInstagramNativeTags(value?: string | null): boolean {
  return instagramConnectionMethod(value) === "facebook_login";
}

export function supportsInstagramNativeLocation(value?: string | null): boolean {
  return instagramConnectionMethod(value) === "facebook_login";
}
