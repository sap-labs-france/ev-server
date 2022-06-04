// Hubject lets you provide the endpoint in the HBS portal.
// Endpoint for eRoamingAuthorizeRemoteStart and eRoamingAuthorizeRemoteStop from the eMSP

import ChargingStation, { Connector } from '../../../../types/ChargingStation';
import { NextFunction, Request, Response } from 'express';
import { OCPPRemoteStartStopStatus, OCPPRemoteStartTransactionResponse, OCPPRemoteStopTransactionResponse } from '../../../../types/ocpp/OCPPClient';
import { OICPAuthorizeRemoteStartCpoReceive, OICPAuthorizeRemoteStopCpoReceive } from '../../../../types/oicp/OICPAuthorize';

import AbstractEndpoint from '../AbstractEndpoint';
import AbstractOICPService from '../../AbstractOICPService';
import { ChargePointStatus } from '../../../../types/ocpp/OCPPServer';
import ChargingStationClientFactory from '../../../../client/ocpp/ChargingStationClientFactory';
import ChargingStationStorage from '../../../../storage/mongodb/ChargingStationStorage';
import Logging from '../../../../utils/Logging';
import LoggingHelper from '../../../../utils/LoggingHelper';
import { OICPAcknowledgment } from '../../../../types/oicp/OICPAcknowledgment';
import { OICPRemoteActionType } from '../../../../types/oicp/OICPRemoteActionType';
import { OICPSession } from '../../../../types/oicp/OICPSession';
import OICPUtils from '../../OICPUtils';
import OICPValidator from '../../validator/OICPValidator';
import { ServerAction } from '../../../../types/Server';
import Tenant from '../../../../types/Tenant';
import TransactionStorage from '../../../../storage/mongodb/TransactionStorage';
import moment from 'moment';

const EP_IDENTIFIER = 'authorize-remote';
const MODULE_NAME = 'CPORemoteAuthorizationsEndpoint';

export default class CPORemoteAuthorizationsEndpoint extends AbstractEndpoint {

  // Create OICP Service
  public constructor(oicpService: AbstractOICPService) {
    super(oicpService, EP_IDENTIFIER);
  }

  public async process(req: Request, res: Response, next: NextFunction, tenant: Tenant): Promise<OICPAcknowledgment> {
    switch (req.method) {
      case 'POST':
        // Select action from URL parameters
        // eslint-disable-next-line no-case-declarations
        const endpointAction = req.params.endpointAction.toLowerCase();
        switch (endpointAction) {
          case OICPRemoteActionType.REMOTE_START:
            return this.authorizeRemoteStart(req, res, next, tenant);
          case OICPRemoteActionType.REMOTE_STOP:
            return this.authorizeRemoteStop(req, res, next, tenant);
        }
    }
  }

