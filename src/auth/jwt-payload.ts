export interface JwtPayload {
  sub: string;
  username: string;
  role: 'user' | 'admin';
  tv?: number;
}
