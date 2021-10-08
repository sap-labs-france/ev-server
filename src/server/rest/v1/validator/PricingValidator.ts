import { HttpPricingDefinitionsRequest } from '../../../../types/requests/HttpPricingRequest';
import PricingDefinition from '../../../../types/Pricing';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from './SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class PricingValidator extends SchemaValidator {
  private static instance: PricingValidator|null = null;
  private pricingGet: Schema;
  private pricingsGet: Schema;
  private princingCreate: Schema;
  private princingUpdate: Schema;

  private constructor() {
    super('PricingValidator');
    this.pricingGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/pricing/pricing-get.json`, 'utf8'));
    this.pricingsGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/pricing/pricings-get.json`, 'utf8'));
    this.princingCreate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/pricing/pricing-create.json`, 'utf8'));
    this.princingUpdate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/pricing/pricing-update.json`, 'utf8'));
  }

  public static getInstance(): PricingValidator {
    if (!PricingValidator.instance) {
      PricingValidator.instance = new PricingValidator();
    }
    return PricingValidator.instance;
  }

  public validatePricingGet(data: any): Partial<HttpPricingDefinitionsRequest> {
    // Validate schema
    this.validate(this.pricingGet, data);
    return data;
  }

  public validatePricingsGet(data: any): Partial<HttpPricingDefinitionsRequest> {
    // Validate schema
    this.validate(this.pricingsGet, data);
    return data;
  }

  public validatePricingCreate(data: any): Partial<PricingDefinition> {
    this.validate(this.princingCreate, data);
    return data;
  }

  public validatePricingUpdate(data: any): Partial<PricingDefinition> {
    this.validate(this.princingUpdate, data);
    return data;
  }
}
