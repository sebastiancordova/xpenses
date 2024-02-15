import { Timestamp } from "@angular/fire/firestore";


export interface Base {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  uid?: string;
}
