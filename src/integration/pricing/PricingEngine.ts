/* eslint-disable max-len */
import PricingDefinition, { PricedConsumptionData, PricingEntity, PricingStaticRestriction, ResolvedPricingDefinition, ResolvedPricingModel } from '../../types/Pricing';

import ChargingStation from '../../types/ChargingStation';
import Constants from '../../utils/Constants';
import Consumption from '../../types/Consumption';
import ConsumptionPricer from './ConsumptionPricer';
import Logging from '../../utils/Logging';
import LoggingHelper from '../../utils/LoggingHelper';
import PricingStorage from '../../storage/mongodb/PricingStorage';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import Transaction from '../../types/Transaction';
import Utils from '../../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'PricingEngine';

export default class PricingEngine {

  public static async resolvePricingContext(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation): Promise<ResolvedPricingModel> {
    // Merge the pricing definitions from the different contexts
    const pricingDefinitions: ResolvedPricingDefinition[] = [];
    // pricingDefinitions.push(...await PricingEngine.getPricingDefinitions4Entity(tenant, transaction.userID));
    pricingDefinitions.push(...await PricingEngine.getPricingDefinitions4Entity(tenant, transaction, chargingStation, PricingEntity.CHARGING_STATION, transaction.chargeBoxID?.toString()));
    // pricingDefinitions.push(...await PricingEngine.getPricingDefinitions4Entity(tenant, transaction, chargingStation, PricingEntity.SITE_AREA, transaction.siteAreaID?.toString()));
    pricingDefinitions.push(...await PricingEngine.getPricingDefinitions4Entity(tenant, transaction, chargingStation, PricingEntity.SITE, transaction.siteID?.toString()));
    // pricingDefinitions.push(...await PricingEngine.getPricingDefinitions4Entity(tenant, transaction, chargingStation, PricingEntity.COMPANY, transaction.companyID?.toString()));
    pricingDefinitions.push(...await PricingEngine.getPricingDefinitions4Entity(tenant, transaction, chargingStation, PricingEntity.TENANT, tenant.id));
    if (!transaction.timezone) {
      await Logging.logWarning({
        tenantID: tenant.id,
        module: MODULE_NAME,
        action: ServerAction.PRICING,
        method: 'resolvePricingContext',
        message: 'Unexpected situation: The timezone of the transaction is unknown. Make sure the location of the charging station is properly set!',
        ...LoggingHelper.getTransactionProperties(transaction)
      });
    }
    // Return the resolution result as a resolved pricing model
    const resolvedPricingModel: ResolvedPricingModel = {
      pricerContext: {
        flatFeeAlreadyPriced: false,
        sessionStartDate: transaction.timestamp,
        timezone: transaction.timezone
      },
      pricingDefinitions
    };
    await Logging.logInfo({
      tenantID: tenant.id,
      module: MODULE_NAME,
      action: ServerAction.PRICING,
      method: 'resolvePricingContext',
      message: `Pricing context has been resolved - ${pricingDefinitions.length} pricing definitions have been found`,
      detailedMessages: { resolvedPricingModel },
      ...LoggingHelper.getTransactionProperties(transaction)
    });
    return Promise.resolve(resolvedPricingModel);
  }

  public static priceConsumption(tenant: Tenant, pricingModel: ResolvedPricingModel, consumptionData: Consumption): PricedConsumptionData {
    const consumptionPricer = new ConsumptionPricer(tenant, pricingModel, consumptionData);
    return consumptionPricer.priceConsumption();
  }

  public static extractFinalPricingData(pricingModel: ResolvedPricingModel): PricedConsumptionData[] {
    if (!pricingModel) {
      // Happens only when billing "ghost" sessions that were created with the former "Simple Pricing" module
      return [];
    }
    // Iterate throw the list of pricing definitions
    const pricedData: PricedConsumptionData[] = pricingModel.pricingDefinitions.map((pricingDefinition) =>
      PricingEngine.extractFinalPricedConsumptionData(pricingDefinition)
    );
    // Remove null/undefined entries (if any)
    return pricedData.filter((pricingConsumptionData) => !!pricingConsumptionData);
  }

  private static async getPricingDefinitions4Entity(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation, entityType: PricingEntity, entityID: string): Promise<ResolvedPricingDefinition[]> {
    if (!entityID) {
      await Logging.logWarning({
        tenantID: tenant.id,
        module: MODULE_NAME,
        action: ServerAction.PRICING,
        method: 'getPricingDefinitions4Entity',
        message: `Pricing context resolution - unexpected situation - entity ID is null for type ${entityType}`,
        ...LoggingHelper.getTransactionProperties(transaction)
      });
      return [];
    }
    let pricingDefinitions = await PricingEngine.fetchPricingDefinitions4Entity(tenant, entityType, entityID);
    pricingDefinitions = pricingDefinitions || [];
    const actualPricingDefinitions = pricingDefinitions.filter((pricingDefinition) =>
      PricingEngine.checkEntityType(pricingDefinition, entityType)
    ).filter((pricingDefinition) =>
      PricingEngine.checkStaticRestrictions(pricingDefinition, transaction, chargingStation)
    ).map((pricingDefinition) =>
      PricingEngine.shrinkPricingDefinition(pricingDefinition)
    );
    await Logging.logDebug({
      tenantID: tenant.id,
      module: MODULE_NAME,
      action: ServerAction.PRICING,
      method: 'getPricingDefinitions4Entity',
      message: `Pricing context resolution - ${actualPricingDefinitions.length || 0} pricing definitions found for ${entityType}: '${entityID}'`,
      ...LoggingHelper.getTransactionProperties(transaction)
    });
    return actualPricingDefinitions || [];
  }

