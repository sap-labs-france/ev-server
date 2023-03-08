import { ChargingProfile, ChargingProfilePurposeType } from '../../../types/ChargingProfile';
import ChargingStation, { ChargingStationCapabilities, ChargingStationTemplate, ChargingStationTemplateConnector, Command, Connector, ConnectorCurrentLimitSource, CurrentType, OcppParameter, SiteAreaLimitSource, StaticLimitAmps, TemplateUpdateResult } from '../../../types/ChargingStation';
import { OCPPChangeConfigurationResponse, OCPPChargingProfileStatus, OCPPConfigurationStatus } from '../../../types/ocpp/OCPPClient';
import { OCPPLocation, OCPPMeasurand, OCPPNormalizedMeterValue, OCPPPhase, OCPPReadingContext, OCPPStopTransactionRequestExtended, OCPPUnitOfMeasure, OCPPValueFormat } from '../../../types/ocpp/OCPPServer';
import Tenant, { TenantComponents } from '../../../types/Tenant';
import Transaction, { InactivityStatus } from '../../../types/Transaction';

import { ActionsResponse } from '../../../types/GlobalType';
import BackendError from '../../../exception/BackendError';
import BillingFactory from '../../../integration/billing/BillingFactory';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import ChargingStationVendorFactory from '../../../integration/charging-station-vendor/ChargingStationVendorFactory';
import Constants from '../../../utils/Constants';
import Consumption from '../../../types/Consumption';
import ConsumptionStorage from '../../../storage/mongodb/ConsumptionStorage';
import DatabaseUtils from '../../../storage/mongodb/DatabaseUtils';
import Logging from '../../../utils/Logging';
import LoggingHelper from '../../../utils/LoggingHelper';
import OCPPCommon from './OCPPCommon';
import { OCPPHeader } from '../../../types/ocpp/OCPPHeader';
import PricingFacade from '../../../integration/pricing/PricingFacade';
import { PricingSettingsType } from '../../../types/Setting';
import { Promise } from 'bluebird';
import RegistrationToken from '../../../types/RegistrationToken';
import RegistrationTokenStorage from '../../../storage/mongodb/RegistrationTokenStorage';
import { ServerAction } from '../../../types/Server';
import SiteArea from '../../../types/SiteArea';
import SiteAreaStorage from '../../../storage/mongodb/SiteAreaStorage';
import TenantStorage from '../../../storage/mongodb/TenantStorage';
import TransactionStorage from '../../../storage/mongodb/TransactionStorage';
import User from '../../../types/User';
import Utils from '../../../utils/Utils';
import _ from 'lodash';
import moment from 'moment';
import url from 'url';

const MODULE_NAME = 'OCPPUtils';

export default class OCPPUtils {
  public static buildServerActionFromOcppCommand(command: Command): ServerAction {
    if (command && typeof command === 'string') {
      return `Ocpp${command}` as ServerAction;
    }
    return ServerAction.UNKNOWN_ACTION;
  }

  public static async ensureChargingStationHasValidConnectionToken(action: ServerAction, tenant: Tenant,
      chargingStationID: string, tokenID: string): Promise<RegistrationToken> {
    // Check Token
    if (!tokenID) {
      throw new BackendError({
        action, chargingStationID,
        module: MODULE_NAME, method: 'ensureChargingStationHasValidConnectionToken',
        message: `Token ID is required in ${Utils.buildTenantName(tenant)}!`,
      });
    }
    if (!DatabaseUtils.isObjectID(tokenID)) {
      throw new BackendError({
        action, chargingStationID,
        module: MODULE_NAME, method: 'ensureChargingStationHasValidConnectionToken',
        message: `The Token ID '${tokenID}' is invalid in ${Utils.buildTenantName(tenant)}!`
      });
    }
    // Get the Token
    const token = await RegistrationTokenStorage.getRegistrationToken(tenant, tokenID);
    if (!token) {
      throw new BackendError({
        action, chargingStationID,
        module: MODULE_NAME, method: 'ensureChargingStationHasValidConnectionToken',
        message: `Token ID '${tokenID}' has not been found in ${Utils.buildTenantName(tenant)}!`,
      });
    }
    if (!token.expirationDate || moment().isAfter(token.expirationDate)) {
      throw new BackendError({
        action, chargingStationID,
        module: MODULE_NAME, method: 'ensureChargingStationHasValidConnectionToken',
        message: `Token ID '${tokenID}' has expired in ${Utils.buildTenantName(tenant)}!`,
      });
    }
    if (token.revocationDate && moment().isAfter(token.revocationDate)) {
      throw new BackendError({
        action, chargingStationID,
        module: MODULE_NAME, method: 'ensureChargingStationHasValidConnectionToken',
        message: `Token ID '${tokenID}' has been revoked in ${Utils.buildTenantName(tenant)}!`,
      });
    }
    return token;
  }

  public static async buildAndPriceExtraConsumptionInactivity(tenant: Tenant, user: User, chargingStation: ChargingStation, lastTransaction: Transaction): Promise<void> {
    const lastConsumption = await OCPPUtils.buildExtraConsumptionInactivity(tenant, lastTransaction);
    if (lastConsumption) {
      // Pricing of the extra inactivity
      if (lastConsumption?.toPrice) {
        await PricingFacade.processEndTransaction(tenant, lastTransaction, chargingStation, lastConsumption, user);
      }
      // Save the last consumption
      await ConsumptionStorage.saveConsumption(tenant, lastConsumption);
      // Update transaction stop
      lastTransaction.stop.timestamp = lastConsumption.endedAt;
      lastTransaction.stop.totalDurationSecs = moment.duration(moment(lastTransaction.stop.timestamp).diff(lastTransaction.timestamp)).asSeconds();
      lastTransaction.stop.price = lastTransaction.currentCumulatedPrice;
      lastTransaction.stop.roundedPrice = lastTransaction.currentCumulatedRoundedPrice;
    }
  }

  public static async buildExtraConsumptionInactivity(tenant: Tenant, transaction: Transaction): Promise<Consumption> {
    // Extra inactivity
    const extraInactivitySecs = transaction.stop?.extraInactivitySecs || 0;
    if (extraInactivitySecs > 0) {
      // Get the last Consumption
      const lastConsumption = await ConsumptionStorage.getLastTransactionConsumption(tenant, { transactionId: transaction.id });
      if (lastConsumption) {
        delete lastConsumption.id;
        // Create the extra consumption with inactivity
        lastConsumption.startedAt = transaction.stop.timestamp;
        lastConsumption.endedAt = moment(transaction.stop.timestamp).add(extraInactivitySecs, 's').toDate();
        lastConsumption.inactivitySecs = extraInactivitySecs;
        lastConsumption.totalDurationSecs = Utils.createDecimal(lastConsumption.totalDurationSecs).add(extraInactivitySecs).toNumber();
        lastConsumption.totalInactivitySecs = Utils.createDecimal(lastConsumption.totalInactivitySecs).add(extraInactivitySecs).toNumber();
        // Set inactivity
        lastConsumption.consumptionAmps = 0;
        lastConsumption.consumptionWh = 0;
        lastConsumption.instantAmps = 0;
        lastConsumption.instantAmpsDC = 0;
        lastConsumption.instantAmpsL1 = 0;
        lastConsumption.instantAmpsL2 = 0;
        lastConsumption.instantAmpsL3 = 0;
        lastConsumption.instantWatts = 0;
        lastConsumption.instantWattsDC = 0;
        lastConsumption.instantWattsL1 = 0;
        lastConsumption.instantWattsL2 = 0;
        lastConsumption.instantWattsL3 = 0;
        lastConsumption.toPrice = true;
        return lastConsumption;
      }
    }
    return null;
  }

  public static assertConsistencyInConsumption(chargingStation: ChargingStation, connectorID: number, consumption: Consumption): void {
    // Check Total Power with Meter Value Power L1, L2, L3
    if (consumption.instantWattsL1 > 0 || consumption.instantWattsL2 > 0 || consumption.instantWattsL3 > 0) {
      consumption.instantWattsL1 = Utils.convertToFloat(consumption.instantWattsL1);
      consumption.instantWattsL2 = Utils.convertToFloat(consumption.instantWattsL2);
      consumption.instantWattsL3 = Utils.convertToFloat(consumption.instantWattsL3);
      // Check total Power with L1/l2/L3
      const totalWatts = Utils.createDecimal(consumption.instantWattsL1).plus(consumption.instantWattsL2).plus(consumption.instantWattsL3).toNumber();
      // Tolerance ± 10%
      const minTotalWatts = totalWatts / 1.1;
      const maxTotalWatts = totalWatts * 1.1;
      // Out of bound limits?
      if (consumption.instantWatts < minTotalWatts || consumption.instantWatts > maxTotalWatts) {
        // Total Power is wrong: Override
        consumption.instantWatts = totalWatts;
      }
    }
    // Check Total Current with Meter Value Current L1, L2, L3 (Schneider Bug)
    if (consumption.instantAmpsL1 > 0 || consumption.instantAmpsL2 > 0 || consumption.instantAmpsL3 > 0) {
      consumption.instantAmpsL1 = Utils.convertToFloat(consumption.instantAmpsL1);
      consumption.instantAmpsL2 = Utils.convertToFloat(consumption.instantAmpsL2);
      consumption.instantAmpsL3 = Utils.convertToFloat(consumption.instantAmpsL3);
      // Check total Current with L1/l2/L3
      const totalAmps = Utils.createDecimal(consumption.instantAmpsL1).plus(consumption.instantAmpsL2).plus(consumption.instantAmpsL3).toNumber();
      // Tolerance ± 10%
      const minTotalAmps = totalAmps / 1.1;
      const maxTotalAmps = totalAmps * 1.1;
      // Out of bound limits?
      if (consumption.instantAmps < minTotalAmps || consumption.instantAmps > maxTotalAmps) {
        // Total Current is wrong: Override
        consumption.instantAmps = totalAmps;
      }
    }
    // Power Active Import not provided in Meter Value
    if (!consumption.instantWatts) {
      // Based on provided Amps/Volts
      if (consumption.instantAmps > 0) {
        if (consumption.instantVolts > 0) {
          consumption.instantWatts = Utils.createDecimal(consumption.instantVolts).mul(consumption.instantAmps).toNumber();
        } else {
          consumption.instantWatts = Utils.convertAmpToWatt(chargingStation, null, connectorID, consumption.instantAmps);
        }
        // Based on provided Consumption
      } else {
        // Compute average Instant Power based on consumption over a time period (usually 60s)
        const diffSecs = moment(consumption.endedAt).diff(consumption.startedAt, 'milliseconds') / 1000;
        // Consumption is always provided
        const sampleMultiplierWhToWatt = diffSecs > 0 ? Utils.createDecimal(3600).div(diffSecs).toNumber() : 0;
        consumption.instantWatts = Utils.createDecimal(consumption.consumptionWh).mul(sampleMultiplierWhToWatt).toNumber();
      }
    }
    // Current not provided in Meter Value
    if (!consumption.instantAmps) {
      // Backup on Instant Watts
      if (consumption.instantWatts > 0) {
        if (consumption.instantVolts > 0) {
          consumption.instantAmps = Utils.createDecimal(consumption.instantWatts).div(consumption.instantVolts).toNumber();
        } else {
          consumption.instantAmps = Utils.convertWattToAmp(chargingStation, null, connectorID, consumption.instantWatts);
        }
      }
    }
    // Fill Power per Phase when Current is provided in Meter Values (Power per phase not Provided by Schneider)
    if (!consumption.instantWattsL1 && !consumption.instantWattsL2 && !consumption.instantWattsL3 &&
      (consumption.instantAmpsL1 > 0 || consumption.instantAmpsL2 > 0 || consumption.instantAmpsL3 > 0)) {
      if (consumption.instantVoltsL1 > 0) {
        consumption.instantWattsL1 = Utils.createDecimal(consumption.instantAmpsL1).mul(consumption.instantVoltsL1).toNumber();
      } else {
        consumption.instantWattsL1 = Utils.convertAmpToWatt(chargingStation, null, connectorID, consumption.instantAmpsL1);
      }
      if (consumption.instantVoltsL2 > 0) {
        consumption.instantWattsL2 = Utils.createDecimal(consumption.instantAmpsL2).mul(consumption.instantVoltsL2).toNumber();
      } else {
        consumption.instantWattsL2 = Utils.convertAmpToWatt(chargingStation, null, connectorID, consumption.instantAmpsL2);
      }
      if (consumption.instantVoltsL3 > 0) {
        consumption.instantWattsL3 = Utils.createDecimal(consumption.instantAmpsL3).mul(consumption.instantVoltsL3).toNumber();
      } else {
        consumption.instantWattsL3 = Utils.convertAmpToWatt(chargingStation, null, connectorID, consumption.instantAmpsL3);
      }
    }
    // Fill Power per Phase
    if (!consumption.instantWattsDC && consumption.instantAmpsDC > 0 && consumption.instantVoltsDC > 0) {
      consumption.instantWattsDC = Utils.createDecimal(consumption.instantAmpsDC).mul(consumption.instantVoltsDC).toNumber();
    }
  }

