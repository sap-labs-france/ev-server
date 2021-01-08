import { CarCatalog, CarCatalogChargeAlternativeTable, CarCatalogChargeOptionTable, CarCatalogConverter } from '../../../types/Car';

import AxiosFactory from '../../../utils/AxiosFactory';
import { AxiosInstance } from 'axios';
import CarIntegration from '../CarIntegration';
import Configuration from '../../../utils/Configuration';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import { ServerAction } from '../../../types/Server';

const MODULE_NAME = 'EVDatabaseCarIntegration';

export default class EVDatabaseCarIntegration extends CarIntegration {
  private axiosInstance: AxiosInstance;

  constructor() {
    super();
    this.axiosInstance = AxiosFactory.getAxiosInstance(Constants.DEFAULT_TENANT);
  }

  public async getCarCatalogs(): Promise<CarCatalog[]> {
    const evDatabaseConfig = Configuration.getEVDatabaseConfig();
    if (!evDatabaseConfig) {
      Logging.logWarning({
        tenantID: Constants.DEFAULT_TENANT,
        source: Constants.CENTRAL_SERVER,
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
      const chargeStandardTables: CarCatalogConverter[] = [];
      const chargeAlternativeTables: CarCatalogChargeAlternativeTable[] = [];
      const chargeOptionTables: CarCatalogChargeOptionTable[] = [];
      for (const chargeStandard of Object.keys(data.Charge_Standard_Table)) {
        const chargeStandardTable: CarCatalogConverter = {
          type: chargeStandard,
          evsePhaseVolt: data.Charge_Standard_Table[chargeStandard].EVSE_PhaseVolt,
          evsePhaseAmp: data.Charge_Standard_Table[chargeStandard].EVSE_PhaseAmp,
          evsePhase: data.Charge_Standard_Table[chargeStandard].EVSE_Phase,
          evsePhaseVoltCalculated: data.Charge_Standard_Table[chargeStandard].EVSE_Phase === 3 ? 400 : data.Charge_Standard_Table[chargeStandard].EVSE_PhaseVolt,
          chargePhaseVolt: data.Charge_Standard_Table[chargeStandard].Charge_PhaseVolt,
          chargePhaseAmp: data.Charge_Standard_Table[chargeStandard].Charge_PhaseAmp,
          chargePhase: data.Charge_Standard_Table[chargeStandard].Charge_Phase,
          chargePower: data.Charge_Standard_Table[chargeStandard].Charge_Power,
          chargeTime: data.Charge_Standard_Table[chargeStandard].Charge_Time,
          chargeSpeed: data.Charge_Standard_Table[chargeStandard].Charge_Speed,
        };
        chargeStandardTables.push(chargeStandardTable);
      }
      if (data.Charge_Alternative_Table) {
        for (const chargeAlternative of Object.keys(data.Charge_Alternative_Table)) {
          const chargeAlternativeTable: CarCatalogChargeAlternativeTable = {
            type: chargeAlternative,
            evsePhaseVolt: data.Charge_Standard_Table[chargeAlternative].EVSE_PhaseVolt,
            evsePhaseAmp: data.Charge_Standard_Table[chargeAlternative].EVSE_PhaseAmp,
            evsePhase: data.Charge_Standard_Table[chargeAlternative].EVSE_Phase,
            chargePhaseVolt: data.Charge_Standard_Table[chargeAlternative].Charge_PhaseVolt,
            chargePhaseAmp: data.Charge_Standard_Table[chargeAlternative].Charge_PhaseAmp,
            chargePhase: data.Charge_Standard_Table[chargeAlternative].Charge_Phase,
            chargePower: data.Charge_Standard_Table[chargeAlternative].Charge_Power,
            chargeTime: data.Charge_Standard_Table[chargeAlternative].Charge_Time,
            chargeSpeed: data.Charge_Standard_Table[chargeAlternative].Charge_Speed,
          };
          chargeAlternativeTables.push(chargeAlternativeTable);
        }
      }
      if (data.Charge_Option_Table) {
        for (const chargeOption of Object.keys(data.Charge_Option_Table)) {
          const chargeAlternativeTable: CarCatalogChargeOptionTable = {
            type: chargeOption,
            evsePhaseVolt: data.Charge_Standard_Table[chargeOption].EVSE_PhaseVolt,
            evsePhaseAmp: data.Charge_Standard_Table[chargeOption].EVSE_PhaseAmp,
            evsePhase: data.Charge_Standard_Table[chargeOption].EVSE_Phase,
            chargePhaseVolt: data.Charge_Standard_Table[chargeOption].Charge_PhaseVolt,
            chargePhaseAmp: data.Charge_Standard_Table[chargeOption].Charge_PhaseAmp,
            chargePhase: data.Charge_Standard_Table[chargeOption].Charge_Phase,
            chargePower: data.Charge_Standard_Table[chargeOption].Charge_Power,
            chargeTime: data.Charge_Standard_Table[chargeOption].Charge_Time,
            chargeSpeed: data.Charge_Standard_Table[chargeOption].Charge_Speed,
          };
          chargeOptionTables.push(chargeAlternativeTable);
        }
      }
      const carCatalog: CarCatalog = {
        id: data.Vehicle_ID,
        vehicleMake: data.Vehicle_Make,
        vehicleModel: data.Vehicle_Model,
        vehicleModelVersion: data.Vehicle_Model_Version,
        availabilityStatus: data.Availability_Status,
        availabilityDateFrom: data.Availability_Date_From,
        availabilityDateTo: data.Availability_Date_To,
        priceFromDE: data.Price_From_DE,
        priceFromDEEstimate: data.Price_From_DE_Estimate,
        priceFromNL: data.Price_From_NL,
        priceFromNLEstimate: data.Price_From_NL_Estimate,
        priceFromUK: data.Price_From_UK,
        priceGrantPICGUK: data.Price_Grant_PICG_UK,
        priceFromUKEstimate: data.Price_From_UK_Estimate,
        drivetrainType: data.Drivetrain_Type,
        drivetrainFuel: data.Drivetrain_Fuel,
        drivetrainPropulsion: data.Drivetrain_Propulsion,
        drivetrainPower: data.Drivetrain_Power,
        drivetrainPowerHP: data.Drivetrain_Power_HP,
        drivetrainTorque: data.Drivetrain_Torque,
        performanceAcceleration: data.Performance_Acceleration,
        performanceTopspeed: data.Performance_Topspeed,
        rangeWLTP: data.Range_WLTP,
        rangeWLTPEstimate: data.Range_WLTP_Estimate,
        rangeNEDC: data.Range_NEDC,
        rangeNEDCEstimate: data.Range_NEDC_Estimate,
        rangeReal: data.Range_Real,
        rangeRealMode: data.Range_Real_Mode,
        rangeRealWHwy: data.Range_Real_WHwy,
        rangeRealWCmb: data.Range_Real_WCmb,
        rangeRealWCty: data.Range_Real_WCty,
        rangeRealBHwy: data.Range_Real_BHwy,
        rangeRealBCmb: data.Range_Real_BCmb,
        rangeRealBCty: data.Range_Real_BCty,
        efficiencyWLTP: data.Efficiency_WLTP,
        efficiencyWLTPFuelEq: data.Efficiency_WLTP_FuelEq,
        efficiencyWLTPV: data.Efficiency_WLTP_V,
        efficiencyWLTPFuelEqV: data.Efficiency_WLTP_FuelEq_V,
        efficiencyWLTPCO2: data.Efficiency_WLTP_CO2,
        efficiencyNEDC: data.Efficiency_NEDC,
        efficiencyNEDCFuelEq: data.Efficiency_NEDC_FuelEq,
        efficiencyNEDCV: data.Efficiency_NEDC_V,
        efficiencyNEDCFuelEqV: data.Efficiency_NEDC_FuelEq_V,
        efficiencyNEDCCO2: data.Efficiency_NEDC_CO2,
        efficiencyReal: data.Efficiency_Real,
        efficiencyRealFuelEqV: data.Efficiency_Real_FuelEq_V,
        efficiencyRealCO2: data.Efficiency_Real_CO2,
        efficiencyRealWHwy: data.Efficiency_Real_WHwy,
        efficiencyRealWCmb: data.Efficiency_Real_WCmb,
        efficiencyRealWCty: data.Efficiency_Real_WCty,
        efficiencyRealBHwy: data.Efficiency_Real_BHwy,
        efficiencyRealBCmb: data.Efficiency_Real_BCmb,
        efficiencyRealBCty: data.Efficiency_Real_BCty,
        chargePlug: data.Charge_Plug,
        chargePlugEstimate: data.Charge_Plug_Estimate,
        chargePlugLocation: data.Charge_Plug_Location,
        chargeStandardPower: data.Charge_Standard_Power,
        chargeStandardPhase: data.Charge_Standard_Phase,
        chargeStandardPhaseAmp: data.Charge_Standard_PhaseAmp,
        chargeStandardChargeTime: data.Charge_Standard_ChargeTime,
        chargeStandardChargeSpeed: data.Charge_Standard_ChargeSpeed,
        chargeStandardEstimate: data.Charge_Standard_Estimate,
        chargeStandardTables: chargeStandardTables,
        chargeAlternativePower: data.Charge_Alternative_Power,
        chargeAlternativePhase: data.Charge_Alternative_Phase,
        chargeAlternativePhaseAmp: data.Charge_Alternative_PhaseAmp,
        chargeAlternativeChargeTime: data.Charge_Alternative_ChargeTime,
        chargeAlternativeChargeSpeed: data.Charge_Alternative_ChargeSpeed,
        chargeAlternativeTables: chargeAlternativeTables,
        chargeOptionPower: data.Charge_Option_Power,
        chargeOptionPhase: data.Charge_Option_Phase,
        chargeOptionPhaseAmp: data.Charge_Option_PhaseAmp,
        chargeOptionChargeTime: data.Charge_Option_ChargeTime,
        chargeOptionChargeSpeed: data.Charge_Option_ChargeSpeed,
        chargeOptionTables: chargeOptionTables,
        fastChargePlug: data.Fastcharge_Plug,
        fastChargePlugEstimate: data.Fastcharge_Plug_Estimate,
        fastChargePlugLocation: data.Fastcharge_Plug_Location,
        fastChargePowerMax: data.Fastcharge_Power_Max,
        fastChargePowerAvg: data.Fastcharge_Power_Avg,
        fastChargeTime: data.Fastcharge_ChargeTime,
        fastChargeSpeed: data.Fastcharge_ChargeSpeed,
        fastChargeOptional: data.Fastcharge_Optional,
        fastChargeEstimate: data.Fastcharge_Estimate,
        batteryCapacityUseable: data.Battery_Capacity_Useable,
        batteryCapacityFull: data.Battery_Capacity_Full,
        batteryCapacityEstimate: data.Battery_Capacity_Estimate,
        dimsLength: data.Dims_Length,
        dimsWidth: data.Dims_Width,
        dimsHeight: data.Dims_Height,
        dimsWheelbase: data.Dims_Wheelbase,
        dimsWeight: data.Dims_Weight,
        dimsBootspace: data.Dims_Bootspace,
        dimsBootspaceMax: data.Dims_Bootspace_Max,
        dimsTowWeightUnbraked: data.Dims_TowWeight_Braked,
        dimsRoofLoadMax: data.Dims_RoofLoad_Max,
        miscBody: data.Misc_Body,
        miscSegment: data.Misc_Segment,
        miscSeats: data.Misc_Seats,
        miscRoofrails: data.Misc_Roofrails,
        miscIsofix: data.Misc_Isofix,
        miscIsofixSeats: data.Misc_Isofix_Seats,
        miscTurningCircle: data.Misc_TurningCircle,
        euroNCAPRating: data.EuroNCAP_Rating,
        euroNCAPYear: data.EuroNCAP_Year,
        euroNCAPAdult: data.EuroNCAP_Adult,
        euroNCAPChild: data.EuroNCAP_Child,
        euroNCAPVRU: data.EuroNCAP_VRU,
        euroNCAPSA: data.EuroNCAP_SA,
        relatedVehicleIDSuccesor: data.Related_Vehicle_ID_Succesor,
        eVDBDetailURL: data.EVDB_Detail_URL,
        imageURLs: data.Images,
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
    if (carCatalog.imageURLs && carCatalog.imageURLs.length > 0) {
      try {
        const imageURL = this.convertToThumbImage(carCatalog.imageURLs[0]);
        const response = await this.axiosInstance.get(imageURL, { responseType: 'arraybuffer' });
        const base64Image = Buffer.from(response.data).toString('base64');
        image = 'data:' + response.headers['content-type'] + ';base64,' + base64Image;
      } catch (error) {
        Logging.logError({
          tenantID: Constants.DEFAULT_TENANT,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.SYNCHRONIZE_CAR_CATALOGS,
          module: MODULE_NAME, method: 'getCarCatalogThumb',
          message: `${carCatalog.id} - ${carCatalog.vehicleMake} - ${carCatalog.vehicleModel} - Cannot retrieve image from URL '${carCatalog.imageURLs[0]}'`,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }
    return image;
  }

  public async getCarCatalogImages(carCatalog: CarCatalog): Promise<string[]> {
    const images: string[] = [];
    // Retrieve all images
    for (const imageURL of carCatalog.imageURLs) {
      try {
        const response = await this.axiosInstance.get(imageURL, { responseType: 'arraybuffer' });
        const base64Image = Buffer.from(response.data).toString('base64');
        const encodedImage = 'data:' + response.headers['content-type'] + ';base64,' + base64Image;
        images.push(encodedImage);
      } catch (error) {
        Logging.logError({
          tenantID: Constants.DEFAULT_TENANT,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.SYNCHRONIZE_CAR_CATALOGS,
          module: MODULE_NAME, method: 'getCarCatalogImages',
          message: `${carCatalog.id} - ${carCatalog.vehicleMake} - ${carCatalog.vehicleModel} - Cannot retrieve image from URL '${imageURL}'`,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }
    return images;
  }

  private convertToThumbImage(image: string): string {
    return [image.slice(0, image.length - 7), '-thumb', image.slice(image.length - 7)].join('');
  }
}
