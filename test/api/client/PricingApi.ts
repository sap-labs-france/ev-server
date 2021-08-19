/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import AuthenticatedBaseApi from './utils/AuthenticatedBaseApi';
import CrudApi from './utils/CrudApi';
import PricingModel from '../../../src/types/Pricing';
import { ServerRoute } from '../../../src/types/Server';
import TestConstants from './utils/TestConstants';

export default class PricingApi extends CrudApi {
  public constructor(authenticatedApi: AuthenticatedBaseApi) {
    super(authenticatedApi);
  }

  public async readPricingModels(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, this.buildRestEndpointUrl(ServerRoute.REST_PRICING_MODELS));
  }

  public async readPricingModel(id: string) {
    return super.read({ ID: id }, this.buildRestEndpointUrl(ServerRoute.REST_PRICING_MODEL, { id }));
  }

  public async updatePricingModel(data: PricingModel) {
    return super.update(data, this.buildRestEndpointUrl(ServerRoute.REST_PRICING_MODEL, { id: data.id }));
  }

  public async createPricingModel(data: PricingModel) {
    return super.create(data, this.buildRestEndpointUrl(ServerRoute.REST_PRICING_MODELS));
  }

  public async deletePricingModel(id: string) {
    return super.delete(id, this.buildRestEndpointUrl(ServerRoute.REST_PRICING_MODEL, { id }));
  }

}
