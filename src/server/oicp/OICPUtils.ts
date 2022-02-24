import ChargingStation, { ChargePoint, Connector, ConnectorType, CurrentType, RemoteAuthorization } from '../../types/ChargingStation';
import { OICPAccessibility, OICPAddressIso19773, OICPAuthenticationMode, OICPCalibrationLawDataAvailability, OICPChargingFacility, OICPChargingMode, OICPChargingPoolID, OICPCountryCode, OICPDynamicInfoAvailable, OICPEvseDataRecord, OICPEvseID, OICPEvseStatus, OICPEvseStatusRecord, OICPGeoCoordinates, OICPGeoCoordinatesResponseFormat, OICPPaymentOption, OICPPlug, OICPPower, OICPValueAddedService } from '../../types/oicp/OICPEvse';
import { OICPDefaultTagId, OICPIdentification, OICPSessionID } from '../../types/oicp/OICPIdentification';
import User, { UserStatus } from '../../types/User';

import Address from '../../types/Address';
import BackendError from '../../exception/BackendError';
import { ChargePointStatus } from '../../types/ocpp/OCPPServer';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import Constants from '../../utils/Constants';
import Countries from 'i18n-iso-countries';
import OCPPStorage from '../../storage/mongodb/OCPPStorage';
import { OICPAcknowledgment } from '../../types/oicp/OICPAcknowledgment';
import { OICPSession } from '../../types/oicp/OICPSession';
import { OICPStatusCode } from '../../types/oicp/OICPStatusCode';
import RoamingUtils from '../../utils/RoamingUtils';
import { ServerAction } from '../../types/Server';
import Site from '../../types/Site';
import SiteArea from '../../types/SiteArea';
import Tenant from '../../types/Tenant';
import Transaction from '../../types/Transaction';
import TransactionStorage from '../../storage/mongodb/TransactionStorage';
import UserStorage from '../../storage/mongodb/UserStorage';
import Utils from '../../utils/Utils';
import { countries } from 'countries-list';
import moment from 'moment';

const MODULE_NAME = 'OICPUtils';

export default class OICPUtils {
  public static getEvseByConnectorId(site: Site, siteArea: SiteArea, chargingStation: ChargingStation, connectorId: number,
      options: { countryID: string; partyID: string; addChargeBoxID?: boolean}): OICPEvseDataRecord {
    // Loop through connectors and send one evse per connector
    const foundConnector = chargingStation.connectors.find(
      (connector) => connector?.connectorId === connectorId);
    if (foundConnector) {
      return OICPUtils.convertConnector2Evse(site, siteArea, chargingStation, foundConnector, options);
    }
    return null;
  }

  public static convertConnector2EvseStatus(chargingStation: ChargingStation, connector: Connector,
      options: { countryID: string; partyID: string; addChargeBoxID?: boolean}): OICPEvseStatusRecord {
    return {
      EvseID: RoamingUtils.buildEvseID(options.countryID, options.partyID, chargingStation, connector.connectorId),
      EvseStatus: chargingStation.inactive ? OICPEvseStatus.OutOfService : OICPUtils.convertStatus2OICPEvseStatus(connector.status),
      ChargingStationID: chargingStation.id,
    };
  }

  public static async convertChargingStationsToEVSEs(tenant: Tenant, site: Site, chargingStations: ChargingStation[],
      options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): Promise<OICPEvseDataRecord[]> {
    const evses: OICPEvseDataRecord[] = [];
    // Convert charging stations to evse(s)
    for (const chargingStation of chargingStations) {
      if (chargingStation.issuer && chargingStation.public) {
        const chargingStationEvses = OICPUtils.convertChargingStation2MultipleEvses(site, chargingStation.siteArea, chargingStation, options);
        // Update the Charging Station's OICP Data
        await ChargingStationStorage.saveChargingStationOicpData(tenant, chargingStation.id, {
          evses: chargingStationEvses
        });
        evses.push(...chargingStationEvses);
      }
    }
    return evses;
  }

