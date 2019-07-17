import HttpDatabaseRequest from "./HttpDatabaseRequest";

export interface HttpVehicleManufacturersRequest extends HttpDatabaseRequest {
  Search?: string;
  WithVehicles?: boolean;
  VehicleType?: string;
}

