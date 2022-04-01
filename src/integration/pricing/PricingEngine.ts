/* eslint-disable max-len */
import PricingDefinition, { PricedConsumptionData, PricingContext, PricingEntity, PricingStaticRestriction, ResolvedPricingDefinition, ResolvedPricingModel } from '../../types/Pricing';

import Constants from '../../utils/Constants';
import Consumption from '../../types/Consumption';
import ConsumptionPricer from './ConsumptionPricer';
import Logging from '../../utils/Logging';
import LoggingHelper from '../../utils/LoggingHelper';
import PricingStorage from '../../storage/mongodb/PricingStorage';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'PricingEngine';

export default class PricingEngine {

  public static async resolvePricingContext(tenant: Tenant, pricingContext: PricingContext): Promise<ResolvedPricingModel> {
    // Merge the pricing definitions from the different contexts
    const pricingDefinitions: ResolvedPricingDefinition[] = [];
    pricingDefinitions.push(...await PricingEngine.getPricingDefinitions4Entity(tenant, pricingContext, PricingEntity.CHARGING_STATION, pricingContext.chargingStationID));
    // pricingDefinitions.push(...await PricingEngine.getPricingDefinitions4Entity(tenant, pricingContext, PricingEntity.SITE_AREA, transaction.siteAreaID));
    pricingDefinitions.push(...await PricingEngine.getPricingDefinitions4Entity(tenant, pricingContext, PricingEntity.SITE, pricingContext.siteID));
    // pricingDefinitions.push(...await PricingEngine.getPricingDefinitions4Entity(tenant, pricingContext, PricingEntity.COMPANY, transaction.companyID));
    pricingDefinitions.push(...await PricingEngine.getPricingDefinitions4Entity(tenant, pricingContext, PricingEntity.TENANT, tenant.id));
    if (!pricingContext.timezone) {
      await Logging.logWarning({
        ...LoggingHelper.getPricingContextProperties(pricingContext),
        tenantID: tenant.id,
        module: MODULE_NAME,
        action: ServerAction.PRICING,
        method: 'resolvePricingContext',
        message: 'Unexpected situation: The timezone of the transaction is unknown. Make sure the location of the charging station is properly set!',
      });
    }
    // Return the resolution result as a resolved pricing model
    const resolvedPricingModel: ResolvedPricingModel = {
      pricerContext: {
        flatFeeAlreadyPriced: false,
        sessionStartDate: pricingContext.timestamp,
        timezone: pricingContext.timezone
      },
      pricingDefinitions
    };
    await Logging.logInfo({
      ...LoggingHelper.getPricingContextProperties(pricingContext),
      tenantID: tenant.id,
      module: MODULE_NAME,
      action: ServerAction.PRICING,
      method: 'resolvePricingContext',
      message: `Pricing context has been resolved - ${pricingDefinitions.length} pricing definitions have been found`,
      detailedMessages: { resolvedPricingModel },
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

  private static async getPricingDefinitions4Entity(tenant: Tenant, pricingContext: PricingContext, entityType: PricingEntity, entityID: string): Promise<ResolvedPricingDefinition[]> {
    if (!entityID) {
      await Logging.logWarning({
        ...LoggingHelper.getPricingContextProperties(pricingContext),
        tenantID: tenant.id,
        module: MODULE_NAME,
        action: ServerAction.PRICING,
        method: 'getPricingDefinitions4Entity',
        message: `Pricing context resolution - unexpected situation - entity ID is null for type ${entityType}`,
      });
      return [];
    }
    let pricingDefinitions = await PricingEngine.fetchPricingDefinitions4Entity(tenant, entityType, entityID);
    pricingDefinitions = pricingDefinitions || [];
    const actualPricingDefinitions = pricingDefinitions.filter((pricingDefinition) =>
      PricingEngine.checkEntityType(pricingDefinition, entityType)
    ).filter((pricingDefinition) =>
      PricingEngine.checkStaticRestrictions(pricingDefinition, pricingContext)
    ).map((pricingDefinition) =>
      PricingEngine.shrinkPricingDefinition(pricingDefinition)
    );
    await Logging.logDebug({
      ...LoggingHelper.getPricingContextProperties(pricingContext),
      tenantID: tenant.id,
      module: MODULE_NAME,
      action: ServerAction.PRICING,
      method: 'getPricingDefinitions4Entity',
      message: `Pricing context resolution - ${actualPricingDefinitions.length || 0} pricing definitions found for ${entityType}: '${entityID}'`,
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

  private static checkStaticRestrictions(pricingDefinition: PricingDefinition, pricingContext: PricingContext) : PricingDefinition {
    if (pricingDefinition.staticRestrictions) {
      if (
        !PricingEngine.checkDateValidity(pricingDefinition.staticRestrictions, pricingContext)
      || !PricingEngine.checkConnectorType(pricingDefinition.staticRestrictions, pricingContext)
      || !PricingEngine.checkConnectorPower(pricingDefinition.staticRestrictions, pricingContext)
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
      description: pricingDefinition.description,
      staticRestrictions: pricingDefinition.staticRestrictions,
      restrictions: pricingDefinition.restrictions,
      dimensions: pricingDefinition.dimensions,
    };
    return resolvedPricingDefinition;
  }

  private static checkDateValidity(staticRestrictions: PricingStaticRestriction, pricingContext: PricingContext): boolean {
    if (!Utils.isNullOrUndefined(staticRestrictions.validFrom)) {
      if (moment(pricingContext.timestamp).isBefore(staticRestrictions.validFrom)) {
        return false;
      }
    }
    if (!Utils.isNullOrUndefined(staticRestrictions.validTo)) {
      if (moment(pricingContext.timestamp).isSameOrAfter(staticRestrictions.validTo)) {
        return false;
      }
    }
    return true;
  }

  private static checkConnectorType(staticRestrictions: PricingStaticRestriction, pricingContext: PricingContext): boolean {
    if (!Utils.isNullOrUndefined(staticRestrictions.connectorType)) {
      if (staticRestrictions.connectorType !== pricingContext.connectorType) {
        return false;
      }
    }
    return true;
  }

  private static checkConnectorPower(staticRestrictions: PricingStaticRestriction, pricingContext: PricingContext): boolean {
    if (!Utils.isNullOrUndefined(staticRestrictions.connectorPowerkW)) {
      if (!Utils.createDecimal(pricingContext.connectorPower).div(1000).equals(staticRestrictions.connectorPowerkW)) {
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
