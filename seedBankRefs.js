require("dotenv").config();
const { sequelize, Parish, GroupBankReference, Registration } = require("./models");

const PARISH_BANKREFS = {
  "PCEA Kagaa Parish": "GY26-KAG-001-DEL",
  "PCEA Githiga Parish": "GY26-GTI-001-DEL",
  "PCEA Gathanji Parish": "GY26-GTJ-001-DEL",
  "PCEA Gathangari Parish": "GY26-GTG-001-DEL",
  "PCEA Riara Ridge Parish": "GY26-RIA-001-DEL",
  "PCEA Matuguta Parish": "GY26-MAT-001-DEL",
  "PCEA Githunguri Parish": "GY26-GTU-001-DEL",
  "PCEA Kahunira Parish": "GY26-KAH-001-DEL",
  "PCEA Gathaithi Parish": "GY26-GAT-001-DEL",
  "PCEA Kamburu Parish": "GY26-KAM-001-DEL",
  "PCEA Karuthi Parish": "GY26-KAR-001-DEL"
};

async function seedBankReferences() {
  let created = 0;

  for (const [parishName, code] of Object.entries(PARISH_BANKREFS)) {
    const parish = await Parish.findOne({ where: { name: parishName } });
    if (!parish) {
      console.log(`⚠️ Parish ${parishName} not found, skipping.`);
      continue;
    }

    const [ref, wasCreated] = await GroupBankReference.findOrCreate({
      where: { code },
      defaults: {
        code,
        parish: parishName,
        totalSlots: 5,
        usedSlots: 0,
        isActive: true
      }
    });

    if (wasCreated) created++;
  }

  console.log(`${created} parish bank references seeded.`);
}

async function registerWithBankReference(userId, code) {
  const ref = await GroupBankReference.findOne({ where: { code } });
  if (!ref) {
    console.log(`Reference ${code} not found.`);
    return;
  }

  if (ref.totalSlots <= ref.usedSlots) {
    console.log(`Reference ${code} has no available slots.`);
    return;
  }

  // Create a registration linked to this bank reference
  const registration = await Registration.create({
    userId,
    ticketType: "GROUP",
    amountDue: 0,
    status: "CONFIRMED",
    groupCode: code,
    bankReferenceId: ref.id
  });

  // Consume a slot
  ref.usedSlots += 1;
  await ref.save();

  console.log(` User ${userId} registered with ${code}. Slots left: ${ref.totalSlots - ref.usedSlots}`);
  return registration;
}

async function main() {
  try {
    await sequelize.authenticate();
    await seedBankReferences();

    await registerWithBankReference("11111111-1111-1111-1111-111111111111", "GY26-KAG-001-DEL");

    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err.message);
    process.exit(1);
  }
}

main();
