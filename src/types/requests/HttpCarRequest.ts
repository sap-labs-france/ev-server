import HttpDatabaseRequest from './HttpDatabaseRequest';
export interface HttpCarsRequest extends HttpDatabaseRequest {
  Search?: string;
  VehicleMaker?: string;
}

export interface HttpCarImagesRequest extends HttpDatabaseRequest {
  CarID: number;
}

export interface HttpCarByIDRequest {
  ID: number;
}
