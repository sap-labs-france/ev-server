import CarStorage from '../../storage/mongodb/CarStorage';
import { Action } from '../../types/Authorization';
import { Car } from '../../types/Car';
import { ActionsResponse } from '../../types/GlobalType';
import Constants from '../../utils/Constants';
import Cypher from '../../utils/Cypher';
import Logging from '../../utils/Logging';

const MODULE_NAME = 'CarDatabase';

export default abstract class CarDatabase {
  public abstract async getCars(): Promise<Car[]>;
  public async synchronizeCars(): Promise<ActionsResponse> {
    /* eslint-disable */
    const actionsDone: ActionsResponse = {
      inSuccess: 0,
      inError: 0
    };
    // Get the cars
    const cars = await this.getCars();
    for (const car of cars) {
      try {
        const carDB = await CarStorage.getCar(car.id);
        if (!carDB) {
          // New Car: Create it
          car.hash = Cypher.hash(JSON.stringify(car));
          car.createdOn = new Date();
          await CarStorage.saveCar(car);
          actionsDone.inSuccess++;
          // Log
          Logging.logDebug({
            tenantID: Constants.DEFAULT_TENANT,
            source: Constants.CENTRAL_SERVER,
            action: Action.SYNCHRONIZE_CARS,
            module: MODULE_NAME, method: 'synchronizeCars',
            message: `${car.id} - ${car.vehicleMake} - ${car.vehicleModel} has been created successfully`,
          });
        } else if (Cypher.hash(JSON.stringify(car)) !== carDB.hash) {
          // Car has changed: Update it
          car.hash = Cypher.hash(JSON.stringify(car));
          car.lastChangedOn = new Date();
          await CarStorage.saveCar(car);
          actionsDone.inSuccess++;
          // Log
          Logging.logDebug({
            tenantID: Constants.DEFAULT_TENANT,
            source: Constants.CENTRAL_SERVER,
            action: Action.SYNCHRONIZE_CARS,
            module: MODULE_NAME, method: 'synchronizeCars',
            message: `${car.id} - ${car.vehicleMake} - ${car.vehicleModel} has been updated successfully`,
          });
        }
      } catch (error) {
        actionsDone.inError++;
        // Log
        Logging.logError({
          tenantID: Constants.DEFAULT_TENANT,
          source: Constants.CENTRAL_SERVER,
          action: Action.SYNCHRONIZE_CARS,
          module: MODULE_NAME, method: 'synchronizeCars',
          message: `${car.id} - ${car.vehicleMake} - ${car.vehicleModel} got synchronization error`,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }
    // Log
    if (actionsDone.inSuccess || actionsDone.inError) {
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        source: Constants.CENTRAL_SERVER,
        action: Action.SYNCHRONIZE_CARS,
        module: MODULE_NAME, method: 'synchronizeCars',
        message: `${actionsDone.inSuccess} car(s) were successfully synchronized, ${actionsDone.inError} got errors`
      });
    } else {
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        source: Constants.CENTRAL_SERVER,
        action: Action.SYNCHRONIZE_CARS,
        module: MODULE_NAME, method: 'synchronizeCars',
        message: 'All the cars are up to date'
      });
    }
    return actionsDone;
  }
}
