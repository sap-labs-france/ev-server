import { CarConverter, CarType } from '../Car';

import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpCarCatalogsGetRequest extends HttpDatabaseRequest {
  Search?: string;
  CarMaker?: string;
}

export interface HttpCarMakersGetRequest extends HttpDatabaseRequest {
  Search?: string;
}

export interface HttpCarCatalogImagesGetRequest extends HttpByIDRequest, HttpDatabaseRequest {
  ID: number;
}

export interface HttpCarCatalogGetRequest extends HttpByIDRequest {
  ID: number;
}

export interface HttpCarGetRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpCarDeleteRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpCarCreateRequest {
  id?: string;
  vin: string;
  licensePlate: string;
  carCatalogID: number;
  forced?: boolean;
  type: CarType;
  converter?: CarConverter;
  userID: string;
  default: boolean;
  carConnectorData?: {
    carConnectorID: string;
    carConnectorMeterID?: string;
  }
}

export interface HttpCarUpdateRequest {
  id?: string;
  vin: string;
  licensePlate: string;
  carCatalogID: number;
  forced?: boolean;
  type: CarType;
  converter?: CarConverter;
  userID: string;
  default: boolean;
  carConnectorData?: {
    carConnectorID: string;
    carConnectorMeterID?: string;
  }
}

export interface HttpCarsGetRequest extends HttpDatabaseRequest {
  Search: string;
  CarMaker: string;
  WithUser: boolean;
  UserID: string;
}
