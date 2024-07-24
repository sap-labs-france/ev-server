import { ObjectId } from 'mongodb';

export default interface WalletTransaction {
  _id?: ObjectId;
  userID: ObjectId;
  type: 'credit' | 'debit';
  amount: number;
  timestamp: Date;
  description?: string;
}
