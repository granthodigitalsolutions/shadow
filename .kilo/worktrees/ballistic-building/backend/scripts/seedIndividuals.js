const { db } = require('../config/firebaseAdmin');

async function seed() {
  const batch = db.batch();
  const names = ['Aarav', 'Vihaan', 'Vivaan', 'Ananya', 'Diya', 'Advik', 'Kabir', 'Anaya', 'Aaradhya', 'Omer'];

  for (let i = 0; i < 10; i++) {
    const studentId = `SKT-IND-${Math.floor(10000 + Math.random() * 90000)}`;
    const docRef = db.collection('students').doc(studentId);
    batch.set(docRef, {
      id: studentId,
      name: `Individual ${names[i]}`,
      gender: i % 2 === 0 ? 'Male' : 'Female',
      registrationType: 'individual',
      schoolId: 'individual',
      school: 'Individual',
      standard: `${(i % 12) + 1}th Standard`,
      contact: `+91987654321${i}`,
      whatsapp: `+91987654321${i}`,
      beltIndex: 0,
      beltLevel: "White Belt",
      stageLevel: 1,
      paymentStatus: "verified",
      testStatus: "pending",
      programType: "KARATE",
      program: "karate",
      registeredAt: new Date().toISOString()
    });
  }

  await batch.commit();
  console.log("Successfully seeded 10 individual students!");
  process.exit(0);
}

seed().catch(console.error);




