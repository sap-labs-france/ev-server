import { Action, Entity } from './Authorization';

import { Data } from './GlobalType';

export default interface ChangeNotification {
  tenantID: string;
  entity: Entity;
  action: Action;
  data?: Data;
}
