import CarStorage from '../../storage/mongodb/CarStorage';
import { CarType } from '../../types/Car';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import User from '../../types/User';
import UserStorage from '../../storage/mongodb/UserStorage';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'CleanUpCarUsersWithDeletedUsersTask';

export default class CleanUpCarUsersWithDeletedUsersTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    // Get users cars
    const carUsersCollection = global.database.getCollection<any>(tenant.id, 'carusers');
    const carUsers = await carUsersCollection.find().toArray();

    let carUsersCounter = 0, carsCounter = 0, user: User;
    if (!Utils.isEmptyArray(carUsers)) {
      for (const carUser of carUsers) {
        user = await UserStorage.getUser(tenant.id, carUser.userID.toString());
        if (!user) {
          // Owner ?
          if (carUser.owner) {
            // Private ?
            const car = await CarStorage.getCar(tenant.id, carUser.carID.toString(), { type: CarType.PRIVATE });
            if (car) {
              // Delete All Users Car
              carUsersCounter += await CarStorage.deleteCarUsersByCarID(tenant.id, car.id);
              // Delete Car
              await CarStorage.deleteCar(tenant.id, car.id);
              carsCounter++;
            } else {
              // Delete User Car
              await CarStorage.deleteCarUser(tenant.id, carUser._id);
              carUsersCounter++;
            }
          } else {
            // Delete User Car
            await CarStorage.deleteCarUser(tenant.id, carUser._id);
            carUsersCounter++;
          }
        }
      }
    }
    // Log in the default tenant
    if (carUsersCounter > 0) {
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `${carUsersCounter} CarUser(s) and ${carsCounter} Car(s) have been deleted in Tenant ${Utils.buildTenantName(tenant)}`
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
    return 'CleanUpCarUsersWithDeletedUsersTask';
  }
}
