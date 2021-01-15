import ChargingStation, { Connector, RemoteAuthorization } from '../../types/ChargingStation';
import { OICPDefaultTagId, OICPIdentification, OICPRFIDmifarefamilyIdentification, OICPSessionID } from '../../types/oicp/OICPIdentification';
import { OICPStatus, OICPStatusCode } from '../../types/oicp/OICPStatusCode';

import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import Constants from '../../utils/Constants';
import OCPPStorage from '../../storage/mongodb/OCPPStorage';
import { OICPAcknowledgment } from '../../types/oicp/OICPAcknowledgment';
import { OICPEvseID } from '../../types/oicp/OICPEvse';
import { OICPSession } from '../../types/oicp/OICPSession';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import Transaction from '../../types/Transaction';
import TransactionStorage from '../../storage/mongodb/TransactionStorage';
import moment from 'moment';

export default class OICPUtils {

  /**
   * Return OICP Success Body Response
   * @param {*} data
   */
  public static success(session: Partial<OICPSession>, data?: any): OICPAcknowledgment {
    const response = {} as OICPAcknowledgment;
    const statusCode = {} as OICPStatus;
    statusCode.Code = OICPStatusCode.Code000;
    response.StatusCode = statusCode;
    response.Result = true;
    response.EMPPartnerSessionID = session.empPartnerSessionID;
    response.SessionID = session.id;
    return response;
  }

  /**
   * Return OICP no success Body Response
   * @param {*} data
   */
  public static noSuccess(session: Partial<OICPSession>, data?: any): OICPAcknowledgment {
    const response = {} as OICPAcknowledgment;
    const status = {} as OICPStatus;
    status.Code = OICPStatusCode.Code022;
    status.Description = data;
    response.StatusCode = status;
    response.Result = false;
    response.EMPPartnerSessionID = session.empPartnerSessionID;
    response.SessionID = session.id;
    return response;
  }

  /**
   * Return OICP Error Body Response
   * @param {*} error
   */
  public static toErrorResponse(error: Error): OICPAcknowledgment {
    const response = {} as OICPAcknowledgment;
    const status = {} as OICPStatus;
    status.Code = OICPStatusCode.Code022;
    status.Description = error.message;
    response.StatusCode = status;
    response.Result = false;
    return response;
  }

  /**
   * Build evse_id from charging station
   * @param {*} countryCode the code of the CPO
   * @param {*} partyId the partyId of the CPO
   * @param {*} chargingStation the charging station used to build the evse ID
   * @param {*} connector the connector used to build the evse id
   */
  public static buildEvseID(countryCode: string, partyId: string, chargingStation: ChargingStation, connector?: Connector): string {
    let evseID = `${countryCode}*${partyId}*E${chargingStation.id}`;
    if (!connector) {
      for (const _connector of chargingStation.connectors) {
        if (_connector) {
          connector = _connector;
          break;
        }
      }
    }
    evseID = `${evseID}*${connector.connectorId}`;
    return evseID.replace(/[\W_]+/g, '*').toUpperCase();
  }

  public static breakUpEvseID(evseID: OICPEvseID): { countryCode: string, partyId: string, connectorId: string } {
    // Problem: it is not save to derive the chargingStationId from evseID because all characters that are not alphanumeric and underscores are replaced with '*'
    // also: evseId is set to upper case
    // see function buildEvseID()
    const evseIDComponents = evseID.split('*');
    const countryCode = evseIDComponents[0];
    const partyId = evseIDComponents[1];
    const connectorId = evseIDComponents[evseIDComponents.length - 1];
    return {
      countryCode: countryCode,
      partyId: partyId,
      connectorId: connectorId
    };
  }

  public static async getChargingStationConnectorFromEvseID(tenant: Tenant, evseID: OICPEvseID): Promise<{ chargingStation: ChargingStation, connector: Connector }> {
    // It is not save to derive charging station id from evseID
    const evseIDComponents = this.breakUpEvseID(evseID);
    const chargingStations = await ChargingStationStorage.getChargingStations(tenant.id, {
      issuer: true
    }, Constants.DB_PARAMS_MAX_LIMIT);
    let chargingStation: ChargingStation;
    let connector: Connector;
    if (chargingStations && chargingStations.result) {
      for (const cs of chargingStations.result) {
        cs.connectors.forEach((conn) => {
          if (evseID === this.buildEvseID(evseIDComponents.countryCode, evseIDComponents.partyId, cs, conn)) {
            chargingStation = cs;
            connector = conn;
          }
        });
        if (chargingStation && connector) {
          return {
            chargingStation: chargingStation,
            connector: connector
          };
        }
      }
    }
    return {
      chargingStation: chargingStation,
      connector: connector
    };
  }

