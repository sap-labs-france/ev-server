import Address from "../Address";

export default interface CompanyData {
    id?: string;
    name: string;
    address: Address;
    logo: string;
}