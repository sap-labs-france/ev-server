import ChargingStation, { CurrentType } from '../../types/ChargingStation';
import Tenant, { TenantComponents } from '../../types/Tenant';

import { Car } from '../../types/Car';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import { SmartChargingRuntimeSessionParameters } from '../../types/Transaction';
import UserToken from '../../types/UserToken';
import Utils from '../../utils/Utils';
import moment from 'moment'; // moment-timezone?

export default class SmartChargingHelper {

  public static getExpectedDepartureTime(chargingStation: ChargingStation, expectedDepartureTime: string): Date {
    const departureTime = moment(expectedDepartureTime, 'HH:mm');
    let departureDate: moment.Moment;
    const timezone = Utils.getTimezone(chargingStation.coordinates);
    if (timezone) {
      // Timezone of the charging station
      departureDate = moment().tz(timezone);
    }
    departureDate.set({
      hour: departureTime.get('hour'),
      minute: departureTime.get('minute'),
    });
    if (departureDate.isBefore(moment())) {
      departureDate = departureDate.add(1, 'day');
    }
    return departureDate.toDate();
  }

  public static async getSessionParameters(tenant: Tenant, user: UserToken, chargingStation: ChargingStation, connectorID: number, car: Car)
      : Promise<SmartChargingRuntimeSessionParameters> {
    // Check prerequisites
    if (chargingStation.excludeFromSmartCharging
      || !chargingStation.siteArea?.smartCharging
      || !chargingStation.capabilities?.supportChargingProfiles
      || !Utils.isComponentActiveFromToken(user, TenantComponents.SMART_CHARGING)) {
      return null;
    }
    const smartChargingSettings = await SettingStorage.getSmartChargingSettings(tenant);
    // Build the smart charging session parameters
    if (smartChargingSettings.sapSmartCharging?.prioritizationParametersActive) {
      // Default values
      const parameters = chargingStation.siteArea?.smartChargingSessionParameters;
      const targetStateOfCharge = parameters?.targetStateOfCharge ?? 70;
      const carStateOfCharge = parameters?.carStateOfCharge ?? 30;
      const expectedDepartureTime: string = parameters?.departureTime || '18:00';
      const departureTime = SmartChargingHelper.getExpectedDepartureTime(chargingStation, expectedDepartureTime);
      if (Utils.getChargingStationCurrentType(chargingStation, null, connectorID) === CurrentType.DC) {
        // DC Charger
        return {
          departureTime: null,
          targetStateOfCharge,
          carStateOfCharge: null,
        };
      } else if (car?.carConnectorData?.carConnectorID) {
        // AC Charger but with a Car Connector properly set
        return {
          departureTime,
          targetStateOfCharge,
          carStateOfCharge: null,
        };
      }
      // AC charger with no CAR Connector
      return {
        departureTime,
        carStateOfCharge,
        targetStateOfCharge
      };
    }
    return null;
  }
}