  public static updateTransactionWithConsumption(chargingStation: ChargingStation, transaction: Transaction, consumption: Consumption): void {
    // Set Consumption (currentTotalConsumptionWh, currentTotalInactivitySecs are updated in consumption creation)
    transaction.currentConsumptionWh = Utils.convertToFloat(consumption.consumptionWh);
    transaction.currentTotalConsumptionWh = Utils.convertToFloat(consumption.cumulatedConsumptionWh);
    transaction.currentInstantWatts = Utils.convertToFloat(consumption.instantWatts);
    transaction.currentInstantWattsL1 = Utils.convertToFloat(consumption.instantWattsL1);
    transaction.currentInstantWattsL2 = Utils.convertToFloat(consumption.instantWattsL2);
    transaction.currentInstantWattsL3 = Utils.convertToFloat(consumption.instantWattsL3);
    transaction.currentInstantWattsDC = Utils.convertToFloat(consumption.instantWattsDC);
    transaction.currentInstantVolts = Utils.convertToFloat(consumption.instantVolts);
    transaction.currentInstantVoltsL1 = Utils.convertToFloat(consumption.instantVoltsL1);
    transaction.currentInstantVoltsL2 = Utils.convertToFloat(consumption.instantVoltsL2);
    transaction.currentInstantVoltsL3 = Utils.convertToFloat(consumption.instantVoltsL3);
    transaction.currentInstantVoltsDC = Utils.convertToFloat(consumption.instantVoltsDC);
    transaction.currentInstantAmps = Utils.convertToFloat(consumption.instantAmps);
    transaction.currentInstantAmpsL1 = Utils.convertToFloat(consumption.instantAmpsL1);
    transaction.currentInstantAmpsL2 = Utils.convertToFloat(consumption.instantAmpsL2);
    transaction.currentInstantAmpsL3 = Utils.convertToFloat(consumption.instantAmpsL3);
    transaction.currentInstantAmpsDC = Utils.convertToFloat(consumption.instantAmpsDC);
    transaction.currentTimestamp = Utils.convertToDate(consumption.endedAt);
    transaction.currentStateOfCharge = Utils.convertToInt(consumption.stateOfCharge);
    // If Transaction.Begin not provided (DELTA)
    if (!transaction.stateOfCharge) {
      transaction.stateOfCharge = Utils.convertToInt(transaction.currentStateOfCharge);
    }
    transaction.currentTotalDurationSecs = moment.duration(
      moment(transaction.lastConsumption ? transaction.lastConsumption.timestamp : new Date()).diff(moment(transaction.timestamp))).asSeconds();
    transaction.currentInactivityStatus = Utils.getInactivityStatusLevel(
      chargingStation, transaction.connectorId, transaction.currentTotalInactivitySecs);
  }

