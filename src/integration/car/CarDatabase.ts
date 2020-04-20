import CarStorage from '../../storage/mongodb/CarStorage';
import { Action } from '../../types/Authorization';
import { CarCatalog } from '../../types/Car';
import { ActionsResponse } from '../../types/GlobalType';
import Constants from '../../utils/Constants';
import Cypher from '../../utils/Cypher';
import Logging from '../../utils/Logging';

const MODULE_NAME = 'CarDatabase';

export default abstract class CarDatabase {
  public abstract async getCarCatalogs(): Promise<CarCatalog[]>;

  public abstract async getCarCatalogThumb(carCatalog: CarCatalog): Promise<string>;

  public abstract async getCarCatalogImages(carCatalog: CarCatalog): Promise<string[]>;

  public async synchronizeCarCatalogs(): Promise<ActionsResponse> {
    /* eslint-disable */
    const actionsDone: ActionsResponse = {
      inSuccess: 0,
      inError: 0
    };
    // Get the cars
    const externalCars = await this.getCarCatalogs();
    for (const externalCar of externalCars) {
      try {
        const internalCar = await CarStorage.getCarCatalog(externalCar.id);
        if (!internalCar) {
          // New Car: Create it
          externalCar.hash = Cypher.hash(JSON.stringify(externalCar));
          externalCar.createdOn = new Date();
          // Get image
          externalCar.image = await this.getCarCatalogThumb(externalCar);
          // Get images
          externalCar.images = await this.getCarCatalogImages(externalCar);
          // Save
          externalCar.id = await CarStorage.saveCarCatalog(externalCar, true);
          actionsDone.inSuccess++;
          // Log
          Logging.logDebug({
            tenantID: Constants.DEFAULT_TENANT,
            source: Constants.CENTRAL_SERVER,
            action: Action.SYNCHRONIZE_CAR_CATALOGS,
            module: MODULE_NAME, method: 'synchronizeCarCatalogs',
            message: `${externalCar.id} - ${externalCar.vehicleMake} - ${externalCar.vehicleModel} has been created successfully`,
          });
        } else if (Cypher.hash(JSON.stringify(externalCar)) !== internalCar.hash) {
          // Car has changed: Update it
          internalCar.hash = Cypher.hash(JSON.stringify(externalCar));
          internalCar.lastChangedOn = new Date();
          // Get image
          internalCar.image = await this.getCarCatalogThumb(internalCar);
          // Get images
          internalCar.images = await this.getCarCatalogImages(internalCar);
          // Save
          await CarStorage.saveCarCatalog(internalCar, true);
          actionsDone.inSuccess++;
          // Log
          Logging.logDebug({
            tenantID: Constants.DEFAULT_TENANT,
            source: Constants.CENTRAL_SERVER,
            action: Action.SYNCHRONIZE_CAR_CATALOGS,
            module: MODULE_NAME, method: 'synchronizeCarCatalogs',
            message: `${internalCar.id} - ${internalCar.vehicleMake} - ${internalCar.vehicleModel} has been updated successfully`,
          });
        }
      } catch (error) {
        actionsDone.inError++;
        Logging.logError({
          tenantID: Constants.DEFAULT_TENANT,
          source: Constants.CENTRAL_SERVER,
          action: Action.SYNCHRONIZE_CAR_CATALOGS,
          module: MODULE_NAME, method: 'synchronizeCarCatalogs',
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
        action: Action.SYNCHRONIZE_CAR_CATALOGS,
        module: MODULE_NAME, method: 'synchronizeCarCatalogs',
        message: `${actionsDone.inSuccess} car(s) were successfully synchronized, ${actionsDone.inError} got errors`
      });
    } else {
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        source: Constants.CENTRAL_SERVER,
        action: Action.SYNCHRONIZE_CAR_CATALOGS,
        module: MODULE_NAME, method: 'synchronizeCarCatalogs',
        message: 'All the cars are up to date'
      });
    }
    return actionsDone;
  }
}
