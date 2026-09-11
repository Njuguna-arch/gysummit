require("dotenv").config();
const { sequelize } = require("../models");

async function main() {
  console.log("Connecting to Postgres...");
  await sequelize.authenticate();
  console.log("Connected. Creating/updating tables...");

  await sequelize.sync({ alter: true });

  console.log(" All tables are in place.");
  process.exit(0);
}

main().catch((err) => {
  console.error(" Failed to sync database:", err.message);
  process.exit(1);
});
