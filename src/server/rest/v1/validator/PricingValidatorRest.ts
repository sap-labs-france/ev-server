import { HttpPricingDefinitionCreateRequest, HttpPricingDefinitionUpdateRequest, HttpPricingDefinitionsDeleteRequest, HttpPricingDefinitionsGetRequest, HttpPricingModelResolutionGetRequest } from '../../../../types/requests/HttpPricingRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class PricingValidatorRest extends SchemaValidator {
  private static instance: PricingValidatorRest|null = null;
  private pricingDefinitionGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/pricing/pricing-definition-get.json`, 'utf8'));
  private pricingDefinitionDelete: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/pricing/pricing-definition-delete.json`, 'utf8'));
  private pricingDefinitionsGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/pricing/pricing-definitions-get.json`, 'utf8'));
  private pricingDefinitionCreate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/pricing/pricing-definition-create.json`, 'utf8'));
  private pricingDefinitionUpdate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/pricing/pricing-definition-update.json`, 'utf8'));
  private pricingModelResolve: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/pricing/pricing-model-resolve.json`, 'utf8'));

  private constructor() {
    super('PricingValidatorRest');
  }

  public static getInstance(): PricingValidatorRest {
    if (!PricingValidatorRest.instance) {
      PricingValidatorRest.instance = new PricingValidatorRest();
    }
    return PricingValidatorRest.instance;
  }

  public validatePricingDefinitionGet(data: Record<string, unknown>): HttpPricingDefinitionsGetRequest {
    return this.validate(this.pricingDefinitionGet, data);
  }

  public validatePricingDefinitionDelete(data: Record<string, unknown>): HttpPricingDefinitionsDeleteRequest {
    return this.validate(this.pricingDefinitionDelete, data);
  }

  public validatePricingDefinitionsGet(data: Record<string, unknown>): HttpPricingDefinitionsGetRequest {
    return this.validate(this.pricingDefinitionsGet, data);
  }

  public validatePricingDefinitionCreate(data: Record<string, unknown>): HttpPricingDefinitionCreateRequest {
    return this.validate(this.pricingDefinitionCreate, data);
  }

  public validatePricingDefinitionUpdate(data: Record<string, unknown>): HttpPricingDefinitionUpdateRequest {
    return this.validate(this.pricingDefinitionUpdate, data);
  }

  public validatePricingModelResolve(data: Record<string, unknown>): HttpPricingModelResolutionGetRequest {
    return this.validate(this.pricingModelResolve, data);
  }
}
