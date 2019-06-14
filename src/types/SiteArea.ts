import CreatedUpdatedProps from "./CreatedUpdatedProps";
import Address from "./Address";
import ChargingStation from "../entity/ChargingStation";

export default interface SiteArea extends CreatedUpdatedProps {

  name: string;
  maximumPower: number;
  address: Address;
  latitude: number;
  image: string;
  siteID: string;
  accessControl: boolean;
  chargingStations: ChargingStation[];
  availableChargers: number;
  totalChargers: number;
  availableConnectors: number;
  totalConnectors: number;

}
