import Site from "../entity/Site";
import CreatedUpdatedProps from "./CreatedUpdatedProps";
import Address from "./Address";

export default interface Company extends CreatedUpdatedProps {
    
    name: string;
    address: Address;
    logo?: string;
    sites?: Site[];

}