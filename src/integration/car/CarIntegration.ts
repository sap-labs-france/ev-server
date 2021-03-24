import { ActionsResponse } from '../../types/GlobalType';
import { CarCatalog } from '../../types/Car';
import CarStorage from '../../storage/mongodb/CarStorage';
import Constants from '../../utils/Constants';
import Cypher from '../../utils/Cypher';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';

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
        let image = '', imagesCount = 0;
        if (!internalCar) {
          // New Car: Create it
          externalCar.hash = Cypher.hash(JSON.stringify(externalCar));
          externalCar.lastChangedOn = new Date();
          externalCar.createdOn = new Date();
          // Get image
          externalCar.image = await this.getCarCatalogThumb(externalCar);
          for (const imageURL of externalCar.imageURLs) {
            // Get images
            image = await this.getCarCatalogImage(externalCar, imageURL);
            await CarStorage.saveCarImage(externalCar.id, image);
            imagesCount++;
          }
          // Create the Hash
          externalCar.imagesHash = (externalCar.imageURLs.length > 0 && externalCar.imageURLs.length === imagesCount && externalCar.image) ?
            Cypher.hash(externalCar.imageURLs.toString()) : null;
          // Save
          externalCar.id = await CarStorage.saveCarCatalog(externalCar);
          actionsDone.inSuccess++;
          // Log
          await Logging.logDebug({
            tenantID: Constants.DEFAULT_TENANT,
            source: Constants.CENTRAL_SERVER,
            action: ServerAction.SYNCHRONIZE_CAR_CATALOGS,
            module: MODULE_NAME, method: 'synchronizeCarCatalogs',
            message: `${externalCar.id} - ${externalCar.vehicleMake} - ${externalCar.vehicleModel} has been created successfully`,
          });
        } else if (!internalCar.imagesHash || (internalCar.imagesHash && !internalCar.image) || Cypher.hash(JSON.stringify(externalCar)) !== internalCar.hash) {
          // Car has changed: Update it
          externalCar.hash = Cypher.hash(JSON.stringify(externalCar));
          externalCar.lastChangedOn = new Date();
          externalCar.createdOn = internalCar.createdOn;
          // Images have changed?
          if (!internalCar.imagesHash || (Cypher.hash(externalCar.imageURLs.toString()) !== internalCar.imagesHash)) {
            // Get image
            externalCar.image = await this.getCarCatalogThumb(externalCar);
            // Delete old car catalogs images
            await CarStorage.deleteCarImages(externalCar.id);
            // Get images
            for (const imageURL of externalCar.imageURLs) {
              // Get images
              image = await this.getCarCatalogImage(externalCar, imageURL);
              await CarStorage.saveCarImage(externalCar.id, image);
              imagesCount++;
            }
            // Create the Hash
            externalCar.imagesHash = (externalCar.imageURLs.length > 0 && externalCar.imageURLs.length === imagesCount
              && externalCar.image) ?
              Cypher.hash(externalCar.imageURLs.toString()) : null;
          } else {
            externalCar.image = internalCar.image;
            externalCar.imagesHash = internalCar.imagesHash;
          }
          // Save
          await CarStorage.saveCarCatalog(externalCar);
          actionsDone.inSuccess++;
          // Log
          await Logging.logDebug({
            tenantID: Constants.DEFAULT_TENANT,
            source: Constants.CENTRAL_SERVER,
            action: ServerAction.SYNCHRONIZE_CAR_CATALOGS,
            module: MODULE_NAME, method: 'synchronizeCarCatalogs',
            message: `${externalCar.id} - ${externalCar.vehicleMake} - ${externalCar.vehicleModel} has been updated successfully`,
          });
        }
      } catch (error) {
        actionsDone.inError++;
        await Logging.logError({
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
    await Logging.logActionsResponse(Constants.DEFAULT_TENANT, ServerAction.SYNCHRONIZE_CAR_CATALOGS,
      MODULE_NAME, 'synchronizeCarCatalogs', actionsDone,
      '{{inSuccess}} car(s) were successfully synchronized',
      '{{inError}} car(s) failed to be synchronized',
      '{{inSuccess}} car(s) were successfully synchronized and {{inError}} failed to be synchronized',
      'All the cars are up to date'
    );
    return actionsDone;
  }

  public abstract getCarCatalogs(): Promise<CarCatalog[]>;

  public abstract getCarCatalogThumb(carCatalog: CarCatalog): Promise<string>;

  public abstract getCarCatalogImage(carCatalog: CarCatalog, imageURL: string): Promise<string>;
}
