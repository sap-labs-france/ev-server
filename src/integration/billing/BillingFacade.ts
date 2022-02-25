import BackendError from '../../exception/BackendError';
import { BillingDataTransactionStop } from '../../types/Billing';
import BillingFactory from './BillingFactory';
import ChargingStation from '../../types/ChargingStation';
import Logging from '../../utils/Logging';
import LoggingHelper from '../../utils/LoggingHelper';
import { ServerAction } from '../../types/Server';
import SiteArea from '../../types/SiteArea';
import Tenant from '../../types/Tenant';
import Transaction from '../../types/Transaction';
import User from '../../types/User';

const MODULE_NAME = 'BillingFacade';

export default class BillingFacade {
  public static async processStartTransaction(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation, siteArea: SiteArea, user: User): Promise<void> {
    if (!user?.issuer) {
      return;
    }
    const billingImpl = await BillingFactory.getBillingImpl(tenant);
    if (billingImpl) {
      try {
        let withBillingActive = false;
        // Check parameters' consistency
        if (billingImpl.checkStartTransaction(transaction, chargingStation, siteArea)) {
          // Delegate to the concrete implementation
          const billingDataTransactionStart = await billingImpl.startTransaction(transaction);
          withBillingActive = billingDataTransactionStart.withBillingActive;
        }
        // Update Billing Data
        transaction.billingData = {
          withBillingActive, // false when access control is OFF or when the user has free access
          lastUpdate: new Date()
        };
      } catch (error) {
        const message = `Billing - Start Transaction failed with Transaction ID '${transaction.id}'`;
        await Logging.logError({
          ...LoggingHelper.getTransactionProperties(transaction),
          tenantID: tenant.id,
          action: ServerAction.BILLING_TRANSACTION,
          module: MODULE_NAME, method: 'processStartTransaction',
          message, detailedMessages: { error: error.stack }
        });
        // Prevent from starting a transaction when Billing prerequisites are not met
        throw new BackendError({
          ...LoggingHelper.getTransactionProperties(transaction),
          action: ServerAction.BILLING_TRANSACTION,
          module: MODULE_NAME, method: 'processStartTransaction',
          message, detailedMessages: { error: error.stack, transaction }
        });
      }
    }
  }

  public static async processUpdateTransaction(tenant: Tenant, transaction: Transaction, user: User): Promise<void> {
    if (!user?.issuer) {
      return;
    }
    const billingImpl = await BillingFactory.getBillingImpl(tenant);
    if (billingImpl) {
      try {
        await billingImpl.updateTransaction(transaction);
        // Update Billing Data
        if (transaction.billingData) {
          transaction.billingData.lastUpdate = new Date();
        }
      } catch (error) {
        const message = `Billing - Update Transaction failed with Transaction ID '${transaction.id}'`;
        await Logging.logError({
          ...LoggingHelper.getTransactionProperties(transaction),
          tenantID: tenant.id,
          action: ServerAction.BILLING_TRANSACTION,
          module: MODULE_NAME, method: 'processUpdateTransaction',
          message, detailedMessages: { error: error.stack, transaction }
        });
      }
    }
  }

  public static async processStopTransaction(tenant: Tenant, transaction: Transaction, user: User): Promise<void> {
    if (!user?.issuer) {
      return;
    }
    const billingImpl = await BillingFactory.getBillingImpl(tenant);
    if (billingImpl) {
      try {
        const billingDataStop: BillingDataTransactionStop = await billingImpl.stopTransaction(transaction);
        // Update Billing Data
        if (transaction.billingData) {
          transaction.billingData.stop = billingDataStop;
          transaction.billingData.lastUpdate = new Date();
        }
      } catch (error) {
        const message = `Billing - Stop Transaction failed with Transaction ID '${transaction.id}'`;
        await Logging.logError({
          ...LoggingHelper.getTransactionProperties(transaction),
          tenantID: tenant.id,
          action: ServerAction.BILLING_TRANSACTION,
          module: MODULE_NAME, method: 'processStopTransaction',
          message, detailedMessages: { error: error.stack, transaction }
        });
      }
    }
  }

  public static async processEndTransaction(tenant: Tenant, transaction: Transaction, user: User): Promise<void> {
    if (!user?.issuer) {
      return;
    }
    const billingImpl = await BillingFactory.getBillingImpl(tenant);
    if (billingImpl) {
      try {
        // Delegate
        const billingDataStop: BillingDataTransactionStop = await billingImpl.endTransaction(transaction);
        // Update
        if (transaction.billingData) {
          transaction.billingData.stop = billingDataStop;
          transaction.billingData.lastUpdate = new Date();
        }
      } catch (error) {
        const message = `Billing - End Transaction failed with Transaction ID '${transaction.id}'`;
        await Logging.logError({
          ...LoggingHelper.getTransactionProperties(transaction),
          tenantID: tenant.id,
          action: ServerAction.BILLING_TRANSACTION,
          module: MODULE_NAME, method: 'processEndTransaction',
          message, detailedMessages: { error: error.stack, transaction }
        });
      }
    }
  }
}
