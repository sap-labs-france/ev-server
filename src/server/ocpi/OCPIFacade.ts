import ChargingStation, { Connector } from '../../types/ChargingStation';
import Tenant, { TenantComponents } from '../../types/Tenant';

import BackendError from '../../exception/BackendError';
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
import Transaction from '../../types/Transaction';
import User from '../../types/User';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'OCPIFacade';

export default class OCPIFacade {
  public static async processStartTransaction(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation,
      siteArea: SiteArea, tag: Tag, user: User, action: ServerAction): Promise<void> {
    if (!Utils.isTenantComponentActive(tenant, TenantComponents.OCPI) ||
        !chargingStation.issuer || !chargingStation.public || !siteArea.accessControl || user.issuer) {
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
    if (!Utils.isTenantComponentActive(tenant, TenantComponents.OCPI) ||
        !chargingStation.issuer || !chargingStation.public || !siteArea.accessControl || user.issuer) {
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
    if (!Utils.isTenantComponentActive(tenant, TenantComponents.OCPI) ||
        !chargingStation.issuer || !chargingStation.public || !siteArea.accessControl || user.issuer) {
      return;
    }
    // Get OCPI CPO client
    const ocpiClient = await OCPIFacade.checkAndGetOcpiCpoClient(
      tenant, transaction, user, action);
    // Stop OCPI Session
    await ocpiClient.stopSession(transaction);
  }

  public static async processEndTransaction(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation,
      siteArea: SiteArea, user: User, action: ServerAction): Promise<boolean> {
    if (!Utils.isTenantComponentActive(tenant, TenantComponents.OCPI) ||
        !chargingStation.issuer || !chargingStation.public || !siteArea.accessControl || user.issuer) {
      return false;
    }
    // Get OCPI CPO client
    const ocpiClient = await OCPIFacade.checkAndGetOcpiCpoClient(
      tenant, transaction, user, action);
    // Send OCPI CDR
    return ocpiClient.pushCdr(transaction);
  }

  public static async checkAndSendTransactionCdr(tenant: Tenant, transaction: Transaction,
      chargingStation: ChargingStation, siteArea: SiteArea, action: ServerAction): Promise<boolean> {
    // CDR not already pushed
    if (Utils.isTenantComponentActive(tenant, TenantComponents.OCPI) &&
        transaction.ocpiData?.session && !transaction.ocpiData.cdr?.id) {
      // Get the lock
      const ocpiLock = await LockingHelper.acquireOCPIPushCdrLock(tenant.id, transaction.id);
      if (ocpiLock) {
        try {
          // Roaming
          return OCPIFacade.processEndTransaction(
            tenant, transaction, chargingStation, siteArea, transaction.user, action);
        } finally {
          // Release the lock
          await LockingManager.release(ocpiLock);
        }
      }
    }
  }

  public static async updateConnectorStatus(tenant: Tenant, chargingStation: ChargingStation, connector: Connector): Promise<void> {
    try {
      if (Utils.isTenantComponentActive(tenant, TenantComponents.OCPI) &&
          chargingStation.issuer && chargingStation.public) {
        const ocpiClient = await OCPIClientFactory.getAvailableOcpiClient(tenant, OCPIRole.CPO) as CpoOCPIClient;
        // Patch status
        if (ocpiClient) {
          await ocpiClient.patchChargingStationConnectorStatus(chargingStation, connector);
        }
      }
    } catch (error) {
      await Logging.logError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        module: MODULE_NAME, method: 'updateConnectorStatus',
        action: ServerAction.OCPI_CPO_UPDATE_STATUS,
        message: `${Utils.buildConnectorInfo(connector.connectorId)} An error occurred while patching the connector's Status`,
        detailedMessages: { error: error.stack, connector, chargingStation }
      });
    }
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
