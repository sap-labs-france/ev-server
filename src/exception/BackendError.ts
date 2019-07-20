import User from '../types/User';

export default class BackendError extends Error {

  public constructor(
    readonly source: string,
    message: string,
    readonly module: string = 'N/A',
    readonly method: string = 'N/A',
    readonly action: string = 'N/A',
    readonly user?: User,
    readonly actionOnUser?: User) {
    super(message);
  }
}
