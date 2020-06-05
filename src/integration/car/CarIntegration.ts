import { ActionsResponse } from '../../types/GlobalType';
import { CarCatalog } from '../../types/Car';
import CarStorage from '../../storage/mongodb/CarStorage';
import Constants from '../../utils/Constants';
import Cypher from '../../utils/Cypher';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'CarIntegration';

export default abstract class CarIntegration {
  public async synchronizeCarCatalogs(): Promise<ActionsResponse> {
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
          // Create the Hash
          externalCar.imagesHash = Cypher.hash(externalCar.imageURLs.toString()),
          // Save
          externalCar.id = await CarStorage.saveCarCatalog(externalCar, true);
          actionsDone.inSuccess++;
          // Log
          Logging.logDebug({
            tenantID: Constants.DEFAULT_TENANT,
            source: Constants.CENTRAL_SERVER,
            action: ServerAction.SYNCHRONIZE_CAR_CATALOGS,
            module: MODULE_NAME, method: 'synchronizeCarCatalogs',
            message: `${externalCar.id} - ${externalCar.vehicleMake} - ${externalCar.vehicleModel} has been created successfully`,
          });
        } else if (!internalCar.imagesHash || Cypher.hash(JSON.stringify(externalCar)) !== internalCar.hash) {
          // Car has changed: Update it
          externalCar.hash = Cypher.hash(JSON.stringify(externalCar));
          externalCar.lastChangedOn = new Date();
          externalCar.createdOn = internalCar.createdOn;
          // Images have changed?
          if (!internalCar.imagesHash || (externalCar.imagesHash !== internalCar.imagesHash)) {
            // Get image
            externalCar.image = await this.getCarCatalogThumb(externalCar);
            // Get images
            externalCar.images = await this.getCarCatalogImages(externalCar);
            // Create the Hash
            externalCar.imagesHash = Cypher.hash(externalCar.imageURLs.toString()),
            // Save
            await CarStorage.saveCarCatalog(externalCar, true);
          } else {
            // Save
            await CarStorage.saveCarCatalog(externalCar, false);
          }
          actionsDone.inSuccess++;
          // Log
          Logging.logDebug({
            tenantID: Constants.DEFAULT_TENANT,
            source: Constants.CENTRAL_SERVER,
            action: ServerAction.SYNCHRONIZE_CAR_CATALOGS,
            module: MODULE_NAME, method: 'synchronizeCarCatalogs',
            message: `${externalCar.id} - ${externalCar.vehicleMake} - ${externalCar.vehicleModel} has been updated successfully`,
          });
        }
      } catch (error) {
        actionsDone.inError++;
        Logging.logError({
          tenantID: Constants.DEFAULT_TENANT,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.SYNCHRONIZE_CAR_CATALOGS,
          module: MODULE_NAME, method: 'synchronizeCarCatalogs',
          message: `${externalCar.id} - ${externalCar.vehicleMake} - ${externalCar.vehicleModel} got synchronization error`,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }
    // Log
    Utils.logActionsResponse(Constants.DEFAULT_TENANT, ServerAction.SYNCHRONIZE_CAR_CATALOGS,
      MODULE_NAME, 'synchronizeCarCatalogs', actionsDone,
      '{{inSuccess}} car(s) were successfully synchronized',
      '{{inError}} car(s) failed to be synchronized',
      '{{inSuccess}} car(s) were successfully synchronized and {{inError}} failed to be synchronized',
      'All the cars are up to date'
    );
    return actionsDone;
  }

  public abstract async getCarCatalogs(): Promise<CarCatalog[]>;

  public abstract async getCarCatalogThumb(carCatalog: CarCatalog): Promise<string>;

  public abstract async getCarCatalogImages(carCatalog: CarCatalog): Promise<string[]>;
}
