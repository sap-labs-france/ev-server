import { ActionsResponse } from '../../types/GlobalType';
import { CarCatalog } from '../../types/Car';
import CarStorage from '../../storage/mongodb/CarStorage';
import Constants from '../../utils/Constants';
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
        const externalCarHash = Utils.hash(JSON.stringify(externalCar));
        const externalCarImagesHash = Utils.hash(externalCar.imageURLs.toString());
        // New Car: Create it
        if (!internalCar) {
          externalCar.hash = externalCarHash;
          externalCar.lastChangedOn = new Date();
          externalCar.createdOn = new Date();
          // Get thumbnail image
          externalCar.image = await this.getCarCatalogThumb(externalCar);
          // Delete old car catalogs images
          await CarStorage.deleteCarCatalogImages(externalCar.id);
          // Get images
          for (const imageURL of externalCar.imageURLs) {
            const image = await this.getCarCatalogImage(externalCar, imageURL);
            await CarStorage.saveCarCatalogImage(externalCar.id, image);
          }
          // Create the images hash
          externalCar.imagesHash = externalCarImagesHash;
          // Save
          externalCar.id = await CarStorage.saveCarCatalog(externalCar);
          actionsDone.inSuccess++;
          // Log
          await Logging.logDebug({
            tenantID: Constants.DEFAULT_TENANT_ID,
            action: ServerAction.SYNCHRONIZE_CAR_CATALOGS,
            module: MODULE_NAME, method: 'synchronizeCarCatalogs',
            message: `${externalCar.id} - ${externalCar.vehicleMake} - ${externalCar.vehicleModel} has been created successfully`,
          });
        // Car has changed?
        } else if (internalCar.hash !== externalCarHash) {
          // Car has changed: Update it
          externalCar.hash = externalCarHash;
          externalCar.lastChangedOn = new Date();
          externalCar.createdOn = internalCar.createdOn;
          // Images have changed?
          if (internalCar.imagesHash !== externalCarImagesHash) {
            // Get thumbnail image
            externalCar.image = await this.getCarCatalogThumb(externalCar);
            // Delete old car catalogs images
            await CarStorage.deleteCarCatalogImages(externalCar.id);
            // Get images
            for (const imageURL of externalCar.imageURLs) {
              // Get images
              const image = await this.getCarCatalogImage(externalCar, imageURL);
              await CarStorage.saveCarCatalogImage(externalCar.id, image);
            }
            // Create the Hash
            externalCar.imagesHash = externalCarImagesHash;
          } else {
            externalCar.image = internalCar.image;
            externalCar.imagesHash = internalCar.imagesHash;
          }
          // Save
          await CarStorage.saveCarCatalog(externalCar);
          actionsDone.inSuccess++;
          // Log
          await Logging.logDebug({
            tenantID: Constants.DEFAULT_TENANT_ID,
            action: ServerAction.SYNCHRONIZE_CAR_CATALOGS,
            module: MODULE_NAME, method: 'synchronizeCarCatalogs',
            message: `${externalCar.id} - ${externalCar.vehicleMake} - ${externalCar.vehicleModel} has been updated successfully`,
          });
        }
      } catch (error) {
        actionsDone.inError++;
        await Logging.logError({
          tenantID: Constants.DEFAULT_TENANT_ID,
          action: ServerAction.SYNCHRONIZE_CAR_CATALOGS,
          module: MODULE_NAME, method: 'synchronizeCarCatalogs',
          message: `${externalCar.id} - ${externalCar.vehicleMake} - ${externalCar.vehicleModel} got synchronization error`,
          detailedMessages: { error: error.stack }
        });
      }
    }
    // Log
    await Logging.logActionsResponse(Constants.DEFAULT_TENANT_ID, ServerAction.SYNCHRONIZE_CAR_CATALOGS,
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
