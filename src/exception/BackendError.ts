import User from '../types/User';

export default class BackendError extends Error {

  public constructor(readonly params: {
    source: string;
    message: string;
    module: string;
    method: string;
    action?: string;
    user?: User;
    actionOnUser?: User;
    detailedMessages?: any;
  }) {
    super(params.message);
  }
}
