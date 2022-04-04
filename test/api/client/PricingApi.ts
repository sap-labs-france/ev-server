/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import AuthenticatedBaseApi from './utils/AuthenticatedBaseApi';
import CrudApi from './utils/CrudApi';
import PricingDefinition from '../../../src/types/Pricing';
import { RESTServerRoute } from '../../../src/types/Server';
import TestConstants from './utils/TestConstants';

export default class PricingApi extends CrudApi {
  public constructor(authenticatedApi: AuthenticatedBaseApi) {
    super(authenticatedApi);
  }

  public async readPricingDefinitions(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, this.buildRestEndpointUrl(RESTServerRoute.REST_PRICING_DEFINITIONS) + '?WithEntityInformation=true');
  }

  public async readPricingDefinition(id: string) {
    return super.readById(id, this.buildRestEndpointUrl(RESTServerRoute.REST_PRICING_DEFINITION, { id }) + '?WithEntityInformation=true');
  }

  public async updatePricingDefinition(data: PricingDefinition) {
    return super.update(data, this.buildRestEndpointUrl(RESTServerRoute.REST_PRICING_DEFINITION, { id: data.id }));
  }

  public async createPricingDefinition(data: Partial<PricingDefinition>) {
    return super.create(data, this.buildRestEndpointUrl(RESTServerRoute.REST_PRICING_DEFINITIONS));
  }

  public async deletePricingDefinition(id: string) {
    return super.delete(id, this.buildRestEndpointUrl(RESTServerRoute.REST_PRICING_DEFINITION, { id }));
  }

}
