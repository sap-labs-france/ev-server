import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import UserToken from '../../../../types/UserToken';
import { HttpChargerManufacturerParametersRequest, HttpChargerScheduleRequest } from '../../../../types/requests/HttpChargingStationRequest';
import { ChargerSchedule } from '../../../../types/ChargerSchedule';

export default class PricingSecurity {

  public static filterChargerManufacturerParametersRequest(request: any): HttpChargerManufacturerParametersRequest {
    const filteredRequest: HttpChargerManufacturerParametersRequest = {} as HttpChargerManufacturerParametersRequest;
    filteredRequest.manufacturer = sanitize(request.Manufacturer);
    filteredRequest.model = sanitize(request.Model);
    return filteredRequest;
  }

  public static filterChargerScheduleRequest(request: any): HttpChargerScheduleRequest {
    const filteredRequest: HttpChargerScheduleRequest = {} as HttpChargerScheduleRequest;
    filteredRequest.chargerID = sanitize(request.ChargerID);
    return filteredRequest;
  }

  public static filterChargerScheduleUpdateRequest(request: any): ChargerSchedule {
    const filteredRequest: any = {};
    filteredRequest.chargerID = sanitize(request.ChargerID);
    filteredRequest.schedule = sanitize(request.Schedule);
    return filteredRequest;
  }

}

