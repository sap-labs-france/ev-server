import { CarType, UserCar } from '../Car';

import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpCarCatalogsRequest extends HttpDatabaseRequest {
  Search?: string;
  CarMaker?: string;
}

export interface HttpCarMakersRequest extends HttpDatabaseRequest {
  Search?: string;
}

export interface HttpCarCatalogImagesRequest extends HttpDatabaseRequest {
  CarID: number;
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
  isDefault: boolean;
  id?: string;
  converterType?: string;
}

export interface HttpUsersAssignRequest {
  carID: string;
  usersCar: UserCar[];
}


export interface HttpCarsRequest extends HttpDatabaseRequest {
  Search: string;
  CarMaker: string;
}

export interface HttpUsersCarsRequest extends HttpDatabaseRequest {
  search: string;
  carID: string;
}
