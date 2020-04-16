import ChangeNotification from './ChangeNotification';

export default interface SingleChangeNotification extends ChangeNotification{
  data: {
    id: string;
    type: string;
  };
}