  public static convertChargingStationsToEvseStatuses(chargingStations: ChargingStation[],
      options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): OICPEvseStatusRecord[] {
    const evseStatuses: OICPEvseStatusRecord[] = [];
    // Convert charging stations to evse status(es)
    for (const chargingStation of chargingStations) {
      if (chargingStation.issuer && chargingStation.public) {
        evseStatuses.push(...OICPUtils.convertChargingStation2MultipleEvseStatuses(chargingStation, options));
      }
    }
    return evseStatuses;
  }

  public static convertChargingStation2MultipleEvses(site: Site, siteArea: SiteArea, chargingStation: ChargingStation,
      options: { countryID: string; partyID: string; addChargeBoxID?: boolean}): OICPEvseDataRecord[] {
    let connectors: Connector[] = [];
    if (!Utils.isEmptyArray(chargingStation.chargePoints)) {
      for (const chargePoint of chargingStation.chargePoints) {
        // OICP does not support multiple connectors in one EVSE object
        // It is not possible to flag if connectors of charge points can charge in parallel or not
        connectors.push(...Utils.getConnectorsFromChargePoint(chargingStation, chargePoint));
      }
    } else {
      connectors = chargingStation.connectors.filter((connector) => connector !== null);
    }
    // Convert Connectors to Chargepoint EVSEs
    const evses = connectors.map(
      (connector) => OICPUtils.convertConnector2Evse(site, siteArea, chargingStation, connector, options));
    return evses;
  }

  public static success(session: Partial<OICPSession>, data?: any): OICPAcknowledgment {
    return {
      Result: true,
      StatusCode: {
        Code: OICPStatusCode.Code000
      },
      EMPPartnerSessionID: session.empPartnerSessionID,
      SessionID: session.id
    };
  }

  public static noSuccess(session: Partial<OICPSession>, data?: any): OICPAcknowledgment {
    return {
      Result: false,
      StatusCode: {
        Code: OICPStatusCode.Code022,
        Description: data
      },
      EMPPartnerSessionID: session.empPartnerSessionID,
      SessionID: session.id
    };
  }

  public static toErrorResponse(error: Error): OICPAcknowledgment {
    return {
      Result: false,
      StatusCode: {
        Code: OICPStatusCode.Code022,
        Description: error.message
      }
    };
  }

