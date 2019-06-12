import Site from "../entity/Site";
import Editeable from "./Editeable";

export default interface Company extends Editeable {
    
    name: string;
    address: string;
    logo: string;
    sites?: Site[];

}