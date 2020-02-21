import { Car, CarSynchronizeAction, ChargeStandardTable, ChargeAlternativeTable, ChargeOptionTable } from '../../types/Car';
import Axios from 'axios';
import hash from 'object-hash';
import Constants from '../../utils/Constants';
import global from '../../types/GlobalType';
import { json } from 'body-parser';
import Cypher from '../../utils/Cypher';
import Logging from '../../utils/Logging';
import { Action, Role } from '../../types/Authorization';
import DatabaseUtils from './DatabaseUtils';
import UserNotifications from '../../types/UserNotifications';
import UserStorage from './UserStorage';
import TenantStorage from './TenantStorage';
import Utils from '../../utils/Utils';
import Configuration from '../../utils/Configuration';
export default class CarStorage {

  public static async synchronizeCars(tenantID): Promise<CarSynchronizeAction> {


    return null;
  }


  public static async getCarsFromAPI(): Promise<Car[]> {
    const evDatabaseConfig = Configuration.getEVDatabaseConfig();
    const response = await Axios.get(evDatabaseConfig.url + '/' + evDatabaseConfig.key);
    const cars: Car[] = [];
    if (response.status === 200 && response.data.length > 0) {
      for (const data of response.data) {
        const chargeStandardTables: { [id: string]: ChargeStandardTable } = {};
        const chargeAlternativeTables: { [id: string]: ChargeAlternativeTable } = {};
        const chargeOptionTables: { [id: string]: ChargeOptionTable } = {};
        for (const ChargeStandard of Object.keys(data.Charge_Standard_Table)) {
          const chargeStandardTable: ChargeStandardTable = {
            EVSEPhaseVolt: data.Charge_Standard_Table[ChargeStandard].EVSE_PhaseVolt,
            EVSEPhaseAmp: data.Charge_Standard_Table[ChargeStandard].EVSE_PhaseAmp,
            EVSEPhase: data.Charge_Standard_Table[ChargeStandard].EVSE_Phase,
            ChargePhaseVolt: data.Charge_Standard_Table[ChargeStandard].Charge_PhaseVolt,
            ChargePhaseAmp: data.Charge_Standard_Table[ChargeStandard].Charge_PhaseAmp,
            ChargePhase: data.Charge_Standard_Table[ChargeStandard].Charge_Phase,
            ChargePower: data.Charge_Standard_Table[ChargeStandard].Charge_Power,
            ChargeTime: data.Charge_Standard_Table[ChargeStandard].Charge_Time,
            ChargeSpeed: data.Charge_Standard_Table[ChargeStandard].Charge_Speed,
          };
          chargeStandardTables[ChargeStandard] = chargeStandardTable;
        }
        if (data.Charge_Alternative_Table) {
          for (const chargeAlternative of Object.keys(data.Charge_Alternative_Table)) {
            const chargeAlternativeTable: ChargeAlternativeTable = {
              EVSEPhaseVolt: data.Charge_Standard_Table[chargeAlternative].EVSE_PhaseVolt,
              EVSEPhaseAmp: data.Charge_Standard_Table[chargeAlternative].EVSE_PhaseAmp,
              EVSEPhase: data.Charge_Standard_Table[chargeAlternative].EVSE_Phase,
              ChargePhaseVolt: data.Charge_Standard_Table[chargeAlternative].Charge_PhaseVolt,
              ChargePhaseAmp: data.Charge_Standard_Table[chargeAlternative].Charge_PhaseAmp,
              ChargePhase: data.Charge_Standard_Table[chargeAlternative].Charge_Phase,
              ChargePower: data.Charge_Standard_Table[chargeAlternative].Charge_Power,
              ChargeTime: data.Charge_Standard_Table[chargeAlternative].Charge_Time,
              ChargeSpeed: data.Charge_Standard_Table[chargeAlternative].Charge_Speed,
            };
            chargeAlternativeTables[chargeAlternative] = chargeAlternativeTable;
          }
        }
        if (data.Charge_Option_Table) {
          for (const chargeOption of Object.keys(data.Charge_Option_Table)) {
            const chargeAlternativeTable: ChargeOptionTable = {
              EVSEPhaseVolt: data.Charge_Standard_Table[chargeOption].EVSE_PhaseVolt,
              EVSEPhaseAmp: data.Charge_Standard_Table[chargeOption].EVSE_PhaseAmp,
              EVSEPhase: data.Charge_Standard_Table[chargeOption].EVSE_Phase,
              ChargePhaseVolt: data.Charge_Standard_Table[chargeOption].Charge_PhaseVolt,
              ChargePhaseAmp: data.Charge_Standard_Table[chargeOption].Charge_PhaseAmp,
              ChargePhase: data.Charge_Standard_Table[chargeOption].Charge_Phase,
              ChargePower: data.Charge_Standard_Table[chargeOption].Charge_Power,
              ChargeTime: data.Charge_Standard_Table[chargeOption].Charge_Time,
              ChargeSpeed: data.Charge_Standard_Table[chargeOption].Charge_Speed,
            };
            chargeOptionTables[chargeOption] = chargeAlternativeTable;
          }
        }
        const car: Car = {
          _id: Cypher.hash(data.Vehicle_Make + data.Vehicle_Model),
          vehicleID: data.Vehicle_ID,
          vehicleMake: data.Vehicle_Make,
          VehicleModel: data.Vehicle_Model,
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
          fastchargePlug: data.Fastcharge_Plug,
          fastchargePlugEstimate: data.Fastcharge_Plug_Estimate,
          fastchargePlugLocation: data.Fastcharge_Plug_Location,
          fastchargePowerMax: data.Fastcharge_Power_Max,
          fastchargePowerAvg: data.Fastcharge_Power_Avg,
          fastchargeChargeTime: data.Fastcharge_ChargeTime,
          fastchargeChargeSpeed: data.Fastcharge_ChargeSpeed,
          fastchargeOptional: data.Fastcharge_Optional,
          fastchargeEstimate: data.Fastcharge_Estimate,
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
          images: data.Images,
          videos: data.Videos,
        };
        cars.push(car);
      }
    }

    return cars;
  }