  public static async rebuildTransactionSimplePricing(tenant: Tenant, transaction: Transaction, pricePerkWh?: number): Promise<void> {
    if (!transaction) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action: ServerAction.REBUILD_TRANSACTION_CONSUMPTIONS,
        module: MODULE_NAME, method: 'rebuildTransactionSimplePricing',
        message: 'Transaction does not exist',
      });
    }
    if (!transaction.stop) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action: ServerAction.REBUILD_TRANSACTION_CONSUMPTIONS,
        module: MODULE_NAME, method: 'rebuildTransactionSimplePricing',
        message: `Transaction ID '${transaction.id}' is in progress`,
      });
    }
    if (transaction.stop.pricingSource !== PricingSettingsType.SIMPLE) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action: ServerAction.REBUILD_TRANSACTION_CONSUMPTIONS,
        module: MODULE_NAME, method: 'rebuildTransactionSimplePricing',
        message: `Transaction ID '${transaction.id}' was not priced with simple pricing`,
      });
    }
    // Retrieve price per kWh
    const transactionSimplePricePerkWh = pricePerkWh > 0 ? pricePerkWh : Utils.roundTo(transaction.stop.price / (transaction.stop.totalConsumptionWh / 1000), 2);
    // Get the consumptions
    const consumptionDataResult = await ConsumptionStorage.getTransactionConsumptions(
      tenant, { transactionId: transaction.id });
    transaction.currentCumulatedPrice = 0;
    const consumptions = consumptionDataResult.result;
    for (const consumption of consumptions) {
      // Update the price
      consumption.amount = Utils.computeSimplePrice(transactionSimplePricePerkWh, consumption.consumptionWh);
      consumption.roundedAmount = Utils.truncTo(consumption.amount, 2);
      transaction.currentCumulatedPrice = Utils.createDecimal(transaction.currentCumulatedPrice).plus(consumption.amount).toNumber();
      consumption.cumulatedAmount = transaction.currentCumulatedPrice;
    }
    // Delete consumptions
    await ConsumptionStorage.deleteConsumptions(tenant, [transaction.id]);
    // Save all
    await ConsumptionStorage.saveConsumptions(tenant, consumptions);
    // Update transaction
    transaction.roundedPrice = Utils.truncTo(transaction.price, 2);
    transaction.stop.price = transaction.currentCumulatedPrice;
    transaction.stop.roundedPrice = transaction.currentCumulatedRoundedPrice;
    await TransactionStorage.saveTransaction(tenant, transaction);
  }

  public static updateTransactionWithStopTransaction(transaction: Transaction, chargingStation: ChargingStation,
      stopTransaction: OCPPStopTransactionRequestExtended, user: User, alternateUser: User, tagId: string, isSoftStop: boolean): void {
    // Set final data
    transaction.stop = {
      reason: stopTransaction.reason,
      meterStop: stopTransaction.meterStop,
      timestamp: Utils.convertToDate(stopTransaction.timestamp),
      userID: (alternateUser ? alternateUser.id : (user ? user.id : null)),
      tagID: tagId,
      extraInactivityComputed: isSoftStop,
      extraInactivitySecs: 0,
      stateOfCharge: transaction.currentStateOfCharge,
      signedData: transaction.currentSignedData ? transaction.currentSignedData : '',
      totalConsumptionWh: transaction.currentTotalConsumptionWh,
      totalInactivitySecs: transaction.currentTotalInactivitySecs,
      totalDurationSecs: transaction.currentTotalDurationSecs,
      inactivityStatus: Utils.getInactivityStatusLevel(chargingStation, transaction.connectorId, transaction.currentTotalInactivitySecs),
      price: transaction.currentCumulatedPrice,
      roundedPrice: transaction.currentCumulatedRoundedPrice,
      priceUnit: transaction.priceUnit,
      pricingSource: transaction.pricingSource,
    };
  }

  public static createTransactionStopMeterValues(chargingStation: ChargingStation, transaction: Transaction,
      stopTransaction: OCPPStopTransactionRequestExtended): OCPPNormalizedMeterValue[] {
    const stopMeterValues: OCPPNormalizedMeterValue[] = [];
    const meterValueBasedProps = {
      chargeBoxID: transaction.chargeBoxID,
      siteID: transaction.siteID,
      siteAreaID: transaction.siteAreaID,
      companyID: transaction.companyID,
      connectorId: transaction.connectorId,
      transactionId: transaction.id,
      timestamp: Utils.convertToDate(stopTransaction.timestamp),
    };
    let id = Utils.getRandomIntSafe();
    // Energy
    stopMeterValues.push({
      id: (id++).toString(),
      ...meterValueBasedProps,
      value: stopTransaction.meterStop,
      attribute: Constants.OCPP_ENERGY_ACTIVE_IMPORT_REGISTER_ATTRIBUTE
    });
    // Add SoC
    if (transaction.currentStateOfCharge > 0) {
      stopMeterValues.push({
        id: (id++).toString(),
        ...meterValueBasedProps,
        value: transaction.currentStateOfCharge,
        attribute: Constants.OCPP_SOC_ATTRIBUTE
      });
    }
    // Add Voltage
    if (transaction.currentInstantVolts > 0 || transaction.currentInstantVoltsDC > 0) {
      stopMeterValues.push({
        id: (id++).toString(),
        ...meterValueBasedProps,
        value: (transaction.currentInstantVolts ? transaction.currentInstantVolts : transaction.currentInstantVoltsDC),
        attribute: Constants.OCPP_VOLTAGE_ATTRIBUTE
      });
    }
    // Add Voltage L1
    if (transaction.currentInstantVoltsL1 > 0) {
      stopMeterValues.push({
        id: (id++).toString(),
        ...meterValueBasedProps,
        value: transaction.currentInstantVoltsL1,
        attribute: Constants.OCPP_VOLTAGE_L1_ATTRIBUTE
      });
    }
    // Add Voltage L2
    if (transaction.currentInstantVoltsL2 > 0) {
      stopMeterValues.push({
        id: (id++).toString(),
        ...meterValueBasedProps,
        value: transaction.currentInstantVoltsL2,
        attribute: Constants.OCPP_VOLTAGE_L2_ATTRIBUTE
      });
    }
    // Add Voltage L3
    if (transaction.currentInstantVoltsL3 > 0) {
      stopMeterValues.push({
        id: (id++).toString(),
        ...meterValueBasedProps,
        value: transaction.currentInstantVoltsL3,
        attribute: Constants.OCPP_VOLTAGE_L3_ATTRIBUTE
      });
    }
    // Add Current
    if (transaction.currentInstantAmps > 0 || transaction.currentInstantAmpsDC > 0) {
      stopMeterValues.push({
        id: (id++).toString(),
        ...meterValueBasedProps,
        value: (transaction.currentInstantAmps
          ? transaction.currentInstantAmps / Utils.getNumberOfConnectedPhases(chargingStation, null, transaction.connectorId)
          : transaction.currentInstantAmpsDC),
        attribute: Constants.OCPP_CURRENT_IMPORT_ATTRIBUTE
      });
    }
    // Add Current L1
    if (transaction.currentInstantAmpsL1 > 0) {
      stopMeterValues.push({
        id: (id++).toString(),
        ...meterValueBasedProps,
        value: transaction.currentInstantAmpsL1,
        attribute: Constants.OCPP_CURRENT_IMPORT_L1_ATTRIBUTE
      });
    }
    // Add Current L2
    if (transaction.currentInstantAmpsL2 > 0) {
      stopMeterValues.push({
        id: (id++).toString(),
        ...meterValueBasedProps,
        value: transaction.currentInstantAmpsL2,
        attribute: Constants.OCPP_CURRENT_IMPORT_L2_ATTRIBUTE
      });
    }
    // Add Current L3
    if (transaction.currentInstantAmpsL3 > 0) {
      stopMeterValues.push({
        id: (id++).toString(),
        ...meterValueBasedProps,
        value: transaction.currentInstantAmpsL3,
        attribute: Constants.OCPP_CURRENT_IMPORT_L3_ATTRIBUTE
      });
    }
    // Add Power
    if (transaction.currentInstantWatts > 0 || transaction.currentInstantWattsDC > 0) {
      stopMeterValues.push({
        id: (id++).toString(),
        ...meterValueBasedProps,
        value: (transaction.currentInstantWatts ? transaction.currentInstantWatts : transaction.currentInstantWattsDC),
        attribute: Constants.OCPP_POWER_ACTIVE_IMPORT_ATTRIBUTE
      });
    }
    // Add Power L1
    if (transaction.currentInstantWattsL1 > 0) {
      stopMeterValues.push({
        id: (id++).toString(),
        ...meterValueBasedProps,
        value: transaction.currentInstantWattsL1,
        attribute: Constants.OCPP_POWER_ACTIVE_IMPORT_L1_ATTRIBUTE
      });
    }
    // Add Power L2
    if (transaction.currentInstantWattsL2 > 0) {
      stopMeterValues.push({
        id: (id++).toString(),
        ...meterValueBasedProps,
        value: transaction.currentInstantWattsL2,
        attribute: Constants.OCPP_POWER_ACTIVE_IMPORT_L2_ATTRIBUTE
      });
    }
    // Add Power L3
    if (transaction.currentInstantWattsL3 > 0) {
      stopMeterValues.push({
        id: (id++).toString(),
        ...meterValueBasedProps,
        value: transaction.currentInstantWattsL3,
        attribute: Constants.OCPP_POWER_ACTIVE_IMPORT_L3_ATTRIBUTE
      });
    }
    return stopMeterValues;
  }

  public static async createConsumptionsFromMeterValues(tenant: Tenant, chargingStation: ChargingStation,
      transaction: Transaction, meterValues: OCPPNormalizedMeterValue[]): Promise<Consumption[]> {
    // Build consumptions
    const consumptions: Consumption[] = [];
    for (const meterValue of meterValues) {
      // Meter Value Handling
      if (OCPPUtils.isValidMeterValue(meterValue)) {
        // Meter Value is in the past
        if (transaction.lastConsumption?.timestamp && meterValue.timestamp &&
            moment(meterValue?.timestamp).isBefore(moment(transaction?.lastConsumption?.timestamp))) {
          await Logging.logError({
            ...LoggingHelper.getChargingStationProperties(chargingStation),
            tenantID: tenant.id,
            module: MODULE_NAME, method: 'createConsumptionsFromMeterValues',
            action: ServerAction.OCPP_METER_VALUES,
            message: 'Meter Value is in the past and will be ignored',
            detailedMessages: { meterValue, transactionData: LoggingHelper.shrinkTransactionProperties(transaction) }
          });
          continue;
        }
        // Build Consumption and Update Transaction with Meter Values
        const consumption = await this.createConsumptionFromMeterValue(tenant, chargingStation, transaction, transaction.lastConsumption, meterValue);
        if (consumption) {
          // Existing Consumption created?
          const existingConsumption = consumptions.find(
            (c) => c.endedAt.getTime() === consumption.endedAt.getTime());
          if (existingConsumption) {
            // Update properties
            for (const property in consumption) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              existingConsumption[property] = consumption[property];
            }
          } else {
            // Add new
            consumptions.push(consumption);
          }
        }
      }
    }
    // Add missing info
    for (const consumption of consumptions) {
      OCPPUtils.assertConsistencyInConsumption(chargingStation, transaction.connectorId, consumption);
    }
    // Sort consumptions by date
    consumptions.sort((a,b) => a.startedAt.getTime() - b.startedAt.getTime());
    return consumptions;
  }

  public static async createFirstConsumption(tenant: Tenant, chargingStation: ChargingStation, transaction: Transaction): Promise<Consumption> {
    const lastConsumption: { value: number; timestamp: Date } = { timestamp: transaction.timestamp, value: transaction.meterStart };
    const meterValue: OCPPNormalizedMeterValue = {
      id: Utils.getRandomIntSafe().toString(),
      chargeBoxID: transaction.chargeBoxID,
      siteID: transaction.siteID,
      siteAreaID: transaction.siteAreaID,
      companyID: transaction.companyID,
      connectorId: transaction.connectorId,
      transactionId: transaction.id,
      timestamp: transaction.timestamp,
      value: transaction.meterStart,
      attribute: Constants.OCPP_ENERGY_ACTIVE_IMPORT_REGISTER_ATTRIBUTE
    };
    return OCPPUtils.createConsumptionFromMeterValue(tenant, chargingStation, transaction, lastConsumption, meterValue);
  }

  public static async createConsumptionFromMeterValue(tenant: Tenant, chargingStation: ChargingStation, transaction: Transaction,
      lastConsumption: { value: number; timestamp: Date }, meterValue: OCPPNormalizedMeterValue): Promise<Consumption> {
    // Only Consumption and SoC (No consumption for Transaction Begin/End: scenario already handled in Start/Stop Transaction)
    if (OCPPUtils.isValidMeterValue(meterValue)) {
      // First meter value: Create one based on the transaction
      if (!lastConsumption) {
        lastConsumption = {
          timestamp: transaction.timestamp,
          value: transaction.meterStart,
        };
      }
      // Init
      const consumption: Consumption = {
        transactionId: transaction.id,
        connectorId: transaction.connectorId,
        chargeBoxID: transaction.chargeBoxID,
        siteAreaID: transaction.siteAreaID,
        siteID: transaction.siteID,
        userID: transaction.userID,
        endedAt: Utils.convertToDate(meterValue.timestamp),
      } as Consumption;
      // Handle SoC (%)
      if (OCPPUtils.isSocMeterValue(meterValue)) {
        consumption.stateOfCharge = Utils.convertToFloat(meterValue.value);
      // Handle Power (W/kW)
      } else if (OCPPUtils.isPowerActiveImportMeterValue(meterValue)) {
        // Compute power
        const powerInMeterValue = Utils.convertToFloat(meterValue.value);
        const powerInMeterValueWatts = meterValue.attribute?.unit === OCPPUnitOfMeasure.KILO_WATT ?
          Utils.createDecimal(powerInMeterValue).mul(1000).toNumber() : powerInMeterValue;
        const currentType = Utils.getChargingStationCurrentType(chargingStation, null, transaction.connectorId);
        switch (currentType) {
          case CurrentType.DC:
            consumption.instantWattsDC = powerInMeterValueWatts;
            break;
          case CurrentType.AC:
            switch (meterValue.attribute?.phase) {
              case OCPPPhase.L1_N:
              case OCPPPhase.L1:
                consumption.instantWattsL1 = powerInMeterValueWatts;
                break;
              case OCPPPhase.L2_N:
              case OCPPPhase.L2:
                consumption.instantWattsL2 = powerInMeterValueWatts;
                break;
              case OCPPPhase.L3_N:
              case OCPPPhase.L3:
                consumption.instantWattsL3 = powerInMeterValueWatts;
                break;
              default:
                consumption.instantWatts = powerInMeterValueWatts;
                break;
            }
            break;
        }
      // Handle Voltage (V)
      } else if (OCPPUtils.isVoltageMeterValue(meterValue)) {
        const voltage = Utils.convertToFloat(meterValue.value);
        const currentType = Utils.getChargingStationCurrentType(chargingStation, null, transaction.connectorId);
        switch (currentType) {
          case CurrentType.DC:
            consumption.instantVoltsDC = voltage;
            break;
          case CurrentType.AC:
            switch (meterValue.attribute.phase) {
              case OCPPPhase.L1_N:
              case OCPPPhase.L1:
                consumption.instantVoltsL1 = voltage;
                break;
              case OCPPPhase.L2_N:
              case OCPPPhase.L2:
                consumption.instantVoltsL2 = voltage;
                break;
              case OCPPPhase.L3_N:
              case OCPPPhase.L3:
                consumption.instantVoltsL3 = voltage;
                break;
              case OCPPPhase.L1_L2:
              case OCPPPhase.L2_L3:
              case OCPPPhase.L3_L1:
                // Do nothing
                break;
              default:
                consumption.instantVolts = voltage;
                break;
            }
            break;
        }
      // Handle Current (A)
      } else if (OCPPUtils.isCurrentImportMeterValue(meterValue)) {
        const amperage = Utils.convertToFloat(meterValue.value);
        const currentType = Utils.getChargingStationCurrentType(chargingStation, null, transaction.connectorId);
        switch (currentType) {
          case CurrentType.DC:
            consumption.instantAmpsDC = amperage;
            break;
          case CurrentType.AC:
            switch (meterValue.attribute.phase) {
              case OCPPPhase.L1:
                consumption.instantAmpsL1 = amperage;
                break;
              case OCPPPhase.L2:
                consumption.instantAmpsL2 = amperage;
                break;
              case OCPPPhase.L3:
                consumption.instantAmpsL3 = amperage;
                break;
              default:
                // MeterValue Current.Import is per phase and consumption currentInstantAmps attribute expect the total amperage
                consumption.instantAmps = amperage * Utils.getNumberOfConnectedPhases(chargingStation, null, transaction.connectorId);
                break;
            }
            break;
        }
      // Handle Consumption (Wh/kWh)
      } else if (OCPPUtils.isEnergyActiveImportMeterValue(meterValue)) {
        // Complete consumption
        consumption.startedAt = Utils.convertToDate(lastConsumption.timestamp);
        const durationSecs = Utils.createDecimal(moment(meterValue.timestamp).diff(lastConsumption.timestamp, 'milliseconds')).div(1000).toNumber();
        // Handle current Connector limitation
        await OCPPUtils.addConnectorLimitationToConsumption(tenant, chargingStation, transaction.connectorId, consumption);
        // Handle current Site Area limitation
        await OCPPUtils.addSiteLimitationToConsumption(tenant, chargingStation.siteArea, consumption);
        // Convert to Wh
        const meterValueWh = meterValue.attribute.unit === OCPPUnitOfMeasure.KILO_WATT_HOUR ?
          Utils.createDecimal(Utils.convertToFloat(meterValue.value)).mul(1000).toNumber() : Utils.convertToFloat(meterValue.value);
        // Check if valid Consumption
        if (meterValueWh > lastConsumption.value) {
          // Compute consumption
          consumption.consumptionWh = Utils.createDecimal(meterValueWh).minus(lastConsumption.value).toNumber();
          consumption.consumptionAmps = Utils.convertWattToAmp(chargingStation, null, transaction.connectorId, consumption.consumptionWh);
          // Cumulated Consumption
          transaction.currentTotalConsumptionWh = Utils.createDecimal(transaction.currentTotalConsumptionWh).plus(consumption.consumptionWh).toNumber();
          // Keep the last consumption
          transaction.lastConsumption = {
            value: meterValueWh,
            timestamp: Utils.convertToDate(meterValue.timestamp)
          };
        // No Consumption
        } else {
          // Keep the last consumption only if not <
          if (meterValueWh === lastConsumption.value) {
            transaction.lastConsumption = {
              value: meterValueWh,
              timestamp: Utils.convertToDate(meterValue.timestamp)
            };
          }
          consumption.consumptionWh = 0;
          consumption.consumptionAmps = 0;
          if (consumption.limitSource !== ConnectorCurrentLimitSource.CHARGING_PROFILE ||
              consumption.limitAmps >= StaticLimitAmps.MIN_LIMIT_PER_PHASE * Utils.getNumberOfConnectedPhases(chargingStation, null, transaction.connectorId)) {
            // Update inactivity
            transaction.currentTotalInactivitySecs = Utils.createDecimal(transaction.currentTotalInactivitySecs).plus(durationSecs).toNumber();
            consumption.inactivitySecs = durationSecs;
            consumption.totalInactivitySecs = transaction.currentTotalInactivitySecs;
          }
        }
        consumption.cumulatedConsumptionWh = transaction.currentTotalConsumptionWh;
        consumption.cumulatedConsumptionAmps = Utils.convertWattToAmp(
          chargingStation, null, transaction.connectorId, transaction.currentTotalConsumptionWh);
        consumption.totalDurationSecs = !transaction.stop ?
          moment.duration(moment(meterValue.timestamp).diff(moment(transaction.timestamp))).asSeconds() :
          moment.duration(moment(transaction.stop.timestamp).diff(moment(transaction.timestamp))).asSeconds();
        consumption.cumulatedAmount = transaction.currentCumulatedPrice;
        consumption.pricingSource = transaction.pricingSource;
        consumption.toPrice = true;
      }
      return consumption;
    }
  }

  public static async addSiteLimitationToConsumption(tenant: Tenant, siteArea: SiteArea, consumption: Consumption): Promise<void> {
    if (Utils.isTenantComponentActive(tenant, TenantComponents.ORGANIZATION) && siteArea) {
      // Get limit of the site area
      consumption.limitSiteAreaWatts = 0;
      // Maximum power of the Site Area provided?
      if (siteArea && siteArea.maximumPower) {
        consumption.limitSiteAreaWatts = siteArea.maximumPower;
        consumption.limitSiteAreaAmps = Utils.createDecimal(siteArea.maximumPower).div(siteArea.voltage).toNumber();
        consumption.limitSiteAreaSource = SiteAreaLimitSource.SITE_AREA;
      } else {
        // Compute it for Charging Stations
        const chargingStationsOfSiteArea = await ChargingStationStorage.getChargingStations(tenant,
          { siteAreaIDs: [siteArea.id], withSiteArea: true }, Constants.DB_PARAMS_MAX_LIMIT);
        for (const chargingStationOfSiteArea of chargingStationsOfSiteArea.result) {
          if (Utils.objectHasProperty(chargingStationOfSiteArea, 'connectors')) {
            for (const connector of chargingStationOfSiteArea.connectors) {
              consumption.limitSiteAreaWatts = Utils.createDecimal(consumption.limitSiteAreaWatts).plus(connector.power).toNumber();
            }
          }
        }
        consumption.limitSiteAreaAmps = Math.round(consumption.limitSiteAreaWatts / siteArea.voltage);
        consumption.limitSiteAreaSource = SiteAreaLimitSource.CHARGING_STATIONS;
        // Save Site Area max consumption
        if (siteArea) {
          siteArea.maximumPower = consumption.limitSiteAreaWatts;
          await SiteAreaStorage.saveSiteArea(tenant, siteArea);
        }
      }
      consumption.smartChargingActive = siteArea.smartCharging;
    }
  }

  public static async addConnectorLimitationToConsumption(tenant: Tenant, chargingStation: ChargingStation,
      connectorID: number, consumption: Consumption): Promise<void> {
    const chargingStationVendor = ChargingStationVendorFactory.getChargingStationVendorImpl(chargingStation);
    if (chargingStationVendor) {
      // Get current limitation
      const connector = Utils.getConnectorFromID(chargingStation, connectorID);
      const chargePoint = Utils.getChargePointFromID(chargingStation, connector?.chargePointID);
      const connectorLimit = await chargingStationVendor.getCurrentConnectorLimit(tenant, chargingStation, chargePoint, connectorID);
      consumption.limitAmps = connectorLimit.limitAmps;
      consumption.limitWatts = connectorLimit.limitWatts;
      consumption.limitSource = connectorLimit.limitSource;
    } else {
      // Default
      const connector = Utils.getConnectorFromID(chargingStation, connectorID);
      consumption.limitAmps = connector?.amperageLimit;
      consumption.limitWatts = connector?.power;
      consumption.limitSource = ConnectorCurrentLimitSource.CONNECTOR;
    }
  }

  public static async getChargingStationTemplate(chargingStation: ChargingStation): Promise<ChargingStationTemplate> {
    let foundTemplate: ChargingStationTemplate = null;
    // Get the Templates
    const chargingStationTemplates: ChargingStationTemplate[] = await ChargingStationStorage.getChargingStationTemplates(chargingStation.chargePointVendor);
    // Parse them
    for (const chargingStationTemplate of chargingStationTemplates) {
      // Keep it
      foundTemplate = chargingStationTemplate;
      // Browse filter for extra matching
      for (const filter in chargingStationTemplate.template.extraFilters) {
        if (Utils.objectHasProperty(chargingStation, filter)) {
          const filterValue: string = chargingStationTemplate.template.extraFilters[filter];
          if (!(new RegExp(filterValue).test(chargingStation[filter]))) {
            foundTemplate = null;
            break;
          }
        }
      }
      // Found?
      if (foundTemplate) {
        break;
      }
    }
    return foundTemplate;
  }

  public static async enrichChargingStationConnectorWithTemplate(
      tenant: Tenant, chargingStation: ChargingStation, connector: Connector): Promise<boolean> {
    if (chargingStation.manualConfiguration) {
      // Check that the Connector is in the Charge Point: Case where the charger got applied a template with an unknown connector in Manual Config
      if (!Utils.isEmptyArray(chargingStation.chargePoints) &&
          !chargingStation.chargePoints[0].connectorIDs.includes(connector.connectorId)) {
        // Add unknown Connector ID
        chargingStation.chargePoints[0].connectorIDs.push(connector.connectorId);
      }
      await Logging.logWarning({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
        module: MODULE_NAME, method: 'enrichChargingStationConnectorWithTemplate',
        message: `Template for Connector ID '${connector.connectorId}' cannot be applied on manual configured charging station`,
        detailedMessages: { chargingStation, connector }
      });
      return false;
    }
    // Get template
    const chargingStationTemplate = await OCPPUtils.getChargingStationTemplate(chargingStation);
    if (chargingStationTemplate) {
      // Handle connector
      if (!Utils.isEmptyArray(chargingStationTemplate.template.technical?.connectors)) {
        let foundTemplateConnector: ChargingStationTemplateConnector;
        // Master/Slave: Always take the first
        if (chargingStationTemplate.template.technical.masterSlave) {
          foundTemplateConnector = chargingStationTemplate.template.technical.connectors[0];
        // Find the connector in the template
        } else {
          foundTemplateConnector = chargingStationTemplate.template.technical.connectors.find(
            (templateConnector) => templateConnector.connectorId === connector.connectorId);
        }
        // Not found but not master/salve
        if (!foundTemplateConnector) {
          await Logging.logError({
            ...LoggingHelper.getChargingStationProperties(chargingStation),
            tenantID: tenant.id,
            action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
            module: MODULE_NAME, method: 'enrichChargingStationConnectorWithTemplate',
            message: `Connector ID '${connector.connectorId}' not found in Template ID '${chargingStationTemplate.id}' on '${chargingStation.chargePointVendor}'`
          });
          return false;
        }
        // Update Connector
        connector.type = foundTemplateConnector.type;
        if (Utils.objectHasProperty(foundTemplateConnector, 'power')) {
          connector.power = foundTemplateConnector.power;
        } else {
          delete connector.power;
        }
        if (Utils.objectHasProperty(foundTemplateConnector, 'amperage')) {
          connector.amperage = foundTemplateConnector.amperage;
        } else {
          delete connector.amperage;
        }
        if (Utils.objectHasProperty(foundTemplateConnector, 'chargePointID')) {
          connector.chargePointID = foundTemplateConnector.chargePointID;
        } else {
          delete connector.chargePointID;
        }
        if (Utils.objectHasProperty(foundTemplateConnector, 'voltage')) {
          connector.voltage = foundTemplateConnector.voltage;
        } else {
          delete connector.voltage;
        }
        if (Utils.objectHasProperty(foundTemplateConnector, 'currentType')) {
          connector.currentType = foundTemplateConnector.currentType;
        } else {
          delete connector.currentType;
        }
        if (Utils.objectHasProperty(foundTemplateConnector, 'numberOfConnectedPhase')) {
          connector.numberOfConnectedPhase = foundTemplateConnector.numberOfConnectedPhase;
        } else {
          delete connector.numberOfConnectedPhase;
        }
        // Master/Slave: Adjust the Charge Point
        if (chargingStationTemplate.template.technical.masterSlave) {
          OCPPUtils.adjustChargingStationChargePointForMasterSlave(chargingStation);
        }
        const numberOfPhases = Utils.getNumberOfConnectedPhases(chargingStation, null, connector.connectorId);
        // Amperage limit
        OCPPUtils.checkAndSetConnectorAmperageLimit(chargingStation, connector, numberOfPhases);
        // Phase Assignment
        if (!Utils.objectHasProperty(connector, 'phaseAssignmentToGrid')) {
          await OCPPUtils.setConnectorPhaseAssignment(tenant, chargingStation, connector, numberOfPhases);
        }
        // Success
        await Logging.logInfo({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          tenantID: tenant.id,
          action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
          module: MODULE_NAME, method: 'enrichChargingStationConnectorWithTemplate',
          message: `Template ID '${chargingStationTemplate.id}' has been applied on Connector ID '${connector.connectorId}' with success`,
          detailedMessages: { chargingStationTemplate, chargingStation }
        });
        return true;
      }
      // No Connector in Template
      await Logging.logError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
        module: MODULE_NAME, method: 'enrichChargingStationConnectorWithTemplate',
        message: `No Connector found in Template ID '${chargingStationTemplate.id}'`,
        detailedMessages: { chargingStationTemplate, chargingStation }
      });
      return false;
    }
    // No Template
    await Logging.logInfo({
      ...LoggingHelper.getChargingStationProperties(chargingStation),
      tenantID: tenant.id,
      action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
      module: MODULE_NAME, method: 'enrichChargingStationConnectorWithTemplate',
      message: 'No Template has been found for this Charging Station',
      detailedMessages: { chargingStation, connector }
    });
    return false;
  }

  public static async checkAndApplyTemplateToChargingStation(tenant: Tenant, chargingStation: ChargingStation, applyOcppParameters = true): Promise<TemplateUpdateResult> {
    // Apply Template
    const chargingStationTemplateUpdateResult = await OCPPUtils.enrichChargingStationWithTemplate(tenant, chargingStation);
    if (chargingStationTemplateUpdateResult.chargingStationUpdated) {
      // Request OCPP parameters from Charging Station
      if (applyOcppParameters && (chargingStationTemplateUpdateResult.ocppStandardUpdated || chargingStationTemplateUpdateResult.ocppVendorUpdated)) {
        await OCPPUtils.applyTemplateOcppParametersToChargingStation(tenant, chargingStation);
      }
    }
    return chargingStationTemplateUpdateResult;
  }

  public static async applyTemplateOcppParametersToChargingStation(tenant: Tenant, chargingStation: ChargingStation): Promise<OCPPChangeConfigurationResponse> {
    await Logging.logInfo({
      ...LoggingHelper.getChargingStationProperties(chargingStation),
      tenantID: tenant.id,
      action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
      module: MODULE_NAME, method: 'applyTemplateOcppParametersToChargingStation',
      message: 'Updating Charging Station with Template\'s OCPP Parameters...',
    });
    // Request and save the latest OCPP parameters
    let result = await Utils.executePromiseWithTimeout<OCPPChangeConfigurationResponse>(
      Constants.DELAY_CHANGE_CONFIGURATION_EXECUTION_MILLIS, OCPPCommon.requestAndSaveChargingStationOcppParameters(tenant, chargingStation),
      `Time out error (${Constants.DELAY_CHANGE_CONFIGURATION_EXECUTION_MILLIS} ms): Cannot update Charging Station with Template's OCPP Parameters`);
    if (result.status !== OCPPConfigurationStatus.ACCEPTED) {
      await Logging.logError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
        module: MODULE_NAME, method: 'applyTemplateOcppParametersToChargingStation',
        message: 'Cannot request Charging Station\'s OCPP Parameters: Cannot apply Template\'s OCPP Parameters',
      });
    } else {
      // Update the OCPP Parameters from the template
      result = await Utils.executePromiseWithTimeout<OCPPChangeConfigurationResponse>(
        Constants.DELAY_CHANGE_CONFIGURATION_EXECUTION_MILLIS, OCPPUtils.updateChargingStationOcppParametersWithTemplate(tenant, chargingStation),
        `Time out error (${Constants.DELAY_CHANGE_CONFIGURATION_EXECUTION_MILLIS} ms): Cannot update Charging Station with Template's OCPP Parameters`);
      if (result.status === OCPPConfigurationStatus.ACCEPTED) {
        await Logging.logInfo({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          tenantID: tenant.id,
          action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
          module: MODULE_NAME, method: 'applyTemplateOcppParametersToChargingStation',
          message: 'Charging Station has been successfully updated with Template\'s OCPP Parameters',
        });
      } else {
        await Logging.logError({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          tenantID: tenant.id,
          action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
          module: MODULE_NAME, method: 'applyTemplateOcppParametersToChargingStation',
          message: 'Cannot update Charging Station with Template\'s OCPP Parameters',
        });
      }
    }
    return result;
  }

  public static async clearAndDeleteChargingProfilesForSiteArea(
      tenant: Tenant, siteArea: SiteArea,
      params?: { profilePurposeType?: ChargingProfilePurposeType; transactionId?: number }): Promise<ActionsResponse> {
    const actionsResponse: ActionsResponse = {
      inError: 0,
      inSuccess: 0
    };
    if (!Utils.isEmptyArray(siteArea.chargingStations)) {
      for (const chargingStation of siteArea.chargingStations) {
        const chargingProfiles = await ChargingStationStorage.getChargingProfiles(tenant, {
          chargingStationIDs: [chargingStation.id],
          profilePurposeType: params.profilePurposeType,
          transactionId: params.transactionId
        }, Constants.DB_PARAMS_MAX_LIMIT);
        for (const chargingProfile of chargingProfiles.result) {
          try {
            await this.clearAndDeleteChargingProfile(tenant, chargingProfile);
            actionsResponse.inSuccess++;
          } catch (error) {
            await Logging.logError({
              tenantID: tenant.id,
              siteID: chargingProfile.chargingStation?.siteID,
              siteAreaID: chargingProfile.chargingStation?.siteAreaID,
              companyID: chargingProfile.chargingStation?.companyID,
              chargingStationID: chargingProfile.chargingStationID,
              action: ServerAction.CHARGING_PROFILE_DELETE,
              module: MODULE_NAME, method: 'clearAndDeleteChargingProfilesForSiteArea',
              message: `Error while clearing the charging profile for chargingStation ${chargingProfile.chargingStationID}`,
              detailedMessages: { error: error.stack }
            });
            actionsResponse.inError++;
          }
        }
      }
    }
    return actionsResponse;
  }

  public static async clearAndDeleteChargingProfile(tenant: Tenant, chargingProfile: ChargingProfile): Promise<void> {
    // Get charging station
    const chargingStation = await ChargingStationStorage.getChargingStation(tenant, chargingProfile.chargingStationID);
    // Check if Charging Profile is supported
    if (!chargingStation.capabilities?.supportChargingProfiles) {
      throw new BackendError({
        chargingStationID: chargingProfile.chargingStationID,
        siteID: chargingProfile.chargingStation?.siteID,
        siteAreaID: chargingProfile.chargingStation?.siteAreaID,
        companyID: chargingProfile.chargingStation?.companyID,
        action: ServerAction.CHARGING_PROFILE_DELETE,
        module: MODULE_NAME, method: 'clearAndDeleteChargingProfile',
        message: 'Charging Station does not support the Charging Profiles',
      });
    }
    // Get Vendor Instance
    const chargingStationVendor = ChargingStationVendorFactory.getChargingStationVendorImpl(chargingStation);
    if (!chargingStationVendor) {
      throw new BackendError({
        chargingStationID: chargingProfile.chargingStationID,
        siteID: chargingProfile.chargingStation?.siteID,
        siteAreaID: chargingProfile.chargingStation?.siteAreaID,
        companyID: chargingProfile.chargingStation?.companyID,
        action: ServerAction.CHARGING_PROFILE_DELETE,
        module: MODULE_NAME, method: 'clearAndDeleteChargingProfile',
        message: `No vendor implementation is available (${chargingStation.chargePointVendor}) for setting a Charging Profile`,
      });
    }
    // Clear Charging Profile
    // Do not check the result because:
    // 1\ Charging Profile exists and has been deleted: Status = ACCEPTED
    // 2\ Charging Profile does not exist : Status = UNKNOWN
    // As there are only 2 statuses, testing them is not necessary
    try {
      await chargingStationVendor.clearChargingProfile(tenant, chargingStation, chargingProfile);
    } catch (error) {
      await Logging.logError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        action: ServerAction.CHARGING_PROFILE_DELETE,
        message: 'Error occurred while clearing the Charging Profile',
        module: MODULE_NAME, method: 'clearAndDeleteChargingProfile',
        detailedMessages: { error: error.stack }
      });
      throw error;
    }
    // Delete from database
    await ChargingStationStorage.deleteChargingProfile(tenant, chargingProfile.id);
    await Logging.logInfo({
      ...LoggingHelper.getChargingStationProperties(chargingStation),
      tenantID: tenant.id,
      action: ServerAction.CHARGING_PROFILE_DELETE,
      module: MODULE_NAME, method: 'clearAndDeleteChargingProfile',
      message: 'Charging Profile has been deleted successfully',
      detailedMessages: { chargingProfile }
    });
  }

  public static async checkChargingStationAndEnrichSoapOcppHeaders(command: Command, headers: OCPPHeader, req: any): Promise<void> {
    // Normalize
    OCPPUtils.normalizeOneSOAPParam(headers, 'chargeBoxIdentity');
    OCPPUtils.normalizeOneSOAPParam(headers, 'Action');
    OCPPUtils.normalizeOneSOAPParam(headers, 'To');
    OCPPUtils.normalizeOneSOAPParam(headers, 'From.Address');
    OCPPUtils.normalizeOneSOAPParam(headers, 'ReplyTo.Address');
    // Add current IPs to charging station properties
    headers.currentIPAddress = Utils.getRequestIP(req);
    // Parse the request (lower case for fucking charging station DBT URL registration)
    const urlParts = url.parse(decodeURIComponent(req.url.toLowerCase()), true);
    headers.tenantID = urlParts.query.tenantid as string;
    headers.tokenID = urlParts.query.token as string;
    // Get all the necessary entities
    const { tenant, chargingStation, token } = await OCPPUtils.checkAndGetChargingStationConnectionData(
      OCPPUtils.buildServerActionFromOcppCommand(command), headers.tenantID, headers.chargeBoxIdentity, headers.tokenID);
    // Set
    headers.tenant = tenant;
    headers.chargingStation = chargingStation;
    headers.token = token;
    return Promise.resolve();
  }

  public static async setAndSaveChargingProfile(tenant: Tenant, chargingProfile: ChargingProfile): Promise<string> {
    // Get charging station
    const chargingStation = await ChargingStationStorage.getChargingStation(tenant, chargingProfile.chargingStationID);
    if (!chargingStation) {
      throw new BackendError({
        chargingStationID: chargingProfile.chargingStationID,
        siteID: chargingProfile.chargingStation?.siteID,
        siteAreaID: chargingProfile.chargingStation?.siteAreaID,
        companyID: chargingProfile.chargingStation?.companyID,
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        module: MODULE_NAME, method: 'setAndSaveChargingProfile',
        message: 'Charging Station not found',
      });
    }
    // Get charge point
    const chargePoint = Utils.getChargePointFromID(chargingStation, chargingProfile.chargePointID);
    // Get Vendor Instance
    const chargingStationVendor = ChargingStationVendorFactory.getChargingStationVendorImpl(chargingStation);
    if (!chargingStationVendor) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        module: MODULE_NAME, method: 'setAndSaveChargingProfile',
        message: `No vendor implementation is available (${chargingStation.chargePointVendor}) for setting a Charging Profile`,
      });
    }
    // Set Charging Profile
    const result = await chargingStationVendor.setChargingProfile(
      tenant, chargingStation, chargePoint, chargingProfile);
    // Check for Array
    let resultStatus = OCPPChargingProfileStatus.ACCEPTED;
    if (Array.isArray(result)) {
      for (const oneResult of result) {
        if (oneResult.status !== OCPPChargingProfileStatus.ACCEPTED) {
          resultStatus = oneResult.status;
          break;
        }
      }
    } else {
      resultStatus = result.status;
    }
    if (resultStatus !== OCPPChargingProfileStatus.ACCEPTED) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        module: MODULE_NAME, method: 'setAndSaveChargingProfile',
        message: 'Cannot set the Charging Profile!',
        detailedMessages: { result, chargingProfile },
      });
    }
    // Save
    const chargingProfileID = await ChargingStationStorage.saveChargingProfile(tenant, chargingProfile);
    await Logging.logInfo({
      ...LoggingHelper.getChargingStationProperties(chargingStation),
      tenantID: tenant.id,
      action: ServerAction.CHARGING_PROFILE_UPDATE,
      module: MODULE_NAME, method: 'setAndSaveChargingProfile',
      message: `${Utils.buildConnectorInfo(chargingProfile.connectorID, chargingProfile.profile?.transactionId)} Charging Profile has been successfully pushed and saved`,
      detailedMessages: { chargingProfile }
    });
    return chargingProfileID;
  }

  public static isValidMeterValue(meterValue: OCPPNormalizedMeterValue): boolean {
    return OCPPUtils.isSocMeterValue(meterValue) ||
      OCPPUtils.isEnergyActiveImportMeterValue(meterValue) ||
      OCPPUtils.isPowerActiveImportMeterValue(meterValue) ||
      OCPPUtils.isCurrentImportMeterValue(meterValue) ||
      OCPPUtils.isVoltageMeterValue(meterValue);
  }

  public static isSocMeterValue(meterValue: OCPPNormalizedMeterValue): boolean {
    return !meterValue.attribute ||
      (meterValue.attribute.measurand === OCPPMeasurand.STATE_OF_CHARGE &&
       (meterValue.attribute.context === OCPPReadingContext.SAMPLE_PERIODIC ||
        meterValue.attribute.context === OCPPReadingContext.TRANSACTION_END));
  }

  public static isEnergyActiveImportMeterValue(meterValue: OCPPNormalizedMeterValue): boolean {
    return !meterValue.attribute ||
      (meterValue.attribute.measurand === OCPPMeasurand.ENERGY_ACTIVE_IMPORT_REGISTER &&
        meterValue.attribute.location !== OCPPLocation.INLET &&
        (meterValue.attribute.context === OCPPReadingContext.SAMPLE_PERIODIC ||
         meterValue.attribute.context === OCPPReadingContext.TRANSACTION_END ||
         meterValue.attribute.context === OCPPReadingContext.SAMPLE_CLOCK));
  }

  public static isPowerActiveImportMeterValue(meterValue: OCPPNormalizedMeterValue): boolean {
    return !meterValue.attribute ||
      (meterValue.attribute.measurand === OCPPMeasurand.POWER_ACTIVE_IMPORT &&
        meterValue.attribute.context === OCPPReadingContext.SAMPLE_PERIODIC);
  }

  public static isCurrentImportMeterValue(meterValue: OCPPNormalizedMeterValue): boolean {
    return !meterValue.attribute ||
      (meterValue.attribute.measurand === OCPPMeasurand.CURRENT_IMPORT &&
        meterValue.attribute.context === OCPPReadingContext.SAMPLE_PERIODIC);
  }

  public static isVoltageMeterValue(meterValue: OCPPNormalizedMeterValue): boolean {
    return !meterValue.attribute ||
      (meterValue.attribute.measurand === OCPPMeasurand.VOLTAGE &&
        meterValue.attribute.context === OCPPReadingContext.SAMPLE_PERIODIC);
  }

  public static checkChargingStationConnectionData(action: ServerAction, tenantID: string, tokenID: string, chargingStationID: string): void {
    // Check Charging Station
    if (!chargingStationID) {
      throw new BackendError({
        action,
        module: MODULE_NAME, method: 'checkChargingStationOcppParameters',
        message: 'The Charging Station ID is mandatory!'
      });
    }
    if (!Utils.isChargingStationIDValid(chargingStationID)) {
      throw new BackendError({
        action, chargingStationID,
        module: MODULE_NAME, method: 'checkChargingStationOcppParameters',
        message: `The Charging Station ID '${chargingStationID}' is invalid!`
      });
    }
    // Check Tenant
    if (!tenantID) {
      throw new BackendError({
        action, chargingStationID,
        module: MODULE_NAME, method: 'checkChargingStationOcppParameters',
        message: 'The Tenant ID is mandatory!'
      });
    }
    if (!DatabaseUtils.isObjectID(tenantID)) {
      throw new BackendError({
        action, chargingStationID,
        module: MODULE_NAME, method: 'checkChargingStationOcppParameters',
        message: `The Tenant ID '${tenantID}' is invalid!`
      });
    }
    // Check Token
    if (!tokenID) {
      throw new BackendError({
        action, chargingStationID,
        module: MODULE_NAME, method: 'checkChargingStationOcppParameters',
        message: 'The Token ID is mandatory!'
      });
    }
  }

  public static async checkAndGetChargingStationConnectionData(action: ServerAction, tenantID: string, chargingStationID: string,
      tokenID: string, updateChargingStationData = true): Promise<{ tenant: Tenant; chargingStation?: ChargingStation; token?: RegistrationToken }> {
    // Check parameters
    OCPPUtils.checkChargingStationConnectionData(
      ServerAction.WS_SERVER_CONNECTION, tenantID, tokenID, chargingStationID);
    // Get Tenant
    const tenant = await TenantStorage.getTenantFromCache(tenantID);
    if (!tenant) {
      throw new BackendError({
        chargingStationID,
        module: MODULE_NAME, method: 'checkAndGetChargingStationData',
        message: `Tenant ID '${tenantID}' does not exist!`
      });
    }
    // Get the Charging Station
    let token: RegistrationToken;
    const chargingStation = await ChargingStationStorage.getChargingStation(
      tenant, chargingStationID, { withSiteArea: true, issuer: true });
    if (!chargingStation) {
      // Must have a valid connection Token
      token = await OCPPUtils.ensureChargingStationHasValidConnectionToken(action, tenant, chargingStationID, tokenID);
      // Check Action
      if (action !== ServerAction.WS_SERVER_CONNECTION &&
          action !== ServerAction.OCPP_BOOT_NOTIFICATION) {
        throw new BackendError({
          chargingStationID,
          module: MODULE_NAME,
          method: 'checkAndGetChargingStationData',
          message: 'Charging Station does not exist!'
        });
      }
      return { tenant, token };
    }
    // Same Token?
    if (chargingStation.tokenID !== tokenID) {
      // Must have a valid connection Token
      token = await OCPPUtils.ensureChargingStationHasValidConnectionToken(action, tenant, chargingStationID, tokenID);
      // Ok, set it
      await Logging.logInfo({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        action, module: MODULE_NAME, method: 'checkAndGetChargingStationData',
        message: `New security Token ID '${tokenID}' has been assigned to the Charging Station (old one was '${chargingStation.tokenID}')`
      });
      chargingStation.tokenID = tokenID;
    }
    // Deleted?
    if (chargingStation.deleted) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        module: MODULE_NAME,
        method: 'checkAndGetChargingStationData',
        message: 'Charging Station has been deleted!'
      });
    }
    // Inactive?
    if (chargingStation.forceInactive) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        module: MODULE_NAME,
        method: 'checkAndGetChargingStationData',
        message: 'Charging Station has been forced as inactive!'
      });
    }
    if (updateChargingStationData) {
      // Reassign to the Charging station
      chargingStation.lastSeen = new Date();
      chargingStation.tokenID = tokenID;
      chargingStation.cloudHostIP = Utils.getHostIP();
      chargingStation.cloudHostName = Utils.getHostName();
      // Save Charging Station runtime data
      await ChargingStationStorage.saveChargingStationRuntimeData(tenant, chargingStation.id, {
        lastSeen: chargingStation.lastSeen,
        tokenID: chargingStation.tokenID,
        cloudHostIP: chargingStation.cloudHostIP,
        cloudHostName: chargingStation.cloudHostName,
      });
    }
    return { tenant, chargingStation, token };
  }

  public static async updateChargingStationOcppParametersWithTemplate(tenant: Tenant, chargingStation: ChargingStation): Promise<OCPPChangeConfigurationResponse> {
    let result: OCPPChangeConfigurationResponse;
    const updatedOcppParameters: ActionsResponse = {
      inError: 0,
      inSuccess: 0
    };
    let rebootRequired = false;
    // Get current OCPP parameters in DB
    const currentOcppParameters =
      (await ChargingStationStorage.getOcppParameters(tenant, chargingStation.id)).result;
    if (Utils.isEmptyArray(chargingStation.ocppStandardParameters) && Utils.isEmptyArray(chargingStation.ocppVendorParameters)) {
      await Logging.logInfo({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
        module: MODULE_NAME, method: 'updateChargingStationOcppParametersWithTemplate',
        message: 'Charging Station has no OCPP Parameters'
      });
      return result;
    }
    // Merge Template Standard and Vendor parameters
    const ocppParameters = chargingStation.ocppStandardParameters.concat(chargingStation.ocppVendorParameters);
    // Check OCPP parameters
    for (const ocppParameter of ocppParameters) {
      // Find OCPP parameter
      const currentOcppParam: OcppParameter = currentOcppParameters.find(
        (ocppParam) => ocppParam.key === ocppParameter.key);
      try {
        // Check Value
        if (currentOcppParam && currentOcppParam.value === ocppParameter.value) {
          // Ok: Already the good value
          await Logging.logInfo({
            ...LoggingHelper.getChargingStationProperties(chargingStation),
            tenantID: tenant.id,
            action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
            module: MODULE_NAME, method: 'updateChargingStationOcppParametersWithTemplate',
            message: `OCPP Parameter '${ocppParameter.key}' has the correct value '${currentOcppParam.value}'`
          });
          continue;
        }
        // Execute OCPP change configuration command
        result = await OCPPCommon.requestChangeChargingStationOcppParameter(tenant, chargingStation, {
          key: ocppParameter.key,
          value: ocppParameter.value
        }, false);
        if (result.status === OCPPConfigurationStatus.ACCEPTED) {
          updatedOcppParameters.inSuccess++;
          await Logging.logInfo({
            ...LoggingHelper.getChargingStationProperties(chargingStation),
            tenantID: tenant.id,
            action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
            module: MODULE_NAME, method: 'updateChargingStationOcppParametersWithTemplate',
            message: `${!Utils.isUndefined(currentOcppParam) && 'Non existent '}OCPP Parameter '${ocppParameter.key}' has been successfully set from '${currentOcppParam?.value}' to '${ocppParameter.value}'`
          });
        } else if (result.status === OCPPConfigurationStatus.REBOOT_REQUIRED) {
          updatedOcppParameters.inSuccess++;
          rebootRequired = true;
          await Logging.logInfo({
            ...LoggingHelper.getChargingStationProperties(chargingStation),
            tenantID: tenant.id,
            action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
            module: MODULE_NAME, method: 'updateChargingStationOcppParametersWithTemplate',
            message: `${!Utils.isUndefined(currentOcppParam) && 'Non existent '}OCPP Parameter '${ocppParameter.key}' that requires reboot has been successfully set from '${currentOcppParam?.value}' to '${ocppParameter.value}'`
          });
        } else {
          updatedOcppParameters.inError++;
          await Logging.logError({
            ...LoggingHelper.getChargingStationProperties(chargingStation),
            tenantID: tenant.id,
            action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
            module: MODULE_NAME, method: 'updateChargingStationOcppParametersWithTemplate',
            message: `Error '${result.status}' in changing ${!Utils.isUndefined(currentOcppParam) && 'non existent '}OCPP Parameter '${ocppParameter.key}' from '${currentOcppParam?.value}' to '${ocppParameter.value}': `
          });
        }
      } catch (error) {
        updatedOcppParameters.inError++;
        await Logging.logError({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          tenantID: tenant.id,
          action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
          module: MODULE_NAME, method: 'updateChargingStationOcppParametersWithTemplate',
          message: `Error in changing ${!Utils.isUndefined(currentOcppParam) && 'non existent '}OCPP Parameter '${ocppParameter.key}' from '${currentOcppParam?.value}' to '${ocppParameter.value}'`,
          detailedMessages: { error: error.stack }
        });
      }
    }
    await Logging.logActionsResponse(
      tenant.id, ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
      MODULE_NAME, 'updateChargingStationOcppParametersWithTemplate', updatedOcppParameters,
      `{{inSuccess}} OCPP Parameter(s) were successfully synchronized, check details in the Tenant ${Utils.buildTenantName(tenant)})`,
      `{{inError}} OCPP Parameter(s) failed to be synchronized, check details in the Tenant ${Utils.buildTenantName(tenant)})`,
      `{{inSuccess}} OCPP Parameter(s) were successfully synchronized and {{inError}} failed to be synchronized, check details in the Tenant ${Utils.buildTenantName(tenant)})`,
      'All the OCPP Parameters are up to date'
    );
    // Parameter(s) updated?
    if (updatedOcppParameters.inSuccess) {
      result = await OCPPCommon.requestAndSaveChargingStationOcppParameters(tenant, chargingStation);
    }
    // Reboot required?
    if (rebootRequired) {
      await OCPPCommon.triggerChargingStationReset(tenant, chargingStation, true);
    }
    return result;
  }

  public static async updateChargingStationConnectorRuntimeDataWithTransaction(tenant: Tenant, chargingStation: ChargingStation,
      transaction: Transaction, saveConnector = false): Promise<void> {
    const connector = Utils.getConnectorFromID(chargingStation, transaction.connectorId);
    if (connector) {
      if (!transaction.stop) {
        // Set Transaction data on Connector
        connector.currentInstantWatts = transaction.currentInstantWatts;
        connector.currentTotalConsumptionWh = transaction.currentTotalConsumptionWh;
        connector.currentTotalInactivitySecs = transaction.currentTotalInactivitySecs;
        connector.currentInactivityStatus = Utils.getInactivityStatusLevel(
          transaction.chargeBox, transaction.connectorId, transaction.currentTotalInactivitySecs);
        connector.currentStateOfCharge = transaction.currentStateOfCharge;
        connector.currentTransactionDate = transaction.timestamp;
        connector.currentTagID = transaction.tagID;
        connector.currentTransactionID = transaction.id;
        connector.currentUserID = transaction.userID;
        // Log
        const instantPower = Utils.truncTo(Utils.createDecimal(connector.currentInstantWatts).div(1000).toNumber(), 3);
        const totalConsumption = Utils.truncTo(Utils.createDecimal(connector.currentTotalConsumptionWh).div(1000).toNumber(), 3);
        await Logging.logInfo({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          tenantID: tenant.id,
          module: MODULE_NAME, method: 'updateChargingStationConnectorRuntimeDataWithTransaction',
          action: ServerAction.CONSUMPTION,
          user: transaction.userID,
          message: `${Utils.buildConnectorInfo(connector.connectorId, connector.currentTransactionID)} Power: ${instantPower} kW, Energy: ${totalConsumption} kW.h${connector.currentStateOfCharge ? ', SoC: ' + connector.currentStateOfCharge.toString() + ' %' : ''}`
        });
      // Clear Connector
      } else {
        OCPPUtils.clearChargingStationConnectorRuntimeData(chargingStation, connector.connectorId);
      }
      if (saveConnector) {
        await ChargingStationStorage.saveChargingStationConnectors(tenant, chargingStation.id, chargingStation.connectors);
      }
    }
  }

  public static clearChargingStationConnectorRuntimeData(chargingStation: ChargingStation, connectorID: number): Connector {
    // Cleanup connector transaction data
    const connector = Utils.getConnectorFromID(chargingStation, connectorID);
    if (connector) {
      connector.currentInstantWatts = 0;
      connector.currentTotalConsumptionWh = 0;
      connector.currentTotalInactivitySecs = 0;
      connector.currentInactivityStatus = InactivityStatus.INFO;
      connector.currentStateOfCharge = 0;
      connector.currentTransactionID = 0;
      connector.currentTransactionDate = null;
      connector.currentTagID = null;
      connector.currentUserID = null;
    }
    return connector;
  }

  public static updateSignedData(transaction: Transaction, meterValue: OCPPNormalizedMeterValue): boolean {
    if (meterValue.attribute.format === OCPPValueFormat.SIGNED_DATA) {
      if (meterValue.attribute.context === OCPPReadingContext.TRANSACTION_BEGIN) {
        // Set the first Signed Data and keep it
        transaction.signedData = meterValue.value as string;
        return true;
      } else if (meterValue.attribute.context === OCPPReadingContext.TRANSACTION_END) {
        // Set the last Signed Data (used in the last consumption)
        transaction.currentSignedData = meterValue.value as string;
        return true;
      }
    }
    return false;
  }

  public static async checkBillingPrerequisites(tenant: Tenant, action: ServerAction, chargingStation: ChargingStation, user: User): Promise<void> {
    if (!user?.issuer) {
      // Roaming - do not check for payment methods
      return;
    }
    const billingImpl = await BillingFactory.getBillingImpl(tenant);
    if (billingImpl) {
      const errorCodes = await billingImpl.precheckStartTransactionPrerequisites(user);
      if (!Utils.isEmptyArray(errorCodes)) {
        throw new BackendError({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          user, action,
          message: 'Billing prerequisites are not met',
          module: MODULE_NAME, method: 'checkBillingPrerequisites',
          detailedMessages: { errorCodes }
        });
      }
    }
  }

  private static async enrichChargingStationWithTemplate(tenant: Tenant, chargingStation: ChargingStation): Promise<TemplateUpdateResult> {
    const templateUpdateResult: TemplateUpdateResult = {
      chargingStationUpdated: false,
      technicalUpdated: false,
      capabilitiesUpdated: false,
      ocppStandardUpdated: false,
      ocppVendorUpdated: false,
    };
    // Do not apply template if manual configured
    if (chargingStation.manualConfiguration) {
      await Logging.logWarning({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
        module: MODULE_NAME, method: 'enrichChargingStationWithTemplate',
        message: 'Template cannot be applied on manual configured charging station',
        detailedMessages: { chargingStation }
      });
      return templateUpdateResult;
    }
    // Get Template
    const chargingStationTemplate = await OCPPUtils.getChargingStationTemplate(chargingStation);
    if (chargingStationTemplate) {
      // Already updated?
      if (chargingStation.templateHash !== chargingStationTemplate.hash) {
        await Logging.logDebug({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          tenantID: tenant.id,
          action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
          module: MODULE_NAME, method: 'enrichChargingStationWithTemplate',
          message: `Template ID '${chargingStationTemplate.id}' is being applied...`
        });
        // Check Technical
        templateUpdateResult.technicalUpdated =
          OCPPUtils.enrichChargingStationWithTemplateTechnicalParams(chargingStation, chargingStationTemplate);
        // Check Capabilities
        templateUpdateResult.capabilitiesUpdated =
          await OCPPUtils.enrichChargingStationWithTemplateCapabilities(tenant, chargingStation, chargingStationTemplate);
        // Check Ocpp Standard parameters
        templateUpdateResult.ocppStandardUpdated =
          await OCPPUtils.enrichChargingStationWithTemplateOcppStandardParams(tenant, chargingStation, chargingStationTemplate);
        // Check Ocpp Vendor parameters
        templateUpdateResult.ocppVendorUpdated =
          await OCPPUtils.enrichChargingStationWithTemplateOcppVendorParams(tenant, chargingStation, chargingStationTemplate);
        // Update
        chargingStation.templateHash = chargingStationTemplate.hash;
        templateUpdateResult.chargingStationUpdated = true;
        await Logging.logInfo({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          tenantID: tenant.id,
          action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
          module: MODULE_NAME, method: 'enrichChargingStationWithTemplate',
          message: `Template ID '${chargingStationTemplate.id}' has been applied with success`,
          detailedMessages: {
            templateUpdateResult,
            templateData: LoggingHelper.shrinkTemplateProperties(chargingStationTemplate),
          }
        });
      } else {
        await Logging.logDebug({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          tenantID: tenant.id,
          action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
          module: MODULE_NAME, method: 'enrichChargingStationWithTemplate',
          message: `Template ID '${chargingStationTemplate.id}' has already been applied`,
          detailedMessages: {
            templateData: LoggingHelper.shrinkTemplateProperties(chargingStationTemplate)
          }
        });
      }
      // Master/Slave: always override the charge point
      if (chargingStationTemplate.template.technical.masterSlave) {
        if (Utils.objectHasProperty(chargingStationTemplate.template.technical, 'chargePoints')) {
          chargingStation.chargePoints = chargingStationTemplate.template.technical.chargePoints;
        }
      }
    } else {
      await Logging.logInfo({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
        module: MODULE_NAME, method: 'enrichChargingStationWithTemplate',
        message: 'No template has been found',
        detailedMessages: {
          chargingStationData: LoggingHelper.shrinkChargingStationProperties(chargingStation)
        }
      });
      chargingStation.manualConfiguration = true; // To be clarified! - Why is this changed here???
    }
    return templateUpdateResult;
  }

  private static async enrichChargingStationWithTemplateOcppStandardParams(tenant: Tenant, chargingStation: ChargingStation,
      chargingStationTemplate: ChargingStationTemplate): Promise<boolean> {
    // Already updated?
    if (chargingStation.templateHashOcppStandard !== chargingStationTemplate.hashOcppStandard) {
      chargingStation.templateHashOcppStandard = chargingStationTemplate.hashOcppStandard;
      return OCPPUtils.enrichChargingStationWithTemplateOcppParams(tenant, chargingStation, chargingStationTemplate, 'ocppStandardParameters');
    }
  }

  private static async enrichChargingStationWithTemplateOcppVendorParams(tenant: Tenant, chargingStation: ChargingStation,
      chargingStationTemplate: ChargingStationTemplate): Promise<boolean> {
    // Already updated?
    if (chargingStation.templateHashOcppVendor !== chargingStationTemplate.hashOcppVendor) {
      chargingStation.templateHashOcppVendor = chargingStationTemplate.hashOcppVendor;
      return OCPPUtils.enrichChargingStationWithTemplateOcppParams(tenant, chargingStation, chargingStationTemplate, 'ocppVendorParameters');
    }
  }

  private static async enrichChargingStationWithTemplateOcppParams(tenant: Tenant, chargingStation: ChargingStation, chargingStationTemplate: ChargingStationTemplate,
      ocppProperty: 'ocppStandardParameters'|'ocppVendorParameters'): Promise<boolean> {
    // Handle OCPP Standard Parameters
    chargingStation[ocppProperty] = [];
    if (chargingStationTemplate.template?.[ocppProperty]) {
      let matchFirmware = false;
      let matchOcpp = false;
      // Search Firmware/Ocpp match
      for (const ocppParameters of chargingStationTemplate.template[ocppProperty]) {
        // Check Firmware version
        if (ocppParameters.supportedFirmwareVersions) {
          for (const supportedFirmwareVersion of ocppParameters.supportedFirmwareVersions) {
            const regExp = new RegExp(supportedFirmwareVersion);
            if (regExp.test(chargingStation.firmwareVersion)) {
              matchFirmware = true;
              break;
            }
          }
        }
        // Check Ocpp version
        if (ocppParameters.supportedOcppVersions) {
          matchOcpp = ocppParameters.supportedOcppVersions.includes(chargingStation.ocppVersion);
        }
        // Found?
        if (matchFirmware && matchOcpp) {
          for (const parameter in ocppParameters.parameters) {
            if (OCPPUtils.isOcppParamForPowerLimitationKey(parameter, chargingStation)) {
              await Logging.logError({
                ...LoggingHelper.getChargingStationProperties(chargingStation),
                tenantID: tenant.id,
                action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
                module: MODULE_NAME, method: 'enrichChargingStationWithTemplate',
                message: `Template contains power limitation key '${parameter}' in OCPP parameters, skipping. Remove it from template!`,
                detailedMessages: { chargingStationTemplate }
              });
              continue;
            }
            if (Constants.OCPP_HEARTBEAT_KEYS.includes(parameter)) {
              await Logging.logWarning({
                ...LoggingHelper.getChargingStationProperties(chargingStation),
                tenantID: tenant.id,
                action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
                module: MODULE_NAME, method: 'enrichChargingStationWithTemplate',
                message: `Template contains heartbeat interval key '${parameter}' in OCPP parameters, skipping. Remove it from template`,
                detailedMessages: { chargingStationTemplate }
              });
              continue;
            }
            chargingStation[ocppProperty].push({
              key: parameter,
              value: ocppParameters.parameters[parameter]
            });
          }
          return true;
        }
      }
      // Not found
      await Logging.logWarning({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
        module: MODULE_NAME, method: 'enrichChargingStationWithTemplateOcppParams',
        message: `Cannot find a matching section named '${ocppProperty}' in Template ID '${chargingStationTemplate.id}'`,
        detailedMessages: { chargingStationTemplate, chargingStation }
      });
    }
  }

  private static async enrichChargingStationWithTemplateCapabilities(tenant: Tenant, chargingStation: ChargingStation,
      chargingStationTemplate: ChargingStationTemplate): Promise<boolean> {
    // Already updated?
    if (chargingStation.templateHashCapabilities !== chargingStationTemplate.hashCapabilities) {
      // Handle capabilities
      chargingStation.capabilities = {} as ChargingStationCapabilities;
      if (chargingStationTemplate.template?.capabilities) {
        let matchFirmware = false;
        let matchOcpp = false;
        // Search Firmware/Ocpp match
        for (const capabilities of chargingStationTemplate.template.capabilities) {
          // Check Firmware version
          if (capabilities.supportedFirmwareVersions) {
            for (const supportedFirmwareVersion of capabilities.supportedFirmwareVersions) {
              const regExp = new RegExp(supportedFirmwareVersion);
              if (regExp.test(chargingStation.firmwareVersion)) {
                matchFirmware = true;
                break;
              }
            }
          }
          // Check Ocpp version
          if (capabilities.supportedOcppVersions) {
            matchOcpp = capabilities.supportedOcppVersions.includes(chargingStation.ocppVersion);
          }
          // Found?
          if (matchFirmware && matchOcpp) {
            if (capabilities.capabilities?.supportChargingProfiles === false) {
              chargingStation.excludeFromSmartCharging = !capabilities.capabilities.supportChargingProfiles;
            }
            chargingStation.capabilities = capabilities.capabilities;
            chargingStation.templateHashCapabilities = chargingStationTemplate.hashCapabilities;
            return true;
          }
        }
        // Not found
        await Logging.logWarning({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          tenantID: tenant.id,
          action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
          module: MODULE_NAME, method: 'enrichChargingStationWithTemplateCapabilities',
          message: `Cannot find a matching section named 'capabilities' in Template ID '${chargingStationTemplate.id}'`,
          detailedMessages: { chargingStationTemplate, chargingStation }
        });
      }
    }
  }

  private static enrichChargingStationWithTemplateTechnicalParams(chargingStation: ChargingStation, chargingStationTemplate: ChargingStationTemplate): boolean {
    if (chargingStation.templateHashTechnical !== chargingStationTemplate.hashTechnical) {
      if (chargingStationTemplate.template.technical?.maximumPower) {
        chargingStation.maximumPower = chargingStationTemplate.template.technical.maximumPower;
      }
      if (chargingStationTemplate.template.technical?.masterSlave) {
        chargingStation.masterSlave = chargingStationTemplate.template.technical.masterSlave;
      }
      if (chargingStationTemplate.template.technical?.chargePoints) {
        chargingStation.chargePoints = chargingStationTemplate.template.technical.chargePoints;
      }
      if (chargingStationTemplate.template.technical?.powerLimitUnit) {
        chargingStation.powerLimitUnit = chargingStationTemplate.template.technical.powerLimitUnit;
      }
      if (chargingStationTemplate.template.technical?.voltage) {
        chargingStation.voltage = chargingStationTemplate.template.technical.voltage;
      }
      // Set the hash
      chargingStation.templateHashTechnical = chargingStationTemplate.hashTechnical;
      return true;
    }
  }

  private static checkAndSetConnectorAmperageLimit(chargingStation: ChargingStation, connector: Connector, nrOfPhases?: number): void {
    const numberOfPhases = nrOfPhases ?? Utils.getNumberOfConnectedPhases(chargingStation, null, connector.connectorId);
    // Check connector amperage limit
    const connectorAmperageLimit = OCPPUtils.checkAndGetConnectorAmperageLimit(chargingStation, connector, numberOfPhases);
    if (connectorAmperageLimit) {
      // Reset
      connector.amperageLimit = connectorAmperageLimit;
    }
  }

  private static checkAndGetConnectorAmperageLimit(chargingStation: ChargingStation, connector: Connector, nrOfPhases?: number): number {
    const numberOfPhases = nrOfPhases ?? Utils.getNumberOfConnectedPhases(chargingStation, null, connector.connectorId);
    const connectorAmperageLimitMin = StaticLimitAmps.MIN_LIMIT_PER_PHASE * numberOfPhases;
    if (connector.amperageLimit // Must be ignored when set to 0
      && connector.amperageLimit < connectorAmperageLimitMin) {
      // Return the minimal value
      return connectorAmperageLimitMin;
    }
    // Return the maximal value
    return Utils.getChargingStationAmperage(chargingStation, null, connector.connectorId);
  }

  private static async setConnectorPhaseAssignment(tenant: Tenant, chargingStation: ChargingStation, connector: Connector, nrOfPhases?: number): Promise<void> {
    const csNumberOfPhases = nrOfPhases ?? Utils.getNumberOfConnectedPhases(chargingStation, null, connector.connectorId);
    if (chargingStation.siteAreaID) {
      const siteArea = await SiteAreaStorage.getSiteArea(tenant, chargingStation.siteAreaID);
      // Phase Assignment to Grid has to be handled only for Site Area with 3 phases
      if (siteArea.numberOfPhases === 3) {
        switch (csNumberOfPhases) {
          // Tri-phased
          case 3:
            connector.phaseAssignmentToGrid = { csPhaseL1: OCPPPhase.L1, csPhaseL2: OCPPPhase.L2, csPhaseL3: OCPPPhase.L3 };
            break;
          // Single Phased
          case 1:
            connector.phaseAssignmentToGrid = { csPhaseL1: OCPPPhase.L1, csPhaseL2: null, csPhaseL3: null };
            break;
          default:
            delete connector.phaseAssignmentToGrid;
            break;
        }
      } else {
        delete connector.phaseAssignmentToGrid;
      }
    // Organization setting not enabled or charging station not assigned to a site area
    } else {
      switch (csNumberOfPhases) {
        // Tri-phased
        case 3:
          connector.phaseAssignmentToGrid = { csPhaseL1: OCPPPhase.L1, csPhaseL2: OCPPPhase.L2, csPhaseL3: OCPPPhase.L3 };
          break;
        // Single Phased
        case 1:
          connector.phaseAssignmentToGrid = { csPhaseL1: OCPPPhase.L1, csPhaseL2: null, csPhaseL3: null };
          break;
        default:
          delete connector.phaseAssignmentToGrid;
          break;
      }
    }
  }

  private static isOcppParamForPowerLimitationKey(ocppParameterKey: string, chargingStation: ChargingStation): boolean {
    for (const chargePoint of chargingStation.chargePoints) {
      if (chargePoint.ocppParamForPowerLimitation && ocppParameterKey.includes(chargePoint.ocppParamForPowerLimitation)) {
        return true;
      }
    }
    return false;
  }

  private static normalizeOneSOAPParam(headers: any, name: string) {
    const val = _.get(headers, name);
    if (val && val.$value) {
      _.set(headers, name, val.$value);
    }
  }

  private static adjustChargingStationChargePointForMasterSlave(chargingStation: ChargingStation) {
    // Master/Slave has only one Charge Point
    const chargePoint = chargingStation.chargePoints[0];
    // Init
    chargePoint.amperage = 0;
    chargePoint.power = 0;
    chargePoint.connectorIDs = [];
    // Set connector's power
    for (const connector of chargingStation.connectors) {
      chargePoint.amperage += connector.amperage;
      chargePoint.power += connector.power;
      chargePoint.connectorIDs.push(connector.connectorId);
    }
  }
}
