export interface UserModel {
  email: string;
  hashedPassword: string;
  createdAt?: Date;
  updatedAt?: Date;
}
