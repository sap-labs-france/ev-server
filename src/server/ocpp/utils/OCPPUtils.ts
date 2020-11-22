import { ChargingProfile, ChargingProfilePurposeType } from '../../../types/ChargingProfile';
import ChargingStation, { ChargingStationCapabilities, ChargingStationOcppParameters, ChargingStationTemplate, ConnectorCurrentLimitSource, CurrentType, OcppParameter, StaticLimitAmps, TemplateUpdateResult } from '../../../types/ChargingStation';
import { OCPPAuthorizeRequestExtended, OCPPMeasurand, OCPPNormalizedMeterValue, OCPPPhase, OCPPReadingContext, OCPPStopTransactionRequestExtended, OCPPUnitOfMeasure } from '../../../types/ocpp/OCPPServer';
import { OCPPChangeConfigurationCommandParam, OCPPChangeConfigurationCommandResult, OCPPChargingProfileStatus, OCPPConfigurationStatus, OCPPGetConfigurationCommandParam, OCPPGetConfigurationCommandResult, OCPPResetCommandResult, OCPPResetStatus, OCPPResetType } from '../../../types/ocpp/OCPPClient';
import Transaction, { InactivityStatus, TransactionAction, TransactionStop } from '../../../types/Transaction';

import { ActionsResponse } from '../../../types/GlobalType';
import BackendError from '../../../exception/BackendError';
import { BillingDataTransactionStop } from '../../../types/Billing';
import BillingFactory from '../../../integration/billing/BillingFactory';
import ChargingStationClientFactory from '../../../client/ocpp/ChargingStationClientFactory';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import ChargingStationVendorFactory from '../../../integration/charging-station-vendor/ChargingStationVendorFactory';
import Constants from '../../../utils/Constants';
import Consumption from '../../../types/Consumption';
import ConsumptionStorage from '../../../storage/mongodb/ConsumptionStorage';
import CpoOCPIClient from '../../../client/ocpi/CpoOCPIClient';
import { DataResult } from '../../../types/DataResult';
import Logging from '../../../utils/Logging';
import OCPIClientFactory from '../../../client/ocpi/OCPIClientFactory';
import { OCPIRole } from '../../../types/ocpi/OCPIRole';
import OCPPStorage from '../../../storage/mongodb/OCPPStorage';
import { PricedConsumption } from '../../../types/Pricing';
import PricingFactory from '../../../integration/pricing/PricingFactory';
import { PricingSettingsType } from '../../../types/Setting';
import { ServerAction } from '../../../types/Server';
import SiteArea from '../../../types/SiteArea';
import SiteAreaStorage from '../../../storage/mongodb/SiteAreaStorage';
import Tenant from '../../../types/Tenant';
import TenantComponents from '../../../types/TenantComponents';
import TenantStorage from '../../../storage/mongodb/TenantStorage';
import TransactionStorage from '../../../storage/mongodb/TransactionStorage';
import User from '../../../types/User';
import UserStorage from '../../../storage/mongodb/UserStorage';
import UserToken from '../../../types/UserToken';
import Utils from '../../../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'OCPPUtils';

