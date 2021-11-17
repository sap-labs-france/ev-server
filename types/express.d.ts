import { Details } from 'express-useragent';
import Tenant from '../src/types/Tenant';
import UserToken from '../src/types/UserToken';

declare module 'express' {
  export interface Request {
    locale: string;
    user?: UserToken;
    tenant?: Tenant;
    useragent?: Details;
  }
}
