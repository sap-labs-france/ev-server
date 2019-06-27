import Constants from '../utils/Constants';
import User from '../entity/User';

export default class AppError extends Error {
  constructor(
    readonly source: string,
    readonly message: string,
    readonly errorCode: number = Constants.HTTP_GENERAL_ERROR,
    readonly module: string = 'N/A',
    readonly method: string = 'N/A',
    readonly user?: User,
    readonly actionOnUser?: any,
    readonly action?: any) {
    super(message);
  }
}
// TODO: As user, actionOnUser and action are not used in any instantiation of
// AppError anywhere in the app, I cannot infer their types. Therefore, they will
// be left any until someone using them will modify the types.
