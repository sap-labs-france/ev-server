import { HTTPError } from '../types/HTTPError';
import { ServerAction } from '../types/Server';
import { OCPIStatusCode } from '../types/ocpi/OCPIStatusCode';
import User from '../types/User';
import UserToken from '../types/UserToken';

export default class AppError extends Error {
  constructor(readonly params: {
    source: string; message: string; errorCode: HTTPError; module: string;
    method: string; user?: User | string | UserToken; actionOnUser?: User | string | UserToken;
    action?: ServerAction; detailedMessages?: any; ocpiError?: OCPIStatusCode;
  }) {
    super(params.message);
  }
}
