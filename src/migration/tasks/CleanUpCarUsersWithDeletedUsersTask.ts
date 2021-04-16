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

const MODULE_NAME = 'CleanUpCarUsersWithDeletedUsersTask';

export default class CleanUpCarUsersWithDeletedUsersTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    let carUsersCounter = 0, carsCounter = 0;
    // Get users cars
    const carUsersMDB = await global.database.getCollection<any>(tenant.id, 'carusers').find().toArray();
    if (!Utils.isEmptyArray(carUsersMDB)) {
      for (const carUserMDB of carUsersMDB) {
        // Get the User
        const user = await UserStorage.getUser(tenant.id, carUserMDB.userID.toString());
        if (!user) {
          // Owner?
          if (carUserMDB.owner) {
            // Get the Private Cars of the Deleted User
            const privateCar = await CarStorage.getCar(tenant.id, carUserMDB.carID.toString(), { type: CarType.PRIVATE });
            if (privateCar) {
              // Delete All Private Cars assignment
              carUsersCounter += await CarStorage.deleteCarUsersByCarID(tenant.id, privateCar.id);
              // Delete Private Car
              await CarStorage.deleteCar(tenant.id, privateCar.id);
              carsCounter++;
            } else {
              // Delete Car assignment
              await CarStorage.deleteCarUser(tenant.id, carUserMDB._id);
              carUsersCounter++;
            }
          } else {
            // Delete Car assignment
            await CarStorage.deleteCarUser(tenant.id, carUserMDB._id);
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
