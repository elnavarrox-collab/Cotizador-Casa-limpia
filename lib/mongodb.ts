import { MongoClient } from "mongodb";
import { resetPromiseOnRejection } from "@/lib/recoverable-promise";

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
    if (!global.casaLimpiaMongoClient) {
      const connection = new MongoClient(uri, options).connect();
      global.casaLimpiaMongoClient = resetPromiseOnRejection(connection, (rejected) => {
        if (global.casaLimpiaMongoClient === rejected) global.casaLimpiaMongoClient = undefined;
      });
    }
    return global.casaLimpiaMongoClient;
  }

  if (!productionClient) {
    const connection = new MongoClient(uri, options).connect();
    productionClient = resetPromiseOnRejection(connection, (rejected) => {
      if (productionClient === rejected) productionClient = undefined;
    });
  }
  return productionClient;
}

export async function getDatabase() {
  const client = await getClient();
  return client.db("casa_limpia");
}
