import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import UserToken from '../../../../types/UserToken';
import { HttpChargerManufacturerParametersRequest, HttpChargerScheduleRequest } from '../../../../types/requests/HttpChargingStationRequest';

export default class PricingSecurity {

  public static filterChargerManufacturerParametersRequest(request: any): HttpChargerManufacturerParametersRequest {
    const filteredRequest: HttpChargerManufacturerParametersRequest = {} as HttpChargerManufacturerParametersRequest;
    filteredRequest.Manufacturer = sanitize(request.Manufacturer);
    filteredRequest.Model = sanitize(request.Model);
    return filteredRequest;
  }

  public static filterChargerScheduleRequest(request: any): HttpChargerScheduleRequest {
    const filteredRequest: HttpChargerScheduleRequest = {} as HttpChargerScheduleRequest;
    filteredRequest.ChargerID = sanitize(request.ChargerID);
    return filteredRequest;
  }

}

