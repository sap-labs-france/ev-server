import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpVehiclesRequest extends HttpDatabaseRequest {
  Search?: string;
  Type?: string;
  VehicleManufacturerID?: string;
}
