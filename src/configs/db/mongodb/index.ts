import env from '@/configs/env';
import mongoose from 'mongoose';
import { MongoClient } from 'mongodb';

const DB_URL = `mongodb://${env.MONGO_INITDB_ROOT_USERNAME}:${env.MONGO_INITDB_ROOT_PASSWORD}@${env.MONGO_HOST}:${env.MONGO_PORT}/${env.MONGO_INITDB_ROOT_DATABASE}${env.NODE_ENV === 'development' ? '?authSource=admin' : ''}`;

const client = new MongoClient(DB_URL);
export const db = client.db();

export default function connectDB() {
  return new Promise((resolve, reject) => {
    mongoose.set('strictQuery', false);
    mongoose
      .connect(DB_URL)
      .then(() => {
        resolve('Successfully connected to database');
      })
      .catch((error) => {
        reject(error);
      });
  });
}
