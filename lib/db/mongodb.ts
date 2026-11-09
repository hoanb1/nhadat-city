import { MongoClient, Db } from 'mongodb';
import { DB_CONFIG } from '@/lib/config/server';

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not set');
}

let client: MongoClient;
let db: Db;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient>;

const mongoOptions = {
  maxPoolSize: DB_CONFIG.MAX_POOL_SIZE,
  minPoolSize: DB_CONFIG.MIN_POOL_SIZE,
  maxIdleTimeMS: 60_000,
  serverSelectionTimeoutMS: DB_CONFIG.CONNECT_TIMEOUT_MS,
  socketTimeoutMS: DB_CONFIG.SOCKET_TIMEOUT_MS,
};

if (process.env.NODE_ENV === 'development') {
  // Reuse connection in dev to avoid exhausting connection limit
  if (!global._mongoClientPromise) {
    client = new MongoClient(MONGODB_URI, mongoOptions);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(MONGODB_URI, mongoOptions);
  clientPromise = client.connect();
}

export async function getDb(): Promise<Db> {
  const c = await clientPromise;
  return c.db(); // uses DB from URI
}

export default clientPromise;
