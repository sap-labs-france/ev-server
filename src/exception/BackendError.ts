import { ServerAction } from '../types/Server';
import User from '../types/User';
import UserToken from '../types/UserToken';

export default class BackendError extends Error {

  public constructor(readonly params: {
    source?: string;
    message: string;
    module?: string;
    method?: string;
    action?: ServerAction;
    user?: User|UserToken|string;
    actionOnUser?: User;
    detailedMessages?: any;
  }) {
    super(params.message);
  }
}
