import { ServerAction } from '../types/Server';
import User from '../types/User';
import UserToken from '../types/UserToken';

export default class BackendError extends Error {

  public constructor(public readonly params: {
    source?: string;
    message: string;
    module?: string;
    method?: string;
    action?: ServerAction;
    user?: User|UserToken|string;
    actionOnUser?: User;
    detailedMessages?: any;
    chargingStationID?: string;
    siteID?: string;
    siteAreaID?: string;
    companyID?: string;
  }) {
    super(params.message);
  }
}
