import CreatedUpdatedProps from './CreatedUpdatedProps';
import Vehicle from './Vehicle';

export default interface VehicleManufacturer extends CreatedUpdatedProps {
  id: string;
  name: string;
  logo?: string;
  vehicles?: Vehicle[];
}
