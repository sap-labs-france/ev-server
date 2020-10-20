/* eslint-disable @typescript-eslint/indent */
import ChargingStation, { ChargePoint, Connector, ConnectorType, CurrentType } from '../../../../types/ChargingStation';
import { OICPAccessibility, OICPAccessibilityLocation, OICPAddressIso19773, OICPAuthenticationMode, OICPCalibrationLawDataAvailability, OICPChargingFacility, OICPChargingMode, OICPChargingPoolID, OICPCountryCode, OICPDynamicInfoAvailable, OICPEvseDataRecord, OICPGeoCoordinates, OICPGeoCoordinatesResponseFormat, OICPPaymentOption, OICPPlug, OICPPower, OICPValueAddedService } from '../../../../types/oicp/OICPEvse';

import OCPIUtils from '../../../ocpi/OCPIUtils';
import Site from '../../../../types/Site';
import Tenant from '../../../../types/Tenant';
import Utils from '../../../../utils/Utils';

/**
 * OICP Mapping 2.3 - Mapping class
 * Mainly contains helper functions to convert internal entity to OICP 2.3 Entity
 */
export default class OICPMapping {
  /**
   * Convert ChargingStation to Multiple EVSEs
   * @param {Tenant} tenant
   * @param {*} chargingStation
   * @return Array of OICP EVSEs
   */
  static convertChargingStation2MultipleEvses(tenant: Tenant, site: Site, chargingStation: ChargingStation,
                                              options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): OICPEvseDataRecord[] {
    let accessible;
    if (chargingStation.public === true) {
      accessible = OICPAccessibility.FreePubliclyAccessible;
    } else {
      accessible = OICPAccessibility.RestrictedAccess;
    }
    // Loop through connectors and send one evse per connector
    const connectors = chargingStation.connectors.filter((connector) => connector !== null);
    const evses = connectors.map((connector) => {
      const evseID = OCPIUtils.buildEvseID(options.countryID, options.partyID, chargingStation, connector);
      const evse: OICPEvseDataRecord = {
        // DeltaType?: OICPDelta, // In case that the operation “PullEvseData” is performed with the parameter “LastCall”, Hubject assigns this attribute to every response EVSE record in order to return the changes compared to the last call.
        // lastUpdate?: Date, // The attribute indicates the date and time of the last update of the record. Hubject assigns this attribute to every response EVSE record.
        EvseID: evseID, // The ID that identifies the charging spot.
        ChargingPoolID: OICPMapping.buildEChargingPoolID(options.countryID, options.partyID, chargingStation),
        ChargingStationId: chargingStation.id,
        ChargingStationNames: [ // Name of the charging station in different Languages
          {
            lang: 'en',
            value: 'ABC Charging Station Test'
          },
          {
            lang: 'de',
            value: 'ABC Testladestation'
          }
        ],
        HardwareManufacturer: chargingStation.chargePointVendor, // Name of the charging point manufacturer. Field Length = 50
        // ChargingStationImage?: string, // URL that redirect to an online image of the related EVSEID. Field Length = 200
        // SubOperatorName?: string, // Name of the Sub Operator owning the Charging Station. Field Length = 100
        Address: OICPMapping.getOICPAddressIso19773FromSite(site), // Address of the charging station.
        GeoCoordinates: OICPMapping.convertCoordinates2OICPGeoCoordinates(chargingStation.coordinates, OICPGeoCoordinatesResponseFormat.DecimalDegree), // Geolocation of the charging station. Field Length = 100
        Plugs: [OICPMapping.convertConnector2OICPPlug(connector)],
        // DynamicPowerLevel?: boolean, // Informs is able to deliver different power outputs.
        ChargingFacilities: [OICPMapping.convertConnector2OICPChargingFacility(chargingStation, connector)], // What if there are multiple connectors?
        RenewableEnergy: false, // If the Charging Station provides only renewable energy then the value must be” true”, if it use grey energy then value must be “false”.
        // EnergySource?: OICPEnergySource[], // List of energy source that the charging station uses to supply electric energy.
        // EnvironmentalImpact?: OICPEnvironmentalImpact, // Environmental Impact produced by the energy sources used by the charging point
        CalibrationLawDataAvailability: OICPCalibrationLawDataAvailability.NotAvailable, // This field gives the information how the charging station provides metering law data.
        AuthenticationModes: OICPAuthenticationMode[OICPPaymentOption.Contract], // List of authentication modes that are supported.
        // MaxCapacity?: number, // Integer. Maximum capacity in kWh
        PaymentOptions: [], // List of payment options that are supported.
        ValueAddedServices: [OICPValueAddedService.None], // List of value added services that are supported.
        Accessibility: accessible, // Specifies how the charging station can be accessed.
        // AccessibilityLocation?: OICPAccessibilityLocation[], // Inform the EV driver where the ChargingPoint could be accessed.
        HotlinePhoneNumber: '+49', // Phone number of a hotline of the charging station operator.
        // AdditionalInfo?: OICPInfoText[], // Optional information. Field Length = 200
        // ChargingStationLocationReference?: OICPInfoText[], // Last meters information regarding the location of the Charging Station
        // GeoChargingPointEntrance?: OICPGeoCoordinates, // In case that the charging spot is part of a bigger facility (e.g. parking place), this attribute specifies the facilities entrance coordinates.
        IsOpen24Hours: true, // Set in case the charging spot is open 24 hours.
        // OpeningTimes?: OICPOpeningTimes[], // Opening time in case that the charging station cannot be accessed around the clock.
        // ClearinghouseID?: string, // Identification of the corresponding clearing house in the event that roaming between different clearing houses must be processed in the future. Field Length = 20
        IsHubjectCompatible: true, // Is eRoaming via intercharge at this charging station possible? If set to "false" the charge spot will not be started/stopped remotely via Hubject.
        DynamicInfoAvailable: OICPDynamicInfoAvailable.auto // Values; true / false / auto This attribute indicates whether a CPO provides (dynamic) EVSE Status info in addition to the (static) EVSE Data for this EVSERecord. Value auto is set to true by Hubject if the operator offers Hubject EVSEStatus data.
      };
      return evse;
    });
    // Return all evses
    return evses;
  }

