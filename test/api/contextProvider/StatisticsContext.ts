import moment from 'moment';
import CONTEXTS from '../contextProvider/ContextConstants';
import TenantContext from './TenantContext';

export default class StatisticsContext {

  static readonly CHARGING_STATIONS: any = [
    CONTEXTS.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP15,
    CONTEXTS.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16];

  static readonly USERS: any = [
    CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN,
    CONTEXTS.USER_CONTEXTS.BASIC_USER
  ];

  static readonly CONSTANTS: any = {
    TRANSACTION_YEARS: 2,
    CHARGING_MINUTES: 80,
    IDLE_MINUTES: 40,
    ENERGY_PER_MINUTE: 150,
    INTERVAL_METER_VALUES: 10
  };

  private tenantContext: TenantContext;
  private chargingStations: any[] = [];

  constructor(tenantContext: TenantContext) {
    this.tenantContext = tenantContext;
  }

  public async createTestData(siteName, siteAreaName) {
    let firstYear = 0;
    const siteContext = this.tenantContext.getSiteContext(siteName);
    const siteAreaContext = siteContext.getSiteAreaContext(siteAreaName);
    this.chargingStations = siteAreaContext.getChargingStations();
//       for (const cs of StatisticsContext.CHARGING_STATIONS) {
//      this.chargingStations.push(siteAreaContext.getChargingStationContext(cs));
//    }
    const users = Array.from(StatisticsContext.USERS, (user) => {
      return this.tenantContext.getUserContext(user);
    });

    const startYear = new Date().getFullYear();
    for (let yr = 0; yr < StatisticsContext.CONSTANTS.TRANSACTION_YEARS; yr++) {
      firstYear = startYear - yr;

      let startTime = moment().year(firstYear).startOf('year').add({ hours: 12 });
      for (const chargingStation of this.chargingStations) {
        for (const user of users) {
          startTime = startTime.clone().add(1, 'days');
          let response = await chargingStation.startTransaction(1, user.tagIDs[0], 0, startTime);
          const transactionId = response.data.transactionId;

          for (let m = 1; m < StatisticsContext.CONSTANTS.CHARGING_MINUTES + StatisticsContext.CONSTANTS.IDLE_MINUTES; m++) {

            if (m % StatisticsContext.CONSTANTS.INTERVAL_METER_VALUES === 0) {
              const meterTime = startTime.clone().add(m, 'minutes');
              if (m > StatisticsContext.CONSTANTS.CHARGING_MINUTES) {
                response = await chargingStation.sendConsumptionMeterValue(1, transactionId, StatisticsContext.CONSTANTS.ENERGY_PER_MINUTE * StatisticsContext.CONSTANTS.CHARGING_MINUTES, meterTime);
              } else {
                response = await chargingStation.sendConsumptionMeterValue(1, transactionId, StatisticsContext.CONSTANTS.ENERGY_PER_MINUTE * m, meterTime);
              }
            }
          }
          const endTime = startTime.clone().add(StatisticsContext.CONSTANTS.CHARGING_MINUTES + StatisticsContext.CONSTANTS.IDLE_MINUTES, 'minutes');
          response = await chargingStation.stopTransaction(transactionId, user.tagIDs[0], StatisticsContext.CONSTANTS.ENERGY_PER_MINUTE * StatisticsContext.CONSTANTS.CHARGING_MINUTES, endTime);
        }
      }
    }
    await this.tenantContext.close();
    return firstYear;
  }

  public async deleteTestData() {
    if (Array.isArray(this.chargingStations)) {
      for (const chargingStation of this.chargingStations) {
        await chargingStation.cleanUpCreatedData();
      }
    }
  }

}
