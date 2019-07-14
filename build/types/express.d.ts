//import * as express from 'express'
import UserToken from "../../src/types/UserToken";

declare global {
  namespace Express {
    interface Request {
      locale: string;
      user?: UserToken;
    }
  }
}
  