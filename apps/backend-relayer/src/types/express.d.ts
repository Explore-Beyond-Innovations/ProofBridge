import 'express';

declare global {
  namespace Express {
    export interface Request {
      user?: {
        sub: string;
        [key: string]: unknown;
      };
    }
  }
}
