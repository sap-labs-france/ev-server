import { CarCatalog } from '../types/Car';
import CarStorage from '../storage/mongodb/CarStorage';
import Constants from '../utils/Constants';
import Jimp from 'jimp';
import Logging from '../utils/Logging';
import { ServerAction } from '../types/Server';
import Utils from '../utils/Utils';
import fs from 'fs';
import global from '../types/GlobalType';

const MODULE_NAME = 'LocalCarIntegration';

export default class LocalCarCatalogBootstrap {
  public static async uploadLocalCarCatalogsFromFile() : Promise<void> {
    let created = 0;
    try {
      const carCatalogs = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/cars/car-catalogs-definition.json`, 'utf8')) as CarCatalog[];
      if (!Utils.isEmptyArray(carCatalogs)) {
        for (const carCatalog of carCatalogs) {
          try {
            // Build the hash code
            carCatalog.hash = Utils.hash(JSON.stringify(carCatalog));
            // Check if the existing car has changed
            const existingCarCatalog = await CarStorage.getCarCatalog(carCatalog.id);
            // Ignore
            if (existingCarCatalog?.hash === carCatalog.hash) {
              continue;
            }
            // Delete Car Catalog
            await CarStorage.deleteCarCatalog(carCatalog.id);
            await CarStorage.deleteCarCatalogImages(carCatalog.id);
            // Save Car Catalog
            carCatalog.createdOn = new Date();
            carCatalog.lastChangedOn = carCatalog.createdOn;
            // Create images
            if (!Utils.isEmptyArray(carCatalog.imageURLs)) {
              // Create thumb image
              let imageURLPath = `${global.appRoot}/assets/cars/img/${carCatalog.imageURLs[0]}`;
              const thumbImage = (await Jimp.read(imageURLPath)).resize(200, 150);
              const thumbImageMIME = thumbImage.getMIME();
              const base64ThumbImage = await thumbImage.getBase64Async(thumbImageMIME);
              carCatalog.image = base64ThumbImage;
              // Create image
              for (const imageURL of carCatalog.imageURLs) {
                imageURLPath = `${global.appRoot}/assets/cars/img/${imageURL}`;
                const image = await Jimp.read(imageURLPath);
                const imageMIME = image.getMIME();
                const base64Image = await image.getBase64Async(imageMIME);
                // Save car catalog images
                await CarStorage.saveCarCatalogImage(carCatalog.id, base64Image);
              }
            }
            await CarStorage.saveCarCatalog(carCatalog);
            created++;
          } catch (error) {
            const message = `Error while importing the local Car ID '${carCatalog.id}': ${error.message as string}`;
            await Logging.logError({
              tenantID: Constants.DEFAULT_TENANT_ID,
              action: ServerAction.UPDATE_LOCAL_CAR_CATALOGS,
              module: MODULE_NAME, method: 'uploadLocalCarCatalogsFromFile',
              message, detailedMessages: { error: error.stack }
            });
            Utils.isDevelopmentEnv() && Logging.logConsoleError(message);
          }
        }
      }
    } catch (error) {
      const message = `Error while importing the local Cars: ${error.message as string}`;
      await Logging.logError({
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.UPDATE_LOCAL_CAR_CATALOGS,
        module: MODULE_NAME, method: 'uploadLocalCarCatalogsFromFile',
        message, detailedMessages: { error: error.stack }
      });
      Utils.isDevelopmentEnv() && Logging.logConsoleError(message);
    }
    // Log in the default tenant
    if (created > 0) {
      const message = `${created} local Car(s) catalog created in the default tenant`;
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.UPDATE_LOCAL_CAR_CATALOGS,
        message, module: MODULE_NAME, method: 'uploadLocalCarCatalogsFromFile',
      });
      Utils.isDevelopmentEnv() && Logging.logConsoleInfo(message);
    }
  }
}
