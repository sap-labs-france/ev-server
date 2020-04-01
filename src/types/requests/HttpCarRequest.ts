import HttpDatabaseRequest from './HttpDatabaseRequest';
export interface HttpCarsRequest extends HttpDatabaseRequest {
  Search?: string;
  VehicleMaker?: string;
}
