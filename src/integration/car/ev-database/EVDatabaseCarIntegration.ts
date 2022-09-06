import { CarCatalog, CarCatalogConverter, CarCatalogFastCharge } from '../../../types/Car';

import AxiosFactory from '../../../utils/AxiosFactory';
import { AxiosInstance } from 'axios';
import CarIntegration from '../CarIntegration';
import Configuration from '../../../utils/Configuration';
import Constants from '../../../utils/Constants';
import Jimp from 'jimp';
import Logging from '../../../utils/Logging';
import { ServerAction } from '../../../types/Server';
import Utils from '../../../utils/Utils';
import { Voltage } from '../../../types/ChargingStation';

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
      console.log(data.Vehicle_ID);
      const chargeStandardTables: CarCatalogConverter[] = [];
      const chargeOptionTables: CarCatalogConverter[] = [];
      const fastChargeTables: CarCatalogFastCharge[] = [];
      const chargeStandardTableUniversal = { ...data.Charge_Standard_Table_UK, ...data.Charge_Standard_Table_NL, ...data.Charge_Standard_Table_DE };
      const chargeOptionTableUniversal = { ...data.Charge_Option_Table_UK, ...data.Charge_Option_Table_NL, ...data.Charge_Option_Table_DE };
      if (chargeStandardTableUniversal) {
        for (const chargeStandard of Object.keys(chargeStandardTableUniversal)) {
          chargeStandardTables.push(this.fillCarCatalogConverter(chargeStandardTableUniversal, chargeStandard));
        }
        if (chargeOptionTableUniversal) {
          for (const chargeOption of Object.keys(chargeOptionTableUniversal)) {
            chargeOptionTables.push(this.fillCarCatalogConverter(chargeOptionTableUniversal, chargeOption));
          }
        }
      }
      if (data.Fastcharge_Table) {
        for (const fastCharge of Object.keys(data.Fastcharge_Table)) {
          const fastChargeTable: CarCatalogFastCharge = {
            type: fastCharge,
            fastChargePowerMax: data.Fastcharge_Table[fastCharge].Fastcharge_Power_Max,
            fastChargePowerAvg: data.Fastcharge_Table[fastCharge].Fastcharge_Power_Avg,
            fastChargeChargeTime: data.Fastcharge_Table[fastCharge].Fastcharge_ChargeTime,
            fastChargeChargeSpeed: data.Fastcharge_Table[fastCharge].Fastcharge_ChargeSpeed,
            fastChargeLimited: data.Fastcharge_Table[fastCharge].Fastcharge_Limited,
            fastChargeAvgLimited: data.Fastcharge_Table[fastCharge].Fastcharge_Avg_Limited,
          };
          fastChargeTables.push(fastChargeTable);
        }
      }

      const carCatalog: CarCatalog = {
        id: data.Vehicle_ID,
        vehicleMake: data.Vehicle_Make,
        vehicleModel: data.Vehicle_Model,
        vehicleModelVersion: data.Vehicle_Model_Version,
        availabilityStatus: data.Availability_Status_DE ?? data.Availability_Status_NL ?? data.Availability_Status_UK,
        availabilityDateFrom: data.Availability_Date_From_DE ?? data.Availability_Date_From_NL ?? data.Availability_Date_UK,
        availabilityDateTo: data.Availability_Date_To_DE ?? data.Availability_Date_To_NL ?? data.Availability_Date_To_UK,
        priceFromDE: data.Price_From_DE,
        priceFromDEEstimate: data.Price_From_DE_Estimate,
        priceGrantUmweltbonusDE: data.Price_Grant_Umweltbonus_DE,
        priceFromNL: data.Price_From_NL,
        priceFromNLFiscal: data.Price_From_NL_Fiscal,
        priceGrantSEPPNL: data.Price_Grant_SEPP_NL,
        priceFromNLEstimate: data.Price_From_NL_Estimate,
        priceFromUK: data.Price_From_UK,
        priceFromUKP11D: data.Price_From_UK_P11D,
        priceGrantPICGUK: data.Price_Grant_PICG_UK,
        priceFromUKEstimate: data.Price_From_UK_Estimate,
        drivetrainType: data.Drivetrain_Type,
        drivetrainFuel: data.Drivetrain_Fuel,
        drivetrainPropulsion: data.Drivetrain_Propulsion,
        drivetrainPropulsionEstimate: data.Drivetrain_Propulsion_Estimate,
        drivetrainPower: data.Drivetrain_Power,
        drivetrainPowerHP: data.Drivetrain_Power_HP,
        drivetrainPowerEstimate: data.Drivetrain_Power_Estimate,
        drivetrainTorque: data.Drivetrain_Torque,
        drivetrainTorqueEstimate: data.Drivetrain_Torque_Estimate,
        performanceAcceleration: data.Performance_Acceleration,
        performanceAccelerationEstimate: data.Performance_Acceleration_Estimate,
        performanceTopspeed: data.Performance_Topspeed,
        performanceTopspeedEstimate: data.Performance_Topspeed_Estimate,
        rangeWLTP: data.Range_WLTP,
        rangeWLTPEstimate: data.Range_WLTP_Estimate,
        rangeWLTPTEH: data.Range_WLTP_TEH,
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
        efficiencyEconomyWLTPV: data.Efficiency_Economy_WLTP_V,
        efficiencyConsumptionWLTPV: data.Efficiency_Consumption_WLTP_V,
        efficiencyEconomyWLTP: data.Efficiency_Economy_WLTP,
        efficiencyConsumptionWLTP: data.Efficiency_Consumption_WLTP,
        efficiencyWLTPFuelEqV: data.Efficiency_WLTP_FuelEq_V,
        efficiencyWLTPCO2: data.Efficiency_WLTP_CO2,
        efficiencyNEDC: data.Efficiency_NEDC,
        efficiencyEconomyNEDC: data.Efficiency_Economy_NEDC,
        efficiencyConsumptionNEDC: data.Efficiency_Consumption_NEDC,
        efficiencyWLTPTEH: data.Efficiency_WLTP_TEH,
        efficiencyWLTPTEHCO2: data.Efficiency_WLTP_TEH_CO2,
        efficiencyEconomyWLTPTEH: data.Efficiency_Economy_WLTP_TEH,
        efficiencyConsumptionWLTPTEH: data.Efficiency_Consumption_WLTP_TEH,
        efficiencyConsumptionWLTPTEHV: data.Efficiency_Consumption_WLTP_TEH_V,
        efficiencyWLTPTEHFuelEq: data.Efficiency_WLTP_TEH_FuelEq,
        efficiencyWLTPTEHV: data.Efficiency_WLTP_TEH_V,
        efficiencyWLTPTEHFuelEqV: data.Efficiency_WLTP_TEH_FuelEq_V,
        efficiencyEconomyWLTPTEHV: data.Efficiency_Economy_WLTP_TEH_V,
        efficiencyNEDCFuelEq: data.Efficiency_NEDC_FuelEq,
        efficiencyNEDCV: data.Efficiency_NEDC_V,
        efficiencyNEDCFuelEqV: data.Efficiency_NEDC_FuelEq_V,
        efficiencyEconomyNEDCV: data.Efficiency_Economy_NEDC_V,
        efficiencyConsumptionNEDCV: data.Efficiency_Consumption_NEDC_V,
        efficiencyNEDCCO2: data.Efficiency_NEDC_CO2,
        efficiencyReal: data.Efficiency_Real,
        efficiencyEconomyReal: data.Efficiency_Economy_Real,
        efficiencyRealFuelEqV: data.Efficiency_Real_FuelEq_V,
        efficiencyRealCO2: data.Efficiency_Real_CO2,
        efficiencyConsumptionReal: data.Efficiency_Consumption_Real,
        efficiencyRealWHwy: data.Efficiency_Real_WHwy,
        efficiencyRealWCmb: data.Efficiency_Real_WCmb,
        efficiencyRealWCty: data.Efficiency_Real_WCty,
        efficiencyRealBHwy: data.Efficiency_Real_BHwy,
        efficiencyRealBCmb: data.Efficiency_Real_BCmb,
        efficiencyRealBCty: data.Efficiency_Real_BCty,
        efficiencyEconomyRealWHwy: data.Efficiency_Economy_Real_WHwy,
        efficiencyEconomyRealWCmb: data.Efficiency_Economy_Real_WCmb,
        efficiencyEconomyRealWCty: data.Efficiency_Economy_Real_WCty,
        efficiencyEconomyRealBHwy: data.Efficiency_Economy_Real_BHwy,
        efficiencyEconomyRealBCmb: data.Efficiency_Economy_Real_BCmb,
        efficiencyEconomyRealBCty: data.Efficiency_Economy_Real_BCty,
        efficiencyConsumptionRealWHwy: data.Efficiency_Consumption_Real_WHwy,
        efficiencyConsumptionRealWCmb: data.Efficiency_Consumption_Real_WCmb,
        efficiencyConsumptionReal_WCty: data.Efficiency_Consumption_Real_WCty,
        efficiencyConsumptionRealBHwy: data.Efficiency_Consumption_Real_BHwy,
        efficiencyConsumptionRealBCmb: data.Efficiency_Consumption_Real_BCmb,
        efficiencyConsumptionRealBCty: data.Efficiency_Consumption_Real_BCty,
        chargePlug: data.Charge_Plug,
        chargePlugEstimate: data.Charge_Plug_Estimate,
        chargePlugLocation: data.Charge_Plug_Location,
        chargePlug2Location: data.Charge_Plug_2_Location,
        chargePlug2OptionalDE: data.Charge_Plug_2_Optional_DE,
        chargePlug2OptionalNL: data.Charge_Plug_2_Optional_NL,
        chargePlug2OptionalUK: data.Charge_Plug_2_Optional_UK,
        chargeStandardPowerDE: data.Charge_Standard_Power_DE,
        chargeStandardPhaseDE: data.Charge_Standard_Phase_DE,
        chargeStandardPhaseAmpDE: data.Charge_Standard_PhaseAmp_DE,
        chargeStandardChargeSpeedDE: data.Charge_Standard_ChargeSpeed_DE,
        chargeStandardChargeTimeDE: data.Charge_Standard_ChargeTime_DE,
        chargeStandardPowerNL: data.Charge_Standard_Power_NL,
        chargeStandardPower: data.Charge_Standard_Power,
        chargeStandardPhase: data.Charge_Standard_Phase,
        chargeStandardPhaseAmp: data.Charge_Standard_PhaseAmp,
        chargeStandardChargeTime: data.Charge_Standard_ChargeTime,
        chargeStandardChargeTimeNL: data.Charge_Standard_ChargeTime_NL,
        chargeStandardChargeSpeedNL: data.Charge_Standard_ChargeSpeed_NL,
        chargeStandardPowerUK: data.Charge_Standard_Power_UK,
        chargeStandardPhaseUK: data.Charge_Standard_Phase_UK,
        chargeStandardPhaseAmpUK: data.Charge_Standard_PhaseAmp_UK,
        chargeStandarChargeTimeUK: data.Charge_Standard_ChargeTime_UK,
        chargeStandardChargeSpeed: data.Charge_Standard_ChargeSpeed,
        chargeStandardChargeSpeedUK: data.Charge_Standard_ChargeSpeed_UK,
        chargeStandardEstimate: data.Charge_Standard_Estimate,
        chargeStandardTables: chargeStandardTables,
        chargeOptionPowerDE: data.Charge_Option_Power_DE,
        chargeOptionPhaseDE: data.Charge_Option_Phase_DE,
        chargeOptionPhaseAmpDE: data.Charge_Option_PhaseAmp_DE,
        chargeOptionChargeTimeDE: data.Charge_Option_ChargeTime_DE,
        chargeOptionChargeSpeedDE: data.Charge_Option_ChargeSpeed_DE,
        chargeOptionPowerNL: data.Charge_Option_Power_NL,
        chargeOptionPhaseAmpNL: data.Charge_Option_PhaseAmp_NL,
        chargeOptionPhaseNL: data.Charge_Option_Phase_NL,
        chargeOptionChargeTimeNL: data.Charge_Option_ChargeTime_NL,
        chargeOptionChargeSpeedNL: data.Charge_Option_ChargeSpeed_NL,
        chargeOptionPowerUK: data.Charge_Option_Power_UK,
        chargeOptionPhaseUK: data.Charge_Option_Phase_UK,
        chargeOptionPhaseAmpUK: data.Charge_Option_PhaseAmp_UK,
        chargeOptionChargeTimeUK: data.Charge_Option_ChargeTime_UK,
        chargeOptionChargeSpeedUK: data.Charge_Option_ChargeSpeed_UK,
        chargeAlternativePower: data.Charge_Alternative_Power,
        chargeAlternativePhase: data.Charge_Alternative_Phase,
        chargeAlternativePhaseAmp: data.Charge_Alternative_PhaseAmp,
        chargeAlternativeChargeTime: data.Charge_Alternative_ChargeTime,
        chargeAlternativeChargeSpeed: data.Charge_Alternative_ChargeSpeed,
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
        fastChargeTables: fastChargeTables,
        batteryCapacityUseable: data.Battery_Capacity_Useable,
        batteryCapacityFull: data.Battery_Capacity_Full,
        batteryCapacityEstimate: data.Battery_Capacity_Estimate,
        batteryTMS: data.Battery_TMS,
        batteryChemistry: data.Battery_Chemistry,
        batteryManufacturer: data.Battery_Manufacturer,
        batteryModules: data.Battery_Modules,
        batteryCells: data.Battery_Cells,
        batteryWeight: data.Battery_Weight,
        BatteryWarrantyPeriod: data.Battery_Warranty_Period,
        batteryWarrantyMileage: data.Battery_Warranty_Mileage,
        dimsLength: data.Dims_Length,
        dimsWidth: data.Dims_Width,
        dimsWidthMirrors: data.Dims_Width_Mirrors,
        dimsHeight: data.Dims_Height,
        dimsLWHEstimate: data.Dims_LWH_Estimate,
        dimsWheelbase: data.Dims_Wheelbase,
        dimsWeightGVWR: data.Dims_Weight_GVWR,
        dimsWeightMaxPayload: data.Dims_Weight_MaxPayload,
        dimsWheelbaseEstimate: data.Dims_Wheelbase_Estimate,
        dimsWeightEstimate: data.Dims_Weight_Estimate,
        dimsWeight: data.Dims_Weight,
        dimsBootspace: data.Dims_Bootspace,
        dimsBootspaceFrunk: data.Dims_Bootspace_Frunk,
        dimsTowHitch: data.Dims_Tow_Hitch,
        dimsTowWeightUnbraked: data.Dims_TowWeight_Unbraked,
        dimsBootspaceMax: data.Dims_Bootspace_Max,
        dimsTowWeightBraked: data.Dims_TowWeight_Braked,
        dimsTowWeightEstimate: data.Dims_TowWeight_Estimate,
        dimsTowWeightVerticalLoad: data.Dims_TowWeight_VerticalLoad,
        dimsRoofLoadMax: data.Dims_RoofLoad_Max,
        miscBody: data.Misc_Body,
        miscSegment: data.Misc_Segment,
        miscSeats: data.Misc_Seats,
        miscRoofrails: data.Misc_Roofrails,
        miscIsofix: data.Misc_Isofix,
        miscIsofixSeats: data.Misc_Isofix_Seats,
        miscTurningCircle: data.Misc_TurningCircle,
        miscVehiclePlatform: data.Misc_Vehicle_Platform,
        miscVehiclePlatformDedicated: data.Misc_Vehicle_Platform_Dedicated,
        miscOEMLinkoutURLDE: data.Misc_OEM_Linkout_URL_DE,
        miscOEMLinkoutURLNL: data.Misc_OEM_Linkout_URL_NL,
        miscOEMLinkoutURLUK: data.Misc_OEM_Linkout_URL_UK,
        BIKNLYear: data.BIK_NL_Year,
        BIKNLRate: data.BIK_NL_Rate,
        BIKNLCap: data.BIK_NL_Cap,
        BIKNLNetLow: data.BIK_NL_Net_Low,
        BIKNLNetHigh: data.BIK_NL_Net_Low,
        BIKUKYear: data.BIK_NL_Net_Low,
        BIKUKRate: data.BIK_NL_Net_Low,
        BIKUKAmount: data.BIK_UK_Amount,
        BIKUKNetLow: data.BIK_UK_Net_Low,
        BIKUKNetMid: data.BIK_UK_Net_Mid,
        BIKUKNetHigh: data.BIK_UK_Net_High,
        euroNCAPRating: data.EuroNCAP_Rating,
        euroNCAPYear: data.EuroNCAP_Year,
        euroNCAPAdult: data.EuroNCAP_Adult,
        euroNCAPChild: data.EuroNCAP_Child,
        euroNCAPVRU: data.EuroNCAP_VRU,
        euroNCAPSA: data.EuroNCAP_SA,
        relatedVehicleIDSuccessor: data.Related_Vehicle_ID_Successor,
        eVDBDetailURL: data.EVDB_Detail_URL,
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

  private fillCarCatalogConverter(chargeTable: any, chargeType: string): CarCatalogConverter {
    return {
      type: chargeType,
      evsePhaseVolt: chargeTable[chargeType].EVSE_PhaseVolt,
      evsePhaseAmp: chargeTable[chargeType].EVSE_PhaseAmp,
      evsePhase: chargeTable[chargeType].EVSE_Phase  === 3 ? Voltage.VOLTAGE_400 : chargeTable[chargeType].EVSE_PhaseVolt,
      evsePower: chargeTable[chargeType].EVSE_Power,
      chargePhaseVolt: chargeTable[chargeType].Charge_PhaseVolt,
      chargePhaseAmp: chargeTable[chargeType].Charge_PhaseAmp,
      chargePhase: chargeTable[chargeType].Charge_Phase,
      chargePower: chargeTable[chargeType].Charge_Power,
      chargeTime: chargeTable[chargeType].Charge_Time,
      chargeSpeed: chargeTable[chargeType].Charge_Speed,
    } as CarCatalogConverter;
  }
}