export default class OCPPUtils {
  public static async processOCPITransaction(tenantID: string, transaction: Transaction,
    chargingStation: ChargingStation, transactionAction: TransactionAction): Promise<void> {
    try {
      if (!transaction.user || transaction.user.issuer) {
        return;
      }
      const user: User = transaction.user;
      const tenant: Tenant = await TenantStorage.getTenant(tenantID);
      let action: ServerAction;
      switch (transactionAction) {
        case TransactionAction.START:
          action = ServerAction.START_TRANSACTION;
          break;
        case TransactionAction.UPDATE:
          action = ServerAction.UPDATE_TRANSACTION;
          break;
        case TransactionAction.STOP:
        case TransactionAction.END:
          action = ServerAction.STOP_TRANSACTION;
          break;
      }
      if (!Utils.isTenantComponentActive(tenant, TenantComponents.OCPI)) {
        throw new BackendError({
          user: user,
          action: action,
          module: MODULE_NAME,
          method: 'processOCPITransaction',
          message: `Unable to ${transactionAction} a Transaction for User '${user.id}' not issued locally`
        });
      }
      const ocpiClient = await OCPIClientFactory.getAvailableOcpiClient(tenant, OCPIRole.CPO) as CpoOCPIClient;
      if (!ocpiClient) {
        throw new BackendError({
          user: user,
          action: action,
          module: MODULE_NAME,
          method: 'processOCPITransaction',
          message: `OCPI component requires at least one CPO endpoint to ${transactionAction} a Session`
        });
      }
      let authorizationId;
      let authorizations: DataResult<OCPPAuthorizeRequestExtended>;
      switch (transactionAction) {
        case TransactionAction.START:
          // eslint-disable-next-line no-case-declarations
          const tag = await UserStorage.getTag(tenantID, transaction.tagID);
          if (!tag.ocpiToken) {
            throw new BackendError({
              user: user,
              action: action,
              module: MODULE_NAME,
              method: 'processOCPITransaction',
              message: `User '${Utils.buildUserFullName(user)}' with Tag ID '${transaction.tagID}' cannot ${transactionAction} a Transaction thought OCPI protocol due to missing OCPI Token`
            });
          }
          // Retrieve Authorization ID
          authorizations = await OCPPStorage.getAuthorizes(tenant.id, {
            dateFrom: moment(transaction.timestamp).subtract(10, 'minutes').toDate(),
            chargeBoxID: transaction.chargeBoxID,
            tagID: transaction.tagID
          }, Constants.DB_PARAMS_MAX_LIMIT);
          // Found ID?
          if (authorizations && authorizations.result && authorizations.result.length > 0) {
            // Get the first non used Authorization OCPI ID
            for (const authorization of authorizations.result) {
              if (authorization.authorizationId) {
                const ocpiTransaction = await TransactionStorage.getOCPITransaction(tenant.id, authorization.authorizationId);
                // OCPI ID not used yet
                if (!ocpiTransaction) {
                  authorizationId = authorization.authorizationId;
                  break;
                }
              }
            }
          }
          if (!authorizationId) {
            throw new BackendError({
              user: user,
              action: action,
              module: MODULE_NAME, method: 'processOCPITransaction',
              message: `User '${user.id}' with Tag ID '${transaction.tagID}' cannot ${transactionAction} Transaction thought OCPI protocol due to missing Authorization`
            });
          }
          await ocpiClient.startSession(tag.ocpiToken, chargingStation, transaction, authorizationId);
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
    } catch (error) {
      Logging.logError({
        tenantID: tenantID,
        user: transaction.userID,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.OCPI_PUSH_SESSIONS,
        module: MODULE_NAME, method: 'processOCPITransaction',
        message: `Cannot ${transactionAction} Transaction ID '${transaction.id}' thought OCPI protocol`,
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
  }

  public static async buildExtraConsumptionInactivity(tenantID: string, transaction: Transaction): Promise<boolean> {
    // Extra inactivity
    if (transaction.stop.extraInactivitySecs > 0) {
      // Get the last Consumption
      const lastConsumption = await ConsumptionStorage.getLastTransactionConsumption(
        tenantID, { transactionId: transaction.id });
      if (lastConsumption) {
        delete lastConsumption.id;
        // Create the extra consumption with inactivity
        lastConsumption.startedAt = lastConsumption.endedAt;
        lastConsumption.endedAt = moment(lastConsumption.startedAt).add(transaction.stop.extraInactivitySecs, 's').toDate();
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
        // Save
        await ConsumptionStorage.saveConsumption(tenantID, lastConsumption);
        // Update the Stop transaction data
        transaction.stop.timestamp = lastConsumption.endedAt;
        transaction.stop.totalDurationSecs = Math.floor((transaction.stop.timestamp.getTime() - transaction.timestamp.getTime()) / 1000);
        transaction.stop.extraInactivityComputed = true;
        return true;
      }
    }
    return false;
  }

  public static async priceTransaction(tenantID: string, transaction: Transaction, consumption: Consumption, action: TransactionAction): Promise<void> {
    let pricedConsumption: PricedConsumption;
    // Get the pricing impl
    const pricingImpl = await PricingFactory.getPricingImpl(tenantID);
    if (pricingImpl) {
      switch (action) {
        // Start Transaction
        case TransactionAction.START:
          // Set
          pricedConsumption = await pricingImpl.startSession(transaction, consumption);
          if (pricedConsumption) {
            // Set the initial pricing
            transaction.price = pricedConsumption.amount;
            transaction.roundedPrice = pricedConsumption.roundedAmount;
            transaction.priceUnit = pricedConsumption.currencyCode;
            transaction.pricingSource = pricedConsumption.pricingSource;
            transaction.currentCumulatedPrice = pricedConsumption.amount;
          }
          break;
        // Meter Values
        case TransactionAction.UPDATE:
          // Set
          pricedConsumption = await pricingImpl.updateSession(transaction, consumption);
          if (pricedConsumption) {
            // Update consumption
            consumption.amount = pricedConsumption.amount;
            consumption.roundedAmount = pricedConsumption.roundedAmount;
            consumption.currencyCode = pricedConsumption.currencyCode;
            consumption.pricingSource = pricedConsumption.pricingSource;
            if (pricedConsumption.cumulatedAmount) {
              consumption.cumulatedAmount = pricedConsumption.cumulatedAmount;
            } else {
              consumption.cumulatedAmount = Utils.convertToFloat((transaction.currentCumulatedPrice + consumption.amount).toFixed(6));
            }
            transaction.currentCumulatedPrice = consumption.cumulatedAmount;
          }
          break;
        // Stop Transaction
        case TransactionAction.STOP:
          // Set
          pricedConsumption = await pricingImpl.stopSession(transaction, consumption);
          if (pricedConsumption) {
            // Update consumption
            consumption.amount = pricedConsumption.amount;
            consumption.roundedAmount = pricedConsumption.roundedAmount;
            consumption.currencyCode = pricedConsumption.currencyCode;
            consumption.pricingSource = pricedConsumption.pricingSource;
            if (pricedConsumption.cumulatedAmount) {
              consumption.cumulatedAmount = pricedConsumption.cumulatedAmount;
            } else {
              consumption.cumulatedAmount = Utils.convertToFloat((transaction.currentCumulatedPrice + consumption.amount).toFixed(6));
            }
            transaction.currentCumulatedPrice = consumption.cumulatedAmount;
            // Update Transaction
            if (!transaction.stop) {
              transaction.stop = {} as TransactionStop;
            }
            transaction.stop.price = Utils.convertToFloat(transaction.currentCumulatedPrice.toFixed(6));
            transaction.stop.roundedPrice = Utils.convertToFloat((transaction.currentCumulatedPrice).toFixed(2));
            transaction.stop.priceUnit = pricedConsumption.currencyCode;
            transaction.stop.pricingSource = pricedConsumption.pricingSource;
          }
          break;
      }
    }
  }

  public static async billTransaction(tenantID: string, transaction: Transaction, action: TransactionAction): Promise<void> {
    let billingDataStop: BillingDataTransactionStop;
    const billingImpl = await BillingFactory.getBillingImpl(tenantID);
    if (billingImpl) {
      // Check
      switch (action) {
        // Start Transaction
        case TransactionAction.START:
          try {
            // Delegate
            await billingImpl.startTransaction(transaction);
            // Update
            transaction.billingData = {
              lastUpdate: new Date()
            };
          } catch (error) {
            Logging.logError({
              tenantID: tenantID,
              user: transaction.userID,
              source: Constants.CENTRAL_SERVER,
              action: ServerAction.BILLING_TRANSACTION,
              module: MODULE_NAME, method: 'billTransaction',
              message: `Failed to bill the Transaction ID '${transaction.id}'`,
              detailedMessages: { error: error.message, stack: error.stack }
            });
          }
          break;
        // Meter Values
        case TransactionAction.UPDATE:
          try {
            // Delegate
            await billingImpl.updateTransaction(transaction);
            // Update
            transaction.billingData.lastUpdate = new Date();
          } catch (error) {
            Logging.logError({
              tenantID: tenantID,
              user: transaction.userID,
              source: Constants.CENTRAL_SERVER,
              action: ServerAction.BILLING_TRANSACTION,
              module: MODULE_NAME, method: 'billTransaction',
              message: `Failed to bill the Transaction ID '${transaction.id}'`,
              detailedMessages: { error: error.message, stack: error.stack }
            });
          }
          break;
        // Stop Transaction
        case TransactionAction.STOP:
          try {
            // Delegate
            billingDataStop = await billingImpl.stopTransaction(transaction);
            // Update
            transaction.billingData.status = billingDataStop.status;
            transaction.billingData.invoiceID = billingDataStop.invoiceID;
            transaction.billingData.invoiceStatus = billingDataStop.invoiceStatus;
            transaction.billingData.invoiceItem = billingDataStop.invoiceItem;
            transaction.billingData.lastUpdate = new Date();
          } catch (error) {
            Logging.logError({
              tenantID: tenantID,
              user: transaction.userID,
              source: Constants.CENTRAL_SERVER,
              action: ServerAction.BILLING_TRANSACTION,
              module: MODULE_NAME, method: 'billTransaction',
              message: `Failed to bill the Transaction ID '${transaction.id}'`,
              detailedMessages: { error: error.message, stack: error.stack }
            });
          }
          break;
      }
    }
  }

  public static assertConsistencyInConsumption(chargingStation: ChargingStation, connectorID: number, consumption: Consumption): void {
    // Check Total Power with Meter Value Power L1, L2, L3
    if (consumption.instantWattsL1 > 0 || consumption.instantWattsL2 > 0 || consumption.instantWattsL3 > 0) {
      // Check total Power with L1/l2/L3
      const totalWatts = consumption.instantWattsL1 + consumption.instantWattsL2 + consumption.instantWattsL3;
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
      // Check total Current with L1/l2/L3
      const totalAmps = consumption.instantAmpsL1 + consumption.instantAmpsL2 + consumption.instantAmpsL3;
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
          consumption.instantWatts = consumption.instantVolts * consumption.instantAmps;
        } else {
          consumption.instantWatts = Utils.convertAmpToWatt(chargingStation, null, connectorID, consumption.instantAmps);
        }
      // Based on provided Consumption
      } else {
        // Compute average Instant Power based on consumption over a time period (usually 60s)
        const diffSecs = moment(consumption.endedAt).diff(consumption.startedAt, 'milliseconds') / 1000;
        // Consumption is always provided
        const sampleMultiplierWhToWatt = diffSecs > 0 ? 3600 / diffSecs : 0;
        consumption.instantWatts = consumption.consumptionWh * sampleMultiplierWhToWatt;
      }
    }
    // Current not provided in Meter Value
    if (!consumption.instantAmps) {
      // Backup on Instant Watts
      if (consumption.instantWatts > 0) {
        if (consumption.instantVolts > 0) {
          consumption.instantAmps = consumption.instantWatts / consumption.instantVolts;
        } else {
          consumption.instantAmps = Utils.convertWattToAmp(chargingStation, null, connectorID, consumption.instantWatts);
        }
      }
    }
    // Fill Power per Phase when Current is provided in Meter Values (Power per phase not Provided by Schneider)
    if (!consumption.instantWattsL1 && !consumption.instantWattsL2 && !consumption.instantWattsL3 &&
      (consumption.instantAmpsL1 > 0 || consumption.instantAmpsL2 > 0 || consumption.instantAmpsL3 > 0)) {
      if (consumption.instantVoltsL1 > 0) {
        consumption.instantWattsL1 = consumption.instantAmpsL1 * consumption.instantVoltsL1;
      } else {
        consumption.instantWattsL1 = Utils.convertAmpToWatt(chargingStation, null, connectorID, consumption.instantAmpsL1);
      }
      if (consumption.instantVoltsL2 > 0) {
        consumption.instantWattsL2 = consumption.instantAmpsL2 * consumption.instantVoltsL2;
      } else {
        consumption.instantWattsL2 = Utils.convertAmpToWatt(chargingStation, null, connectorID, consumption.instantAmpsL2);
      }
      if (consumption.instantVoltsL3 > 0) {
        consumption.instantWattsL3 = consumption.instantAmpsL3 * consumption.instantVoltsL3;
      } else {
        consumption.instantWattsL3 = Utils.convertAmpToWatt(chargingStation, null, connectorID, consumption.instantAmpsL3);
      }
    }
    // Fill Power per Phase
    if (!consumption.instantWattsDC && consumption.instantAmpsDC > 0 && consumption.instantVoltsDC > 0) {
      consumption.instantWattsDC = consumption.instantAmpsDC * consumption.instantVoltsDC;
    }
  }

  public static updateTransactionWithConsumption(chargingStation: ChargingStation, transaction: Transaction, consumption: Consumption): void {
    // Set Consumption (currentTotalConsumptionWh, currentTotalInactivitySecs are updated in consumption creation)
    transaction.currentConsumptionWh = Utils.convertToFloat(consumption.consumptionWh);
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
      moment(transaction.lastConsumption ? transaction.lastConsumption.timestamp : new Date()).diff(
        moment(transaction.timestamp))).asSeconds();
    transaction.currentInactivityStatus = Utils.getInactivityStatusLevel(
      chargingStation, transaction.connectorId, transaction.currentTotalInactivitySecs);
  }

  public static async rebuildTransactionConsumptions(tenantID: string, transactionId: number): Promise<number> {
    let consumptions: Consumption[] = [];
    let transactionSimplePricePerkWh;
    if (!transactionId) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.REBUILD_TRANSACTION_CONSUMPTIONS,
        module: MODULE_NAME, method: 'rebuildConsumptionsFromMeterValues',
        message: 'Session ID must be provided',
      });
    }
    // Get the Transaction
    const transaction = await TransactionStorage.getTransaction(tenantID, transactionId);
    if (!transaction) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.REBUILD_TRANSACTION_CONSUMPTIONS,
        module: MODULE_NAME, method: 'rebuildConsumptionsFromMeterValues',
        message: `Session ID '${transactionId}' does not exist`,
      });
    }
    if (!transaction.stop) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.REBUILD_TRANSACTION_CONSUMPTIONS,
        module: MODULE_NAME, method: 'rebuildConsumptionsFromMeterValues',
        message: `Session ID '${transactionId}' is in progress`,
      });
    }
    // Check Simple Pricing
    if (transaction.pricingSource === PricingSettingsType.SIMPLE) {
      transactionSimplePricePerkWh = Utils.roundTo(transaction.stop.price / (transaction.stop.totalConsumptionWh / 1000), 2);
    }
    // Get the Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStation(tenantID,
      transaction.chargeBoxID, { includeDeleted: true });
    if (!chargingStation) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.REBUILD_TRANSACTION_CONSUMPTIONS,
        module: MODULE_NAME, method: 'rebuildConsumptionsFromMeterValues',
        message: `Charging Station ID '${transaction.chargeBoxID}' does not exist`,
      });
    }
    // Get the Meter Values
    const meterValues = await OCPPStorage.getMeterValues(tenantID, { transactionId }, Constants.DB_PARAMS_MAX_LIMIT);
    if (meterValues.count > 0) {
      // Build all Consumptions
      consumptions = await OCPPUtils.createConsumptionsFromMeterValues(tenantID, chargingStation, transaction, meterValues.result);
      // Build last Consumptions
      const stopTransaction: OCPPStopTransactionRequestExtended = {
        idTag: transaction.stop.tagID,
        meterStop: transaction.stop.meterStop,
        timestamp: meterValues.result[meterValues.count - 1].timestamp.toISOString(),
        transactionId: transaction.id,
        chargeBoxID: transaction.chargeBoxID,
      };
      // Push last dummy consumption for Stop Transaction
      consumptions.push({} as Consumption);
      // Delete first all transaction's consumptions
      await ConsumptionStorage.deleteConsumptions(tenantID, [transactionId]);
      // Price/Bill Transaction and Save the Consumptions
      for (let i = 0; i < consumptions.length; i++) {
        // Last consumption is a Stop Transaction
        if (i === consumptions.length - 1) {
          // Create last meter values based on history of transaction/stopTransaction
          const stopMeterValues = OCPPUtils.createTransactionStopMeterValues(transaction, stopTransaction);
          // Create last consumption
          const lastConsumptions = await OCPPUtils.createConsumptionsFromMeterValues(
            tenantID, chargingStation, transaction, stopMeterValues);
          consumptions.splice(consumptions.length - 1, 1, lastConsumptions[0]);
        }
        const consumption = consumptions[i];
        // Update Transaction with Consumption
        OCPPUtils.updateTransactionWithConsumption(chargingStation, transaction, consumption);
        // Price & Bill
        if (consumption.toPrice) {
          await OCPPUtils.priceTransaction(tenantID, transaction, consumption, TransactionAction.UPDATE);
          await OCPPUtils.billTransaction(tenantID, transaction, TransactionAction.UPDATE);
        }
        // Override the price if simple pricing only
        if (transactionSimplePricePerkWh > 0) {
          consumption.amount = Utils.computeSimplePrice(transactionSimplePricePerkWh, consumption.consumptionWh);
          consumption.roundedAmount = Utils.computeSimpleRoundedPrice(transactionSimplePricePerkWh, consumption.consumptionWh);
          consumption.pricingSource = PricingSettingsType.SIMPLE;
        }
        // Cumulated props
        const currentDurationSecs = Math.trunc((new Date(consumption.endedAt).getTime() - new Date(consumption.startedAt).getTime()) / 1000);
        if (i === 0) {
          // Initial values
          consumption.cumulatedConsumptionWh = consumption.consumptionWh;
          consumption.cumulatedConsumptionAmps = Utils.convertWattToAmp(
            chargingStation, null, transaction.connectorId, consumption.cumulatedConsumptionWh);
          consumption.cumulatedAmount = consumption.amount;
          if (!consumption.consumptionWh) {
            consumption.totalInactivitySecs = currentDurationSecs;
          }
          consumption.totalDurationSecs = currentDurationSecs;
        } else {
          // Take total from previous consumption
          consumption.cumulatedConsumptionWh = consumptions[i - 1].cumulatedConsumptionWh + consumption.consumptionWh;
          consumption.cumulatedConsumptionAmps = Utils.convertWattToAmp(
            chargingStation, null, transaction.connectorId, consumption.cumulatedConsumptionWh);
          consumption.cumulatedAmount = consumptions[i - 1].cumulatedAmount + consumption.amount;
          if (!consumption.consumptionWh) {
            consumption.totalInactivitySecs = consumptions[i - 1].totalInactivitySecs + currentDurationSecs;
          }
          consumption.totalDurationSecs = consumptions[i - 1].totalDurationSecs + currentDurationSecs;
        }
        // Save all
        await ConsumptionStorage.saveConsumption(tenantID, consumption);
      }
    }
    // Build extra inactivity consumption
    const consumptionCreated = await OCPPUtils.buildExtraConsumptionInactivity(tenantID, transaction);
    if (consumptionCreated) {
      await TransactionStorage.saveTransaction(tenantID, transaction);
    }
    return consumptions.length + (consumptionCreated ? 1 : 0);
  }

  public static updateTransactionWithStopTransaction(transaction: Transaction, stopTransaction: OCPPStopTransactionRequestExtended,
    user: User, alternateUser: User, tagId: string): void {
    // Set final data
    transaction.stop = {
      meterStop: stopTransaction.meterStop,
      timestamp: Utils.convertToDate(stopTransaction.timestamp),
      userID: (alternateUser ? alternateUser.id : (user ? user.id : null)),
      tagID: tagId,
      stateOfCharge: transaction.currentStateOfCharge,
      signedData: transaction.currentSignedData ? transaction.currentSignedData : '',
      totalConsumptionWh: transaction.currentTotalConsumptionWh,
      totalInactivitySecs: transaction.currentTotalInactivitySecs,
      totalDurationSecs: transaction.currentTotalDurationSecs,
      inactivityStatus: Utils.getInactivityStatusLevel(transaction.chargeBox, transaction.connectorId, transaction.currentTotalInactivitySecs)
    };
  }

  public static createTransactionStopMeterValues(transaction: Transaction,
    stopTransaction: OCPPStopTransactionRequestExtended): OCPPNormalizedMeterValue[] {
    const stopMeterValues: OCPPNormalizedMeterValue[] = [];
    const meterValueBasedProps = {
      chargeBoxID: transaction.chargeBoxID,
      connectorId: transaction.connectorId,
      transactionId: transaction.id,
      timestamp: Utils.convertToDate(stopTransaction.timestamp),
    };
    let id = 696969;
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
        value: (transaction.currentInstantAmps ? transaction.currentInstantAmps : transaction.currentInstantAmpsDC),
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

  public static async createConsumptionsFromMeterValues(tenantID: string, chargingStation: ChargingStation,
    transaction: Transaction, meterValues: OCPPNormalizedMeterValue[]): Promise<Consumption[]> {
    // Build consumptions
    const consumptions: Consumption[] = [];
    for (const meterValue of meterValues) {
      // Meter Value Handling
      if (OCPPUtils.isValidMeterValue(meterValue)) {
        // Build Consumption and Update Transaction with Meter Values
        const consumption: Consumption = await this.createConsumptionFromMeterValue(
          tenantID, chargingStation, transaction, transaction.lastConsumption, meterValue);
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
    return consumptions;
  }

  public static async createConsumptionFromMeterValue(tenantID: string, chargingStation: ChargingStation, transaction: Transaction,
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
        const powerInMeterValueWatts = (meterValue.attribute && meterValue.attribute.unit === OCPPUnitOfMeasure.KILO_WATT ?
          powerInMeterValue * 1000 : powerInMeterValue);
        const currentType = Utils.getChargingStationCurrentType(chargingStation, null, transaction.connectorId);
        // AC Charging Station
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
        // AC Charging Station
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
        // AC Charging Station
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
                consumption.instantAmps = amperage;
                break;
            }
            break;
        }
      // Handle Consumption (Wh/kWh)
      } else if (OCPPUtils.isEnergyActiveImportMeterValue(meterValue)) {
        // Complete consumption
        consumption.startedAt = Utils.convertToDate(lastConsumption.timestamp);
        const diffSecs = moment(meterValue.timestamp).diff(lastConsumption.timestamp, 'milliseconds') / 1000;
        // Handle current Connector limitation
        await OCPPUtils.addConnectorLimitationToConsumption(tenantID, chargingStation, transaction.connectorId, consumption);
        // Handle current Site Area limitation
        await Utils.addSiteLimitationToConsumption(tenantID, chargingStation.siteArea, consumption);
        // Consumption
        if (Utils.convertToFloat(meterValue.value) > lastConsumption.value) {
          // Compute consumption
          const consumptionInMeterValue = Utils.convertToFloat(meterValue.value) - Utils.convertToFloat(lastConsumption.value);
          // Current consumption
          consumption.consumptionWh = (meterValue.attribute.unit === OCPPUnitOfMeasure.KILO_WATT_HOUR ?
            consumptionInMeterValue * 1000 : consumptionInMeterValue);
          consumption.consumptionAmps = Utils.convertWattToAmp(chargingStation, null, transaction.connectorId, consumption.consumptionWh);
          // Cumulated Consumption
          transaction.currentTotalConsumptionWh += consumption.consumptionWh;
          // No Consumption
        } else {
          consumption.consumptionWh = 0;
          consumption.consumptionAmps = 0;
          if (consumption.limitSource !== ConnectorCurrentLimitSource.CHARGING_PROFILE ||
            consumption.limitAmps >= StaticLimitAmps.MIN_LIMIT_PER_PHASE * Utils.getNumberOfConnectedPhases(chargingStation, null, transaction.connectorId)) {
            // Update inactivity
            transaction.currentTotalInactivitySecs += diffSecs;
            consumption.totalInactivitySecs = transaction.currentTotalInactivitySecs;
          }
        }
        consumption.cumulatedConsumptionWh = transaction.currentTotalConsumptionWh;
        consumption.cumulatedConsumptionAmps = Utils.convertWattToAmp(chargingStation, null, transaction.connectorId, transaction.currentTotalConsumptionWh);
        consumption.totalDurationSecs = !transaction.stop ?
          moment.duration(moment(meterValue.timestamp).diff(moment(transaction.timestamp))).asSeconds() :
          moment.duration(moment(transaction.stop.timestamp).diff(moment(transaction.timestamp))).asSeconds();
        consumption.toPrice = true;
        // Keep last one
        transaction.lastConsumption = {
          value: Utils.convertToFloat(meterValue.value),
          timestamp: Utils.convertToDate(meterValue.timestamp)
        };
      }
      // Return
      return consumption;
    }
  }

  public static async addConnectorLimitationToConsumption(tenantID: string, chargingStation: ChargingStation,
    connectorID: number, consumption: Consumption): Promise<void> {
    const chargingStationVendor = ChargingStationVendorFactory.getChargingStationVendorImpl(chargingStation);
    if (chargingStationVendor) {
      // Get current limitation
      const connector = Utils.getConnectorFromID(chargingStation, connectorID);
      const chargePoint = Utils.getChargePointFromID(chargingStation, connector?.chargePointID);
      const connectorLimit = await chargingStationVendor.getCurrentConnectorLimit(
        tenantID, chargingStation, chargePoint, connectorID);
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
    const chargingStationTemplates: ChargingStationTemplate[] =
      await ChargingStationStorage.getChargingStationTemplates(chargingStation.chargePointVendor);
    // Parse Them
    for (const chargingStationTemplate of chargingStationTemplates) {
      // Keep it
      foundTemplate = chargingStationTemplate;
      // Browse filter for extra matching
      for (const filter in chargingStationTemplate.extraFilters) {
        // Check
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

  public static async enrichChargingStationWithTemplate(tenantID: string, chargingStation: ChargingStation): Promise<TemplateUpdateResult> {
    const templateUpdateResult: TemplateUpdateResult = {
      technicalUpdated: false,
      capabilitiesUpdated: false,
      ocppUpdated: false,
    };
    const sectionsNotMatched: string[] = [];
    // Get Template
    const chargingStationTemplate = await OCPPUtils.getChargingStationTemplate(chargingStation);
    // Copy from template
    if (chargingStationTemplate) {
      // Already updated?
      if (chargingStation.templateHash !== chargingStationTemplate.hash) {
        chargingStation.templateHash = chargingStationTemplate.hash;
        // Check Technical Hash
        if (chargingStation.templateHashTechnical !== chargingStationTemplate.hashTechnical) {
          templateUpdateResult.technicalUpdated = true;
          // Set the hash
          chargingStation.templateHashTechnical = chargingStationTemplate.hashTechnical;
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
          if (chargingStation.connectors) {
            for (const connector of chargingStation.connectors) {
              await OCPPUtils.enrichChargingStationConnectorWithTemplate(
                tenantID, chargingStation, connector.connectorId, chargingStationTemplate);
            }
          }
        }
        // Already updated?
        if (chargingStation.templateHashCapabilities !== chargingStationTemplate.hashCapabilities) {
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
                chargingStation.templateHashCapabilities = chargingStationTemplate.hashCapabilities;
                templateUpdateResult.capabilitiesUpdated = true;
                if (Utils.objectHasProperty(capabilities.capabilities, 'supportChargingProfiles') &&
                  !capabilities.capabilities.supportChargingProfiles) {
                  chargingStation.excludeFromSmartCharging = !capabilities.capabilities.supportChargingProfiles;
                }
                chargingStation.capabilities = capabilities.capabilities;
                break;
              } else {
                delete chargingStation.templateHashCapabilities;
                sectionsNotMatched.push('Capabilities');
              }
            }
          }
        }
        // Already updated?
        if (chargingStation.templateHashOcppStandard !== chargingStationTemplate.hashOcppStandard) {
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
                chargingStation.templateHashOcppStandard = chargingStationTemplate.hashOcppStandard;
                templateUpdateResult.ocppUpdated = true;
                for (const parameter in ocppStandardParameters.parameters) {
                  if (OCPPUtils.isOcppParamForPowerLimitationKey(parameter, chargingStation)) {
                    Logging.logError({
                      tenantID: tenantID,
                      source: chargingStation.id,
                      action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
                      module: MODULE_NAME, method: 'enrichChargingStationWithTemplate',
                      message: `Template contains setting for power limitation OCPP Parameter key '${parameter}' in OCPP Standard parameters, skipping. Remove it from template!`,
                      detailedMessages: { chargingStationTemplate }
                    });
                    continue;
                  }
                  if (parameter === 'HeartBeatInterval' || parameter === 'HeartbeatInterval') {
                    Logging.logWarning({
                      tenantID: tenantID,
                      source: chargingStation.id,
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
                break;
              } else {
                delete chargingStation.templateHashOcppStandard;
                sectionsNotMatched.push('OCPPStandard');
              }
            }
          }
        }
        // Already updated?
        if (chargingStation.templateHashOcppVendor !== chargingStationTemplate.hashOcppVendor) {
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
                chargingStation.templateHashOcppVendor = chargingStationTemplate.hashOcppVendor;
                templateUpdateResult.ocppUpdated = true;
                for (const parameter in ocppVendorParameters.parameters) {
                  if (OCPPUtils.isOcppParamForPowerLimitationKey(parameter, chargingStation)) {
                    Logging.logError({
                      tenantID: tenantID,
                      source: chargingStation.id,
                      action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
                      module: MODULE_NAME, method: 'enrichChargingStationWithTemplate',
                      message: `Template contains setting for power limitation OCPP Parameter key '${parameter}' in OCPP Vendor parameters, skipping. Remove it from template!`,
                      detailedMessages: { chargingStationTemplate }
                    });
                    continue;
                  }
                  if (parameter === 'HeartBeatInterval' || parameter === 'HeartbeatInterval') {
                    Logging.logWarning({
                      tenantID: tenantID,
                      source: chargingStation.id,
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
                break;
              } else {
                delete chargingStation.templateHashOcppVendor;
                sectionsNotMatched.push('OCPPVendor');
              }
            }
          }
        }
        // Log
        const sectionsUpdated: string[] = [];
        if (templateUpdateResult.technicalUpdated) {
          sectionsUpdated.push('Technical');
        }
        if (templateUpdateResult.capabilitiesUpdated) {
          sectionsUpdated.push('Capabilities');
        }
        if (templateUpdateResult.ocppUpdated) {
          sectionsUpdated.push('OCPP');
        }
        Logging.logInfo({
          tenantID: tenantID,
          source: chargingStation.id,
          action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
          module: MODULE_NAME, method: 'enrichChargingStationWithTemplate',
          message: `Template applied and updated the following sections: ${sectionsUpdated.join(', ')}`,
          detailedMessages: { templateUpdateResult, chargingStationTemplate, chargingStation }
        });
        if (!Utils.isEmptyArray(sectionsNotMatched)) {
          Logging.logWarning({
            tenantID: tenantID,
            source: chargingStation.id,
            action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
            module: MODULE_NAME, method: 'enrichChargingStationWithTemplate',
            message: `Template applied and not matched the following sections: ${sectionsNotMatched.join(', ')}`,
            detailedMessages: { templateUpdateResult, chargingStationTemplate, chargingStation }
          });
        }
        return templateUpdateResult;
      }
      // Log
      Logging.logDebug({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
        module: MODULE_NAME, method: 'enrichChargingStationWithTemplate',
        message: 'Template has already been applied',
        detailedMessages: { chargingStationTemplate, chargingStation }
      });
      return templateUpdateResult;
    }
    let noMatchingTemplateLogMsg: string;
    if (chargingStation.templateHash) {
      noMatchingTemplateLogMsg = 'No template matching the charging station has been found but one matched previously. Keeping the previous template configuration';
    } else {
      noMatchingTemplateLogMsg = 'No template matching the charging station has been found';
    }
    // Log
    Logging.logWarning({
      tenantID: tenantID,
      source: chargingStation.id,
      action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
      module: MODULE_NAME, method: 'enrichChargingStationWithTemplate',
      message: noMatchingTemplateLogMsg,
      detailedMessages: { chargingStation }
    });
    return templateUpdateResult;
  }

  public static async enrichChargingStationConnectorWithTemplate(
    tenantID: string, chargingStation: ChargingStation, connectorID: number,
    chargingStationTemplate: ChargingStationTemplate): Promise<boolean> {
    // Copy from template
    if (chargingStationTemplate) {
      // Handle connector
      if (Utils.objectHasProperty(chargingStationTemplate.technical, 'connectors')) {
        // Find the connector in the template
        const templateConnector = chargingStationTemplate.technical.connectors.find(
          (connector) => connector.connectorId === connectorID);
        if (!templateConnector) {
          // Log
          Logging.logWarning({
            tenantID: tenantID,
            source: chargingStation.id,
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
            if (chargingStation.siteAreaID && !connector.phaseAssignmentToGrid) {
              const siteArea = await SiteAreaStorage.getSiteArea(tenantID, chargingStation.siteAreaID);
              if (siteArea.numberOfPhases === 3) {
                const numberOfPhases = Utils.getNumberOfConnectedPhases(chargingStation, null, connectorID);
                switch (numberOfPhases) {
                  case 3:
                    connector.phaseAssignmentToGrid = { csPhaseL1: OCPPPhase.L1, csPhaseL2: OCPPPhase.L2, csPhaseL3: OCPPPhase.L3 };
                    break;
                  case 1:
                    connector.phaseAssignmentToGrid = { csPhaseL1: OCPPPhase.L1, csPhaseL2: null, csPhaseL3: null };
                    break;
                }
              }
            }
            // Template on connector id = connectorID applied, break the loop to continue the static method execution. Never return here.
            break;
          }
        }
      }
      // Log
      Logging.logInfo({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
        module: MODULE_NAME, method: 'enrichChargingStationConnectorWithTemplate',
        message: `Template for Connector ID '${connectorID}' has been applied successfully on '${chargingStation.chargePointVendor}'`,
        detailedMessages: { chargingStationTemplate }
      });
      return true;
    }
    // Log
    Logging.logWarning({
      tenantID: tenantID,
      source: chargingStation.id,
      action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
      module: MODULE_NAME, method: 'enrichChargingStationConnectorWithTemplate',
      message: `No Template for Connector ID '${connectorID}' has been found for '${chargingStation.chargePointVendor}'`
    });
    return false;
  }

  public static async clearAndDeleteChargingProfilesForSiteArea(
    tenantID: string, siteArea: SiteArea,
    params?: { profilePurposeType?: ChargingProfilePurposeType; transactionId?: number }): Promise<ActionsResponse> {
    const actionsResponse: ActionsResponse = {
      inError: 0,
      inSuccess: 0
    };
    for (const chargingStation of siteArea.chargingStations) {
      const chargingProfiles = await ChargingStationStorage.getChargingProfiles(tenantID, {
        chargingStationIDs: [chargingStation.id],
        profilePurposeType: params.profilePurposeType,
        transactionId: params.transactionId
      }, Constants.DB_PARAMS_MAX_LIMIT);
      for (const chargingProfile of chargingProfiles.result) {
        try {
          await this.clearAndDeleteChargingProfile(tenantID, chargingProfile);
          actionsResponse.inSuccess++;
        } catch (error) {
          Logging.logError({
            tenantID: tenantID,
            source: chargingProfile.chargingStationID,
            action: ServerAction.CHARGING_PROFILE_DELETE,
            module: MODULE_NAME, method: 'clearAndDeleteChargingProfilesForSiteArea',
            message: `Error while clearing the charging profile for chargingStation ${chargingProfile.chargingStationID}`,
            detailedMessages: { error: error.message, stack: error.stack }
          });
          actionsResponse.inError++;
        }
      }
    }
    return actionsResponse;
  }

  public static async clearAndDeleteChargingProfile(tenantID: string, chargingProfile: ChargingProfile): Promise<void> {
    // Get charging station
    const chargingStation = await ChargingStationStorage.getChargingStation(tenantID, chargingProfile.chargingStationID);
    // Check if Charging Profile is supported
    if (!chargingStation.capabilities || !chargingStation.capabilities.supportChargingProfiles) {
      throw new BackendError({
        source: chargingProfile.chargingStationID,
        action: ServerAction.CHARGING_PROFILE_DELETE,
        module: MODULE_NAME, method: 'clearAndDeleteChargingProfile',
        message: `Charging Station '${chargingStation.id}' does not support the Charging Profiles`,
      });
    }
    // Get Vendor Instance
    const chargingStationVendor = ChargingStationVendorFactory.getChargingStationVendorImpl(chargingStation);
    if (!chargingStationVendor) {
      throw new BackendError({
        source: chargingProfile.chargingStationID,
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
      await chargingStationVendor.clearChargingProfile(tenantID, chargingStation, chargingProfile);
    } catch (error) {
      Logging.logError({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.CHARGING_PROFILE_DELETE,
        message: 'Error occurred while clearing the Charging Profile',
        module: MODULE_NAME, method: 'clearAndDeleteChargingProfile',
        detailedMessages: { error: error.message, stack: error.stack }
      });
      throw error;
    }
    // Delete from database
    await ChargingStationStorage.deleteChargingProfile(tenantID, chargingProfile.id);
    // Log
    Logging.logInfo({
      tenantID: tenantID,
      source: chargingStation.id,
      action: ServerAction.CHARGING_PROFILE_DELETE,
      module: MODULE_NAME, method: 'clearAndDeleteChargingProfile',
      message: 'Charging Profile has been deleted successfully',
      detailedMessages: { chargingProfile }
    });
  }

  public static async setAndSaveChargingProfile(tenantID: string, chargingProfile: ChargingProfile, user?: UserToken): Promise<string> {
    // Get charging station
    const chargingStation = await ChargingStationStorage.getChargingStation(tenantID, chargingProfile.chargingStationID);
    if (!chargingStation) {
      throw new BackendError({
        source: chargingProfile.chargingStationID,
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
        source: chargingStation.id,
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        module: MODULE_NAME, method: 'setAndSaveChargingProfile',
        message: `No vendor implementation is available (${chargingStation.chargePointVendor}) for setting a Charging Profile`,
      });
    }
    // Set Charging Profile
    const result = await chargingStationVendor.setChargingProfile(
      tenantID, chargingStation, chargePoint, chargingProfile);
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
        source: chargingStation.id,
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        module: MODULE_NAME, method: 'setAndSaveChargingProfile',
        message: 'Cannot set the Charging Profile!',
        detailedMessages: { result, chargingProfile },
      });
    }
    // Saves
    const chargingProfileID = await ChargingStationStorage.saveChargingProfile(tenantID, chargingProfile);
    Logging.logInfo({
      tenantID: tenantID,
      source: chargingStation.id,
      action: ServerAction.CHARGING_PROFILE_UPDATE,
      module: MODULE_NAME, method: 'setAndSaveChargingProfile',
      message: `Connector ID '${chargingProfile.connectorID}' > Charging Profile has been successfully pushed and saved`,
      detailedMessages: { chargingProfile }
    });
    return chargingProfileID;
  }

  static isValidMeterValue(meterValue: OCPPNormalizedMeterValue): boolean {
    return OCPPUtils.isSocMeterValue(meterValue) ||
      OCPPUtils.isEnergyActiveImportMeterValue(meterValue) ||
      OCPPUtils.isPowerActiveImportMeterValue(meterValue) ||
      OCPPUtils.isCurrentImportMeterValue(meterValue) ||
      OCPPUtils.isVoltageMeterValue(meterValue);
  }

  static isSocMeterValue(meterValue: OCPPNormalizedMeterValue): boolean {
    return !meterValue.attribute ||
      (meterValue.attribute.measurand === OCPPMeasurand.STATE_OF_CHARGE
        && meterValue.attribute.context === OCPPReadingContext.SAMPLE_PERIODIC);
  }

  static isEnergyActiveImportMeterValue(meterValue: OCPPNormalizedMeterValue): boolean {
    return !meterValue.attribute ||
      (meterValue.attribute.measurand === OCPPMeasurand.ENERGY_ACTIVE_IMPORT_REGISTER &&
        (meterValue.attribute.context === OCPPReadingContext.SAMPLE_PERIODIC ||
          meterValue.attribute.context === OCPPReadingContext.SAMPLE_CLOCK));
  }

  static isPowerActiveImportMeterValue(meterValue: OCPPNormalizedMeterValue): boolean {
    return !meterValue.attribute ||
      (meterValue.attribute.measurand === OCPPMeasurand.POWER_ACTIVE_IMPORT &&
        meterValue.attribute.context === OCPPReadingContext.SAMPLE_PERIODIC);
  }

  static isCurrentImportMeterValue(meterValue: OCPPNormalizedMeterValue): boolean {
    return !meterValue.attribute ||
      (meterValue.attribute.measurand === OCPPMeasurand.CURRENT_IMPORT &&
        meterValue.attribute.context === OCPPReadingContext.SAMPLE_PERIODIC);
  }

  static isVoltageMeterValue(meterValue: OCPPNormalizedMeterValue): boolean {
    return !meterValue.attribute ||
      (meterValue.attribute.measurand === OCPPMeasurand.VOLTAGE &&
        meterValue.attribute.context === OCPPReadingContext.SAMPLE_PERIODIC);
  }

  static async checkAndGetChargingStation(chargeBoxIdentity: string, tenantID: string): Promise<ChargingStation> {
    // Check
    if (!chargeBoxIdentity) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'checkAndGetChargingStation',
        message: 'Should have the required property \'chargeBoxIdentity\'!'
      });
    }
    // Get the charging station
    const chargingStation = await ChargingStationStorage.getChargingStation(tenantID, chargeBoxIdentity);
    // Found?
    if (!chargingStation) {
      throw new BackendError({
        source: chargeBoxIdentity,
        module: MODULE_NAME,
        method: 'checkAndGetChargingStation',
        message: 'Charging Station does not exist'
      });
    }
    // Deleted?
    if (chargingStation.deleted) {
      throw new BackendError({
        source: chargeBoxIdentity,
        module: MODULE_NAME,
        method: 'checkAndGetChargingStation',
        message: 'Charging Station is deleted'
      });
    }
    return chargingStation;
  }

  public static async requestAndSaveChargingStationOcppParameters(tenantID: string, chargingStation: ChargingStation,
    forceUpdateOcppParametersWithTemplate = false): Promise<OCPPChangeConfigurationCommandResult> {
    try {
      // Get the OCPP Configuration
      const ocppConfiguration = await OCPPUtils.requestChargingStationOcppParameters(tenantID, chargingStation, {});
      // Log
      Logging.logInfo({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
        module: MODULE_NAME, method: 'requestAndSaveChargingStationOcppParameters',
        message: 'Command sent with success',
        detailedMessages: { ocppConfiguration }
      });
      // Set Conf
      const chargingStationOcppParameters: ChargingStationOcppParameters = {
        id: chargingStation.id,
        configuration: ocppConfiguration.configurationKey,
        timestamp: new Date()
      };
      // No: Get it from DB
      const ocppParametersFromDB = await ChargingStationStorage.getOcppParameters(tenantID, chargingStation.id);
      // Configuration found in Charging Station
      if (!chargingStationOcppParameters.configuration) {
        if (ocppParametersFromDB.count === 0) {
          // No config at all: Set default OCPP configuration
          chargingStationOcppParameters.configuration = Constants.DEFAULT_OCPP_16_CONFIGURATION;
        } else {
          // Set from DB
          chargingStationOcppParameters.configuration = ocppParametersFromDB.result;
        }
      }
      // Add the existing custom params
      const customParams = ocppParametersFromDB.result.filter((customParam) => customParam.custom);
      if (!Utils.isEmptyArray(customParams)) {
        for (const customParam of customParams) {
          const foundCustomParam = chargingStationOcppParameters.configuration.find((configuration) => configuration.key === customParam.key);
          if (!foundCustomParam) {
            chargingStationOcppParameters.configuration.push(customParam);
          }
        }
      }
      // Save config
      await ChargingStationStorage.saveOcppParameters(tenantID, chargingStationOcppParameters);
      // Check OCPP Configuration
      if (forceUpdateOcppParametersWithTemplate) {
        await OCPPUtils.updateChargingStationTemplateOcppParameters(
          tenantID, chargingStation, chargingStationOcppParameters.configuration);
      }
      // Ok
      Logging.logInfo({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
        module: MODULE_NAME, method: 'requestAndSaveChargingStationOcppParameters',
        message: 'Configuration has been saved'
      });
      return { status: OCPPConfigurationStatus.ACCEPTED };
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION, error);
      return { status: OCPPConfigurationStatus.REJECTED };
    }
  }

  public static async updateChargingStationTemplateOcppParameters(tenantID: string, chargingStation: ChargingStation,
    currentOcppParameters?: OcppParameter[]): Promise<ActionsResponse> {
    const updatedOcppParams = {
      inError: 0,
      inSuccess: 0
    };
    let rebootRequired = false;
    // Not Provided: Get from DB
    if (!currentOcppParameters) {
      // Check if there is an already existing config in DB
      const ocppParametersFromDB = await ChargingStationStorage.getOcppParameters(tenantID, chargingStation.id);
      if (ocppParametersFromDB.count > 0) {
        currentOcppParameters = ocppParametersFromDB.result;
      }
    }
    // Check
    if (Utils.isEmptyArray(chargingStation.ocppStandardParameters) && Utils.isEmptyArray(chargingStation.ocppVendorParameters)) {
      Logging.logInfo({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
        module: MODULE_NAME, method: 'updateChargingStationTemplateOcppParameters',
        message: 'Charging Station has no OCPP Parameters'
      });
      return updatedOcppParams;
    }
    // Merge Standard and Vendor parameters
    const ocppParameters = chargingStation.ocppStandardParameters.concat(chargingStation.ocppVendorParameters);
    // Check Standard OCPP Params
    for (const ocppParameter of ocppParameters) {
      // Find OCPP Param
      const currentOcppParam: OcppParameter = currentOcppParameters.find(
        (ocppParam) => ocppParam.key === ocppParameter.key);
      try {
        if (!currentOcppParam) {
          // Not Found in Charging Station!
          Logging.logError({
            tenantID: tenantID,
            source: chargingStation.id,
            action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
            module: MODULE_NAME, method: 'updateChargingStationTemplateOcppParameters',
            message: `OCPP Parameter '${ocppParameter.key}' not found in Charging Station's configuration`
          });
          updatedOcppParams.inError++;
          continue;
        }
        // Check Value
        if (ocppParameter.value === currentOcppParam.value) {
          // Ok: Already the good value
          Logging.logInfo({
            tenantID: tenantID,
            source: chargingStation.id,
            action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
            module: MODULE_NAME, method: 'updateChargingStationTemplateOcppParameters',
            message: `OCPP Parameter '${ocppParameter.key}' has the correct value '${currentOcppParam.value}'`
          });
          continue;
        }
        // Execute update command
        const result = await OCPPUtils.requestChangeChargingStationOcppParameter(tenantID, chargingStation, {
          key: ocppParameter.key,
          value: ocppParameter.value
        }, false);
        if (result.status === OCPPConfigurationStatus.ACCEPTED) {
          // Ok
          updatedOcppParams.inSuccess++;
          Logging.logInfo({
            tenantID: tenantID,
            source: chargingStation.id,
            action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
            module: MODULE_NAME, method: 'updateChargingStationTemplateOcppParameters',
            message: `OCPP Parameter '${currentOcppParam.key}' has been successfully set from '${currentOcppParam.value}' to '${ocppParameter.value}'`
          });
        } else if (result.status === OCPPConfigurationStatus.REBOOT_REQUIRED) {
          // Ok
          updatedOcppParams.inSuccess++;
          rebootRequired = true;
          Logging.logInfo({
            tenantID: tenantID,
            source: chargingStation.id,
            action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
            module: MODULE_NAME, method: 'updateChargingStationTemplateOcppParameters',
            message: `OCPP Parameter '${currentOcppParam.key}' that requires reboot has been successfully set from '${currentOcppParam.value}' to '${ocppParameter.value}'`
          });
        } else {
          updatedOcppParams.inError++;
          Logging.logError({
            tenantID: tenantID,
            source: chargingStation.id,
            action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
            module: MODULE_NAME, method: 'updateChargingStationTemplateOcppParameters',
            message: `Error '${result.status}' in changing OCPP Parameter '${ocppParameter.key}' from '${currentOcppParam.value}' to '${ocppParameter.value}': `
          });
        }
      } catch (error) {
        updatedOcppParams.inError++;
        Logging.logError({
          tenantID: tenantID,
          source: chargingStation.id,
          action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
          module: MODULE_NAME, method: 'updateChargingStationTemplateOcppParameters',
          message: `Error in changing OCPP Parameter '${ocppParameter.key}' from '${currentOcppParam.value}' to '${ocppParameter.value}'`,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }
    // Parameter(s) updated?
    if (updatedOcppParams.inSuccess) {
      await OCPPUtils.requestAndSaveChargingStationOcppParameters(tenantID, chargingStation);
    }
    // Reboot required?
    if (rebootRequired) {
      await OCPPUtils.triggerChargingStationReset(tenantID, chargingStation, true);
    }
    return updatedOcppParams;
  }

  public static async requestChangeChargingStationOcppParameter(tenantID: string, chargingStation: ChargingStation, params: OCPPChangeConfigurationCommandParam,
    saveChange = true, triggerConditionalReset = false): Promise<OCPPChangeConfigurationCommandResult> {
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
    if (!chargingStationClient) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
        module: MODULE_NAME, method: 'requestChangeChargingStationOcppParameter',
        message: 'Charging Station is not connected to the backend',
      });
    }
    // Apply the configuration change
    const result = await chargingStationClient.changeConfiguration(params);
    const isValidResultStatus: boolean = result.status === OCPPConfigurationStatus.ACCEPTED || result.status === OCPPConfigurationStatus.REBOOT_REQUIRED;
    // Request the new Configuration?
    if (saveChange && isValidResultStatus) {
      // Retrieve and save it
      await OCPPUtils.requestAndSaveChargingStationOcppParameters(tenantID, chargingStation);
    }
    if (triggerConditionalReset && result.status === OCPPConfigurationStatus.REBOOT_REQUIRED) {
      Logging.logInfo({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
        module: MODULE_NAME, method: 'requestChangeChargingStationOcppParameter',
        message: `Reboot triggered due to change of OCPP Parameter '${params.key}' to '${params.value}'`,
        detailedMessages: { result }
      });
      await OCPPUtils.triggerChargingStationReset(tenantID, chargingStation, true);
    }
    // Return
    return result;
  }

  public static async requestChargingStationOcppParameters(
    tenantID: string, chargingStation: ChargingStation, params: OCPPGetConfigurationCommandParam): Promise<OCPPGetConfigurationCommandResult> {
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
    if (!chargingStationClient) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_REQUEST_OCPP_PARAMETERS,
        module: MODULE_NAME, method: 'requestChargingStationOcppParameters',
        message: 'Charging Station is not connected to the backend',
      });
    }
    // Get the configuration
    const result = await chargingStationClient.getConfiguration(params);
    // Return
    return result;
  }

  public static checkAndFreeChargingStationConnector(chargingStation: ChargingStation, connectorId: number): void {
    // Cleanup connector transaction data
    const foundConnector = Utils.getConnectorFromID(chargingStation, connectorId);
    if (foundConnector) {
      foundConnector.currentInstantWatts = 0;
      foundConnector.currentTotalConsumptionWh = 0;
      foundConnector.currentTotalInactivitySecs = 0;
      foundConnector.currentInactivityStatus = InactivityStatus.INFO;
      foundConnector.currentStateOfCharge = 0;
      foundConnector.currentTransactionID = 0;
      foundConnector.currentTransactionDate = null;
      foundConnector.currentTagID = null;
      foundConnector.userID = null;
    }
  }

  public static async triggerChargingStationReset(tenantID: string, chargingStation: ChargingStation,
    hardResetFallback = false, resetType: OCPPResetType = OCPPResetType.SOFT): Promise<OCPPResetCommandResult> {
    // Get the Charging Station client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
    if (!chargingStationClient) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_RESET,
        module: MODULE_NAME, method: 'triggerChargingStationReset',
        message: 'Charging Station is not connected to the backend',
      });
    }

    let resetResult = await chargingStationClient.reset({ type: resetType });
    if (resetResult.status === OCPPResetStatus.REJECTED) {
      Logging.logError({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_RESET,
        module: MODULE_NAME, method: 'triggerChargingStationReset',
        message: `Error at ${resetType} Rebooting charging station`,
      });
      if (hardResetFallback && resetType !== OCPPResetType.HARD) {
        Logging.logInfo({
          tenantID: tenantID,
          source: chargingStation.id,
          action: ServerAction.CHARGING_STATION_RESET,
          module: MODULE_NAME, method: 'triggerChargingStationReset',
          message: `Conditional ${OCPPResetType.HARD} Reboot requested`,
        });
        resetResult = await chargingStationClient.reset({ type: OCPPResetType.HARD });
        if (resetResult.status === OCPPResetStatus.REJECTED) {
          Logging.logError({
            tenantID: tenantID,
            source: chargingStation.id,
            action: ServerAction.CHARGING_STATION_RESET,
            module: MODULE_NAME, method: 'triggerChargingStationReset',
            message: `Error at ${OCPPResetType.HARD} Rebooting charging station`,
          });
        }
      }
    }
    return resetResult;
  }

  private static isOcppParamForPowerLimitationKey(ocppParameterKey: string, chargingStation: ChargingStation): boolean {
    for (const chargePoint of chargingStation.chargePoints) {
      if (chargePoint.ocppParamForPowerLimitation && ocppParameterKey.includes(chargePoint.ocppParamForPowerLimitation)) {
        return true;
      }
    }
    return false;
  }
}
