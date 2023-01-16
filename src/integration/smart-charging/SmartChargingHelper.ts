import ChargingStation, { CurrentType } from '../../types/ChargingStation';
import Tenant, { TenantComponents } from '../../types/Tenant';

import { Car } from '../../types/Car';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import { SmartChargingRuntimeSessionParameters } from '../../types/Transaction';
import UserToken from '../../types/UserToken';
import Utils from '../../utils/Utils';
import moment from 'moment';

export default class SmartChargingHelper {

  public static getExpectedDepartureTime(chargingStation: ChargingStation, expectedDepartureTime: number): Date {
    // Timezone of the charging station
    const timezone = Utils.getTimezone(chargingStation.coordinates);
    let aDate: moment.Moment;
    if (timezone) {
      aDate = moment().tz(timezone).set('hour', expectedDepartureTime);
    } else {
      aDate = moment().set('hour', expectedDepartureTime);
    }
    if (aDate.isBefore(moment())) {
      aDate = aDate.add(1, 'day');
    }
    return aDate.toDate();
  }

  public static async getSessionParameters(tenant: Tenant, user: UserToken, chargingStation: ChargingStation, connectorID: number, car: Car)
      : Promise<SmartChargingRuntimeSessionParameters> {
    // Check prerequisites
    if (chargingStation.excludeFromSmartCharging
      || !chargingStation.siteArea?.smartCharging
      || !chargingStation.capabilities.supportChargingProfiles
      || Utils.isComponentActiveFromToken(user, TenantComponents.SMART_CHARGING)) {
      return null;
    }
    // Build the smart charging session parameters
    const expectedDepartureTime = chargingStation.siteArea.smartChargingSessionParameters?.departureTime || 18;
    const departureTime = SmartChargingHelper.getExpectedDepartureTime(chargingStation, expectedDepartureTime);
    // Handle Smart Charging
    const smartChargingSettings = await SettingStorage.getSmartChargingSettings(tenant);
    if (smartChargingSettings.sapSmartCharging?.prioritizationParametersActive) {
      // Default values
      const targetStateOfCharge = chargingStation.siteArea?.smartChargingSessionParameters?.targetStateOfCharge || 70;
      const carStateOfCharge = chargingStation.siteArea?.smartChargingSessionParameters?.carStateOfCharge || 30;
      if (Utils.getChargingStationCurrentType(chargingStation, null, connectorID) === CurrentType.DC) {
        // DC Charger
        return {
          targetStateOfCharge
        };
      } else if (car?.carConnectorData?.carConnectorID) {
        // AC Charger but with a Car Connector properly set
        return {
          departureTime,
          carStateOfCharge
        };
      }
      // AC charger with no CAR Connector
      return {
        departureTime,
        carStateOfCharge,
        targetStateOfCharge
      };
    }
  }
}
