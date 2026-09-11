require("dotenv").config();
const bcrypt = require("bcryptjs");
const { sequelize, User, Parish, Church } = require("./models");

async function seedJosephNjuguna() {
  try {
    await sequelize.authenticate();

    const parish = await Parish.findOne({ where: { name: "PCEA Gathangari Parish" } });
    const church = await Church.findOne({ where: { name: "PCEA Mathanja" } });

    if (!parish || !church) {
      console.log("⚠️ Parish or Church not found. Please check DB names.");
      return;
    }

    const passwordHash = await bcrypt.hash("Joseph@2026", 10);

    const joseph = await User.create({
      fullName: "Joseph Njuguna",
      email: "njugunajose977@gmail.com",
      phone: "0729504716",
      passwordHash,
      role: "PARTICIPANT",
      parishId: parish.id,
      churchId: church.id,
      isVerified: true
    });

    console.log(`User created: ${joseph.fullName} (${joseph.id})`);
  } catch (err) {
    console.error("Seed failed:", err.message);
  } finally {
    process.exit(0);
  }
}

seedJosephNjuguna();
