import { Details } from 'express-useragent';
import OCPIEndpoint from '../src/types/ocpi/OCPIEndpoint';
import Tenant from '../src/types/Tenant';
import UserToken from '../src/types/UserToken';

declare module 'express' {
  export interface Request {
    locale: string;
    user?: UserToken;
    tenant?: Tenant;
    ocpiEndpoint?: OCPIEndpoint;
    useragent?: Details;
  }
}
