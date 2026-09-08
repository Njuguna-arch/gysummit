require("dotenv").config();
const { Sequelize } = require("sequelize");

const {
  DATABASE_URL,
  DB_HOST,
  DB_PORT,
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
  DB_SSL,
  NODE_ENV,
} = process.env;

console.log("DEBUG ENV →", {
  DATABASE_URL,
  DB_HOST,
  DB_PORT,
  DB_NAME,
  DB_USER,
  DB_PASSWORD: DB_PASSWORD ? "***hidden***" : undefined,
  DB_SSL,
  NODE_ENV,
});

let sequelize;

function detectPooler(hostOrUrl, port) {
  return String(port) === "6543" || /-pooler\./.test(String(hostOrUrl));
}

if (DATABASE_URL) {
  const usingPooler = detectPooler(DATABASE_URL, new URL(DATABASE_URL).port);

  sequelize = new Sequelize(DATABASE_URL, {
    dialect: "postgres",
    logging: NODE_ENV === "production" ? false : console.log,
    dialectOptions: DB_SSL === "false" ? {} : { ssl: { require: true, rejectUnauthorized: false } },
    pool: { max: usingPooler ? 20 : 10, min: 0, acquire: 30000, idle: 10000 },
    define: { underscored: false },
  });
} else {
  const required = { DB_HOST, DB_PORT, DB_NAME, DB_USER };
  for (const [key, value] of Object.entries(required)) {
    if (!value) {
      throw new Error(`Missing required environment variable: ${key} (or set DATABASE_URL instead — see .env.example)`);
    }
  }

  const usingPooler = detectPooler(DB_HOST, DB_PORT);

  sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
    host: DB_HOST,
    port: parseInt(DB_PORT, 10),
    dialect: "postgres",
    logging: NODE_ENV === "production" ? false : console.log,
    dialectOptions: DB_SSL === "true" ? { ssl: { require: true, rejectUnauthorized: false } } : {},
    pool: { max: usingPooler ? 20 : 10, min: 0, acquire: 30000, idle: 10000 },
    define: { underscored: false },
  });
}

sequelize.authenticate()
  .then(async () => {
    console.log("✅ Database connection established successfully");
    const [result] = await sequelize.query("SELECT NOW()");
    console.log("🕒 Test query result:", result);
  })
  .catch(err => console.error("❌ Database connection failed:", err));

module.exports = { sequelize };
