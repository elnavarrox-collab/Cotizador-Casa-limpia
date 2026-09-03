import { MongoClient } from "mongodb";

const options = {
  maxPoolSize: 10,
  minPoolSize: 0,
  serverSelectionTimeoutMS: 8_000,
};

declare global {
  var casaLimpiaMongoClient: Promise<MongoClient> | undefined;
}

let productionClient: Promise<MongoClient> | undefined;

function getClient() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Falta configurar MONGODB_URI en las variables de entorno.");
  }

  if (process.env.NODE_ENV !== "production") {
    global.casaLimpiaMongoClient ??= new MongoClient(uri, options).connect();
    return global.casaLimpiaMongoClient;
  }

  productionClient ??= new MongoClient(uri, options).connect();
  return productionClient;
}

export async function getDatabase() {
  const client = await getClient();
  return client.db("casa_limpia");
}
