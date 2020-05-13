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

export interface HttpCarCreateRequest {
  vin: string;
  licensePlate: string;
  carCatalogID: number;
  forced: boolean;
  isPrivate: boolean;
  isDefault: boolean;
}

export interface HttpCarsRequest extends HttpDatabaseRequest {
  Search: string;
  CarMaker: string;
}
