import CreatedUpdatedProps from './CreatedUpdatedProps';

export default interface Setting extends CreatedUpdatedProps {

  id?: string;
  identifier: string;
  sensitiveData: string[];
  content: any;

}
