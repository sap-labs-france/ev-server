import { PricedConsumptionData, ResolvedPricingModel } from '../../types/Pricing';

import Consumption from '../../types/Consumption';
import ConsumptionChunkPricer from './ConsumptionChunkPricer';
import PricingHelper from './PricingHelper';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';
import moment from 'moment';

export interface ConsumptionChunk{
  startedAt: Date;
  endedAt: Date;
  consumptionWh: number;
  cumulatedConsumptionWh: number;
  totalDurationSecs: number;
  totalInactivitySecs: number;
}

export default class ConsumptionPricer {
  private tenant: Tenant;
  private pricingModel: ResolvedPricingModel;
  private consumptionData: Consumption;

  public constructor(tenant: Tenant, pricingModel: ResolvedPricingModel, consumptionData: Consumption) {
    this.tenant = tenant;
    this.pricingModel = pricingModel;
    this.consumptionData = consumptionData;
  }

  public getPricingModel(): ResolvedPricingModel {
    return this.pricingModel;
  }

  public priceConsumption(): PricedConsumptionData {
    let accumulatedConsumptionData: PricedConsumptionData = {};
    for (const consumptionChunk of this.generateChunk()) {
      const pricedData = this.priceConsumptionChunk(consumptionChunk);
      accumulatedConsumptionData = PricingHelper.accumulatePricedConsumption([ accumulatedConsumptionData, pricedData ]);
    }
    return accumulatedConsumptionData;
  }

  private priceConsumptionChunk(consumptionChunk: ConsumptionChunk): PricedConsumptionData {
    const consumptionChunkPricer = new ConsumptionChunkPricer(this, consumptionChunk);
    return consumptionChunkPricer.priceConsumptionChunk();
  }

  private * generateChunk(): IterableIterator<ConsumptionChunk> {
    const consumptionData = this.consumptionData;
    const startedAt = moment(consumptionData.startedAt);
    const endedAt = moment(consumptionData.endedAt);
    const durationSecs = endedAt.diff(startedAt, 'seconds');
    const inactivitySecs = consumptionData.inactivitySecs || 0;
    if (durationSecs <= 60) {
      yield {
        startedAt: consumptionData.startedAt,
        endedAt: consumptionData.endedAt,
        consumptionWh: consumptionData.consumptionWh,
        cumulatedConsumptionWh: consumptionData.cumulatedConsumptionWh,
        totalDurationSecs: consumptionData.totalDurationSecs,
        totalInactivitySecs: consumptionData.totalInactivitySecs
      };
    } else {
      // Well - we got data for more than 1 minute! - we need to handle chunks!
      const nbSeconds = endedAt.diff(startedAt, 'seconds');
      let secondsAlreadyPriced = 0;
      let inactivityToPrice: number;
      let chunkCumulatedConsumptionWh = Utils.createDecimal(consumptionData.cumulatedConsumptionWh).minus(consumptionData.consumptionWh);
      let chunkTotalDurationSecs = Utils.createDecimal(consumptionData.totalDurationSecs).minus(durationSecs);
      let chunkTotalInactivitySecs = Utils.createDecimal(consumptionData.totalInactivitySecs).minus(inactivitySecs);
      while (secondsAlreadyPriced < nbSeconds) {
        // Number of seconds for the current chunk
        const secondsToPrice = Utils.minValue(nbSeconds - secondsAlreadyPriced, 60);
        if (consumptionData.consumptionWh === 0 && inactivitySecs === nbSeconds) {
          // Specific-situation for the extraInactivity
          inactivityToPrice = secondsToPrice;
        } else {
          inactivityToPrice = 0;
        }
        // Chunk dates
        const chunkStartedAt = moment(startedAt).add(secondsAlreadyPriced, 'seconds');
        const chunkEndedAt = moment(startedAt).add(secondsAlreadyPriced + secondsToPrice, 'seconds');
        // Chunk consumption
        // const chunkConsumptionWh = Utils.createDecimal(consumptionData.consumptionWh).mul(secondsToPrice).divToInt(nbSeconds);
        const chunkConsumptionWh = Utils.createDecimal(consumptionData.consumptionWh).mul(secondsToPrice).div(nbSeconds); // Keep the precision here!
        // Chunk accumulated data
        chunkCumulatedConsumptionWh = chunkCumulatedConsumptionWh.add(chunkConsumptionWh);
        chunkTotalDurationSecs = chunkTotalDurationSecs.plus(secondsToPrice);
        chunkTotalInactivitySecs = chunkTotalInactivitySecs.plus(inactivityToPrice);
        // Create the consumption chunk
        const consumptionChunk = {
          startedAt: chunkStartedAt.toDate(),
          endedAt: chunkEndedAt.toDate(),
          consumptionWh: chunkConsumptionWh.toNumber(),
          cumulatedConsumptionWh: chunkCumulatedConsumptionWh.toNumber(),
          totalDurationSecs: chunkTotalDurationSecs.toNumber(),
          totalInactivitySecs: chunkTotalInactivitySecs.toNumber()
        };
        // Number of seconds already priced
        secondsAlreadyPriced += secondsToPrice;
        // Production of the chunk
        yield consumptionChunk;
      }
    }
  }
}

