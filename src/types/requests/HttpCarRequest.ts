import { CarConverter, CarType } from '../Car';

import HttpDatabaseRequest from './HttpDatabaseRequest';
import { UserCar } from '../User';

export interface HttpCarCatalogsRequest extends HttpDatabaseRequest {
  Search?: string;
  CarMaker?: string;
}

export interface HttpCarMakersRequest extends HttpDatabaseRequest {
  Search?: string;
}

export interface HttpCarCatalogImagesRequest extends HttpDatabaseRequest {
  ID: number;
}

export interface HttpCarCatalogByIDRequest {
  ID: number;
}

export interface HttpCarByIDRequest {
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
