import { HttpCarCatalogImagesRequest, HttpCarCatalogRequest, HttpCarCatalogsRequest, HttpCarCreateRequest, HttpCarMakersRequest, HttpCarRequest, HttpCarUpdateRequest, HttpCarsRequest } from '../../../../types/requests/HttpCarRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class CarValidator extends SchemaValidator {
  private static instance: CarValidator|null = null;
  private carMakersGet: Schema;
  private carCatalogsGet: Schema;
  private carCatalogImagesGet: Schema;
  private carCatalogGet: Schema;
  private carCreate: Schema;
  private carUpdate: Schema;
  private carsGet: Schema;
  private carGet: Schema;

  private constructor() {
    super('CarValidator');
    this.carMakersGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/car/carmakers-get.json`, 'utf8'));
    this.carCatalogsGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/car/carcatalogs-get.json`, 'utf8'));
    this.carCatalogImagesGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/car/carcatalog-images-get.json`, 'utf8'));
    this.carCatalogGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/car/carcatalog-get.json`, 'utf8'));
    this.carCreate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/car/car-create.json`, 'utf8'));
    this.carUpdate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/car/car-update.json`, 'utf8'));
    this.carsGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/car/cars-get.json`, 'utf8'));
    this.carGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/car/car-get.json`, 'utf8'));
  }

  public static getInstance(): CarValidator {
    if (!CarValidator.instance) {
      CarValidator.instance = new CarValidator();
    }
    return CarValidator.instance;
  }

  public validateCarMakersGetReq(data: Record<string, unknown>): HttpCarMakersRequest {
    return this.validate(this.carMakersGet, data);
  }

  public validateCarCatalogsGetReq(data: Record<string, unknown>): HttpCarCatalogsRequest {
    return this.validate(this.carCatalogsGet, data);
  }

  public validateCarCatalogImagesGetReq(data: Record<string, unknown>): HttpCarCatalogImagesRequest {
    return this.validate(this.carCatalogImagesGet, data);
  }

  public validateCarCatalogGetReq(data: Record<string, unknown>): HttpCarCatalogRequest {
    return this.validate(this.carCatalogGet, data);
  }

  public validateCarCreateReq(data: Record<string, unknown>): HttpCarCreateRequest {
    return this.validate(this.carCreate, data);
  }

  public validateCarUpdateReq(data: Record<string, unknown>): HttpCarUpdateRequest {
    return this.validate(this.carUpdate, data);
  }

  public validateCarsGetReq(data: Record<string, unknown>): HttpCarsRequest {
    return this.validate(this.carsGet, data);
  }

  public validateCarGetReq(data: Record<string, unknown>): HttpCarRequest {
    return this.validate(this.carGet, data);
  }
}
