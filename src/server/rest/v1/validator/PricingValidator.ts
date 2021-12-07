import { HttpPricingDefinitionsRequest } from '../../../../types/requests/HttpPricingRequest';
import PricingDefinition from '../../../../types/Pricing';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class PricingValidator extends SchemaValidator {
  private static instance: PricingValidator|null = null;
  private pricingDefinitionGet: Schema;
  private pricingDefinitionsGet: Schema;
  private pricingDefinitionCreate: Schema;
  private pricingDefinitionUpdate: Schema;

  private constructor() {
    super('PricingValidator');
    this.pricingDefinitionGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/pricing/pricing-definition-get.json`, 'utf8'));
    this.pricingDefinitionsGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/pricing/pricing-definitions-get.json`, 'utf8'));
    this.pricingDefinitionCreate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/pricing/pricing-definition-create.json`, 'utf8'));
    this.pricingDefinitionUpdate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/pricing/pricing-definition-update.json`, 'utf8'));
  }

  public static getInstance(): PricingValidator {
    if (!PricingValidator.instance) {
      PricingValidator.instance = new PricingValidator();
    }
    return PricingValidator.instance;
  }

  public validatePricingDefinitionGet(data: Record<string, unknown>): HttpPricingDefinitionsRequest {
    return this.validate(this.pricingDefinitionGet, data);
  }

  public validatePricingDefinitionsGet(data: Record<string, unknown>): HttpPricingDefinitionsRequest {
    return this.validate(this.pricingDefinitionsGet, data);
  }

  public validatePricingDefinitionCreate(data: Record<string, unknown>): PricingDefinition {
    return this.validate(this.pricingDefinitionCreate, data);
  }

  public validatePricingDefinitionUpdate(data: Record<string, unknown>): PricingDefinition {
    return this.validate(this.pricingDefinitionUpdate, data);
  }
}
