import { HttpSynchronizeUserRequest } from '../../../../../types/requests/HttpUserRequest';
import Utils from '../../../../../utils/Utils';
import sanitize from 'mongo-sanitize';

export default class BillingSecurity {
  public static filterSynchronizeUserRequest(requestBody: any): HttpSynchronizeUserRequest {
    const filteredUser: HttpSynchronizeUserRequest = {} as HttpSynchronizeUserRequest;
    if (Utils.objectHasProperty(requestBody, 'id')) {
      filteredUser.id = sanitize(requestBody.id);
    }
    if (Utils.objectHasProperty(requestBody, 'email')) {
      filteredUser.email = sanitize(requestBody.email);
    }
    return filteredUser;
  }
}
