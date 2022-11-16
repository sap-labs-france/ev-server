import { Action, Entity } from '../types/Authorization';

import { HTTPAuthError } from '../types/HTTPError';
import { TenantComponents } from '../types/Tenant';
import User from '../types/User';
import UserToken from '../types/UserToken';

export default class AppAuthError extends Error {
  public constructor(public readonly params: {
    action: Action;
    entity: Entity;
    value?: string;
    chargingStationID?: string;
    siteID?: string;
    siteAreaID?: string;
    companyID?: string;
    errorCode: HTTPAuthError;
    module: string;
    method: string;
    user: UserToken;
    inactiveComponent?: TenantComponents,
    actionOnUser?: User|UserToken|string;
    detailedMessages?: any;
  }) {
    super(`${params.inactiveComponent ? 'Component \'' + params.inactiveComponent + '\' is not active - ' : ''}Role '${params.user.rolesACL.join(', ')}' is not authorized to perform '${params.action}' on '${params.entity}'${(params.value ? ' with ID \'' + params.value + '\'' : '')}`);
  }
}
