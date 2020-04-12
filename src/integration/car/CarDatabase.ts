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

  public abstract async getCarThumb(car: Car): Promise<string>;

  public abstract async getCarImages(car: Car): Promise<string[]>;

  public async synchronizeCars(): Promise<ActionsResponse> {
    /* eslint-disable */
    const actionsDone: ActionsResponse = {
      inSuccess: 0,
      inError: 0
    };
    // Get the cars
    const externalCars = await this.getCars();
    for (const externalCar of externalCars) {
      try {
        const internalCar = await CarStorage.getCar(externalCar.id);
        if (!internalCar) {
          // New Car: Create it
          externalCar.hash = Cypher.hash(JSON.stringify(externalCar));
          externalCar.createdOn = new Date();
          // Get image
          externalCar.image = await this.getCarThumb(externalCar);
          // Get images
          externalCar.images = await this.getCarImages(externalCar);
          // Save
          externalCar.id = await CarStorage.saveCar(externalCar, true);
          actionsDone.inSuccess++;
          // Log
          Logging.logDebug({
            tenantID: Constants.DEFAULT_TENANT,
            source: Constants.CENTRAL_SERVER,
            action: Action.SYNCHRONIZE_CARS,
            module: MODULE_NAME, method: 'synchronizeCars',
            message: `${externalCar.id} - ${externalCar.vehicleMake} - ${externalCar.vehicleModel} has been created successfully`,
          });
        } else if (Cypher.hash(JSON.stringify(externalCar)) !== internalCar.hash) {
          // Car has changed: Update it
          internalCar.hash = Cypher.hash(JSON.stringify(externalCar));
          internalCar.lastChangedOn = new Date();
          // Get image
          internalCar.image = await this.getCarThumb(internalCar);
          // Get images
          internalCar.images = await this.getCarImages(internalCar);
          // Save
          await CarStorage.saveCar(internalCar, true);
          actionsDone.inSuccess++;
          // Log
          Logging.logDebug({
            tenantID: Constants.DEFAULT_TENANT,
            source: Constants.CENTRAL_SERVER,
            action: Action.SYNCHRONIZE_CARS,
            module: MODULE_NAME, method: 'synchronizeCars',
            message: `${internalCar.id} - ${internalCar.vehicleMake} - ${internalCar.vehicleModel} has been updated successfully`,
          });
        }
      } catch (error) {
        actionsDone.inError++;
        Logging.logError({
          tenantID: Constants.DEFAULT_TENANT,
          source: Constants.CENTRAL_SERVER,
          action: Action.SYNCHRONIZE_CARS,
          module: MODULE_NAME, method: 'synchronizeCars',
          message: `${externalCar.id} - ${externalCar.vehicleMake} - ${externalCar.vehicleModel} got synchronization error`,
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
