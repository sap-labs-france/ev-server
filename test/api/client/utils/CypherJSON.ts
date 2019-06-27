export default interface CypherJSON {
  sensitiveData: string[];
  content: {
    secret1: string;
    secret2: string;
  };
}
