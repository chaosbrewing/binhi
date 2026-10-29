/** BINHI-owned identity boundary; provider identities never replace project owner ids. */
export type SocialProvider = "google" | "apple";
export type OAuthIntent = "login" | "link" | "reauth";
export interface ProviderStatus { id: SocialProvider; label: string; available: boolean; reason: string | null }
export interface AuthMethods {
  hasPassword: boolean;
  reauthenticated: boolean;
  identities: { id: string; provider: SocialProvider; email: string | null; canUnlink: boolean }[];
  providers: ProviderStatus[];
}
