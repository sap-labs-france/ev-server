import * as Express from 'express';
import UserToken from '../../src/types/UserToken';

declare module 'express' {
  interface Request {
    locale: string;
    user?: UserToken;
  }
}
