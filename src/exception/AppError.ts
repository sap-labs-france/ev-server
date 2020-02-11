import { HTTPError } from '../types/HTTPError';
import User from '../types/User';
import UserToken from '../types/UserToken';

export default class AppError extends Error {
  constructor(readonly params: {
    source: string; message: string; errorCode: HTTPError; module: string;
    method: string; user?: User | string | UserToken; actionOnUser?: User | string | UserToken;
    action?: any; detailedMessages?: any; ocpiError?: {status_code: number; status_message: string};
  }) {
    super(params.message);
  }
}
// TODO: As user, actionOnUser and action are not used in any instantiation of
// AppError anywhere in the app, I cannot infer their types. Therefore, they will
// be left any until someone using them will modify the types.
