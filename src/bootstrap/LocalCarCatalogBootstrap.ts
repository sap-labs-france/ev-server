import { CarCatalog, CarCatalogChargeAlternativeTable, CarCatalogChargeOptionTable, CarCatalogConverter } from '../types/Car';

import CarStorage from '../storage/mongodb/CarStorage';
import Constants from '../utils/Constants';
import Jimp from 'jimp';
import Logging from '../utils/Logging';
import { ServerAction } from '../types/Server';
import Utils from '../utils/Utils';
import { Voltage } from '../types/ChargingStation';
import fs from 'fs';
import global from '../types/GlobalType';

const MODULE_NAME = 'LocalCarIntegration';

export default class LocalCarCatalogBootstrap {
  public static async uploadLocalCarCatalogsFromFile() : Promise<void> {
    let created = 0;
    try {
      const cars = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/cars/cars-definition.json`, 'utf8'));
      if (!Utils.isEmptyArray(cars)) {
        for (const car of cars) {
          try {
            const chargeStandardTables: CarCatalogConverter[] = [];
            const chargeAlternativeTables: CarCatalogChargeAlternativeTable[] = [];
            const chargeOptionTables: CarCatalogChargeOptionTable[] = [];
            for (const chargeStandard of Object.keys(car.Charge_Standard_Table)) {
              const chargeStandardTable: CarCatalogConverter = {
                type: chargeStandard,
                evsePhaseVolt: car.Charge_Standard_Table[chargeStandard].EVSE_PhaseVolt,
                evsePhaseAmp: car.Charge_Standard_Table[chargeStandard].EVSE_PhaseAmp,
                evsePhase: car.Charge_Standard_Table[chargeStandard].EVSE_Phase,
                evsePhaseVoltCalculated: car.Charge_Standard_Table[chargeStandard].EVSE_Phase === 3 ?
                  Voltage.VOLTAGE_400 : car.Charge_Standard_Table[chargeStandard].EVSE_PhaseVolt,
                chargePhaseVolt: car.Charge_Standard_Table[chargeStandard].Charge_PhaseVolt,
                chargePhaseAmp: car.Charge_Standard_Table[chargeStandard].Charge_PhaseAmp,
                chargePhase: car.Charge_Standard_Table[chargeStandard].Charge_Phase,
                chargePower: car.Charge_Standard_Table[chargeStandard].Charge_Power,
                chargeTime: car.Charge_Standard_Table[chargeStandard].Charge_Time,
                chargeSpeed: car.Charge_Standard_Table[chargeStandard].Charge_Speed,
              };
              chargeStandardTables.push(chargeStandardTable);
            }
            if (car.Charge_Alternative_Table) {
              for (const chargeAlternative of Object.keys(car.Charge_Alternative_Table)) {
                const chargeAlternativeTable: CarCatalogChargeAlternativeTable = {
                  type: chargeAlternative,
                  evsePhaseVolt: car.Charge_Standard_Table[chargeAlternative].EVSE_PhaseVolt,
                  evsePhaseAmp: car.Charge_Standard_Table[chargeAlternative].EVSE_PhaseAmp,
                  evsePhase: car.Charge_Standard_Table[chargeAlternative].EVSE_Phase,
                  chargePhaseVolt: car.Charge_Standard_Table[chargeAlternative].Charge_PhaseVolt,
                  chargePhaseAmp: car.Charge_Standard_Table[chargeAlternative].Charge_PhaseAmp,
                  chargePhase: car.Charge_Standard_Table[chargeAlternative].Charge_Phase,
                  chargePower: car.Charge_Standard_Table[chargeAlternative].Charge_Power,
                  chargeTime: car.Charge_Standard_Table[chargeAlternative].Charge_Time,
                  chargeSpeed: car.Charge_Standard_Table[chargeAlternative].Charge_Speed,
                };
                chargeAlternativeTables.push(chargeAlternativeTable);
              }
            }
            if (car.Charge_Option_Table) {
              for (const chargeOption of Object.keys(car.Charge_Option_Table)) {
                const chargeAlternativeTable: CarCatalogChargeOptionTable = {
                  type: chargeOption,
                  evsePhaseVolt: car.Charge_Standard_Table[chargeOption].EVSE_PhaseVolt,
                  evsePhaseAmp: car.Charge_Standard_Table[chargeOption].EVSE_PhaseAmp,
                  evsePhase: car.Charge_Standard_Table[chargeOption].EVSE_Phase,
                  chargePhaseVolt: car.Charge_Standard_Table[chargeOption].Charge_PhaseVolt,
                  chargePhaseAmp: car.Charge_Standard_Table[chargeOption].Charge_PhaseAmp,
                  chargePhase: car.Charge_Standard_Table[chargeOption].Charge_Phase,
                  chargePower: car.Charge_Standard_Table[chargeOption].Charge_Power,
                  chargeTime: car.Charge_Standard_Table[chargeOption].Charge_Time,
                  chargeSpeed: car.Charge_Standard_Table[chargeOption].Charge_Speed,
                };
                chargeOptionTables.push(chargeAlternativeTable);
              }
            }
            const carCatalog: CarCatalog = {
              id: car.Vehicle_ID,
              vehicleMake: car.Vehicle_Make,
              vehicleModel: car.Vehicle_Model,
              vehicleModelVersion: car.Vehicle_Model_Version,
              availabilityStatus: car.Availability_Status,
              availabilityDateFrom: car.Availability_Date_From,
              availabilityDateTo: car.Availability_Date_To,
              priceFromDE: car.Price_From_DE,
              priceFromDEEstimate: car.Price_From_DE_Estimate,
              priceFromNL: car.Price_From_NL,
              priceFromNLEstimate: car.Price_From_NL_Estimate,
              priceFromUK: car.Price_From_UK,
              priceGrantPICGUK: car.Price_Grant_PICG_UK,
              priceFromUKEstimate: car.Price_From_UK_Estimate,
              drivetrainType: car.Drivetrain_Type,
              drivetrainFuel: car.Drivetrain_Fuel,
              drivetrainPropulsion: car.Drivetrain_Propulsion,
              drivetrainPower: car.Drivetrain_Power,
              drivetrainPowerHP: car.Drivetrain_Power_HP,
              drivetrainTorque: car.Drivetrain_Torque,
              performanceAcceleration: car.Performance_Acceleration,
              performanceTopspeed: car.Performance_Topspeed,
              rangeWLTP: car.Range_WLTP,
              rangeWLTPEstimate: car.Range_WLTP_Estimate,
              rangeNEDC: car.Range_NEDC,
              rangeNEDCEstimate: car.Range_NEDC_Estimate,
              rangeReal: car.Range_Real,
              rangeRealMode: car.Range_Real_Mode,
              rangeRealWHwy: car.Range_Real_WHwy,
              rangeRealWCmb: car.Range_Real_WCmb,
              rangeRealWCty: car.Range_Real_WCty,
              rangeRealBHwy: car.Range_Real_BHwy,
              rangeRealBCmb: car.Range_Real_BCmb,
              rangeRealBCty: car.Range_Real_BCty,
              efficiencyWLTP: car.Efficiency_WLTP,
              efficiencyWLTPFuelEq: car.Efficiency_WLTP_FuelEq,
              efficiencyWLTPV: car.Efficiency_WLTP_V,
              efficiencyWLTPFuelEqV: car.Efficiency_WLTP_FuelEq_V,
              efficiencyWLTPCO2: car.Efficiency_WLTP_CO2,
              efficiencyNEDC: car.Efficiency_NEDC,
              efficiencyNEDCFuelEq: car.Efficiency_NEDC_FuelEq,
              efficiencyNEDCV: car.Efficiency_NEDC_V,
              efficiencyNEDCFuelEqV: car.Efficiency_NEDC_FuelEq_V,
              efficiencyNEDCCO2: car.Efficiency_NEDC_CO2,
              efficiencyReal: car.Efficiency_Real,
              efficiencyRealFuelEqV: car.Efficiency_Real_FuelEq_V,
              efficiencyRealCO2: car.Efficiency_Real_CO2,
              efficiencyRealWHwy: car.Efficiency_Real_WHwy,
              efficiencyRealWCmb: car.Efficiency_Real_WCmb,
              efficiencyRealWCty: car.Efficiency_Real_WCty,
              efficiencyRealBHwy: car.Efficiency_Real_BHwy,
              efficiencyRealBCmb: car.Efficiency_Real_BCmb,
              efficiencyRealBCty: car.Efficiency_Real_BCty,
              chargePlug: car.Charge_Plug,
              chargePlugEstimate: car.Charge_Plug_Estimate,
              chargePlugLocation: car.Charge_Plug_Location,
              chargeStandardPower: car.Charge_Standard_Power,
              chargeStandardPhase: car.Charge_Standard_Phase,
              chargeStandardPhaseAmp: car.Charge_Standard_PhaseAmp,
              chargeStandardChargeTime: car.Charge_Standard_ChargeTime,
              chargeStandardChargeSpeed: car.Charge_Standard_ChargeSpeed,
              chargeStandardEstimate: car.Charge_Standard_Estimate,
              chargeStandardTables: chargeStandardTables,
              chargeAlternativePower: car.Charge_Alternative_Power,
              chargeAlternativePhase: car.Charge_Alternative_Phase,
              chargeAlternativePhaseAmp: car.Charge_Alternative_PhaseAmp,
              chargeAlternativeChargeTime: car.Charge_Alternative_ChargeTime,
              chargeAlternativeChargeSpeed: car.Charge_Alternative_ChargeSpeed,
              chargeAlternativeTables: chargeAlternativeTables,
              chargeOptionPower: car.Charge_Option_Power,
              chargeOptionPhase: car.Charge_Option_Phase,
              chargeOptionPhaseAmp: car.Charge_Option_PhaseAmp,
              chargeOptionChargeTime: car.Charge_Option_ChargeTime,
              chargeOptionChargeSpeed: car.Charge_Option_ChargeSpeed,
              chargeOptionTables: chargeOptionTables,
              fastChargePlug: car.Fastcharge_Plug,
              fastChargePlugEstimate: car.Fastcharge_Plug_Estimate,
              fastChargePlugLocation: car.Fastcharge_Plug_Location,
              fastChargePowerMax: car.Fastcharge_Power_Max,
              fastChargePowerAvg: car.Fastcharge_Power_Avg,
              fastChargeTime: car.Fastcharge_ChargeTime,
              fastChargeSpeed: car.Fastcharge_ChargeSpeed,
              fastChargeOptional: car.Fastcharge_Optional,
              fastChargeEstimate: car.Fastcharge_Estimate,
              batteryCapacityUseable: car.Battery_Capacity_Useable,
              batteryCapacityFull: car.Battery_Capacity_Full,
              batteryCapacityEstimate: car.Battery_Capacity_Estimate,
              dimsLength: car.Dims_Length,
              dimsWidth: car.Dims_Width,
              dimsHeight: car.Dims_Height,
              dimsWheelbase: car.Dims_Wheelbase,
              dimsWeight: car.Dims_Weight,
              dimsBootspace: car.Dims_Bootspace,
              dimsBootspaceMax: car.Dims_Bootspace_Max,
              dimsTowWeightUnbraked: car.Dims_TowWeight_Braked,
              dimsRoofLoadMax: car.Dims_RoofLoad_Max,
              miscBody: car.Misc_Body,
              miscSegment: car.Misc_Segment,
              miscSeats: car.Misc_Seats,
              miscRoofrails: car.Misc_Roofrails,
              miscIsofix: car.Misc_Isofix,
              miscIsofixSeats: car.Misc_Isofix_Seats,
              miscTurningCircle: car.Misc_TurningCircle,
              euroNCAPRating: car.EuroNCAP_Rating,
              euroNCAPYear: car.EuroNCAP_Year,
              euroNCAPAdult: car.EuroNCAP_Adult,
              euroNCAPChild: car.EuroNCAP_Child,
              euroNCAPVRU: car.EuroNCAP_VRU,
              euroNCAPSA: car.EuroNCAP_SA,
              relatedVehicleIDSuccessor: car.Related_Vehicle_ID_Successor,
              eVDBDetailURL: car.EVDB_Detail_URL,
              imageURLs: car.Images ? (!Utils.isEmptyArray(car.Images) ? car.Images : [car.Images]) : [],
              images: [],
              videos: car.Videos,
            };
            let imageURLPath = `${global.appRoot}/assets/cars/img/${carCatalog.imageURLs[0]}`;
            const thumbImage = (await Jimp.read(imageURLPath)).resize(200, 150);
            const thumbImageMIME = thumbImage.getMIME();
            const base64ThumbImage = await thumbImage.getBase64Async(thumbImageMIME);
            carCatalog.image = base64ThumbImage;
            // Delete Car Catalog
            await CarStorage.deleteCarCatalog(carCatalog.id);
            await CarStorage.deleteCarCatalogImages(carCatalog.id);
            carCatalog.createdOn = new Date();
            carCatalog.lastChangedOn = carCatalog.createdOn;
            for (const imageURL of carCatalog.imageURLs) {
              imageURLPath = `${global.appRoot}/assets/cars/img/${imageURL}`;
              const image = await Jimp.read(imageURLPath);
              const imageMIME = image.getMIME();
              const base64Image = await image.getBase64Async(imageMIME);
              // Save car catalog images
              await CarStorage.saveCarCatalogImage(carCatalog.id, base64Image);
            }
            // Save
            await CarStorage.saveCarCatalog(carCatalog);
            created++;
          } catch (error) {
            const message = `Error while importing the local Car ID '${car.Vehicle_ID as string}': ${error.message as string}`;
            await Logging.logError({
              tenantID: Constants.DEFAULT_TENANT,
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
        tenantID: Constants.DEFAULT_TENANT,
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
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.UPDATE_LOCAL_CAR_CATALOGS,
        message, module: MODULE_NAME, method: 'uploadLocalCarCatalogsFromFile',
      });
      Utils.isDevelopmentEnv() && Logging.logConsoleInfo(message);
    }
  }
}
