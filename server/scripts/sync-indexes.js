import "dotenv/config";
import mongoose from "mongoose";
import Task from "../src/models/Tasks.js";
import User from "../src/models/User.js";
import PushSubscription from "../src/models/PushSubscription.js";

await mongoose.connect(process.env.MONGO_URI, {
  dbName: "Backpwa",
});

for (const Model of [User, Task, PushSubscription]) {
  const dropped = await Model.syncIndexes();
  const indexes = await Model.listIndexes();

  console.log(
    `${Model.modelName}: ${indexes.map((i) => i.name).join(", ")}`
  );

  if (dropped.length) {
    console.log(`eliminados: ${dropped.join(", ")}`);
  }
}

await mongoose.disconnect();