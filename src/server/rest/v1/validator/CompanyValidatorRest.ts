import { HttpCompaniesGetRequest, HttpCompanyDeleteRequest, HttpCompanyGetRequest, HttpCompanyLogoGetRequest } from '../../../../types/requests/HttpCompanyRequest';

import Company from '../../../../types/Company';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class CompanyValidatorRest extends SchemaValidator {
  private static instance: CompanyValidatorRest|null = null;
  private companiesGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/company/companies-get.json`, 'utf8'));
  private companyGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/company/company-get.json`, 'utf8'));
  private companyDelete: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/company/company-delete.json`, 'utf8'));
  private companyCreate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/company/company-create.json`, 'utf8'));
  private companyUpdate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/company/company-update.json`, 'utf8'));
  private companyLogoGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/company/company-logo-get.json`, 'utf8'));

  private constructor() {
    super('CompanyValidatorRest');
  }

  public static getInstance(): CompanyValidatorRest {
    if (!CompanyValidatorRest.instance) {
      CompanyValidatorRest.instance = new CompanyValidatorRest();
    }
    return CompanyValidatorRest.instance;
  }

  public validateCompaniesGetReq(data: Record<string, unknown>): HttpCompaniesGetRequest {
    return this.validate(this.companiesGet, data);
  }

  public validateCompanyDeleteReq(data: Record<string, unknown>): HttpCompanyDeleteRequest {
    return this.validate(this.companyDelete, data);
  }

  public validateCompanyGetReq(data: Record<string, unknown>): HttpCompanyGetRequest {
    return this.validate(this.companyGet, data);
  }

  public validateCompanyCreateReq(data: Record<string, unknown>): Company {
    return this.validate(this.companyCreate, data);
  }

  public validateCompanyUpdateReq(data: Record<string, unknown>): Company {
    return this.validate(this.companyUpdate, data);
  }

  public validateCompanyLogoGetReq(data: Record<string, unknown>): HttpCompanyLogoGetRequest {
    return this.validate(this.companyLogoGet, data);
  }
}
