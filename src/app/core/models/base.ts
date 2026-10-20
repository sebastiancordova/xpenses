import { Timestamp } from 'firebase/firestore';



export interface Base {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  uid?: string;
}