  public static async getChargingStationConnectorFromEvseID(tenant: Tenant, evseID: OICPEvseID): Promise<{ chargingStation: ChargingStation, connector: Connector }> {
    const evseIDComponents = RoamingUtils.getEvseIdComponents(evseID);
    const chargingStation = await ChargingStationStorage.getChargingStationByOicpEvseID(tenant, evseID);
    let foundConnector: Connector;
    if (chargingStation) {
      for (const connector of chargingStation.connectors) {
        if (evseID === RoamingUtils.buildEvseID(evseIDComponents.countryCode, evseIDComponents.partyId, chargingStation, connector.connectorId)) {
          foundConnector = connector;
        }
      }
    }
    return {
      chargingStation: chargingStation,
      connector: foundConnector
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
    return {
      RFIDMifareFamilyIdentification: {
        UID: tagID
      }
    };
  }

  public static getOICPIdentificationFromRemoteAuthorization(chargingStation: ChargingStation, connectorId: number,
      action?: ServerAction): { sessionId: OICPSessionID; identification: OICPIdentification; } {
    // Check remote auth in Charging Station
    if (!Utils.isEmptyArray(chargingStation.remoteAuthorizations)) {
      const existingAuthorization = chargingStation.remoteAuthorizations.find(
        (authorization) => authorization.connectorId === connectorId && authorization.oicpIdentification);
      if (existingAuthorization) {
        if (action === ServerAction.OCPP_START_TRANSACTION) {
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

  public static async getOICPIdentificationFromAuthorization(tenant: Tenant,
      transaction: Transaction): Promise<{ sessionId: OICPSessionID; identification: OICPIdentification; }> {
    // Retrieve Session Id from Authorization ID
    let sessionId: OICPSessionID;
    const authorizations = await OCPPStorage.getAuthorizes(tenant, {
      dateFrom: moment(transaction.timestamp).subtract(Constants.ROAMING_AUTHORIZATION_TIMEOUT_MINS, 'minutes').toDate(),
      chargeBoxID: transaction.chargeBoxID,
      tagID: transaction.tagID
    }, Constants.DB_PARAMS_MAX_LIMIT);
    // Found ID?
    if (!Utils.isEmptyArray(authorizations.result)) {
      // Get the first non used Authorization OICP ID / Session ID
      for (const authorization of authorizations.result) {
        if (authorization.authorizationId) {
          const oicpTransaction = await TransactionStorage.getOICPTransactionBySessionID(tenant, authorization.authorizationId);
          // OICP SessionID not used yet
          if (!oicpTransaction) {
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
  }

  public static async createOICPVirtualUser(tenant: Tenant): Promise<void> {
    // Create the virtual OICP user
    const newVirtualOICPUser = UserStorage.createNewUser() as User;
    newVirtualOICPUser.email = Constants.OICP_VIRTUAL_USER_EMAIL;
    newVirtualOICPUser.name = 'OICP';
    newVirtualOICPUser.firstName = 'Virtual';
    newVirtualOICPUser.issuer = false;
    newVirtualOICPUser.status = UserStatus.ACTIVE;
    newVirtualOICPUser.notificationsActive = false;
    // Save User
    newVirtualOICPUser.id = await UserStorage.saveUser(tenant, newVirtualOICPUser);
    // Save User Status
    await UserStorage.saveUserStatus(tenant, newVirtualOICPUser.id, UserStatus.ACTIVE);
  }

  private static convertConnector2OICPChargingFacility(chargingStation: ChargingStation, connector: Connector): OICPChargingFacility {
    let chargePoint: ChargePoint;
    if (connector.chargePointID) {
      chargePoint = Utils.getChargePointFromID(chargingStation, connector.chargePointID);
    }
    const voltage = Utils.getChargingStationVoltage(chargingStation, chargePoint, connector.connectorId);
    const amperage = Utils.getChargingStationAmperage(chargingStation, chargePoint, connector.connectorId);
    let numberOfConnectedPhase = 0;
    const currentType = Utils.getChargingStationCurrentType(chargingStation, chargePoint, connector.connectorId);
    if (currentType === CurrentType.AC) {
      numberOfConnectedPhase = Utils.getNumberOfConnectedPhases(chargingStation, chargePoint, connector.connectorId);
    }
    return {
      Amperage: amperage,
      Power: connector.power,
      PowerType: OICPUtils.convertNumberOfConnectedPhase2PowerType(numberOfConnectedPhase),
      Voltage: voltage,
      ChargingModes: [
        OICPChargingMode.Mode_4 // No mapping yet
      ]
    };
  }

  private static convertConnector2OICPPlug(connector: Connector): OICPPlug {
    switch (connector.type) {
      case ConnectorType.CHADEMO:
        return OICPPlug.CHAdeMO;
      case ConnectorType.TYPE_2:
        return OICPPlug.Type2Outlet;
      case ConnectorType.COMBO_CCS:
        return OICPPlug.CCSCombo2PlugCableAttached;
      case ConnectorType.TYPE_1:
        return OICPPlug.Type1ConnectorCableAttached;
      case ConnectorType.TYPE_3C:
        return OICPPlug.Type3Outlet;
      case ConnectorType.TYPE_1_CCS:
        return OICPPlug.CCSCombo1PlugCableAttached;
      case ConnectorType.DOMESTIC:
        return OICPPlug.TypeFSchuko;
      case ConnectorType.UNKNOWN:
        return OICPPlug.Type2Outlet; // No corresponding type found
    }
  }

  private static convertNumberOfConnectedPhase2PowerType(numberOfConnectedPhase: number): OICPPower {
    switch (numberOfConnectedPhase) {
      case 0:
        return OICPPower.DC;
      case 1:
        return OICPPower.AC_1_PHASE;
      case 3:
        return OICPPower.AC_3_PHASE;
    }
  }

  private static getOICPAddressIso19773FromSiteArea(site: Site, siteArea: SiteArea, countryID: string): OICPAddressIso19773 {
    let address: Address;
    if (siteArea.address) {
      address = siteArea.address;
    } else {
      address = site.address;
    }
    return {
      Country: OICPUtils.convertCountry2CountryCode(address.country, countryID), // OICP expects Alpha-3 county code.
      City: address.city,
      Street: `${address.address1} ${address.address2}`,
      PostalCode: address.postalCode,
      HouseNum: '', // No separate house number in internal address type. Mandatory field
      Region: address.region,
      Timezone: Utils.getTimezone(address.coordinates) // Optional
    };
  }

  private static convertCountry2CountryCode(country: string, countryID: string): OICPCountryCode {
    // The CountryCodeType allows for Alpha-3 country codes. For Alpha-3 (three-letter) country codes as defined in ISO 3166-1. Example: FRA France
    // Check input parameter
    if (!country) {
      throw new BackendError({
        action: ServerAction.OICP_PUSH_EVSE_DATA,
        message: 'Invalid parameters. Country name is empty',
        module: MODULE_NAME, method: 'convertCountry2CountryCode',
      });
    }
    const countryLanguage = countries[countryID].languages[0] as string;
    const countryCode = Countries.getAlpha3Code(country, countryLanguage);
    // Check result
    if (!countryCode) {
      throw new BackendError({
        action: ServerAction.OICP_PUSH_EVSE_DATA,
        message: `Invalid parameters. Country name '${country}' might not be in the right language '${countryLanguage}' or misspelled`,
        module: MODULE_NAME, method: 'convertCountry2CountryCode',
      });
    }
    return countryCode;
  }

  private static convertCoordinates2OICPGeoCoordinates(coordinates: number[], format: OICPGeoCoordinatesResponseFormat): OICPGeoCoordinates {
    switch (format) {
      case OICPGeoCoordinatesResponseFormat.Google:
        // TODO
        return {
          Google: {
            Coordinates: 'TODO'
          },
        };
      case OICPGeoCoordinatesResponseFormat.DecimalDegree:
        return {
          DecimalDegree: {
            Longitude: String(Utils.roundTo(coordinates[0], 6)), // Fixed to 6 decimal places according to OICP requirements
            Latitude: String(Utils.roundTo(coordinates[1],6))
          }
        };
      case OICPGeoCoordinatesResponseFormat.DegreeMinuteSeconds:
        // TODO
        return {
          DegreeMinuteSeconds: {
            Longitude: 'TODO',
            Latitude: 'TODO'
          },
        };
    }
  }

  private static buildEChargingPoolID(countryCode: string, partyId: string, siteAreaID: string): OICPChargingPoolID {
    const chargingPoolID = `${countryCode}*${partyId}*P${siteAreaID}`;
    return chargingPoolID.replace(/[\W_]+/g, '*').toUpperCase();
  }

  private static convertStatus2OICPEvseStatus(status: ChargePointStatus): OICPEvseStatus {
    switch (status) {
      case ChargePointStatus.AVAILABLE:
        return OICPEvseStatus.Available;
      case ChargePointStatus.OCCUPIED:
        return OICPEvseStatus.Occupied;
      case ChargePointStatus.CHARGING:
        return OICPEvseStatus.Occupied;
      case ChargePointStatus.FAULTED:
        return OICPEvseStatus.OutOfService;
      case ChargePointStatus.PREPARING: // No corresponding type found
      case ChargePointStatus.SUSPENDED_EV: // No corresponding type found
      case ChargePointStatus.SUSPENDED_EVSE: // No corresponding type found
      case ChargePointStatus.FINISHING:
        return OICPEvseStatus.Occupied;
      case ChargePointStatus.RESERVED:
        return OICPEvseStatus.Reserved;
      default:
        return OICPEvseStatus.Unknown;
    }
  }

  private static convertChargingStation2MultipleEvseStatuses(chargingStation: ChargingStation, options: { countryID: string; partyID: string; addChargeBoxID?: boolean}): OICPEvseStatusRecord[] {
    let connectors: Connector[] = [];
    if (!Utils.isEmptyArray(chargingStation.chargePoints)) {
      for (const chargePoint of chargingStation.chargePoints) {
        // OICP does not support multiple connectors in one EVSE object
        // It is not possible to flag if connectors of charge points can charge in parallel or not
        connectors.push(...Utils.getConnectorsFromChargePoint(chargingStation, chargePoint));
      }
    } else {
      connectors = chargingStation.connectors.filter((connector) => connector !== null);
    }
    const evseStatuses = connectors.map(
      (connector) => OICPUtils.convertConnector2EvseStatus(chargingStation, connector, options));
    // Return all EVSE Statuses
    return evseStatuses;
  }

  private static convertConnector2Evse(site: Site, siteArea: SiteArea, chargingStation: ChargingStation, connector: Connector,
      options: { countryID: string; partyID: string; addChargeBoxID?: boolean}): OICPEvseDataRecord {
    const evse: OICPEvseDataRecord = {} as OICPEvseDataRecord;
    evse.deltaType; // Optional
    evse.lastUpdate; // Optional
    evse.EvseID = RoamingUtils.buildEvseID(options.countryID, options.partyID, chargingStation, connector.connectorId);
    evse.ChargingPoolID = OICPUtils.buildEChargingPoolID(options.countryID, options.partyID, siteArea.id); // Optional
    evse.ChargingStationID = chargingStation.id; // Optional
    evse.ChargingStationNames = [
      {
        lang: 'en',
        value: chargingStation.id
      }
    ];
    evse.HardwareManufacturer = chargingStation.chargePointVendor; // Optional
    evse.ChargingStationImage; // Optional
    evse.SubOperatorName; // Optional
    evse.Address = OICPUtils.getOICPAddressIso19773FromSiteArea(site, siteArea, options.countryID);
    evse.GeoCoordinates = OICPUtils.convertCoordinates2OICPGeoCoordinates(chargingStation.coordinates, OICPGeoCoordinatesResponseFormat.DecimalDegree); // Optional
    evse.Plugs = [OICPUtils.convertConnector2OICPPlug(connector)];
    evse.DynamicPowerLevel; // Optional
    evse.ChargingFacilities = [OICPUtils.convertConnector2OICPChargingFacility(chargingStation, connector)];
    evse.RenewableEnergy = false; // No information found for mandatory field
    evse.EnergySource; // Optional
    evse.EnvironmentalImpact; // Optional
    evse.CalibrationLawDataAvailability = OICPCalibrationLawDataAvailability.NotAvailable; // No information found for mandatory field
    evse.AuthenticationModes = [OICPAuthenticationMode.NfcRfidClassic]; // No information found for mandatory field
    evse.MaxCapacity; // Optional
    evse.PaymentOptions = [OICPPaymentOption.Contract]; // No information found for mandatory field
    evse.ValueAddedServices = [OICPValueAddedService.None]; // No information found for mandatory field
    evse.Accessibility = OICPAccessibility.FreePubliclyAccessible;
    evse.AccessibilityLocation; // Optional
    evse.HotlinePhoneNumber = '+49123123123123'; // No information found for mandatory field
    evse.AdditionalInfo; // Optional
    evse.ChargingStationLocationReference; // Optional
    evse.GeoChargingPointEntrance; // Optional
    evse.IsOpen24Hours = true; // No information found for mandatory field
    evse.OpeningTimes; // Optional
    evse.ClearinghouseID; // Optional
    evse.IsHubjectCompatible = true;
    evse.DynamicInfoAvailable = OICPDynamicInfoAvailable.auto;
    // Return evse
    return evse;
  }
}