  private static async fetchPricingDefinitions4Entity(tenant: Tenant, entityType: PricingEntity, entityID: string): Promise<PricingDefinition[]> {
    if (entityID) {
      const pricingModelResults = await PricingStorage.getPricingDefinitions(tenant, { entityType, entityID }, {
        limit: Constants.DB_RECORD_COUNT_NO_LIMIT, skip: 0, sort: { createdOn: -1 }
      });
      if (pricingModelResults.count > 0) {
        return pricingModelResults.result;
      }
    }
    return null;
  }

  private static checkEntityType(pricingDefinition: PricingDefinition, entityType: PricingEntity) : PricingDefinition {
    return (pricingDefinition.entityType === entityType) ? pricingDefinition : null;
  }

  private static checkStaticRestrictions(pricingDefinition: PricingDefinition, transaction: Transaction, chargingStation: ChargingStation) : PricingDefinition {
    if (pricingDefinition.staticRestrictions) {
      if (
        !PricingEngine.checkDateValidity(pricingDefinition.staticRestrictions, transaction)
      || !PricingEngine.checkConnectorType(pricingDefinition.staticRestrictions, transaction, chargingStation)
      || !PricingEngine.checkConnectorPower(pricingDefinition.staticRestrictions, transaction, chargingStation)
      ) {
        return null;
      }
    }
    // a definition matching the restrictions has been found
    return pricingDefinition;
  }

  private static shrinkPricingDefinition(pricingDefinition: PricingDefinition): ResolvedPricingDefinition {
    const resolvedPricingDefinition: ResolvedPricingDefinition = {
      id: pricingDefinition.id,
      entityID: pricingDefinition.entityID,
      entityType: pricingDefinition.entityType,
      name: pricingDefinition.name,
      description: pricingDefinition.name,
      staticRestrictions: pricingDefinition.staticRestrictions,
      restrictions: pricingDefinition.restrictions,
      dimensions: pricingDefinition.dimensions,
    };
    return resolvedPricingDefinition;
  }

  private static checkDateValidity(staticRestrictions: PricingStaticRestriction, transaction: Transaction): boolean {
    if (!Utils.isNullOrUndefined(staticRestrictions.validFrom)) {
      if (moment(transaction.timestamp).isBefore(staticRestrictions.validFrom)) {
        return false;
      }
    }
    if (!Utils.isNullOrUndefined(staticRestrictions.validTo)) {
      if (moment(transaction.timestamp).isSameOrAfter(staticRestrictions.validTo)) {
        return false;
      }
    }
    return true;
  }

  private static checkConnectorType(staticRestrictions: PricingStaticRestriction, transaction: Transaction, chargingStation: ChargingStation): boolean {
    if (!Utils.isNullOrUndefined(staticRestrictions.connectorType)) {
      const connectorType = Utils.getConnectorFromID(chargingStation, transaction.connectorId)?.type;
      if (staticRestrictions.connectorType !== connectorType) {
        return false;
      }
    }
    return true;
  }

  private static checkConnectorPower(staticRestrictions: PricingStaticRestriction, transaction: Transaction, chargingStation: ChargingStation): boolean {
    if (!Utils.isNullOrUndefined(staticRestrictions.connectorPowerkW)) {
      const connectorPowerWatts = Utils.getConnectorFromID(chargingStation, transaction.connectorId)?.power;
      if (!Utils.createDecimal(connectorPowerWatts).div(1000).equals(staticRestrictions.connectorPowerkW)) {
        return false;
      }
    }
    return true;
  }

  private static extractFinalPricedConsumptionData(pricingDefinition: ResolvedPricingDefinition): PricedConsumptionData {
    const flatFee = pricingDefinition.dimensions.flatFee?.pricedData;
    const energy = pricingDefinition.dimensions.energy?.pricedData;
    const chargingTime = pricingDefinition.dimensions.chargingTime?.pricedData;
    const parkingTime = pricingDefinition.dimensions.parkingTime?.pricedData;
    if (flatFee || energy || chargingTime || parkingTime) {
      return {
        flatFee,
        energy,
        chargingTime,
        parkingTime
      };
    }
    // Nothing to bill for the current pricing definition
    return null;
  }
}
