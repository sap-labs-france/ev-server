import { HttpCompaniesRequest, HttpCompanyLogoRequest, HttpCompanyRequest } from '../../../../types/requests/HttpCompanyRequest';

import Company from '../../../../types/Company';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from './SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class CompanyValidator extends SchemaValidator {
  private static instance: CompanyValidator|null = null;
  private companiesGet: Schema;
  private companyGet: Schema;
  private companyCreate: Schema;
  private companyUpdate: Schema;
  private companyGetLogo: Schema;

  private constructor() {
    super('CompanyValidator');
    this.companiesGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/company/companies-get.json`, 'utf8'));
    this.companyGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/company/company-get.json`, 'utf8'));
    this.companyCreate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/company/company-create.json`, 'utf8'));
    this.companyUpdate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/company/company-update.json`, 'utf8'));
    this.companyGetLogo = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/company/company-get-logo.json`, 'utf8'));
  }

  public static getInstance(): CompanyValidator {
    if (!CompanyValidator.instance) {
      CompanyValidator.instance = new CompanyValidator();
    }
    return CompanyValidator.instance;
  }

  public validateCompaniesGet(data: any): HttpCompaniesRequest {
    // Validate schema
    this.validate(this.companiesGet, data);
    return data;
  }

  public validateCompanyGet(data: any): HttpCompanyRequest {
    // Validate schema
    this.validate(this.companyGet, data);
    return data;
  }

  public validateCompanyCreate(data: any): Company {
    // Validate schema
    this.validate(this.companyCreate, data);
    return data;
  }

  public validateCompanyUpdate(data: any): Company {
    // Validate schema
    this.validate(this.companyUpdate, data);
    return data;
  }

  public validateCompanyGetLogo(data: any): HttpCompanyLogoRequest {
    // Validate schema
    this.validate(this.companyGetLogo, data);
    return data;
  }
}
