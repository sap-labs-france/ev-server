import Tenant from '../../src/types/Tenant';
import UserToken from '../../src/types/UserToken';

import { IncomingHttpHeaders } from 'http';
declare module 'express' {
  export interface Request {
    locale: string;
    user?: UserToken;
    tenant?: Tenant;
  }
}

declare module 'http' {
  //https://stackoverflow.com/questions/58966110/typescript-add-custom-request-header-in-express
  interface IncomingHttpHeaders {
      "emobilitytoken"?: string
  }
}
