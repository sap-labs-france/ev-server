import AxiosFactory from '../../../utils/AxiosFactory';
import { AxiosInstance } from 'axios';
import { CarCatalog } from '../../../types/Car';
import CarIntegration from '../CarIntegration';
import Configuration from '../../../utils/Configuration';
import Constants from '../../../utils/Constants';
import Jimp from 'jimp';
import Logging from '../../../utils/Logging';
import { ServerAction } from '../../../types/Server';
import Utils from '../../../utils/Utils';

const MODULE_NAME = 'EVDatabaseCarIntegration';

export default class EVDatabaseCarIntegration extends CarIntegration {
  private axiosInstance: AxiosInstance;

  constructor() {
    super();
    this.axiosInstance = AxiosFactory.getAxiosInstance(Constants.DEFAULT_TENANT_OBJECT);
  }

  public async getCarCatalogs(): Promise<CarCatalog[]> {
    const evDatabaseConfig = Configuration.getEVDatabaseConfig();
    if (!evDatabaseConfig) {
      await Logging.logWarning({
        tenantID: Constants.DEFAULT_TENANT_ID,
        message: 'No configuration is provided to access the EVDatabase system, skipping',
        module: MODULE_NAME, method: 'getCarCatalogs',
        action: ServerAction.SYNCHRONIZE_CAR_CATALOGS,
      });
      return;
    }
    const response = await this.axiosInstance.get(evDatabaseConfig.url + '/' + evDatabaseConfig.key);
    const carCatalogs: CarCatalog[] = [];
    // Build result
    for (const data of response.data) {
      // Create and fill th carCatalog object to be saved in the DB
      const carCatalog: CarCatalog = {
        id: data.Vehicle_ID,
        vehicleMake: data.Vehicle_Make,
        vehicleModel: data.Vehicle_Model,
        vehicleModelVersion: data.Vehicle_Model_Version,
        priceFromDE: data.Price_From_DE,
        drivetrainPropulsion: data.Drivetrain_Propulsion,
        drivetrainPowerHP: data.Drivetrain_Power_HP,
        drivetrainTorque: data.Drivetrain_Torque,
        performanceAcceleration: data.Performance_Acceleration,
        performanceTopspeed: data.Performance_Topspeed,
        rangeReal: data.Range_Real,
        efficiencyReal: data.Efficiency_Real,
        chargePlug: data.Charge_Plug,
        chargePlugLocation: data.Charge_Plug_Location,
        chargePlug2Location: data.Charge_Plug_2_Location,
        chargePlug2OptionalDE: data.Charge_Plug_2_Optional_DE,
        chargePlug2OptionalNL: data.Charge_Plug_2_Optional_NL,
        chargePlug2OptionalUK: data.Charge_Plug_2_Optional_UK,
        chargeStandardChargeSpeedDE: data.Charge_Standard_ChargeSpeed_DE,
        chargeStandardChargeTimeDE: data.Charge_Standard_ChargeTime_DE,
        chargeStandardPower: data.Charge_Standard_Power_DE ?? data.Charge_Standard_Power_NL ?? data.Charge_Standard_Power_UK,
        chargeStandardPhase: data.Charge_Standard_Phase_DE ?? data.Charge_Standard_Phase_NL ?? data.Charge_Standard_Phase_UK,
        chargeStandardPhaseAmp: data.Charge_Standard_PhaseAmp_DE ?? data.Charge_Standard_PhaseAmp_NL ?? data.Charge_Standard_PhaseAmp_UK,
        chargeStandardChargeTime: data.Charge_Standard_ChargeTime,
        chargeStandardChargeTimeNL: data.Charge_Standard_ChargeTime_NL,
        chargeStandardChargeSpeedNL: data.Charge_Standard_ChargeSpeed_NL,
        chargeStandarChargeTimeUK: data.Charge_Standard_ChargeTime_UK,
        chargeStandardChargeSpeed: data.Charge_Standard_ChargeSpeed,
        chargeStandardChargeSpeedUK: data.Charge_Standard_ChargeSpeed_UK,
        fastChargePlug: data.Fastcharge_Plug,
        fastChargePowerMax: data.Fastcharge_Power_Max,
        batteryCapacityUseable: data.Battery_Capacity_Useable,
        batteryCapacityFull: data.Battery_Capacity_Full,
        miscBody: data.Misc_Body,
        miscSegment: data.Misc_Segment,
        miscSeats: data.Misc_Seats,
        miscIsofix: data.Misc_Isofix,
        miscIsofixSeats: data.Misc_Isofix_Seats,
        miscTurningCircle: data.Misc_TurningCircle,
        rangeWLTP: data.Range_WLTP,
        imageURLs: data.Images ? (!Utils.isEmptyArray(data.Images) ? data.Images : [data.Images]) : [],
        images: [],
        videos: data.Videos,
      };
      carCatalogs.push(carCatalog);
    }
    return carCatalogs;
  }

  public async getCarCatalogThumb(carCatalog: CarCatalog): Promise<string> {
    let image: string;
    // Create the car thumb using the first image URL
    if (!Utils.isEmptyArray(carCatalog.imageURLs)) {
      try {
        const imageURL = this.convertToThumbImage(carCatalog.imageURLs[0]);
        const response = await this.axiosInstance.get(imageURL, { responseType: 'arraybuffer' });
        const base64Image = Buffer.from(response.data).toString('base64');
        image = 'data:' + response.headers['content-type'] + ';base64,' + base64Image;
      } catch (error) {
        await Logging.logError({
          tenantID: Constants.DEFAULT_TENANT_ID,
          action: ServerAction.SYNCHRONIZE_CAR_CATALOGS,
          module: MODULE_NAME, method: 'getCarCatalogThumb',
          message: `${carCatalog.id} - ${carCatalog.vehicleMake} - ${carCatalog.vehicleModel} - Cannot retrieve image from URL '${carCatalog.imageURLs[0]}'`,
          detailedMessages: { error: error.stack }
        });
      }
    }
    return image;
  }

  public async getCarCatalogImage(carCatalog: CarCatalog, imageURL: string): Promise<string> {
    try {
      const response = (await Jimp.read(imageURL)).resize(700, Jimp.AUTO).quality(60);
      const imageMIME = response.getMIME();
      const encodedImage = await response.getBase64Async(imageMIME);
      return encodedImage;
    } catch (error) {
      await Logging.logError({
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.SYNCHRONIZE_CAR_CATALOGS,
        module: MODULE_NAME, method: 'getCarCatalogImage',
        message: `${carCatalog.id} - ${carCatalog.vehicleMake} - ${carCatalog.vehicleModel} - Cannot retrieve image from URL '${imageURL}'`,
        detailedMessages: { error: error.stack }
      });
    }
  }

  private convertToThumbImage(image: string): string {
    return [image.slice(0, image.length - 7), '-thumb', image.slice(image.length - 7)].join('');
  }
}
