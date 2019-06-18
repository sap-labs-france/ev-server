import CreatedUpdatedProps from "./CreatedUpdatedProps";
import Address from "./Address";
import ChargingStation from "../entity/ChargingStation";
import Site from "../entity/Site";

export default interface SiteArea extends CreatedUpdatedProps {

  name: string;
  maximumPower: number;
  address: Address;
  image: string;
  siteID: string;
  site: Site;
  accessControl: boolean;
  chargingStations: ChargingStation[];
  availableChargers?: number;
  totalChargers?: number;
  availableConnectors?: number;
  totalConnectors?: number;

}
