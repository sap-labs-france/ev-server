import CreatedUpdatedProps from './CreatedUpdatedProps';
import VehicleManufacturer from './VehicleManufacturer';

export default interface Vehicle extends CreatedUpdatedProps {
  id: string;
  images?: string[];
  numberOfImages: number;
  vehicleManufacturerID: string;
  type: string;
  model: string;
  batteryKW: number;
  autonomyKmWLTP: number;
  autonomyKmReal: number;
  horsePower: number;
  torqueNm: number;
  performance0To100kmh: number;
  weightKg: number;
  lengthMeter: number;
  widthMeter: number;
  heightMeter: number;
  releasedOn: Date;
  logo?: string;

}
