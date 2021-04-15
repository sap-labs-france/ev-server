import CarStorage from '../../storage/mongodb/CarStorage';
import { CarType } from '../../types/Car';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import UserStorage from '../../storage/mongodb/UserStorage';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'CleanUpLogicallyDeletedUsersTask';

export default class CleanUpLogicallyDeletedUsersTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    // Get logically deleted users
    const userCollection = global.database.getCollection<any>(tenant.id, 'users');
    const users = await userCollection.find({
      deleted : true
    }).toArray();

    let counter = 0, userID: string;
    for (const user of users) {
      userID = user._id.toString();
      const carUsers = await CarStorage.getCarUsers(tenant.id, { userIDs : [userID] }, Constants.DB_PARAMS_MAX_LIMIT);
      if (carUsers.count > 0) {
        for (const carUser of carUsers.result) {
          // Owner ?
          if (carUser.owner) {
            // Private ?
            const car = await CarStorage.getCar(tenant.id, carUser.carID, { type: CarType.PRIVATE });
            if (car) {
              // Delete All Users Car
              await CarStorage.deleteCarUsersByCarID(tenant.id, car.id);
              // Delete Car
              await CarStorage.deleteCar(tenant.id, car.id);
            } else {
              // Delete User Car
              await CarStorage.deleteCarUser(tenant.id, carUser.id);
            }
          } else {
            // Delete User Car
            await CarStorage.deleteCarUser(tenant.id, carUser.id);
          }
        }
      }
      await UserStorage.deleteUser(tenant.id, userID);
      counter++;
    }
    // Log in the default tenant
    if (counter > 0) {
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `${counter} User(s) have been deleted in Tenant ${Utils.buildTenantName(tenant)}`
      });
    }
  }

  getVersion(): string {
    return '1.0';
  }

  isAsynchronous(): boolean {
    return true;
  }

  getName(): string {
    return 'CleanUpLogicallyDeletedUsersTask';
  }
}
