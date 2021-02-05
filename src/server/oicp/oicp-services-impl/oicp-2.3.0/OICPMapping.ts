import ChargingStation, { ChargePoint, Connector, ConnectorType, CurrentType } from '../../../../types/ChargingStation';
import { OICPAccessibility, OICPAddressIso19773, OICPAuthenticationMode, OICPCalibrationLawDataAvailability, OICPChargingFacility, OICPChargingMode, OICPChargingPoolID, OICPCountryCode, OICPDynamicInfoAvailable, OICPEvseDataRecord, OICPEvseStatus, OICPEvseStatusRecord, OICPGeoCoordinates, OICPGeoCoordinatesResponseFormat, OICPPaymentOption, OICPPlug, OICPPower, OICPValueAddedService } from '../../../../types/oicp/OICPEvse';

import Address from '../../../../types/Address';
import BackendError from '../../../../exception/BackendError';
import { ChargePointStatus } from '../../../../types/ocpp/OCPPServer';
import Constants from '../../../../utils/Constants';
import Countries from 'i18n-iso-countries';
import CountryLanguage from 'country-language';
import { DataResult } from '../../../../types/DataResult';
import RoamingUtils from '../../../../utils/RoamingUtils';
import { ServerAction } from '../../../../types/Server';
import Site from '../../../../types/Site';
import SiteArea from '../../../../types/SiteArea';
import SiteAreaStorage from '../../../../storage/mongodb/SiteAreaStorage';
import SiteStorage from '../../../../storage/mongodb/SiteStorage';
import Tenant from '../../../../types/Tenant';
import Utils from '../../../../utils/Utils';

const MODULE_NAME = 'OICPMapping';

/**
 * OICP Mapping 2.3.0 - Mapping class
 * Mainly contains helper functions to convert internal entity to OICP 2.3.0 Entity
 */
export default class OICPMapping {
  /**
   * Get EVSE by connectorID
   * @param {Tenant} tenant
   * @param {*} chargingStation
   * @return OICP EVSE
   */
  public static getEvseByConnectorId(tenant: Tenant, siteArea: SiteArea, chargingStation: ChargingStation, connectorId: number, options: { countryID: string; partyID: string; addChargeBoxID?: boolean}): OICPEvseDataRecord {
    // Loop through connectors and send one evse per connector
    const connector = chargingStation.connectors.find((conn) => (conn !== null) && (conn.connectorId === connectorId));

    if (connector) {
      return OICPMapping.convertConnector2Evse(tenant, siteArea, chargingStation, connector, options);
    }
    return null;
  }

  /**
   * Convert Connector to EVSE Status
   * @param {Tenant} tenant
   * @param {*} connector
   * @return Array of OICP EVSE Statuses
   */
  public static convertConnector2EvseStatus(tenant: Tenant, chargingStation: ChargingStation, connector: Connector, options: { countryID: string; partyID: string; addChargeBoxID?: boolean}): OICPEvseStatusRecord {
    const evseStatus: OICPEvseStatusRecord = {} as OICPEvseStatusRecord;
    evseStatus.EvseID = RoamingUtils.buildEvseID(options.countryID, options.partyID, chargingStation, connector);
    evseStatus.EvseStatus = OICPMapping.convertStatus2OICPEvseStatus(connector.status);
    evseStatus.ChargingStationID = chargingStation.id;
    return evseStatus;
  }

  /**
   * Get evses from SiteArea
   * @param {Tenant} tenant
   * @param {SiteArea} siteArea
   * @param options
   * @return Array of OICP EVSES
   */
  static async getEvsesFromSiteaArea(tenant: Tenant, siteArea: SiteArea, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): Promise<OICPEvseDataRecord[]> {
    // Build evses array
    const evses: OICPEvseDataRecord[] = [];
    // Convert charging stations to evse(s)
    for (const chargingStation of siteArea.chargingStations) {
      if (chargingStation.issuer && chargingStation.public) {
        if (!Utils.isEmptyArray(chargingStation.chargePoints)) {
          for (const chargePoint of chargingStation.chargePoints) {
            // OICP does not support multiple connectors in one EVSE object
            // It is not possible to flag if connectors of charge points can charge in parallel or not
            evses.push(...OICPMapping.convertChargingStation2MultipleEvses(tenant,siteArea, chargingStation, chargePoint, options));
          }
        } else {
          evses.push(...OICPMapping.convertChargingStation2MultipleEvses(tenant, siteArea, chargingStation, null, options));
        }
      }
    }
    // Return evses
    return evses;
  }

  /**
   * Get All OICP Evses from given tenant
   * @param {Tenant} tenant
   */
  public static async getAllEvses(tenant: Tenant, limit: number, skip: number, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): Promise<DataResult<OICPEvseDataRecord>> {
    // Result
    const oicpEvsesResult: DataResult<OICPEvseDataRecord> = { count: 0, result: [] };
    // Get all sites
    const sites = await SiteStorage.getSites(tenant.id, { issuer: true, onlyPublicSite: true }, { limit, skip });
    // Convert Sites to Evses
    for (const site of sites.result) {
      oicpEvsesResult.result.push(...await OICPMapping.getEvsesFromSite(tenant, site, options));
    }
    // Set count
    oicpEvsesResult.count = oicpEvsesResult.result.length;
    // Return EVSEs
    return oicpEvsesResult;
  }

