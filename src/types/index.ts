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