import HttpDatabaseRequest from './HttpDatabaseRequest';
export interface HttpCarsRequest extends HttpDatabaseRequest {
  Search?: string;
  CarMaker?: string;
}

export interface HttpCarMakersRequest extends HttpDatabaseRequest {
  Search?: string;
}