  /**
   * Get All OICP Evse Statuses from given tenant
   * @param {Tenant} tenant
   */
  public static async getAllEvseStatuses(tenant: Tenant, limit: number, skip: number, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): Promise<DataResult<OICPEvseStatusRecord>> {
    // Result
    const oicpEvsesResult: DataResult<OICPEvseStatusRecord> = { count: 0, result: [] };
    // Get all sites
    const sites = await SiteStorage.getSites(tenant.id, { issuer: true, onlyPublicSite: true }, { limit, skip });
    // Convert Sites to Evses
    for (const site of sites.result) {
      oicpEvsesResult.result.push(...await OICPMapping.getEvseStatusesFromSite(tenant, site, options));
    }
    // Set count
    oicpEvsesResult.count = oicpEvsesResult.result.length;
    // Return EVSE Stauses
    return oicpEvsesResult;
  }

  /**
   * Converter Connector to OICP Charging Facility
   * @param {ChargingStation} chargingStation
   * @param connector
   * @param {*} connector
   */
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
      PowerType: OICPMapping.convertNumberOfConnectedPhase2PowerType(numberOfConnectedPhase),
      Voltage:voltage,
      ChargingModes: [
        OICPChargingMode.Mode_4 // No mapping yet
      ]
    };
  }

  /**
   * Converter Connector to OICP Plug
   * @param connector
   * @param {*} connector
   */
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

  /**
   * Convert internal Power (1/3 Phase) to PowerType
   * @param {*} power
   */
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

  private static getOICPAddressIso19773FromSiteArea(siteArea: SiteArea, countryID: string): OICPAddressIso19773 {
    let address: Address;
    if (siteArea.address) {
      address = siteArea.address;
    } else {
      address = siteArea.site.address;
    }
    return {
      Country: OICPMapping.convertCountry2CountryCode(address.country, countryID), // OICP expects Alpha-3 county code.
      City: address.city,
      Street: `${address.address1} ${address.address2}`,
      PostalCode: address.postalCode,
      HouseNum: '', // No separate house number in internal address type. Mandatory field
      Region: address.region,
      Timezone: Utils.getTimezone(address.coordinates) // Optional
    };
  }

  // The CountryCodeType allows for Alpha-3 country codes. For Alpha-3 (three-letter) country codes as defined in ISO 3166-1. Example: FRA France
  private static convertCountry2CountryCode(country: string, countryID: string): OICPCountryCode {
    // Check input parameter
    if (!country) {
      throw new BackendError({
        action: ServerAction.OICP_PUSH_EVSE_DATA,
        message: 'Invalid parameters. Country name is empty',
        module: MODULE_NAME, method: 'convertCountry2CountryCode',
      });
    }
    const countryLanguage = CountryLanguage.getCountryLanguages(countryID, (err, languages) => languages[0].iso639_1) as string;
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

  /**
   * Build ChargingPoolID from charging station
   * @param {*} chargingStation
   */
  private static buildEChargingPoolID(countryCode: string, partyId: string, siteAreaID: string): OICPChargingPoolID {
    const chargingPoolID = `${countryCode}*${partyId}*P${siteAreaID}`;
    return chargingPoolID.replace(/[\W_]+/g, '*').toUpperCase();
  }

  /**
   * Convert internal status to OICP EVSE Status
   * @param {*} status
   */
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

  /**
   * Get EVSE Statuses from SiteArea
   * @param {Tenant} tenant
   * @param {SiteArea} siteArea
   * @param options
   * @return Array of OICP EVSE Statuses
   */
  private static async getEvseStatusesFromSiteaArea(tenant: Tenant, siteArea: SiteArea, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): Promise<OICPEvseStatusRecord[]> {
    // Build evses array
    const evseStatuses: OICPEvseStatusRecord[] = [];
    // Convert charging stations to evse status(es)
    for (const chargingStation of siteArea.chargingStations) {
      if (chargingStation.issuer && chargingStation.public) {
        if (!Utils.isEmptyArray(chargingStation.chargePoints)) {
          for (const chargePoint of chargingStation.chargePoints) {
            // OICP does not support multiple connectors in one EVSE object
            // It is not possible to flag if connectors of charge points can charge in parallel or not
            evseStatuses.push(...OICPMapping.convertChargingStation2MultipleEvseStatuses(tenant, chargingStation, chargePoint, options));
          }
        } else {
          evseStatuses.push(...OICPMapping.convertChargingStation2MultipleEvseStatuses(tenant, chargingStation, null, options));
        }
      }
    }
    // Return evses
    return evseStatuses;
  }

  /**
   * Get evse statuses from Site
   * @param {Tenant} tenant
   * @param {Site} site
   * @param options
   * @return Array of OICP EVSE Statuses
   */
  private static async getEvseStatusesFromSite(tenant: Tenant, site: Site, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): Promise<OICPEvseStatusRecord[]> {
    // Build evses array
    const evseStatuses: OICPEvseStatusRecord[] = [];
    const siteAreas = await SiteAreaStorage.getSiteAreas(tenant.id,
      {
        withOnlyChargingStations: true,
        withChargingStations: true,
        siteIDs: [site.id],
        issuer: true
      },
      Constants.DB_PARAMS_MAX_LIMIT);
    for (const siteArea of siteAreas.result) {
      // Get charging station statuses from SiteArea
      evseStatuses.push(...await OICPMapping.getEvseStatusesFromSiteaArea(tenant, siteArea, options));
    }
    // Return evse statuses
    return evseStatuses;
  }

  /**
   * Get evses from Site
   * @param {Tenant} tenant
   * @param {Site} site
   * @param options
   * @return Array of OICP EVSEs
   */
  private static async getEvsesFromSite(tenant: Tenant, site: Site, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): Promise<OICPEvseDataRecord[]> {
    // Build evses array
    const evses = [];
    const siteAreas = await SiteAreaStorage.getSiteAreas(tenant.id,
      {
        withOnlyChargingStations: true,
        withChargingStations: true,
        withSite: true,
        siteIDs: [site.id],
        issuer: true
      },
      Constants.DB_PARAMS_MAX_LIMIT);
    for (const siteArea of siteAreas.result) {
      // Get charging stations from SiteArea
      evses.push(...await OICPMapping.getEvsesFromSiteaArea(tenant, siteArea, options));
    }
    // Return evses
    return evses;
  }

  /**
   * Convert ChargingStation to Multiple EVSEs
   * @param {Tenant} tenant
   * @param {*} chargingStation
   * @return Array of OICP EVSEs
   */
  private static convertChargingStation2MultipleEvses(tenant: Tenant, siteArea: SiteArea, chargingStation: ChargingStation, chargePoint: ChargePoint, options: { countryID: string; partyID: string; addChargeBoxID?: boolean}): OICPEvseDataRecord[] {
    // Loop through connectors and send one evse per connector
    let connectors: Connector[];
    if (chargePoint) {
      connectors = Utils.getConnectorsFromChargePoint(chargingStation, chargePoint);
    } else {
      connectors = chargingStation.connectors.filter((connector) => connector !== null);
    }
    const evses = connectors.map((connector) => OICPMapping.convertConnector2Evse(tenant, siteArea, chargingStation, connector, options));
    // Return all evses
    return evses;
  }

  /**
   * Convert ChargingStation to Multiple EVSE Statuses
   * @param {Tenant} tenant
   * @param {*} chargingStation
   * @return Array of OICP EVSE Statuses
   */
  private static convertChargingStation2MultipleEvseStatuses(tenant: Tenant, chargingStation: ChargingStation, chargePoint: ChargePoint, options: { countryID: string; partyID: string; addChargeBoxID?: boolean}): OICPEvseStatusRecord[] {
    // Loop through connectors and send one evse per connector
    let connectors: Connector[];
    if (chargePoint) {
      connectors = Utils.getConnectorsFromChargePoint(chargingStation, chargePoint);
    } else {
      connectors = chargingStation.connectors.filter((connector) => connector !== null);
    }
    const evseStatuses = connectors.map((connector) => OICPMapping.convertConnector2EvseStatus(tenant, chargingStation, connector, options));
    // Return all EVSE Statuses
    return evseStatuses;
  }

  /**
   * Convert Connector to OICP EVSE
   * @param {Tenant} tenant
   * @param {*} connector
   * @return EVSE
   */
  private static convertConnector2Evse(tenant: Tenant, siteArea: SiteArea, chargingStation: ChargingStation, connector: Connector, options: { countryID: string; partyID: string; addChargeBoxID?: boolean}): OICPEvseDataRecord {
    const evse: OICPEvseDataRecord = {} as OICPEvseDataRecord;
    evse.deltaType; // Optional
    evse.lastUpdate; // Optional
    evse.EvseID = RoamingUtils.buildEvseID(options.countryID, options.partyID, chargingStation, connector);
    evse.ChargingPoolID = OICPMapping.buildEChargingPoolID(options.countryID, options.partyID, siteArea.id); // Optional
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
    evse.Address = OICPMapping.getOICPAddressIso19773FromSiteArea(siteArea, options.countryID);
    evse.GeoCoordinates = OICPMapping.convertCoordinates2OICPGeoCoordinates(chargingStation.coordinates, OICPGeoCoordinatesResponseFormat.DecimalDegree); // Optional
    evse.Plugs = [OICPMapping.convertConnector2OICPPlug(connector)];
    evse.DynamicPowerLevel; // Optional
    evse.ChargingFacilities = [OICPMapping.convertConnector2OICPChargingFacility(chargingStation, connector)];
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