  public static isAuthorizationValid(authorizationDate: Date): boolean {
    return authorizationDate && moment(authorizationDate).isAfter(moment().subtract(2, 'minutes'));
  }

  public static convertOICPIdentification2TagID(identification: OICPIdentification): string {
    let tagID: string;
    // No tag ID in case of remote Identification, QR Code Identification and Plug and Charge Identification
    if (identification.RFIDMifareFamilyIdentification) {
      tagID = identification.RFIDMifareFamilyIdentification.UID;
    } else if (identification.RFIDIdentification) {
      tagID = identification.RFIDIdentification.UID;
    } else if (identification.QRCodeIdentification) {
      tagID = OICPDefaultTagId.QRCodeIdentification;
    } else if (identification.PlugAndChargeIdentification) {
      tagID = OICPDefaultTagId.PlugAndChargeIdentification;
    } else if (identification.RemoteIdentification) {
      tagID = OICPDefaultTagId.RemoteIdentification;
    }
    return tagID;
  }

  public static convertTagID2OICPIdentification(tagID: string): OICPIdentification {
    // RFID Mifare Family as default for tag IDs because we get no information about the card type from the charging station over OCPP
    const identification: OICPIdentification = {} as OICPIdentification;
    const rfidIdentification = {} as OICPRFIDmifarefamilyIdentification;
    rfidIdentification.UID = tagID;
    identification.RFIDMifareFamilyIdentification = rfidIdentification;
    return identification;
  }

  public static getOICPIdentificationFromRemoteAuthorization(tenantID: string, chargingStation: ChargingStation, connectorId: number, action?: ServerAction): { sessionId: OICPSessionID; identification: OICPIdentification; } {
    if (chargingStation.remoteAuthorizations && chargingStation.remoteAuthorizations.length > 0) {
      const existingAuthorization: RemoteAuthorization = chargingStation.remoteAuthorizations.find(
        (authorization) => authorization.connectorId === connectorId && authorization.oicpIdentification);
      if (existingAuthorization) {
        if (action === ServerAction.START_TRANSACTION) {
          if (OICPUtils.isAuthorizationValid(existingAuthorization.timestamp)) {
            return {
              sessionId: existingAuthorization.id,
              identification: existingAuthorization.oicpIdentification
            };
          }
        } else {
          return {
            sessionId: existingAuthorization.id,
            identification: existingAuthorization.oicpIdentification
          };
        }
      }
    }
  }

  public static async getOICPIdentificationFromAuthorization(tenantID: string,
      transaction: Transaction): Promise<{ sessionId: OICPSessionID; identification: OICPIdentification; }> {
    // Retrieve Session Id from Authorization ID
    let sessionId: OICPSessionID;
    const authorizations = await OCPPStorage.getAuthorizes(tenantID, {
      dateFrom: moment(transaction.timestamp).subtract(10, 'minutes').toDate(),
      chargeBoxID: transaction.chargeBoxID,
      tagID: transaction.tagID
    }, Constants.DB_PARAMS_MAX_LIMIT);
    // Found ID?
    if (authorizations && authorizations.result && authorizations.result.length > 0) {
      // Get the first non used Authorization OICP ID / Session ID
      for (const authorization of authorizations.result) {
        if (authorization.authorizationId) {
          const ocpiTransaction = await TransactionStorage.getOICPTransaction(tenantID, authorization.authorizationId);
          // OICP ID not used yet
          if (!ocpiTransaction) {
            sessionId = authorization.authorizationId;
            break;
          }
        }
      }
      return {
        sessionId: sessionId,
        identification: OICPUtils.convertTagID2OICPIdentification(transaction.tagID)
      };
    }
    return null;
  }
}
