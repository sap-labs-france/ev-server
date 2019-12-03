import { ChargerManufacturerParameters } from '../../types/ChargerManufacturerParameters';
import { ChargerSchedule } from '../../types/ChargerSchedule';
import global from '../../types/GlobalType';
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

  public static async saveChargerSchedule(tenantID: string, chargerSchedule: ChargerSchedule): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('SmartChargingStorage', 'getChargerSchedule');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Update DB
    await global.database.getCollection<any>(tenantID, 'chargerschedules')
      .findOneAndUpdate({
        'chargerID': chargerSchedule.chargerID,
      }, { $set: chargerSchedule });
    // Debug
    Logging.traceEnd('SmartChargingStorage', 'getChargerSchedule', uniqueTimerID);
  }
}
