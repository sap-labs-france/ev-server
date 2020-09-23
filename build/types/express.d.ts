import UserToken from '../../src/types/UserToken';

declare module 'express' {
  export interface Request {
    locale: string;
    user?: UserToken;
  }
}
