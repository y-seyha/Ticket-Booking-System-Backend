export interface JwtPayload {
  sub: string;
  email: string;
  sid: string;
  type?: string;
}

export interface RefreshResponse {
  user: {
    sub: string;
    email: string;
    sid: string;
  };
}

export interface OAuthProfile {
  provider: string;
  providerUserId: string;
  email: string | null;
  displayName?: string;
}

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  cookies?: Record<string, string>;
  user?: { sub: string };
}
