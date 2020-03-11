import CarStorage from '../../storage/mongodb/CarStorage';
import { Action } from '../../types/Authorization';
import { Car, CarSynchronizeAction } from '../../types/Car';
import Constants from '../../utils/Constants';
import Cypher from '../../utils/Cypher';
import Logging from '../../utils/Logging';

export default abstract class CarDatabase {
  public abstract async getCars(): Promise<Car[]>;
 /* eslint-disable */
  public async synchronizeCars(): Promise<CarSynchronizeAction> {
    const actionsDone = {
      synchronized: 0,
      error: 0
    } as CarSynchronizeAction;
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
          actionsDone.synchronized++;
          // Log
          Logging.logDebug({
            tenantID: Constants.DEFAULT_TENANT,
            source: Constants.CENTRAL_SERVER,
            action: Action.SYNCHRONIZE_CARS,
            module: 'CarDatabase', method: 'synchronizeCars',
            message: `${car.id} - ${car.vehicleMake} - ${car.VehicleModel} has been created successfully`,
          });
        } else if (Cypher.hash(JSON.stringify(car)) !== carDB.hash) {
          // Car has changed: Update it
          car.hash = Cypher.hash(JSON.stringify(car));
          car.lastChangedOn = new Date();
          await CarStorage.saveCar(car);
          actionsDone.synchronized++;
          // Log
          Logging.logDebug({
            tenantID: Constants.DEFAULT_TENANT,
            source: Constants.CENTRAL_SERVER,
            action: Action.SYNCHRONIZE_CARS,
            module: 'CarDatabase', method: 'synchronizeCars',
            message: `${car.id} - ${car.vehicleMake} - ${car.VehicleModel} has been updated successfully`,
          });
        }
      } catch (error) {
        actionsDone.error++;
        // Log
        Logging.logError({
          tenantID: Constants.DEFAULT_TENANT,
          source: Constants.CENTRAL_SERVER,
          action: Action.SYNCHRONIZE_CARS,
          module: 'CarDatabase', method: 'synchronizeCars',
          message: `${car.id} - ${car.vehicleMake} - ${car.VehicleModel} got synchronization error`,
          detailedMessages: error
        });
      }
    }
    // Log
    if (actionsDone.synchronized || actionsDone.error) {
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        source: Constants.CENTRAL_SERVER,
        action: Action.SYNCHRONIZE_CARS,
        module: 'CarDatabase', method: 'synchronizeCars',
        message: `${actionsDone.synchronized} car(s) were successfully synchronized, ${actionsDone.error} got errors`
      });
    } else {
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        source: Constants.CENTRAL_SERVER,
        action: Action.SYNCHRONIZE_CARS,
        module: 'CarDatabase', method: 'synchronizeCars',
        message: 'All the cars are up to date'
      });
    }
    return actionsDone;
  }
}
