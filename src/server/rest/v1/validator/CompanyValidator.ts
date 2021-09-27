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
  private companyLogoGet: Schema;

  private constructor() {
    super('CompanyValidator');
    this.companiesGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/company/companies-get.json`, 'utf8'));
    this.companyGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/company/company-get.json`, 'utf8'));
    this.companyCreate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/company/company-create.json`, 'utf8'));
    this.companyUpdate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/company/company-update.json`, 'utf8'));
    this.companyLogoGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/company/company-logo-get.json`, 'utf8'));
  }

  public static getInstance(): CompanyValidator {
    if (!CompanyValidator.instance) {
      CompanyValidator.instance = new CompanyValidator();
    }
    return CompanyValidator.instance;
  }

  public validateCompaniesGetReq(data: unknown): HttpCompaniesRequest {
    return this.validate('validateCompaniesGetReq', this.companiesGet, data);
  }

  public validateCompanyGetReq(data: unknown): HttpCompanyRequest {
    return this.validate('validateCompanyGetReq', this.companyGet, data);
  }

  public validateCompanyCreateReq(data: unknown): Company {
    return this.validate('validateCompanyCreateReq', this.companyCreate, data);
  }

  public validateCompanyUpdateReq(data: unknown): Company {
    return this.validate('validateCompanyUpdateReq', this.companyUpdate, data);
  }

  public validateCompanyLogoGetReq(data: unknown): HttpCompanyLogoRequest {
    return this.validate('validateCompanyLogoGetReq', this.companyLogoGet, data);
  }
}
