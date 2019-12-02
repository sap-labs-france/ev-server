import Database from '../../utils/Database';
import global from '../../types/GlobalType';
import { ChargerManufacturerParameters, ChargerSchedule } from '../../types/ChargerManufacturerParameters';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';

export default class SmartChargingStorage {
  public static async getChargerManufacturerParameters(tenantID: string, manufacturer: string, model: string): Promise<ChargerManufacturerParameters> {
    // Debug
    const uniqueTimerID = Logging.traceStart('SmartChargingStorage', 'getChargerManufacturerParameters');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const ParametersMDB = await global.database.getCollection<any>(tenantID, 'chargermanufacturerparameters')
      .findOne({
        'manufacturer': manufacturer,
        'model': model,
      });
    // Debug
    Logging.traceEnd('SmartChargingStorage', 'getChargerManufacturerParameters', uniqueTimerID);
    return ParametersMDB;
  }

  public static async getChargerSchedule(tenantID: string, chargerID: string): Promise<ChargerSchedule> {
    // Debug
    const uniqueTimerID = Logging.traceStart('SmartChargingStorage', 'getChargerSchedule');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const ScheduleMDB = await global.database.getCollection<any>(tenantID, 'chargerschedules')
      .findOne({
        'chargerID': chargerID,
      });
    // Debug
    Logging.traceEnd('SmartChargingStorage', 'getChargerSchedule', uniqueTimerID);
    return ScheduleMDB;
  }
}
