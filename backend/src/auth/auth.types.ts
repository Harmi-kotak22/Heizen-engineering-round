import type { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
}

export type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

export interface AccessTokenPayload {
  sub: string;
}
