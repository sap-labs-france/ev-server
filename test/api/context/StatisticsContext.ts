import chai, { expect } from 'chai';

import CentralServerService from '../client/CentralServerService';
import ChargingStationContext from './ChargingStationContext';
import ContextDefinition from './ContextDefinition';
import { RefundStatus } from '../../../src/types/Refund';
import TenantContext from './TenantContext';
import TransactionStorage from '../../../src/storage/mongodb/TransactionStorage';
import User from '../../../src/types/User';
import chaiSubset from 'chai-subset';
import { faker } from '@faker-js/faker';
import moment from 'moment';
import responseHelper from '../../helpers/responseHelper';

chai.use(chaiSubset);
chai.use(responseHelper);

export default class StatisticsContext {

  static readonly USERS: any = [
    ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN,
    ContextDefinition.USER_CONTEXTS.BASIC_USER
  ];

  static readonly CONSTANTS: any = {
    TRANSACTION_YEARS: 2,
    CHARGING_MINUTES: 80,
    IDLE_MINUTES: 40,
    ENERGY_PER_MINUTE: 150,
    INTERVAL_METER_VALUES: 10
  };

  public transactionUser: User;
  public transactionUserService: CentralServerService;

  private tenantContext: TenantContext;
  private chargingStations: ChargingStationContext[] = [];

  constructor(tenantContext: TenantContext) {
    this.tenantContext = tenantContext;
  }

  public async createTestData(siteName, siteAreaName): Promise<number> {
    let firstYear = 0;
    const siteContext = this.tenantContext.getSiteContext(siteName);
    const siteAreaContext = siteContext.getSiteAreaContext(siteAreaName);
    this.chargingStations = siteAreaContext.getChargingStations();
    const users = Array.from(StatisticsContext.USERS, (user) => this.tenantContext.getUserContext(user));
    const startYear = new Date().getFullYear();
    for (let yr = 0; yr < StatisticsContext.CONSTANTS.TRANSACTION_YEARS; yr++) {
      firstYear = startYear - yr;
      let startTime = moment().year(firstYear).startOf('year').add({ hours: 12 });
      for (const chargingStation of this.chargingStations) {
        for (const user of users) {
          this.setUser(user);
          startTime = startTime.clone().add(1, 'days');
          const startTransactionResponse = await chargingStation.startTransaction(1, user.tags[0].id, 0, startTime.toDate());
          // eslint-disable-next-line @typescript-eslint/unbound-method
          expect(startTransactionResponse).to.be.transactionValid;
          const transactionId = startTransactionResponse.transactionId;
          for (let m = 1; m < StatisticsContext.CONSTANTS.CHARGING_MINUTES + StatisticsContext.CONSTANTS.IDLE_MINUTES; m++) {
            if (m % StatisticsContext.CONSTANTS.INTERVAL_METER_VALUES === 0) {
              const meterTime = startTime.clone().add(m, 'minutes');
              if (m > StatisticsContext.CONSTANTS.CHARGING_MINUTES) {
                await chargingStation.sendConsumptionMeterValue(1, transactionId, meterTime.toDate(),
                  { energyActiveImportMeterValue: StatisticsContext.CONSTANTS.ENERGY_PER_MINUTE * StatisticsContext.CONSTANTS.CHARGING_MINUTES });
              } else {
                await chargingStation.sendConsumptionMeterValue(1, transactionId, meterTime.toDate(),
                  { energyActiveImportMeterValue: StatisticsContext.CONSTANTS.ENERGY_PER_MINUTE * m });
              }
            }
          }
          const endTime = startTime.clone().add(StatisticsContext.CONSTANTS.CHARGING_MINUTES + StatisticsContext.CONSTANTS.IDLE_MINUTES, 'minutes');
          const stopTransactionResponse = await chargingStation.stopTransaction(transactionId, user.tags[0].id,
            StatisticsContext.CONSTANTS.ENERGY_PER_MINUTE * StatisticsContext.CONSTANTS.CHARGING_MINUTES, endTime.toDate());
          expect(stopTransactionResponse).to.be.transactionStatus('Accepted');
          // Add a fake refund data to transaction
          await this.generateStaticRefundData(transactionId);
          await this.generateStaticRefundData(transactionId);
        }
      }
    }
    return firstYear;
  }

  /**
   * Add a fake refund data to a given transaction
   *
   * @param transactionId The id of the transaction
   */
  public async generateStaticRefundData(transactionId: number) {
    const transaction = await TransactionStorage.getTransaction(this.tenantContext.getTenant(), transactionId);
    transaction.refundData = {
      refundId: faker.random.alphaNumeric(32),
      refundedAt: new Date(),
      reportId: faker.random.alphaNumeric(20),
      status: RefundStatus.APPROVED,
    };
    await TransactionStorage.saveTransaction(this.tenantContext.getTenant(), transaction);
    console.log(`${this.tenantContext.getTenant().id} (${this.tenantContext.getTenant().name}) - Updated transaction '${transaction.id}' with refund data`);
  }

  public async deleteTestData(): Promise<void> {
    if (Array.isArray(this.chargingStations)) {
      for (const chargingStation of this.chargingStations) {
        await chargingStation.cleanUpCreatedData();
      }
    }
  }

  public setUser(userContext): void {
    expect(userContext).to.exist;
    this.transactionUser = userContext;
    this.transactionUserService = new CentralServerService(this.tenantContext.getTenant().subdomain, this.transactionUser);
  }

}
