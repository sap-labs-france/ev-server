import BackendError from '../../exception/BackendError';
import ChargingStation from '../../types/ChargingStation';
import CpoOCPIClient from '../../client/ocpi/CpoOCPIClient';
import LockingHelper from '../../locking/LockingHelper';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import LoggingHelper from '../../utils/LoggingHelper';
import OCPIClientFactory from '../../client/ocpi/OCPIClientFactory';
import { OCPIRole } from '../../types/ocpi/OCPIRole';
import { ServerAction } from '../../types/Server';
import SiteArea from '../../types/SiteArea';
import Tag from '../../types/Tag';
import Tenant from '../../types/Tenant';
import Transaction from '../../types/Transaction';
import User from '../../types/User';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'OCPIFacade';

export default class OCPIFacade {
  public static async processStartTransaction(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation,
      siteArea: SiteArea, tag: Tag, user: User, action: ServerAction): Promise<void> {
    if (!chargingStation.issuer || !chargingStation.public || !siteArea.accessControl) {
      return;
    }
    // Get OCPI CPO client
    const ocpiClient = await OCPIFacade.checkAndGetOcpiCpoClient(tenant, transaction, user, action);
    // Check Authorization
    if (!transaction.authorizationID) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action: action,
        module: MODULE_NAME, method: 'processStartTransaction',
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} Tag ID '${transaction.tagID}' is not authorized`
      });
    }
    await ocpiClient.startSession(tag.ocpiToken, chargingStation, transaction);
  }

  public static async processUpdateTransaction(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation,
      siteArea: SiteArea, user: User, action: ServerAction): Promise<void> {
    if (!chargingStation.issuer || !chargingStation.public || !siteArea.accessControl) {
      return;
    }
    try {
      // Get OCPI CPO client
      const ocpiClient = await OCPIFacade.checkAndGetOcpiCpoClient(
        tenant, transaction, user, action);
      // Update OCPI Session
      await ocpiClient.updateSession(transaction);
    } catch (error) {
      await Logging.logWarning({
        ...LoggingHelper.getTransactionProperties(transaction),
        tenantID: tenant.id,
        action, module: MODULE_NAME, method: 'processUpdateTransaction',
        user: transaction.userID,
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} Cannot process OCPI Update Transaction: ${error.message as string}`,
        detailedMessages: { error: error.stack }
      });
    }
  }

  public static async processStopTransaction(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation,
      siteArea: SiteArea, user: User, action: ServerAction): Promise<void> {
    if (!chargingStation.issuer || !chargingStation.public || !siteArea.accessControl) {
      return;
    }
    // Get OCPI CPO client
    const ocpiClient = await OCPIFacade.checkAndGetOcpiCpoClient(
      tenant, transaction, user, action);
    // Stop OCPI Session
    // await ocpiClient.stopSession(transaction);
  }

  public static async processEndTransaction(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation,
      siteArea: SiteArea, user: User, action: ServerAction): Promise<void> {
    if (!chargingStation.issuer || !chargingStation.public || !siteArea.accessControl) {
      return;
    }
    // Get OCPI CPO client
    const ocpiClient = await OCPIFacade.checkAndGetOcpiCpoClient(
      tenant, transaction, user, action);
    // Send OCPI CDR
    await ocpiClient.postCdr(transaction);
  }

  public static async checkAndSendTransactionCdr(tenant: Tenant, transaction: Transaction,
      chargingStation: ChargingStation, siteArea: SiteArea, action: ServerAction): Promise<boolean> {
    let ocpiCdrSent = false;
    // CDR not already pushed
    if (transaction.ocpiData?.session && !transaction.ocpiData.cdr?.id) {
      // Get the lock
      const ocpiLock = await LockingHelper.acquireOCPIPushCdrLock(tenant.id, transaction.id);
      if (ocpiLock) {
        try {
          // Roaming
          ocpiCdrSent = true;
          await OCPIFacade.processEndTransaction(tenant, transaction, chargingStation, siteArea, transaction.user, action);
        } finally {
          // Release the lock
          await LockingManager.release(ocpiLock);
        }
      }
    }
    return ocpiCdrSent;
  }

  private static async checkAndGetOcpiCpoClient(tenant: Tenant, transaction: Transaction,
      user: User, action: ServerAction): Promise<CpoOCPIClient> {
    // Check User
    if (!user) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action, module: MODULE_NAME, method: 'checkAndGetOcpiCpoClient',
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} User is mandatory`
      });
    }
    if (user.issuer) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action, module: MODULE_NAME, method: 'checkAndGetOcpiCpoClient',
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} User does not belong to the local organization`
      });
    }
    const ocpiClient = await OCPIClientFactory.getAvailableOcpiClient(tenant, OCPIRole.CPO) as CpoOCPIClient;
    if (!ocpiClient) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action, module: MODULE_NAME, method: 'checkAndGetOcpiCpoClient',
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} OCPI component requires at least one CPO endpoint to start a Transaction`
      });
    }
    return ocpiClient;
  }
}
