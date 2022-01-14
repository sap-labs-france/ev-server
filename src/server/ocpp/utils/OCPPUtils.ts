import { BillingDataTransactionStart, BillingDataTransactionStop } from '../../../types/Billing';
import { ChargingProfile, ChargingProfilePurposeType } from '../../../types/ChargingProfile';
import ChargingStation, { ChargingStationCapabilities, ChargingStationTemplate, Command, Connector, ConnectorCurrentLimitSource, CurrentType, OcppParameter, SiteAreaLimitSource, StaticLimitAmps, TemplateUpdate, TemplateUpdateResult } from '../../../types/ChargingStation';
import FeatureToggles, { Feature } from '../../../utils/FeatureToggles';
import { OCPPChangeConfigurationResponse, OCPPChargingProfileStatus, OCPPConfigurationStatus } from '../../../types/ocpp/OCPPClient';
import { OCPPMeasurand, OCPPNormalizedMeterValue, OCPPPhase, OCPPReadingContext, OCPPStopTransactionRequestExtended, OCPPUnitOfMeasure, OCPPValueFormat } from '../../../types/ocpp/OCPPServer';
import { OICPIdentification, OICPSessionID } from '../../../types/oicp/OICPIdentification';
import Tenant, { TenantComponents } from '../../../types/Tenant';
import Transaction, { InactivityStatus, TransactionAction } from '../../../types/Transaction';