  private async authorizeRemoteStart(req: Request, res: Response, next: NextFunction, tenant: Tenant): Promise<OICPAcknowledgment> {
    const authorizeRemoteStart = req.body as OICPAuthorizeRemoteStartCpoReceive;
    // Check props
    OICPValidator.getInstance().validateRemoteStart(authorizeRemoteStart);
    const evseID = authorizeRemoteStart.EvseID;
    const session = {} as Partial<OICPSession>;
    session.id = authorizeRemoteStart.SessionID;
    session.providerID = authorizeRemoteStart.ProviderID;
    session.identification = authorizeRemoteStart.Identification;
    const chargingStationConnector = await OICPUtils.getChargingStationConnectorFromEvseID(tenant, evseID);
    const connector = chargingStationConnector.connector;
    const chargingStation = chargingStationConnector.chargingStation;
    if (!chargingStation) {
      await Logging.logError({
        tenantID: tenant.id,
        action: ServerAction.OICP_AUTHORIZE_REMOTE_START,
        message: `Charging Station ID '${authorizeRemoteStart.EvseID}' not found`,
        module: MODULE_NAME, method: 'authorizeRemoteStart'
      });
      return OICPUtils.noSuccess(session, `EVSE for EvseID '${authorizeRemoteStart.EvseID}' not found`);
    }
    if (!connector) {
      await Logging.logError({
        tenantID: tenant.id,
        action: ServerAction.OICP_AUTHORIZE_REMOTE_START,
        message: `Connector for Charging Station ID '${authorizeRemoteStart.EvseID}' not found`,
        module: MODULE_NAME, method: 'authorizeRemoteStart'
      });
      return OICPUtils.noSuccess(session, `EVSE for EvseID '${authorizeRemoteStart.EvseID}' not found`);
    }
    if (!chargingStation.issuer || !chargingStation.public) {
      await Logging.logError({
        tenantID: tenant.id,
        action: ServerAction.OICP_AUTHORIZE_REMOTE_START,
        message: `Charging Station ID '${authorizeRemoteStart.EvseID}' cannot be used with OICP`,
        module: MODULE_NAME, method: 'authorizeRemoteStart'
      });
      return OICPUtils.noSuccess(session, `EVSE '${authorizeRemoteStart.EvseID}' cannot be used with OICP`);
    }
    if (connector.status !== ChargePointStatus.AVAILABLE && connector.status !== ChargePointStatus.PREPARING) {
      await Logging.logError({
        tenantID: tenant.id,
        action: ServerAction.OICP_AUTHORIZE_REMOTE_START,
        message: `Charging Station ID '${authorizeRemoteStart.EvseID}' is not available`,
        module: MODULE_NAME, method: 'authorizeRemoteStart'
      });
      return OICPUtils.noSuccess(session, `EVSE '${authorizeRemoteStart.EvseID}' is not available`);
    }
    if (!chargingStation.remoteAuthorizations) {
      chargingStation.remoteAuthorizations = [];
    }
    // Check if there is already a authorization for this charging station
    const existingAuthorization = chargingStation.remoteAuthorizations.find(
      (authorization) => authorization.connectorId === connector.connectorId);
    if (existingAuthorization) {
      // Check if authorization is from same user or different user
      if (existingAuthorization?.oicpIdentification?.RemoteIdentification?.EvcoID !== authorizeRemoteStart.Identification?.RemoteIdentification?.EvcoID) {
        // Check if authorization of different user is valid
        if (OICPUtils.isAuthorizationValid(existingAuthorization.timestamp)) {
          // Current remote authorization fails due to valid remote authorization of different user
          await Logging.logDebug({
            ...LoggingHelper.getChargingStationProperties(chargingStation),
            tenantID: tenant.id,
            action: ServerAction.OICP_AUTHORIZE_REMOTE_START,
            message: `An existing remote authorization exists for Charging Station '${chargingStation.id}' and Connector ID ${connector.connectorId}`,
            module: MODULE_NAME, method: 'authorizeRemoteStart'
          });
          return OICPUtils.noSuccess(session, `An existing remote authorization exists for Charging Station '${chargingStation.id}' and Connector ID ${connector.connectorId}`);
        }
      }
      existingAuthorization.timestamp = moment().toDate();
      // No authorization ID available
      // Use sessionID instead
      existingAuthorization.id = authorizeRemoteStart.SessionID;
      existingAuthorization.tagId = OICPUtils.convertOICPIdentification2TagID(authorizeRemoteStart.Identification);
      existingAuthorization.oicpIdentification = authorizeRemoteStart.Identification;
    } else {
      chargingStation.remoteAuthorizations.push(
        {
          id: authorizeRemoteStart.SessionID,
          connectorId: connector.connectorId,
          timestamp: new Date(),
          tagId: OICPUtils.convertOICPIdentification2TagID(authorizeRemoteStart.Identification),
          oicpIdentification: authorizeRemoteStart.Identification
        }
      );
    }
    // Save Auth
    await ChargingStationStorage.saveChargingStationRemoteAuthorizations(
      tenant, chargingStation.id, chargingStation.remoteAuthorizations);
    // Start the transaction
    const result = await this.remoteStartTransaction(tenant, chargingStation, connector, authorizeRemoteStart);
    if (result?.status === OCPPRemoteStartStopStatus.ACCEPTED) {
      return OICPUtils.success(session);
    }
    return OICPUtils.noSuccess(session, 'Remote Start rejected by Charging Station');
  }

