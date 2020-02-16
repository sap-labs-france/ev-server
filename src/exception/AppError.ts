import { Action } from '../types/Authorization';
import { HTTPError } from '../types/HTTPError';
import User from '../types/User';
import UserToken from '../types/UserToken';

export default class AppError extends Error {
  constructor(readonly params: {
    source: string; message: string; errorCode: HTTPError; module: string;
    method: string; user?: User | string | UserToken; actionOnUser?: User | string | UserToken;
    action?: Action; detailedMessages?: any; ocpiError?: {status_code: number; status_message: string};
  }) {
    super(params.message);
  }
}
