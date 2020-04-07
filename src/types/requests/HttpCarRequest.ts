import HttpDatabaseRequest from './HttpDatabaseRequest';
export interface HttpCarsRequest extends HttpDatabaseRequest {
  Search?: string;
  CarMaker?: string;
}

export interface HttpCarMakersRequest extends HttpDatabaseRequest {
  Search?: string;
}

export interface HttpCarImagesRequest extends HttpDatabaseRequest {
  CarID: number;
}

export interface HttpCarByIDRequest {
  ID: number;
}