 /**
   * Converter Connector to OICP Charging Facility
   * @param {ChargingStation} chargingStation
   * @param connector
   * @param {*} connector
   */
  static convertConnector2OICPChargingFacility(chargingStation: ChargingStation, connector: Connector): OICPChargingFacility {
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
      Power: connector.power, // To be reviewed
      PowerType: [OICPMapping.convertNumberofConnectedPhase2PowerType(numberOfConnectedPhase)],
      Voltage:voltage,
      ChargingModes: [
        OICPChargingMode.Mode_1 // No mapping yet
        ]
     };
  }

  /**
   * Converter Connector to OICP Plug
   * @param connector
   * @param {*} connector
   */
  static convertConnector2OICPPlug(connector: Connector): OICPPlug {
    switch (connector.type) {
      case ConnectorType.CHADEMO:
        return OICPPlug.CHAdeMO;
      case ConnectorType.TYPE_2:
        return OICPPlug.Type2Outlet;
      case ConnectorType.COMBO_CCS:
        return OICPPlug.CCSCombo2PlugCableAttached;
      case ConnectorType.TYPE_1:
        return OICPPlug.Type1ConnectorCableAttached; // Has to be checked if cable is attached
      case ConnectorType.TYPE_3C:
        return OICPPlug.Type3Outlet;
      case ConnectorType.TYPE_1_CCS:
        return OICPPlug.CCSCombo1PlugCableAttached;
      case ConnectorType.DOMESTIC: // No corresponding type found
      case ConnectorType.UNKNOWN: // No corresponding type found
    }
  }

  /**
   * Convert internal Power (1/3 Phase) to PowerType
   * @param {*} power
   */
  static convertNumberofConnectedPhase2PowerType(numberOfConnectedPhase: number): OICPPower {
    switch (numberOfConnectedPhase) {
      case 0:
        return OICPPower.DC;
      case 1:
        return OICPPower.AC_1_PHASE;
      case 3:
        return OICPPower.AC_3_PHASE;
    }
  }

  static getOICPAddressIso19773FromSite(site: Site): OICPAddressIso19773 {
    return {
      Country: OICPMapping.convertCountry2CountryCode(site.address.country),
      City: site.address.city, // Field Length = 11-50
      Street: `${site.address.address1} ${site.address.address2}`, // Field Length = 2-100
      PostalCode: site.address.postalCode, // Field Length = 10
      HouseNum: '', // No specific house number field in site address
      // Floor?: site.address., // Field Length = 5
      Region:  site.address.region, // Field Length = 50
      // ParkingFacility?: site.,
      // ParkingSpot?: , // Field Length = 5
      // Timezone?: OICPTimezone,
    };
  }

  static convertCountry2CountryCode(country: string): OICPCountryCode { // The CountryCodeType allows for Alpha-3 country codes. For Alpha-3 (three-letter) country codes as defined in ISO 3166-1. Example: FRA France
    // To be done...
    // https://www.npmjs.com/package/country-code-lookup
    return 'country code';
  }

  static convertCoordinates2OICPGeoCoordinates(coordinates: number[], format: OICPGeoCoordinatesResponseFormat): OICPGeoCoordinates {
    switch (format) {
      case OICPGeoCoordinatesResponseFormat.Google:
        // To be done
        return {
          Google: {
            Coordinates: 'To be done'
          },
        };
      case OICPGeoCoordinatesResponseFormat.DecimalDegree:
        return {
          DecimalDegree: {
            Longitude: String(coordinates[1]),
            Latitude: String(coordinates[1])
          }
        };
      case OICPGeoCoordinatesResponseFormat.DegreeMinuteSeconds:
        // To be done
        return {
          DegreeMinuteSeconds: {
            Longitude: 'To be done',
            Latitude: 'To be done'
          },
        };
    }
  }

   /**
   * Build ChargingPoolID from charging station
   * @param {*} chargingStation
   */
  public static buildEChargingPoolID(countryCode: string, partyId: string,chargingStation: ChargingStation): OICPChargingPoolID {
    if (chargingStation.siteAreaID) {
      return `${countryCode}*${partyId}*P${chargingStation.siteAreaID}`;
    }
  }

}
