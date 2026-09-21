import React, { useState } from 'react';
import { Database, PlayCircle } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { firebaseSchoolService, firebaseStudentService, firebaseBatchService } from '../../services/firebaseData';
import { StudentRecord, Batch } from '../../types/admin';
import AdminLayout from './AdminLayout';

export default function DataSeeder() {
  const { showToast } = useToast();
  const [isSeeding, setIsSeeding] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, msg]);
  };

  const generateRandomPhone = () => {
    return '9' + Math.floor(100000000 + Math.random() * 900000000).toString();
  };

  const generateData = async (programType: 'KARATE' | 'SELAMBAM') => {
    setIsSeeding(true);
    setLogs([]);
    addLog(`🚀 Starting ${programType} data generation...`);
    
    try {
      const program = programType.toLowerCase() as 'karate' | 'selambam';
      const year = new Date().getFullYear();

      // 1. Create Schools
      addLog(`[Schools] Creating 2 schools...`);
      const school1Id = await firebaseSchoolService.create({
        name: `${programType} School A`,
        branch: 'Main',
        active: true,
        programType,
        programId: program,
      });
      const school2Id = await firebaseSchoolService.create({
        name: `${programType} School B`,
        branch: 'Main',
        active: true,
        programType,
        programId: program,
      });
      addLog(`[Schools] Created School A (${school1Id}) and School B (${school2Id})`);

      // 2. Generate 10 students for School A
      addLog(`[Students] Generating 10 students for School A...`);
      const schoolAStudentIds: string[] = [];
      for (let i = 1; i <= 10; i++) {
        const id = `SKT-${year}-${Math.floor(10000 + Math.random() * 90000)}`;
        schoolAStudentIds.push(id);
        const student: StudentRecord = {
          id,
          name: `${programType} SchA Student ${i}`,
          gender: i % 2 === 0 ? 'Female' : 'Male',
          registrationType: 'school',
          schoolId: school1Id,
          school: `${programType} School A`,
          standard: '5',
          contact: generateRandomPhone(),
          whatsapp: generateRandomPhone(),
          beltIndex: programType === 'KARATE' ? 0 : undefined,
          stageLevel: programType === 'SELAMBAM' ? 1 : undefined,
          beltTestId: 'test-seed',
          batchId: null,
          refereeId: null,
          paymentStatus: 'verified',
          testStatus: 'pending',
          programType,
          program,
          registeredAt: new Date().toISOString(),
        };
        await firebaseStudentService.add(student);
      }

      // 3. Generate 10 students for School B
      addLog(`[Students] Generating 10 students for School B...`);
      const schoolBStudentIds: string[] = [];
      for (let i = 1; i <= 10; i++) {
        const id = `SKT-${year}-${Math.floor(10000 + Math.random() * 90000)}`;
        schoolBStudentIds.push(id);
        const student: StudentRecord = {
          id,
          name: `${programType} SchB Student ${i}`,
          gender: i % 2 === 0 ? 'Female' : 'Male',
          registrationType: 'school',
          schoolId: school2Id,
          school: `${programType} School B`,
          standard: '5',
          contact: generateRandomPhone(),
          whatsapp: generateRandomPhone(),
          beltIndex: programType === 'KARATE' ? 0 : undefined,
          stageLevel: programType === 'SELAMBAM' ? 1 : undefined,
          beltTestId: 'test-seed',
          batchId: null,
          refereeId: null,
          paymentStatus: 'verified',
          testStatus: 'pending',
          programType,
          program,
          registeredAt: new Date().toISOString(),
        };
        await firebaseStudentService.add(student);
      }

      // 4. Create School Batches
      addLog(`[Batches] Creating School Batches...`);
      const batchA = await firebaseBatchService.create({
        beltTestId: 'test-seed',
        schoolId: school1Id,
        batchNumber: 1,
        refereeIds: [],
        studentIds: schoolAStudentIds,
        maxSize: 10,
        status: 'filling',
        programType,
        programId: program,
      });
      // Assign batchId to students
      for (const sId of schoolAStudentIds) {
        await firebaseStudentService.update(sId, { batchId: batchA.id });
      }

      const batchB = await firebaseBatchService.create({
        beltTestId: 'test-seed',
        schoolId: school2Id,
        batchNumber: 2,
        refereeIds: [],
        studentIds: schoolBStudentIds,
        maxSize: 10,
        status: 'filling',
        programType,
        programId: program,
      });
      // Assign batchId to students
      for (const sId of schoolBStudentIds) {
        await firebaseStudentService.update(sId, { batchId: batchB.id });
      }

      // 5. Generate 40 Individual Students
      addLog(`[Students] Generating 40 Individual Students...`);
      const individualStudentIds: string[] = [];
      for (let i = 1; i <= 40; i++) {
        const id = `SKT-${year}-${Math.floor(10000 + Math.random() * 90000)}`;
        individualStudentIds.push(id);
        const student: StudentRecord = {
          id,
          name: `${programType} Indv Student ${i}`,
          gender: i % 2 === 0 ? 'Female' : 'Male',
          registrationType: 'individual',
          schoolId: 'individual',
          school: 'Individual',
          standard: '5',
          contact: generateRandomPhone(),
          whatsapp: generateRandomPhone(),
          beltIndex: programType === 'KARATE' ? 0 : undefined,
          stageLevel: programType === 'SELAMBAM' ? 1 : undefined,
          beltTestId: 'test-seed',
          batchId: null,
          refereeId: null,
          paymentStatus: 'verified',
          testStatus: 'pending',
          programType,
          program,
          registeredAt: new Date().toISOString(),
        };
        await firebaseStudentService.add(student);
      }

      // 6. Distribute into 4 Individual Batches
      addLog(`[Batches] Distributing 40 individuals into 4 batches...`);
      for (let b = 0; b < 4; b++) {
        const batchStudentIds = individualStudentIds.slice(b * 10, (b + 1) * 10);
        const indBatch = await firebaseBatchService.create({
          beltTestId: 'test-seed',
          schoolId: 'individual',
          batchNumber: 3 + b,
          refereeIds: [],
          studentIds: batchStudentIds,
          maxSize: 10,
          status: 'filling',
          programType,
          programId: program,
        });
        for (const sId of batchStudentIds) {
          await firebaseStudentService.update(sId, { batchId: indBatch.id });
        }
      }

      addLog(`✅ Successfully completed ${programType} data generation!`);
      showToast(`Generated ${programType} testing data successfully`, 'success');
    } catch (error: any) {
      console.error(error);
      addLog(`❌ Error: ${error.message}`);
      showToast(`Failed to generate data: ${error.message}`, 'error');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-zinc-950 rounded-lg shadow-md dark:shadow-none dark:border dark:border-zinc-800 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Database className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                TEST DATA SEEDER
              </h2>
              <p className="text-sm text-gray-600 dark:text-zinc-400">
                Generate realistic testing data securely into Firestore.
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-zinc-950 rounded-lg shadow-md dark:shadow-none dark:border dark:border-zinc-800 p-6 space-y-6">
          <div className="border-2 border-red-200 dark:border-zinc-800 rounded-lg p-4 sm:p-6 bg-red-50 dark:bg-zinc-900">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
              <div className="flex-1 w-full">
                <h4 className="font-bold text-red-800 dark:text-red-400 mb-2">Warning: Live Database Write</h4>
                <p className="text-sm text-red-700 dark:text-red-300">
                  This tool will write 132 new records directly to Firestore for whichever program you select.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => generateData('KARATE')}
              disabled={isSeeding}
              className="flex-1 flex justify-center items-center gap-2 px-6 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-lg transition-all"
            >
              {isSeeding ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <PlayCircle className="w-6 h-6" />
              )}
              Seed Karate Data
            </button>
            <button
              onClick={() => generateData('SELAMBAM')}
              disabled={isSeeding}
              className="flex-1 flex justify-center items-center gap-2 px-6 py-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl font-bold text-lg transition-all"
            >
              {isSeeding ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <PlayCircle className="w-6 h-6" />
              )}
              Seed Selambam Data
            </button>
          </div>

          {logs.length > 0 && (
            <div className="mt-6 p-4 bg-gray-900 text-green-400 font-mono text-sm rounded-md h-64 overflow-y-auto shadow-inner border border-zinc-800">
              {logs.map((log, index) => (
                <div key={index} className="mb-1">{log}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
