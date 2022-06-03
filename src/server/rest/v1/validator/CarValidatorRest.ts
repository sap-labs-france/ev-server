import { HttpCarCatalogGetRequest, HttpCarCatalogImagesGetRequest, HttpCarCatalogsGetRequest, HttpCarCreateRequest, HttpCarDeleteRequest, HttpCarGetRequest, HttpCarMakersGetRequest, HttpCarUpdateRequest, HttpCarsGetRequest } from '../../../../types/requests/HttpCarRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class CarValidatorRest extends SchemaValidator {
  private static instance: CarValidatorRest|null = null;
  private carMakersGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/car/carmakers-get.json`, 'utf8'));
  private carCatalogsGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/car/carcatalogs-get.json`, 'utf8'));
  private carCatalogImagesGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/car/carcatalog-images-get.json`, 'utf8'));
  private carCatalogGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/car/carcatalog-get.json`, 'utf8'));
  private carCreate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/car/car-create.json`, 'utf8'));
  private carUpdate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/car/car-update.json`, 'utf8'));
  private carsGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/car/cars-get.json`, 'utf8'));
  private carGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/car/car-get.json`, 'utf8'));
  private carDelete: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/car/car-delete.json`, 'utf8'));

  private constructor() {
    super('CarValidatorRest');
  }

  public static getInstance(): CarValidatorRest {
    if (!CarValidatorRest.instance) {
      CarValidatorRest.instance = new CarValidatorRest();
    }
    return CarValidatorRest.instance;
  }

  public validateCarMakersGetReq(data: Record<string, unknown>): HttpCarMakersGetRequest {
    return this.validate(this.carMakersGet, data);
  }

  public validateCarCatalogsGetReq(data: Record<string, unknown>): HttpCarCatalogsGetRequest {
    return this.validate(this.carCatalogsGet, data);
  }

  public validateCarCatalogImagesGetReq(data: Record<string, unknown>): HttpCarCatalogImagesGetRequest {
    return this.validate(this.carCatalogImagesGet, data);
  }

  public validateCarCatalogGetReq(data: Record<string, unknown>): HttpCarCatalogGetRequest {
    return this.validate(this.carCatalogGet, data);
  }

  public validateCarCreateReq(data: Record<string, unknown>): HttpCarCreateRequest {
    return this.validate(this.carCreate, data);
  }

  public validateCarUpdateReq(data: Record<string, unknown>): HttpCarUpdateRequest {
    return this.validate(this.carUpdate, data);
  }

  public validateCarsGetReq(data: Record<string, unknown>): HttpCarsGetRequest {
    return this.validate(this.carsGet, data);
  }

  public validateCarGetReq(data: Record<string, unknown>): HttpCarGetRequest {
    return this.validate(this.carGet, data);
  }

  public validateCarDeleteReq(data: Record<string, unknown>): HttpCarDeleteRequest {
    return this.validate(this.carDelete, data);
  }
}