import { ActionsResponse } from '../../../types/GlobalType';
import BackendError from '../../../exception/BackendError';
import BillingFactory from '../../../integration/billing/BillingFactory';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import ChargingStationVendorFactory from '../../../integration/charging-station-vendor/ChargingStationVendorFactory';
import Constants from '../../../utils/Constants';
import Consumption from '../../../types/Consumption';
import ConsumptionStorage from '../../../storage/mongodb/ConsumptionStorage';
import CpoOCPIClient from '../../../client/ocpi/CpoOCPIClient';
import CpoOICPClient from '../../../client/oicp/CpoOICPClient';
import DatabaseUtils from '../../../storage/mongodb/DatabaseUtils';
import Logging from '../../../utils/Logging';
import LoggingHelper from '../../../utils/LoggingHelper';
import OCPIClientFactory from '../../../client/ocpi/OCPIClientFactory';
import { OCPIRole } from '../../../types/ocpi/OCPIRole';
import OCPPCommon from './OCPPCommon';
import { OCPPHeader } from '../../../types/ocpp/OCPPHeader';
import OICPClientFactory from '../../../client/oicp/OICPClientFactory';
import { OICPRole } from '../../../types/oicp/OICPRole';
import OICPUtils from '../../oicp/OICPUtils';
import { PricedConsumption } from '../../../types/Pricing';
import PricingFactory from '../../../integration/pricing/PricingFactory';
import { PricingSettingsType } from '../../../types/Setting';
import { Promise } from 'bluebird';
import RegistrationToken from '../../../types/RegistrationToken';
import RegistrationTokenStorage from '../../../storage/mongodb/RegistrationTokenStorage';
import { ServerAction } from '../../../types/Server';
import SiteArea from '../../../types/SiteArea';
import SiteAreaStorage from '../../../storage/mongodb/SiteAreaStorage';
import Tag from '../../../types/Tag';
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

  public static async processTransactionRoaming(tenant: Tenant, transaction: Transaction,
      chargingStation: ChargingStation, tag: Tag, transactionAction: TransactionAction): Promise<void> {
    try {
      if (transaction.user && !transaction.user.issuer) {
        // OCPI
        if (Utils.isTenantComponentActive(tenant, TenantComponents.OCPI)) {
          await OCPPUtils.processOCPITransaction(tenant, transaction, chargingStation, tag, transactionAction);
        }
        // OICP
        if (Utils.isTenantComponentActive(tenant, TenantComponents.OICP)) {
          await OCPPUtils.processOICPTransaction(tenant, transaction, chargingStation, transactionAction);
        }
      }
    } catch (error) {
      // Cancel Start/Stop Transaction
      if (transactionAction !== TransactionAction.UPDATE) {
        throw error;
      } else {
        await Logging.logWarning({
          tenantID: tenant.id,
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          action: ServerAction.ROAMING,
          user: transaction.userID,
          module: MODULE_NAME, method: 'processTransactionRoaming',
          message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} Roaming exception occurred: ${error.message as string}`,
          detailedMessages: { error: error.stack }
        });
      }
    }
  }

  public static async processOICPTransaction(tenant: Tenant, transaction: Transaction,
      chargingStation: ChargingStation, transactionAction: TransactionAction): Promise<void> {
    if (!transaction.user || transaction.user.issuer) {
      return;
    }
    const user = transaction.user;
    let action: ServerAction;
    switch (transactionAction) {
      case TransactionAction.START:
        action = ServerAction.OCPP_START_TRANSACTION;
        break;
      case TransactionAction.UPDATE:
        action = ServerAction.UPDATE_TRANSACTION;
        break;
      case TransactionAction.STOP:
      case TransactionAction.END:
        action = ServerAction.OCPP_STOP_TRANSACTION;
        break;
    }
    // Get the client
    const oicpClient = await OICPClientFactory.getAvailableOicpClient(tenant, OICPRole.CPO) as CpoOICPClient;
    if (!oicpClient) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        user: user,
        action: action,
        module: MODULE_NAME, method: 'processOICPTransaction',
        message: `OICP component requires at least one CPO endpoint to ${transactionAction} a Session`
      });
    }
    let authorization: {
      sessionId: OICPSessionID;
      identification: OICPIdentification;
    };
    switch (transactionAction) {
      case TransactionAction.START:
        // Get the Session ID and Identification from (remote) authorization stored in Charging Station
        authorization = OICPUtils.getOICPIdentificationFromRemoteAuthorization(
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
        break;
      case TransactionAction.UPDATE:
        await oicpClient.updateSession(transaction);
        break;
      case TransactionAction.STOP:
        await oicpClient.stopSession(transaction);
        break;
      case TransactionAction.END:
        await oicpClient.pushCdr(transaction);
        break;
    }
  }

  public static async buildAndPriceExtraConsumptionInactivity(tenant: Tenant, chargingStation: ChargingStation, lastTransaction: Transaction): Promise<void> {
    const lastConsumption = await OCPPUtils.buildExtraConsumptionInactivity(tenant, chargingStation, lastTransaction);
    if (lastConsumption) {
      // Pricing of the extra inactivity
      if (lastConsumption?.toPrice) {
        await OCPPUtils.processTransactionPricing(tenant, lastTransaction, chargingStation, lastConsumption, TransactionAction.END);
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

  public static async buildExtraConsumptionInactivity(tenant: Tenant, chargingStation: ChargingStation, transaction: Transaction): Promise<Consumption> {
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

  public static async processTransactionPricing(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation,
      consumption: Consumption, action: TransactionAction): Promise<void> {
    let pricedConsumption: PricedConsumption;
    // Get the pricing impl
    const pricingImpl = await PricingFactory.getPricingImpl(tenant);
    if (pricingImpl) {
      switch (action) {
        // Start Transaction
        case TransactionAction.START:
          // Build first Dummy consumption for pricing the Start Transaction
          if (!consumption) {
            consumption = await OCPPUtils.createConsumptionFromMeterValue(
              tenant, chargingStation, transaction,
              { timestamp: transaction.timestamp, value: transaction.meterStart },
              {
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
              }
            );
          }
          // Set
          pricedConsumption = await pricingImpl.startSession(transaction, consumption, chargingStation);
          if (pricedConsumption) {
            // Set the initial pricing
            transaction.price = pricedConsumption.amount;
            transaction.roundedPrice = pricedConsumption.roundedAmount;
            transaction.priceUnit = pricedConsumption.currencyCode;
            transaction.pricingSource = pricedConsumption.pricingSource;
            transaction.currentCumulatedPrice = pricedConsumption.amount;
            transaction.currentCumulatedRoundedPrice = pricedConsumption.roundedAmount;
            transaction.pricingModel = pricedConsumption.pricingModel;
          }
          break;
        // Meter Values
        case TransactionAction.UPDATE:
          // Set
          pricedConsumption = await pricingImpl.updateSession(transaction, consumption, chargingStation);
          OCPPUtils.updateCumulatedAmounts(transaction, consumption, pricedConsumption);
          break;
        // Stop, End Transaction
        case TransactionAction.STOP:
          // Set
          pricedConsumption = await pricingImpl.stopSession(transaction, consumption, chargingStation);
          OCPPUtils.updateCumulatedAmounts(transaction, consumption, pricedConsumption);
          break;
        case TransactionAction.END:
          // Set
          pricedConsumption = await pricingImpl.endSession(transaction, consumption, chargingStation);
          OCPPUtils.updateCumulatedAmounts(transaction, consumption, pricedConsumption);
          break;
      }
    }
  }

  public static updateCumulatedAmounts(transaction: Transaction, consumption: Consumption, pricedConsumption: PricedConsumption): void {
    if (pricedConsumption) {
      // Update consumption
      consumption.amount = pricedConsumption.amount;
      consumption.roundedAmount = pricedConsumption.roundedAmount;
      consumption.currencyCode = pricedConsumption.currencyCode;
      consumption.pricingSource = pricedConsumption.pricingSource;
      consumption.cumulatedAmount = pricedConsumption.cumulatedAmount;
      // Update transaction
      transaction.currentCumulatedPrice = consumption.cumulatedAmount;
      transaction.currentCumulatedRoundedPrice = pricedConsumption.cumulatedRoundedAmount;
    }
  }

  public static async processTransactionBilling(tenant: Tenant, transaction: Transaction, action: TransactionAction): Promise<void> {
    if (!transaction.user || !transaction.user.issuer) {
      return;
    }
    const billingImpl = await BillingFactory.getBillingImpl(tenant);
    if (billingImpl) {
      switch (action) {
        // Start Transaction
        case TransactionAction.START:
          try {
            // Delegate
            const billingDataTransactionStart: BillingDataTransactionStart = await billingImpl.startTransaction(transaction);
            // Update
            transaction.billingData = {
              withBillingActive: billingDataTransactionStart.withBillingActive,
              lastUpdate: new Date()
            };
          } catch (error) {
            const message = `Billing - startTransaction failed - transaction ID '${transaction.id}'`;
            await Logging.logError({
              tenantID: tenant.id,
              siteID: transaction.siteID,
              siteAreaID: transaction.siteAreaID,
              companyID: transaction.companyID,
              chargingStationID: transaction.chargeBoxID,
              user: transaction.userID,
              action: ServerAction.BILLING_TRANSACTION,
              module: MODULE_NAME, method: 'processTransactionBilling',
              message, detailedMessages: { error: error.stack }
            });
            // Prevent from starting a transaction when Billing prerequisites are not met
            throw new BackendError({
              chargingStationID: transaction.chargeBoxID,
              siteID: transaction.siteID,
              siteAreaID: transaction.siteAreaID,
              companyID: transaction.companyID,
              user: transaction.user,
              action: ServerAction.BILLING_TRANSACTION,
              module: MODULE_NAME, method: 'processTransactionBilling',
              message, detailedMessages: { error: error.stack }
            });
          }
          break;
        // Meter Values
        case TransactionAction.UPDATE:
          try {
            // Delegate
            await billingImpl.updateTransaction(transaction);
            // Update
            if (transaction.billingData) {
              transaction.billingData.lastUpdate = new Date();
            }
          } catch (error) {
            const message = `Billing - updateTransaction failed - transaction ID '${transaction.id}'`;
            await Logging.logError({
              tenantID: tenant.id,
              siteID: transaction.siteID,
              siteAreaID: transaction.siteAreaID,
              companyID: transaction.companyID,
              chargingStationID: transaction.chargeBoxID,
              user: transaction.userID,
              action: ServerAction.BILLING_TRANSACTION,
              module: MODULE_NAME, method: 'processTransactionBilling',
              message, detailedMessages: { error: error.stack }
            });
          }
          break;
        // Stop Transaction - Extra inactivity is not yet known
        case TransactionAction.STOP:
          try {
            // Delegate
            const billingDataStop: BillingDataTransactionStop = await billingImpl.stopTransaction(transaction);
            // Update
            if (transaction.billingData) {
              transaction.billingData.stop = billingDataStop;
              transaction.billingData.lastUpdate = new Date();
            }
          } catch (error) {
            const message = `Billing - stopTransaction failed - transaction ID '${transaction.id}'`;
            await Logging.logError({
              tenantID: tenant.id,
              siteID: transaction.siteID,
              siteAreaID: transaction.siteAreaID,
              companyID: transaction.companyID,
              chargingStationID: transaction.chargeBoxID,
              user: transaction.userID,
              action: ServerAction.BILLING_TRANSACTION,
              module: MODULE_NAME, method: 'processTransactionBilling',
              message, detailedMessages: { error: error.stack }
            });
          }
          break;
        // End Transaction - Extra inactivity is now known
        case TransactionAction.END:
          try {
            // Delegate
            const billingDataStop: BillingDataTransactionStop = await billingImpl.endTransaction(transaction);
            // Update
            if (transaction.billingData) {
              transaction.billingData.stop = billingDataStop;
              transaction.billingData.lastUpdate = new Date();
            }
          } catch (error) {
            const message = `Billing - stopTransaction failed - transaction ID '${transaction.id}'`;
            await Logging.logError({
              tenantID: tenant.id,
              siteID: transaction.siteID,
              siteAreaID: transaction.siteAreaID,
              companyID: transaction.companyID,
              chargingStationID: transaction.chargeBoxID,
              user: transaction.userID,
              action: ServerAction.BILLING_TRANSACTION,
              module: MODULE_NAME, method: 'processTransactionBilling',
              message, detailedMessages: { error: error.stack }
            });
          }
          break;
      }
    }
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
        chargingStationID: transaction.chargeBoxID,
        siteID: transaction.siteID,
        siteAreaID: transaction.siteAreaID,
        companyID: transaction.companyID,
        action: ServerAction.REBUILD_TRANSACTION_CONSUMPTIONS,
        module: MODULE_NAME, method: 'rebuildTransactionSimplePricing',
        message: 'Transaction does not exist',
      });
    }
    if (!transaction.stop) {
      throw new BackendError({
        chargingStationID: transaction.chargeBoxID,
        siteID: transaction.siteID,
        siteAreaID: transaction.siteAreaID,
        companyID: transaction.companyID,
        action: ServerAction.REBUILD_TRANSACTION_CONSUMPTIONS,
        module: MODULE_NAME, method: 'rebuildTransactionSimplePricing',
        message: `Transaction ID '${transaction.id}' is in progress`,
      });
    }
    if (transaction.stop.pricingSource !== PricingSettingsType.SIMPLE) {
      throw new BackendError({
        chargingStationID: transaction.chargeBoxID,
        siteID: transaction.siteID,
        siteAreaID: transaction.siteAreaID,
        companyID: transaction.companyID,
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
      stopTransaction: OCPPStopTransactionRequestExtended, user: User, alternateUser: User, tagId: string): void {
    // Set final data
    transaction.stop = {
      reason: stopTransaction.reason,
      meterStop: stopTransaction.meterStop,
      timestamp: Utils.convertToDate(stopTransaction.timestamp),
      userID: (alternateUser ? alternateUser.id : (user ? user.id : null)),
      tagID: tagId,
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
            tenantID: tenant.id,
            ...LoggingHelper.getChargingStationProperties(chargingStation),
            module: MODULE_NAME, method: 'createConsumptionsFromMeterValues',
            action: ServerAction.OCPP_METER_VALUES,
            message: 'Meter Value is in the past and will be ignored',
            detailedMessages: { meterValue, transaction }
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
      for (const filter in chargingStationTemplate.extraFilters) {
        if (Utils.objectHasProperty(chargingStation, filter)) {
          const filterValue: string = chargingStationTemplate.extraFilters[filter];
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
      tenant: Tenant, chargingStation: ChargingStation, connectorID: number,
      chargingStationTemplate: ChargingStationTemplate): Promise<boolean> {
    // Copy from template
    if (chargingStationTemplate && !chargingStation.manualConfiguration) {
      // Handle connector
      if (Utils.objectHasProperty(chargingStationTemplate.technical, 'connectors')) {
        // Find the connector in the template
        const templateConnector = chargingStationTemplate.technical.connectors.find(
          (connector) => connector.connectorId === connectorID);
        if (!templateConnector) {
          await Logging.logWarning({
            tenantID: tenant.id,
            ...LoggingHelper.getChargingStationProperties(chargingStation),
            action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
            module: MODULE_NAME, method: 'enrichChargingStationConnectorWithTemplate',
            message: `No connector found in Template for Connector ID '${connectorID}' on '${chargingStation.chargePointVendor}'`
          });
          return false;
        }
        // Force Update
        for (const connector of chargingStation.connectors) {
          // Set
          if (connector.connectorId === connectorID) {
            // Assign props
            connector.type = templateConnector.type;
            if (Utils.objectHasProperty(templateConnector, 'power')) {
              connector.power = templateConnector.power;
            } else {
              delete connector.power;
            }
            if (Utils.objectHasProperty(templateConnector, 'amperage')) {
              connector.amperage = templateConnector.amperage;
            } else {
              delete connector.amperage;
            }
            if (Utils.objectHasProperty(templateConnector, 'chargePointID')) {
              connector.chargePointID = templateConnector.chargePointID;
            } else {
              delete connector.chargePointID;
            }
            if (Utils.objectHasProperty(templateConnector, 'voltage')) {
              connector.voltage = templateConnector.voltage;
            } else {
              delete connector.voltage;
            }
            if (Utils.objectHasProperty(templateConnector, 'currentType')) {
              connector.currentType = templateConnector.currentType;
            } else {
              delete connector.currentType;
            }
            if (Utils.objectHasProperty(templateConnector, 'numberOfConnectedPhase')) {
              connector.numberOfConnectedPhase = templateConnector.numberOfConnectedPhase;
            } else {
              delete connector.numberOfConnectedPhase;
            }
            const numberOfPhases = Utils.getNumberOfConnectedPhases(chargingStation, null, connector.connectorId);
            // Amperage limit
            OCPPUtils.checkAndSetConnectorAmperageLimit(chargingStation, connector, numberOfPhases);
            // Phase Assignment
            if (!Utils.objectHasProperty(connector, 'phaseAssignmentToGrid')) {
              await OCPPUtils.setConnectorPhaseAssignment(tenant, chargingStation, connector, numberOfPhases);
            }
            // Template on connector id = connectorID applied, break the loop to continue the static method execution. Never return here.
            break;
          }
        }
      }
      await Logging.logInfo({
        tenantID: tenant.id,
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
        module: MODULE_NAME, method: 'enrichChargingStationConnectorWithTemplate',
        message: `Template for Connector ID '${connectorID}' has been applied successfully on '${chargingStation.chargePointVendor}'`,
        detailedMessages: { chargingStationTemplate }
      });
      return true;
    } else if (chargingStationTemplate && chargingStation.manualConfiguration) {
      await Logging.logWarning({
        tenantID: tenant.id,
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
        module: MODULE_NAME, method: 'enrichChargingStationConnectorWithTemplate',
        message: `Template for Connector ID '${connectorID}' has been found but manual configuration is enabled so it will not be applied`,
        detailedMessages: { chargingStation }
      });
      return false;
    }
    await Logging.logWarning({
      tenantID: tenant.id,
      ...LoggingHelper.getChargingStationProperties(chargingStation),
      action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
      module: MODULE_NAME, method: 'enrichChargingStationConnectorWithTemplate',
      message: `No Template for Connector ID '${connectorID}' has been found for '${chargingStation.chargePointVendor}'`
    });
    return false;
  }

  public static async setChargingStationPhaseAssignment(tenant: Tenant, chargingStation: ChargingStation): Promise<void> {
    if (Utils.objectHasProperty(chargingStation, 'connectors')) {
      for (const connector of chargingStation.connectors) {
        if (!Utils.objectHasProperty(connector, 'phaseAssignmentToGrid')) {
          await OCPPUtils.setConnectorPhaseAssignment(tenant, chargingStation, connector);
        }
      }
    }
  }

  public static checkAndSetChargingStationAmperageLimit(chargingStation: ChargingStation): void {
    if (Utils.objectHasProperty(chargingStation, 'connectors')) {
      for (const connector of chargingStation.connectors) {
        OCPPUtils.checkAndSetConnectorAmperageLimit(chargingStation, connector);
      }
    }
  }

  public static async applyTemplateToChargingStation(tenant: Tenant, chargingStation: ChargingStation, applyOcppParameters = true): Promise<TemplateUpdateResult> {
    // Enrich
    const chargingStationTemplateUpdateResult = await OCPPUtils.enrichChargingStationWithTemplate(tenant, chargingStation);
    // Save
    if (chargingStationTemplateUpdateResult.chargingStationUpdated ||
      chargingStationTemplateUpdateResult.technicalUpdated ||
      chargingStationTemplateUpdateResult.capabilitiesUpdated ||
      chargingStationTemplateUpdateResult.ocppStandardUpdated ||
      chargingStationTemplateUpdateResult.ocppVendorUpdated) {
      const sectionsUpdated = [];
      if (chargingStationTemplateUpdateResult.technicalUpdated) {
        sectionsUpdated.push('Technical');
      }
      if (chargingStationTemplateUpdateResult.capabilitiesUpdated) {
        sectionsUpdated.push('Capabilities');
      }
      if (chargingStationTemplateUpdateResult.ocppStandardUpdated || chargingStationTemplateUpdateResult.ocppVendorUpdated) {
        sectionsUpdated.push('OCPP');
      }
      // Save
      await ChargingStationStorage.saveChargingStation(tenant, chargingStation);
      await Logging.logInfo({
        tenantID: tenant.id,
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
        module: MODULE_NAME, method: 'applyTemplateToChargingStation',
        message: `Charging Station '${chargingStation.id}' updated with the following Template's section(s): ${sectionsUpdated.join(', ')}`,
        detailedMessages: { chargingStationTemplateUpdated: chargingStationTemplateUpdateResult }
      });
      // Request and update OCPP parameters if needed
      if (applyOcppParameters && (chargingStationTemplateUpdateResult.ocppStandardUpdated || chargingStationTemplateUpdateResult.ocppVendorUpdated)) {
        await OCPPUtils.applyTemplateOcppParametersToChargingStation(tenant, chargingStation);
      }
    }
    return chargingStationTemplateUpdateResult;
  }

  public static async applyTemplateOcppParametersToChargingStation(tenant: Tenant, chargingStation: ChargingStation): Promise<OCPPChangeConfigurationResponse> {
    await Logging.logDebug({
      tenantID: tenant.id,
      ...LoggingHelper.getChargingStationProperties(chargingStation),
      action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
      module: MODULE_NAME, method: 'applyTemplateOcppParametersToChargingStation',
      message: `Apply Template's OCPP Parameters for '${chargingStation.id}' in Tenant ${Utils.buildTenantName(tenant)})`,
    });
    // Request and save the latest OCPP parameters
    let result = await Utils.executePromiseWithTimeout<OCPPChangeConfigurationResponse>(
      Constants.DELAY_CHANGE_CONFIGURATION_EXECUTION_MILLIS, OCPPCommon.requestAndSaveChargingStationOcppParameters(tenant, chargingStation),
      `Time out error (${Constants.DELAY_CHANGE_CONFIGURATION_EXECUTION_MILLIS.toString()} ms) in requesting OCPP Parameters`);
    // Update the OCPP Parameters from the template
    result = await Utils.executePromiseWithTimeout<OCPPChangeConfigurationResponse>(
      Constants.DELAY_CHANGE_CONFIGURATION_EXECUTION_MILLIS, OCPPUtils.updateChargingStationOcppParametersWithTemplate(tenant, chargingStation),
      `Time out error (${Constants.DELAY_CHANGE_CONFIGURATION_EXECUTION_MILLIS} ms) in updating OCPP Parameters`);
    if (result.status !== OCPPConfigurationStatus.ACCEPTED) {
      await Logging.logError({
        tenantID: tenant.id,
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
        module: MODULE_NAME, method: 'applyTemplateOcppParametersToChargingStation',
        message: `Cannot apply template OCPP Parameters to '${chargingStation.id}' in Tenant ${Utils.buildTenantName(tenant)})`,
      });
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
        tenantID: tenant.id,
        ...LoggingHelper.getChargingStationProperties(chargingStation),
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
      tenantID: tenant.id,
      ...LoggingHelper.getChargingStationProperties(chargingStation),
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
    const { tenant, chargingStation, token } = await OCPPUtils.checkAndGetChargingStationData(
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
      resultStatus = (result).status;
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
      tenantID: tenant.id,
      ...LoggingHelper.getChargingStationProperties(chargingStation),
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

  public static checkChargingStationOcppParameters(action: ServerAction, tenantID: string, tokenID: string, chargingStationID: string): void {
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

  public static async checkAndGetChargingStationData(action: ServerAction, tenantID: string, chargingStationID: string,
      tokenID: string): Promise<{ tenant: Tenant; chargingStation?: ChargingStation; token?: RegistrationToken }> {
    // Check parameters
    OCPPUtils.checkChargingStationOcppParameters(
      ServerAction.WS_CONNECTION, tenantID, tokenID, chargingStationID);
    // Get Tenant
    const tenant = await TenantStorage.getTenant(tenantID);
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
      if (action !== ServerAction.WS_CONNECTION &&
          action !== ServerAction.OCPP_BOOT_NOTIFICATION) {
        throw new BackendError({
          chargingStationID,
          module: MODULE_NAME,
          method: 'checkAndGetChargingStationData',
          message: 'Charging Station does not exist!'
        });
      }
    } else {
      // Update the DB (Migration for existing charging stations)
      if (!chargingStation.tokenID) {
        chargingStation.tokenID = tokenID;
      }
      if (chargingStation.tokenID !== tokenID) {
        // Must have a valid connection Token
        token = await OCPPUtils.ensureChargingStationHasValidConnectionToken(action, tenant, chargingStationID, tokenID);
        // Ok, set it
        await Logging.logInfo({
          tenantID: tenant.id,
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          action, module: MODULE_NAME, method: 'checkAndGetChargingStationData',
          message: `New Token ID '${tokenID}' has been set (old was '${chargingStation.tokenID}')`
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
      // Save Charging Station lastSeen date
      await ChargingStationStorage.saveChargingStationRuntimeData(tenant, chargingStation.id, {
        lastSeen: new Date(),
        tokenID: tokenID,
        cloudHostIP: Utils.getHostIP(),
        cloudHostName: Utils.getHostName(),
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
        tenantID: tenant.id,
        ...LoggingHelper.getChargingStationProperties(chargingStation),
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
            tenantID: tenant.id,
            ...LoggingHelper.getChargingStationProperties(chargingStation),
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
            tenantID: tenant.id,
            ...LoggingHelper.getChargingStationProperties(chargingStation),
            action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
            module: MODULE_NAME, method: 'updateChargingStationOcppParametersWithTemplate',
            message: `${!Utils.isUndefined(currentOcppParam) && 'Non existent '}OCPP Parameter '${ocppParameter.key}' has been successfully set from '${currentOcppParam?.value}' to '${ocppParameter.value}'`
          });
        } else if (result.status === OCPPConfigurationStatus.REBOOT_REQUIRED) {
          updatedOcppParameters.inSuccess++;
          rebootRequired = true;
          await Logging.logInfo({
            tenantID: tenant.id,
            ...LoggingHelper.getChargingStationProperties(chargingStation),
            action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
            module: MODULE_NAME, method: 'updateChargingStationOcppParametersWithTemplate',
            message: `${!Utils.isUndefined(currentOcppParam) && 'Non existent '}OCPP Parameter '${ocppParameter.key}' that requires reboot has been successfully set from '${currentOcppParam?.value}' to '${ocppParameter.value}'`
          });
        } else {
          updatedOcppParameters.inError++;
          await Logging.logError({
            tenantID: tenant.id,
            ...LoggingHelper.getChargingStationProperties(chargingStation),
            action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
            module: MODULE_NAME, method: 'updateChargingStationOcppParametersWithTemplate',
            message: `Error '${result.status}' in changing ${!Utils.isUndefined(currentOcppParam) && 'non existent '}OCPP Parameter '${ocppParameter.key}' from '${currentOcppParam?.value}' to '${ocppParameter.value}': `
          });
        }
      } catch (error) {
        updatedOcppParameters.inError++;
        await Logging.logError({
          tenantID: tenant.id,
          ...LoggingHelper.getChargingStationProperties(chargingStation),
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

  public static clearChargingStationConnectorRuntimeData(chargingStation: ChargingStation, connectorID: number): void {
    // Cleanup connector transaction data
    const foundConnector = Utils.getConnectorFromID(chargingStation, connectorID);
    if (foundConnector) {
      foundConnector.currentInstantWatts = 0;
      foundConnector.currentTotalConsumptionWh = 0;
      foundConnector.currentTotalInactivitySecs = 0;
      foundConnector.currentInactivityStatus = InactivityStatus.INFO;
      foundConnector.currentStateOfCharge = 0;
      foundConnector.currentTransactionID = 0;
      foundConnector.currentTransactionDate = null;
      foundConnector.currentTagID = null;
      foundConnector.currentUserID = null;
    }
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
          user, action,
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          message: 'Billing prerequisites are not met',
          module: MODULE_NAME, method: 'checkBillingPrerequisites',
          detailedMessages: { errorCodes }
        });
      }
    }
  }

  private static async enrichChargingStationWithTemplate(tenant: Tenant, chargingStation: ChargingStation): Promise<TemplateUpdateResult> {
    const templateUpdate: TemplateUpdate = {
      chargingStationUpdate: false,
      technicalUpdate: false,
      capabilitiesUpdate: false,
      ocppStandardUpdate: false,
      ocppVendorUpdate: false,
    };
    const templateUpdateResult: TemplateUpdateResult = {
      chargingStationUpdated: false,
      technicalUpdated: false,
      capabilitiesUpdated: false,
      ocppStandardUpdated: false,
      ocppVendorUpdated: false,
    };
    // Get Template
    const chargingStationTemplate = await OCPPUtils.getChargingStationTemplate(chargingStation);
    // Copy from template
    if (chargingStationTemplate && !chargingStation.manualConfiguration) {
      // Already updated?
      if (chargingStation.templateHash !== chargingStationTemplate.hash) {
        templateUpdate.chargingStationUpdate = true;
        // Check Technical Hash
        if (chargingStation.templateHashTechnical !== chargingStationTemplate.hashTechnical) {
          templateUpdate.technicalUpdate = true;
          if (Utils.objectHasProperty(chargingStationTemplate.technical, 'maximumPower')) {
            chargingStation.maximumPower = chargingStationTemplate.technical.maximumPower;
          }
          if (Utils.objectHasProperty(chargingStationTemplate.technical, 'chargePoints')) {
            chargingStation.chargePoints = chargingStationTemplate.technical.chargePoints;
          }
          if (Utils.objectHasProperty(chargingStationTemplate.technical, 'powerLimitUnit')) {
            chargingStation.powerLimitUnit = chargingStationTemplate.technical.powerLimitUnit;
          }
          if (Utils.objectHasProperty(chargingStationTemplate.technical, 'voltage')) {
            chargingStation.voltage = chargingStationTemplate.technical.voltage;
          }
          // Enrich connectors
          if (Utils.objectHasProperty(chargingStation, 'connectors')) {
            for (const connector of chargingStation.connectors) {
              await OCPPUtils.enrichChargingStationConnectorWithTemplate(tenant, chargingStation, connector.connectorId, chargingStationTemplate);
            }
          }
          // Set the hash
          chargingStation.templateHashTechnical = chargingStationTemplate.hashTechnical;
          templateUpdateResult.technicalUpdated = true;
        }
        // Already updated?
        if (chargingStation.templateHashCapabilities !== chargingStationTemplate.hashCapabilities) {
          templateUpdate.capabilitiesUpdate = true;
          // Handle capabilities
          chargingStation.capabilities = {} as ChargingStationCapabilities;
          if (Utils.objectHasProperty(chargingStationTemplate, 'capabilities')) {
            let matchFirmware = false;
            let matchOcpp = false;
            // Search Firmware/Ocpp match
            for (const capabilities of chargingStationTemplate.capabilities) {
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
                if (Utils.objectHasProperty(capabilities.capabilities, 'supportChargingProfiles') &&
                    !capabilities.capabilities?.supportChargingProfiles) {
                  chargingStation.excludeFromSmartCharging = !capabilities.capabilities.supportChargingProfiles;
                }
                chargingStation.capabilities = capabilities.capabilities;
                chargingStation.templateHashCapabilities = chargingStationTemplate.hashCapabilities;
                templateUpdateResult.capabilitiesUpdated = true;
                break;
              }
            }
          }
        }
        // Already updated?
        if (chargingStation.templateHashOcppStandard !== chargingStationTemplate.hashOcppStandard) {
          templateUpdate.ocppStandardUpdate = true;
          // Handle OCPP Standard Parameters
          chargingStation.ocppStandardParameters = [];
          if (Utils.objectHasProperty(chargingStationTemplate, 'ocppStandardParameters')) {
            let matchFirmware = false;
            let matchOcpp = false;
            // Search Firmware/Ocpp match
            for (const ocppStandardParameters of chargingStationTemplate.ocppStandardParameters) {
              // Check Firmware version
              if (ocppStandardParameters.supportedFirmwareVersions) {
                for (const supportedFirmwareVersion of ocppStandardParameters.supportedFirmwareVersions) {
                  const regExp = new RegExp(supportedFirmwareVersion);
                  if (regExp.test(chargingStation.firmwareVersion)) {
                    matchFirmware = true;
                    break;
                  }
                }
              }
              // Check Ocpp version
              if (ocppStandardParameters.supportedOcppVersions) {
                matchOcpp = ocppStandardParameters.supportedOcppVersions.includes(chargingStation.ocppVersion);
              }
              // Found?
              if (matchFirmware && matchOcpp) {
                for (const parameter in ocppStandardParameters.parameters) {
                  if (OCPPUtils.isOcppParamForPowerLimitationKey(parameter, chargingStation)) {
                    await Logging.logError({
                      tenantID: tenant.id,
                      ...LoggingHelper.getChargingStationProperties(chargingStation),
                      action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
                      module: MODULE_NAME, method: 'enrichChargingStationWithTemplate',
                      message: `Template contains setting for power limitation OCPP Parameter key '${parameter}' in OCPP Standard parameters, skipping. Remove it from template!`,
                      detailedMessages: { chargingStationTemplate }
                    });
                    continue;
                  }
                  if (Constants.OCPP_HEARTBEAT_KEYS.includes(parameter)) {
                    await Logging.logWarning({
                      tenantID: tenant.id,
                      ...LoggingHelper.getChargingStationProperties(chargingStation),
                      action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
                      module: MODULE_NAME, method: 'enrichChargingStationWithTemplate',
                      message: `Template contains heartbeat interval value setting for OCPP Parameter key '${parameter}' in OCPP Standard parameters, skipping. Remove it from template`,
                      detailedMessages: { chargingStationTemplate }
                    });
                    continue;
                  }
                  chargingStation.ocppStandardParameters.push({
                    key: parameter,
                    value: ocppStandardParameters.parameters[parameter]
                  });
                }
                chargingStation.templateHashOcppStandard = chargingStationTemplate.hashOcppStandard;
                templateUpdateResult.ocppStandardUpdated = true;
                break;
              }
            }
          }
        }
        // Already updated?
        if (chargingStation.templateHashOcppVendor !== chargingStationTemplate.hashOcppVendor) {
          templateUpdate.ocppVendorUpdate = true;
          // Handle OCPP Vendor Parameters
          chargingStation.ocppVendorParameters = [];
          if (Utils.objectHasProperty(chargingStationTemplate, 'ocppVendorParameters')) {
            let matchFirmware = false;
            let matchOcpp = false;
            // Search Firmware/Ocpp match
            for (const ocppVendorParameters of chargingStationTemplate.ocppVendorParameters) {
              // Check Firmware version
              if (ocppVendorParameters.supportedFirmwareVersions) {
                for (const supportedFirmwareVersion of ocppVendorParameters.supportedFirmwareVersions) {
                  const regExp = new RegExp(supportedFirmwareVersion);
                  if (regExp.test(chargingStation.firmwareVersion)) {
                    matchFirmware = true;
                    break;
                  }
                }
              }
              // Check Ocpp version
              if (ocppVendorParameters.supportedOcppVersions) {
                matchOcpp = ocppVendorParameters.supportedOcppVersions.includes(chargingStation.ocppVersion);
              }
              // Found?
              if (matchFirmware && matchOcpp) {
                for (const parameter in ocppVendorParameters.parameters) {
                  if (OCPPUtils.isOcppParamForPowerLimitationKey(parameter, chargingStation)) {
                    await Logging.logError({
                      tenantID: tenant.id,
                      ...LoggingHelper.getChargingStationProperties(chargingStation),
                      action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
                      module: MODULE_NAME, method: 'enrichChargingStationWithTemplate',
                      message: `Template contains setting for power limitation OCPP Parameter key '${parameter}' in OCPP Vendor parameters, skipping. Remove it from template!`,
                      detailedMessages: { chargingStationTemplate }
                    });
                    continue;
                  }
                  if (Constants.OCPP_HEARTBEAT_KEYS.includes(parameter)) {
                    await Logging.logWarning({
                      tenantID: tenant.id,
                      ...LoggingHelper.getChargingStationProperties(chargingStation),
                      action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
                      module: MODULE_NAME, method: 'enrichChargingStationWithTemplate',
                      message: `Template contains heartbeat interval value setting for OCPP Parameter key '${parameter}' in OCPP Vendor parameters, skipping. Remove it from template`,
                      detailedMessages: { chargingStationTemplate }
                    });
                    continue;
                  }
                  chargingStation.ocppVendorParameters.push({
                    key: parameter,
                    value: ocppVendorParameters.parameters[parameter]
                  });
                }
                chargingStation.templateHashOcppVendor = chargingStationTemplate.hashOcppVendor;
                templateUpdateResult.ocppVendorUpdated = true;
                break;
              }
            }
          }
        }
        const sectionsUpdated: string[] = [];
        const sectionsNotMatched: string[] = [];
        if (templateUpdateResult.technicalUpdated) {
          sectionsUpdated.push('Technical');
        }
        if (templateUpdateResult.capabilitiesUpdated) {
          sectionsUpdated.push('Capabilities');
        }
        if (templateUpdateResult.ocppStandardUpdated || templateUpdateResult.ocppVendorUpdated) {
          sectionsUpdated.push('OCPP');
        }
        if (templateUpdate.capabilitiesUpdate && !templateUpdateResult.capabilitiesUpdated) {
          sectionsNotMatched.push('Capabilities');
        }
        if (templateUpdate.ocppStandardUpdate && !templateUpdateResult.ocppStandardUpdated) {
          sectionsNotMatched.push('OCPPStandard');
        }
        if (templateUpdate.ocppVendorUpdate && !templateUpdateResult.ocppVendorUpdated) {
          sectionsNotMatched.push('OCPPVendor');
        }
        chargingStation.templateHash = chargingStationTemplate.hash;
        templateUpdateResult.chargingStationUpdated = true;
        await Logging.logInfo({
          tenantID: tenant.id,
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
          module: MODULE_NAME, method: 'enrichChargingStationWithTemplate',
          message: `Template applied and updated the following sections: ${sectionsUpdated.join(', ')}`,
          detailedMessages: { templateUpdateResult, chargingStationTemplate, chargingStation }
        });
        if (!Utils.isEmptyArray(sectionsNotMatched)) {
          await Logging.logWarning({
            tenantID: tenant.id,
            ...LoggingHelper.getChargingStationProperties(chargingStation),
            action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
            module: MODULE_NAME, method: 'enrichChargingStationWithTemplate',
            message: `Template applied and not matched the following sections: ${sectionsNotMatched.join(', ')}`,
            detailedMessages: { templateUpdateResult, chargingStationTemplate, chargingStation }
          });
        }
        return templateUpdateResult;
      }
      await Logging.logDebug({
        tenantID: tenant.id,
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
        module: MODULE_NAME, method: 'enrichChargingStationWithTemplate',
        message: 'Template has already been applied',
        detailedMessages: { chargingStationTemplate, chargingStation }
      });
      return templateUpdateResult;
    } else if (chargingStationTemplate && chargingStation.manualConfiguration) {
      await Logging.logWarning({
        tenantID: tenant.id,
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
        module: MODULE_NAME, method: 'enrichChargingStationWithTemplate',
        message: 'Template matching the charging station has been found but manual configuration is enabled so it will not be applied',
        detailedMessages: { chargingStation }
      });
      return templateUpdateResult;
    }
    let noMatchingTemplateLogMsg: string;
    if (chargingStation.templateHash) {
      noMatchingTemplateLogMsg = 'No template matching the charging station has been found but one matched previously. Keeping the previous template configuration';
    } else {
      noMatchingTemplateLogMsg = 'No template matching the charging station has been found';
    }
    await Logging.logWarning({
      tenantID: tenant.id,
      ...LoggingHelper.getChargingStationProperties(chargingStation),
      action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
      module: MODULE_NAME, method: 'enrichChargingStationWithTemplate',
      message: noMatchingTemplateLogMsg,
      detailedMessages: { chargingStation }
    });
    return templateUpdateResult;
  }

  private static checkAndSetConnectorAmperageLimit(chargingStation: ChargingStation, connector: Connector, nrOfPhases?: number): void {
    const numberOfPhases = nrOfPhases ?? Utils.getNumberOfConnectedPhases(chargingStation, null, connector.connectorId);
    // Check connector amperage limit
    const connectorAmperageLimit = OCPPUtils.checkAndGetConnectorAmperageLimit(chargingStation, connector, numberOfPhases);
    if (connectorAmperageLimit) {
      // Reset
      connector.amperageLimit = connectorAmperageLimit;
    }
    // Keep
  }

  private static checkAndGetConnectorAmperageLimit(chargingStation: ChargingStation, connector: Connector, nrOfPhases?: number): number {
    const numberOfPhases = nrOfPhases ?? Utils.getNumberOfConnectedPhases(chargingStation, null, connector.connectorId);
    const connectorAmperageLimitMax = Utils.getChargingStationAmperage(chargingStation, null, connector.connectorId);
    const connectorAmperageLimitMin = StaticLimitAmps.MIN_LIMIT_PER_PHASE * numberOfPhases;
    if (!Utils.objectHasProperty(connector, 'amperageLimit') || (Utils.objectHasProperty(connector, 'amperageLimit') && Utils.isNullOrUndefined(connector.amperageLimit))) {
      return connectorAmperageLimitMax;
    } else if (Utils.objectHasProperty(connector, 'amperageLimit') && connector.amperageLimit > connectorAmperageLimitMax) {
      return connectorAmperageLimitMax;
    } else if (Utils.objectHasProperty(connector, 'amperageLimit') && connector.amperageLimit < connectorAmperageLimitMin) {
      return connectorAmperageLimitMin;
    }
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

  private static async processOCPITransaction(tenant: Tenant, transaction: Transaction,
      chargingStation: ChargingStation, tag: Tag, transactionAction: TransactionAction): Promise<void> {
    // Set Action
    let action: ServerAction;
    switch (transactionAction) {
      case TransactionAction.START:
        action = ServerAction.OCPP_START_TRANSACTION;
        break;
      case TransactionAction.UPDATE:
        action = ServerAction.UPDATE_TRANSACTION;
        break;
      case TransactionAction.STOP:
      case TransactionAction.END:
        action = ServerAction.OCPP_STOP_TRANSACTION;
        break;
    }
    // Check User
    if (!transaction.user) {
      throw new BackendError({
        chargingStationID: transaction.chargeBoxID,
        siteID: transaction.siteID,
        siteAreaID: transaction.siteAreaID,
        companyID: transaction.companyID,
        user: transaction.user,
        action,
        module: MODULE_NAME, method: 'processOCPITransaction',
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} User does not exist`
      });
    }
    if (!Utils.isTenantComponentActive(tenant, TenantComponents.OCPI)) {
      throw new BackendError({
        chargingStationID: transaction.chargeBoxID,
        siteID: transaction.siteID,
        siteAreaID: transaction.siteAreaID,
        companyID: transaction.companyID,
        user: transaction.user,
        action,
        module: MODULE_NAME, method: 'processOCPITransaction',
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} OCPI Component is not active in this Tenant`
      });
    }
    if (transaction.user.issuer) {
      throw new BackendError({
        chargingStationID: transaction.chargeBoxID,
        siteID: transaction.siteID,
        siteAreaID: transaction.siteAreaID,
        companyID: transaction.companyID,
        user: transaction.user,
        action,
        module: MODULE_NAME, method: 'processOCPITransaction',
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} User does not belong to the local organization`
      });
    }
    const ocpiClient = await OCPIClientFactory.getAvailableOcpiClient(tenant, OCPIRole.CPO) as CpoOCPIClient;
    if (!ocpiClient) {
      throw new BackendError({
        chargingStationID: transaction.chargeBoxID,
        siteID: transaction.siteID,
        siteAreaID: transaction.siteAreaID,
        companyID: transaction.companyID,
        user: transaction.user,
        action,
        module: MODULE_NAME, method: 'processOCPITransaction',
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} OCPI component requires at least one CPO endpoint to ${transactionAction} a Transaction`
      });
    }
    switch (transactionAction) {
      case TransactionAction.START:
        // Check Authorization
        if (!transaction.authorizationID) {
          throw new BackendError({
            chargingStationID: transaction.chargeBoxID,
            siteID: transaction.siteID,
            siteAreaID: transaction.siteAreaID,
            companyID: transaction.companyID,
            user: transaction.user,
            action: action,
            module: MODULE_NAME, method: 'processOCPITransaction',
            message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} Tag ID '${transaction.tagID}' is not authorized`
          });
        }
        await ocpiClient.startSession(tag.ocpiToken, chargingStation, transaction);
        break;
      case TransactionAction.UPDATE:
        await ocpiClient.updateSession(transaction);
        break;
      case TransactionAction.STOP:
        await ocpiClient.stopSession(transaction);
        break;
      case TransactionAction.END:
        await ocpiClient.postCdr(transaction);
        break;
    }
  }
}