  public static async syncCars(cars: Car[]): Promise<CarSynchronizeAction> {
    /* eslint-disable */
    const actionsDone = {
      synchronized: 0,
      error: 0
    } as CarSynchronizeAction;
    for (const car of cars) {
      try {
        const carDB = await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'cars')
          .findOne({
            '_id': car._id
          });
        if (!carDB) {
          car.hash = Cypher.hash(JSON.stringify(car));
          car.lastChangedOn = new Date();
          car.createdOn = new Date();
          await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'cars').insertOne(car);
        } else {
          if (Cypher.hash(JSON.stringify(car)) != carDB.hash) {
            car.hash = Cypher.hash(JSON.stringify(car));
            car.lastChangedOn = new Date();
            await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'cars').updateOne({ '_id': car._id }, { $set: car }, { upsert: true });
          }
        }
        actionsDone.synchronized++;
        // Log
        Logging.logError({
          tenantID: Constants.DEFAULT_TENANT,
          source: Constants.CENTRAL_SERVER,
          action: Action.SYNCHRONIZE_CARS,
          module: 'CarService', method: 'handleSynchronizeCars',
          message: `${car.vehicleMake} - ${car.VehicleModel} has been synchronized successfully`,
        });
      }
      catch (error) {
        actionsDone.error++;
        // Log
        Logging.logError({
          tenantID: Constants.DEFAULT_TENANT,
          source: Constants.CENTRAL_SERVER,
          action: Action.SYNCHRONIZE_CARS,
          module: 'CarService', method: 'handleSynchronizeCars',
          message: `Synchronization error: ${error.message}, While synchronizing the car ${car.vehicleMake} - ${car.VehicleModel}`,
        });
      }
    }
    return actionsDone;
  }

}
