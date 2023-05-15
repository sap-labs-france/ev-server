import fs from 'fs';

import global from '../../types/GlobalType';
import Reservation from '../../types/Reservation';
import Schema from '../../types/validator/Schema';
import SchemaValidator from '../../validator/SchemaValidator';

export default class ReservationValidatorStorage extends SchemaValidator {
  private static instance: ReservationValidatorStorage | null = null;
  private reservationSave: Schema = JSON.parse(
    fs.readFileSync(
      `${global.appRoot}/assets/storage/schemas/reservation/reservation-save.json`,
      'utf-8'
    )
  );

  private constructor() {
    super(ReservationValidatorStorage.name);
  }

  public static getInstance(): ReservationValidatorStorage {
    if (!ReservationValidatorStorage.instance) {
      ReservationValidatorStorage.instance = new ReservationValidatorStorage();
    }
    return ReservationValidatorStorage.instance;
  }

  public validateReservation(data: any): Reservation {
    return this.validate(this.reservationSave, data, true);
  }
}
