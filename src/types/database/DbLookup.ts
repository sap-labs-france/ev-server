
export default interface DbLookup {
  tenantID: string;
  aggregation: any[];
  localField: string;
  foreignField: string;
  asField: string;
  objectIDFields?: string[];
  projectedFields?: string[];
  count?: boolean;
  oneToOneCardinality?: boolean;
  oneToOneCardinalityNotNull?: boolean;
  pipelineMatch?: any;
}
