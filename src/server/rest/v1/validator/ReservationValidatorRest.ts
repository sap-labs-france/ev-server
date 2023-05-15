import fs from 'fs';

import global from '../../../../types/GlobalType';
import {
  HttpReservationCancelRequest,
  HttpReservationCreateRequest,
  HttpReservationDeleteRequest,
  HttpReservationGetRequest,
  HttpReservationUpdateRequest,
  HttpReservationsDeleteRequest,
  HttpReservationsGetRequest,
} from '../../../../types/requests/HttpReservationRequest';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';

export default class ReservationValidatorRest extends SchemaValidator {
  private static instance: ReservationValidatorRest | null = null;
  private reservationGet: Schema = JSON.parse(
    fs.readFileSync(
      `${global.appRoot}/assets/server/rest/v1/schemas/reservation/reservation-get.json`,
      'utf8'
    )
  );

  private reservationsGet: Schema = JSON.parse(
    fs.readFileSync(
      `${global.appRoot}/assets/server/rest/v1/schemas/reservation/reservations-get.json`,
      'utf8'
    )
  );

  private reservationCreate: Schema = JSON.parse(
    fs.readFileSync(
      `${global.appRoot}/assets/server/rest/v1/schemas/reservation/reservation-create.json`,
      'utf8'
    )
  );

  private reservationUpdate: Schema = JSON.parse(
    fs.readFileSync(
      `${global.appRoot}/assets/server/rest/v1/schemas/reservation/reservation-update.json`,
      'utf8'
    )
  );

  private reservationDelete: Schema = JSON.parse(
    fs.readFileSync(
      `${global.appRoot}/assets/server/rest/v1/schemas/reservation/reservation-delete.json`,
      'utf8'
    )
  );

  private reservationsDelete: Schema = JSON.parse(
    fs.readFileSync(
      `${global.appRoot}/assets/server/rest/v1/schemas/reservation/reservations-delete.json`,
      'utf8'
    )
  );

  private reservationCancel: Schema = JSON.parse(
    fs.readFileSync(
      `${global.appRoot}/assets/server/rest/v1/schemas/reservation/reservation-cancel.json`,
      'utf8'
    )
  );

  private constructor() {
    super('ReservationValidatorRest');
  }

  public static getInstance(): ReservationValidatorRest {
    if (!ReservationValidatorRest.instance) {
      ReservationValidatorRest.instance = new ReservationValidatorRest();
    }
    return ReservationValidatorRest.instance;
  }

  public validateReservationGetReq(data: Record<string, unknown>): HttpReservationGetRequest {
    return this.validate(this.reservationGet, data);
  }

  public validateReservationsGetReq(data: Record<string, unknown>): HttpReservationsGetRequest {
    return this.validate(this.reservationsGet, data);
  }

  public validateReservationCreateReq(data: Record<string, unknown>): HttpReservationCreateRequest {
    return this.validate(this.reservationCreate, data);
  }

  public validateReservationUpdateReq(data: Record<string, unknown>): HttpReservationUpdateRequest {
    return this.validate(this.reservationUpdate, data);
  }

  public validateReservationDeleteReq(data: Record<string, unknown>): HttpReservationDeleteRequest {
    return this.validate(this.reservationDelete, data);
  }

  public validateReservationsDeleteReq(
    data: Record<string, unknown>
  ): HttpReservationsDeleteRequest {
    return this.validate(this.reservationsDelete, data);
  }

  public validateReservationCancelReq(data: Record<string, unknown>): HttpReservationCancelRequest {
    return this.validate(this.reservationCancel, data);
  }
}
