import ChargingStation, { Connector } from '../../types/ChargingStation';
import Tenant, { TenantComponents } from '../../types/Tenant';

import BackendError from '../../exception/BackendError';
import CpoOICPClient from '../../client/oicp/CpoOICPClient';
import LockingHelper from '../../locking/LockingHelper';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import LoggingHelper from '../../utils/LoggingHelper';
import OICPClientFactory from '../../client/oicp/OICPClientFactory';
import { OICPRole } from '../../types/oicp/OICPRole';
import OICPUtils from './OICPUtils';
import { ServerAction } from '../../types/Server';
import SiteArea from '../../types/SiteArea';
import Transaction from '../../types/Transaction';
import User from '../../types/User';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'OICPFacade';

export default class OICPFacade {
  public static async processStartTransaction(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation,
      siteArea: SiteArea, user: User, action: ServerAction): Promise<void> {
    if (!Utils.isTenantComponentActive(tenant, TenantComponents.OICP) ||
        !chargingStation.issuer || !chargingStation.public || !siteArea.accessControl) {
      return;
    }
    // Get OICP CPO client
    const oicpClient = await OICPFacade.checkAndGetOICPCpoClient(tenant, transaction, user, action);
    // Get the Session ID and Identification from (remote) authorization stored in Charging Station
    let authorization = OICPUtils.getOICPIdentificationFromRemoteAuthorization(
      chargingStation, transaction.connectorId, ServerAction.OCPP_START_TRANSACTION);
    if (!authorization) {
      // Get the Session ID and Identification from OCPP Authorize message
      authorization = await OICPUtils.getOICPIdentificationFromAuthorization(tenant, transaction);
    }
    if (!authorization) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.OICP_PUSH_SESSIONS,
        message: 'No Authorization found, OICP Session not started',
        module: MODULE_NAME, method: 'processOICPTransaction',
      });
    }
    await oicpClient.startSession(chargingStation, transaction, authorization.sessionId, authorization.identification);
  }

  public static async processUpdateTransaction(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation,
      siteArea: SiteArea, user: User, action: ServerAction): Promise<void> {
    if (!Utils.isTenantComponentActive(tenant, TenantComponents.OICP) ||
        !chargingStation.issuer || !chargingStation.public || !siteArea.accessControl) {
      return;
    }
    try {
      // Get OICP CPO client
      const oicpClient = await OICPFacade.checkAndGetOICPCpoClient(
        tenant, transaction, user, action);
      // Update OICP Session
      await oicpClient.updateSession(transaction);
    } catch (error) {
      await Logging.logWarning({
        ...LoggingHelper.getTransactionProperties(transaction),
        tenantID: tenant.id,
        action, module: MODULE_NAME, method: 'processUpdateTransaction',
        user: transaction.userID,
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} Cannot process OICP Update Transaction: ${error.message as string}`,
        detailedMessages: { error: error.stack }
      });
    }
  }

  public static async processStopTransaction(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation,
      siteArea: SiteArea, user: User, action: ServerAction): Promise<void> {
    if (!Utils.isTenantComponentActive(tenant, TenantComponents.OICP) ||
        !chargingStation.issuer || !chargingStation.public || !siteArea.accessControl) {
      return;
    }
    // Get OICP CPO client
    const oicpClient = await OICPFacade.checkAndGetOICPCpoClient(
      tenant, transaction, user, action);
    // Stop OICP Session
    await oicpClient.stopSession(transaction);
  }

  public static async processEndTransaction(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation,
      siteArea: SiteArea, user: User, action: ServerAction): Promise<boolean> {
    if (!Utils.isTenantComponentActive(tenant, TenantComponents.OICP) ||
        !chargingStation.issuer || !chargingStation.public || !siteArea.accessControl) {
      return false;
    }
    // Get OICP CPO client
    const oicpClient = await OICPFacade.checkAndGetOICPCpoClient(
      tenant, transaction, user, action);
    // Send OICP CDR
    await oicpClient.pushCdr(transaction);
  }

  public static async checkAndSendTransactionCdr(tenant: Tenant, transaction: Transaction,
      chargingStation: ChargingStation, siteArea: SiteArea, action: ServerAction): Promise<boolean> {
    let oicpCdrSent = false;
    // CDR not already pushed
    if (Utils.isTenantComponentActive(tenant, TenantComponents.OICP) &&
        transaction.oicpData?.session && !transaction.oicpData.cdr?.SessionID) {
      // Get the lock
      const OICPLock = await LockingHelper.acquireOICPPushCdrLock(tenant.id, transaction.id);
      if (OICPLock) {
        try {
          // Roaming
          oicpCdrSent = await OICPFacade.processEndTransaction(
            tenant, transaction, chargingStation, siteArea, transaction.user, action);
        } finally {
          // Release the lock
          await LockingManager.release(OICPLock);
        }
      }
    }
    return oicpCdrSent;
  }

  public static async updateConnectorStatus(tenant: Tenant, chargingStation: ChargingStation, connector: Connector): Promise<void> {
    try {
      if (Utils.isTenantComponentActive(tenant, TenantComponents.OICP) &&
          chargingStation.issuer && chargingStation.public) {
        const oicpClient = await OICPClientFactory.getAvailableOicpClient(tenant, OICPRole.CPO) as CpoOICPClient;
        // Patch status
        if (oicpClient) {
          await oicpClient.updateEVSEStatus(chargingStation, connector);
        }
      }
    } catch (error) {
      await Logging.logError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        module: MODULE_NAME, method: 'updateConnectorStatus',
        action: ServerAction.OICP_UPDATE_EVSE_STATUS,
        message: `${Utils.buildConnectorInfo(connector.connectorId)} An error occurred while patching the connector's Status`,
        detailedMessages: { error: error.stack, connector, chargingStation }
      });
    }
  }

  private static async checkAndGetOICPCpoClient(tenant: Tenant, transaction: Transaction,
      user: User, action: ServerAction): Promise<CpoOICPClient> {
    // Check User
    if (!user) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action, module: MODULE_NAME, method: 'checkAndGetOICPCpoClient',
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} User is mandatory`
      });
    }
    if (user.issuer) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action, module: MODULE_NAME, method: 'checkAndGetOICPCpoClient',
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} User does not belong to the local organization`
      });
    }
    // Get the client
    const oicpClient = await OICPClientFactory.getAvailableOicpClient(tenant, OICPRole.CPO) as CpoOICPClient;
    if (!oicpClient) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action, module: MODULE_NAME, method: 'checkAndGetOICPCpoClient',
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} OICP component requires at least one CPO endpoint to start a Transaction`
      });
    }
    return oicpClient;
  }
}
