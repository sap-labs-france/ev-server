import { HttpCarCatalogImagesRequest, HttpCarCatalogRequest, HttpCarCatalogsRequest, HttpCarCreateRequest, HttpCarMakersRequest, HttpCarRequest, HttpCarUpdateRequest, HttpCarsRequest } from '../../../../types/requests/HttpCarRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from './SchemaValidator';
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

  public validateGetCarMakersReq(data: any): HttpCarMakersRequest {
    // Validate schema
    this.validate(this.carMakersGet, data);
    return data;
  }

  public validateGetCarCatalogsReq(data: any): HttpCarCatalogsRequest {
    // Validate schema
    this.validate(this.carCatalogsGet, data);
    return data;
  }

  public validateGetCarCatalogImagesReq(data: any): HttpCarCatalogImagesRequest {
    // Validate schema
    this.validate(this.carCatalogImagesGet, data);
    return data;
  }

  public validateGetCarCatalogReq(data: any): HttpCarCatalogRequest {
    // Validate schema
    this.validate(this.carCatalogGet, data);
    return data;
  }

  public validateCreateCarReq(data: any): HttpCarCreateRequest {
    // Validate schema
    this.validate(this.carCreate, data);
    return data;
  }

  public validateUpdateCarReq(data: any): HttpCarUpdateRequest {
    // Validate schema
    this.validate(this.carUpdate, data);
    return data;
  }

  public validateGetCarsReq(data: any): HttpCarsRequest {
    // Validate schema
    this.validate(this.carsGet, data);
    return data;
  }

  public validateGetCarReq(data: any): HttpCarRequest {
    // Validate schema
    this.validate(this.carGet, data);
    return data;
  }
}
