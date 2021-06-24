import { CarConverter, CarType } from '../Car';

import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';
import { UserCar } from '../User';

export interface HttpCarCatalogsRequest extends HttpDatabaseRequest {
  Search?: string;
  CarMaker?: string;
}

export interface HttpCarMakersRequest extends HttpDatabaseRequest {
  Search?: string;
}

export interface HttpCarCatalogImagesRequest extends HttpByIDRequest, HttpDatabaseRequest {
  ID: number;
}

export interface HttpCarCatalogRequest extends HttpByIDRequest {
  ID: number;
}

export interface HttpCarRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpCarCreateRequest {
  vin: string;
  licensePlate: string;
  carCatalogID: number;
  forced?: boolean;
  type: CarType;
  id?: string;
  converter?: CarConverter;
  usersAdded?: UserCar[];
}

export interface HttpCarUpdateRequest {
  vin: string;
  licensePlate: string;
  carCatalogID: number;
  forced?: boolean;
  type: CarType;
  id?: string;
  converter?: CarConverter;
  usersRemoved?: UserCar[];
  usersUpserted?: UserCar[];
}

export interface HttpCarsRequest extends HttpDatabaseRequest {
  Search: string;
  CarMaker: string;
  WithUsers: boolean;
  UserID: string;
}

export interface HttpUsersCarsRequest extends HttpDatabaseRequest {
  Search: string;
  CarID: string;
}
