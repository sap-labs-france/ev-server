import { HTTPError } from '../types/HTTPError';
import { OCPIStatusCode } from '../types/ocpi/OCPIStatusCode';
import { OICPStatusCode } from '../types/oicp/OICPStatusCode';
import { ServerAction } from '../types/Server';
import { StatusCodes } from 'http-status-codes';
import User from '../types/User';
import UserToken from '../types/UserToken';

export default class AppError extends Error {
  constructor(readonly params: {
    source: string; message: string; errorCode: HTTPError | StatusCodes; module: string;
    method: string; user?: User | string | UserToken; actionOnUser?: User | string | UserToken;
    action?: ServerAction; detailedMessages?: any; ocpiError?: OCPIStatusCode; oicpError?: OICPStatusCode;
  }) {
    super(params.message);
  }
}
