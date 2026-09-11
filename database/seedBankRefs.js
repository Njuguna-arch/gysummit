require("dotenv").config();
const { sequelize, Parish, BankReference } = require("./models");

const PARISH_BANKREFS = {
  "Kagaa Parish": "GY26-KAG-001-DEL",
  "Githiga Parish": "GY26-GTI-001-DEL",
  "Gathanji Parish": "GY26-GTJ-001-DEL",
  "Gathangari Parish": "GY26-GTG-001-DEL",
  "Riara Ridge Parish": "GY26-RIA-001-DEL",
  "Matuguta Parish": "GY26-MAT-001-DEL",
  "Githunguri Parish": "GY26-GTU-001-DEL",
  "Kahunira Parish": "GY26-KAH-001-DEL",
  "Gathaithi Parish": "GY26-GAT-001-DEL",
  "Kamburu Parish": "GY26-KAM-001-DEL",
  "Karuthi Parish": "GY26-KAR-001-DEL"
};

async function seedBankReferences() {
  let created = 0;

  for (const [parishName, referenceNumber] of Object.entries(PARISH_BANKREFS)) {
    const parish = await Parish.findOne({ where: { name: parishName } });
    if (!parish) {
      console.log(`⚠️ Parish ${parishName} not found, skipping.`);
      continue;
    }

    const [ref, wasCreated] = await BankReference.findOrCreate({
      where: { referenceNumber },
      defaults: {
        referenceNumber,
        availableSlots: 5,
        registeredSlotsUsed: 0,
        status: "Not Verified",
        parishId: parish.id
      }
    });

    if (wasCreated) created++;
  }

  console.log(`${created} bank references seeded (hard‑coded per parish).`);
}

async function consumeSlot(referenceNumber) {
  const ref = await BankReference.findOne({ where: { referenceNumber } });
  if (!ref) {
    console.log(`Reference ${referenceNumber} not found.`);
    return;
  }

  if (ref.availableSlots > 0) {
    ref.availableSlots -= 1;
    ref.registeredSlotsUsed += 1;
    ref.status = "Verified";
    await ref.save();
    console.log(`Reference ${referenceNumber} updated: ${ref.availableSlots} slots left, ${ref.registeredSlotsUsed} used.`);
  } else {
    console.log(`Reference ${referenceNumber} has no available slots.`);
  }
}

async function main() {
  try {
    await sequelize.authenticate();
    await seedBankReferences();

    await consumeSlot("GY26-KAG-001-DEL");

    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err.message);
    process.exit(1);
  }
}

main();