  private async authorizeRemoteStop(req: Request, res: Response, next: NextFunction, tenant: Tenant): Promise<OICPAcknowledgment> {
    const authorizeRemoteStop = req.body as OICPAuthorizeRemoteStopCpoReceive;
    // Check props
    OICPValidator.getInstance().validateRemoteStop(authorizeRemoteStop);
    const session = {} as Partial<OICPSession>;
    session.id = authorizeRemoteStop.SessionID;
    session.providerID = authorizeRemoteStop.ProviderID;
    const transaction = await TransactionStorage.getOICPTransactionBySessionID(tenant, authorizeRemoteStop.SessionID);
    if (!transaction) {
      await Logging.logError({
        tenantID: tenant.id,
        action: ServerAction.OICP_AUTHORIZE_REMOTE_STOP,
        message: `OICP Transaction ID '${authorizeRemoteStop.SessionID}' does not exists`,
        module: MODULE_NAME, method: 'authorizeRemoteStop'
      });
      return OICPUtils.noSuccess(session, `Transaction with OICP Transaction ID '${authorizeRemoteStop.SessionID}' does not exists`);
    }
    if (!transaction.issuer) {
      await Logging.logError({
        tenantID: tenant.id,
        action: ServerAction.OICP_AUTHORIZE_REMOTE_STOP,
        message: `OICP Transaction ID '${authorizeRemoteStop.SessionID}' has been issued locally`,
        module: MODULE_NAME, method: 'authorizeRemoteStop'
      });
      return OICPUtils.noSuccess(session, `Transaction with OICP Transaction ID '${authorizeRemoteStop.SessionID}' has been issued locally`);
    }
    if (transaction.stop) {
      await Logging.logError({
        tenantID: tenant.id,
        action: ServerAction.OICP_AUTHORIZE_REMOTE_STOP,
        message: `OICP Transaction ID '${authorizeRemoteStop.SessionID}' is already stopped`,
        module: MODULE_NAME, method: 'authorizeRemoteStop'
      });
      return OICPUtils.noSuccess(session, `Transaction with OICP Transaction ID '${authorizeRemoteStop.SessionID}' is already stopped`);
    }
    const chargingStation = await ChargingStationStorage.getChargingStation(tenant, transaction.chargeBoxID);
    if (!chargingStation) {
      await Logging.logError({
        ...LoggingHelper.getTransactionProperties(transaction),
        tenantID: tenant.id,
        action: ServerAction.OICP_AUTHORIZE_REMOTE_STOP,
        message: `Charging Station '${transaction.chargeBoxID}' not found`,
        module: MODULE_NAME, method: 'authorizeRemoteStop'
      });
      return OICPUtils.noSuccess(session, `Charging Station '${transaction.chargeBoxID}' not found`);
    }
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    const result = await this.remoteStopTransaction(tenant, chargingStation, transaction.id);
    if (result?.status === OCPPRemoteStartStopStatus.ACCEPTED) {
      return OICPUtils.success(session);
    }
    return OICPUtils.noSuccess(session, 'Remote Stop rejected by Charging Station');
  }

  private async remoteStartTransaction(tenant: Tenant, chargingStation: ChargingStation,
      connector: Connector, authorizeRemoteStart: OICPAuthorizeRemoteStartCpoReceive): Promise<OCPPRemoteStartTransactionResponse> {
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenant, chargingStation);
    if (!chargingStationClient) {
      await Logging.logError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        action: ServerAction.OICP_AUTHORIZE_REMOTE_START,
        message: `Charging Station '${chargingStation.id}' not found`,
        module: MODULE_NAME, method: 'remoteStartTransaction'
      });
      return;
    }
    return chargingStationClient.remoteStartTransaction({
      connectorId: connector.connectorId,
      idTag: OICPUtils.convertOICPIdentification2TagID(authorizeRemoteStart.Identification)
    });
  }

  private async remoteStopTransaction(tenant: Tenant, chargingStation: ChargingStation, transactionId: number): Promise<OCPPRemoteStopTransactionResponse> {
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenant, chargingStation);
    if (!chargingStationClient) {
      await Logging.logError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        action: ServerAction.OICP_AUTHORIZE_REMOTE_STOP,
        message: `Charging Station '${chargingStation.id}' not found`,
        module: MODULE_NAME, method: 'remoteStopTransaction'
      });
      return;
    }
    return chargingStationClient.remoteStopTransaction({
      transactionId: transactionId
    });
  }
}
