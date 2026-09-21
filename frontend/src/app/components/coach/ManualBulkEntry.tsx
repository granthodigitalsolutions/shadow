import React, { useState, useEffect } from 'react';
import { firebaseFeeStructureService, firebaseSilambanFeeService, FeeStructure, SilambanFeeStructure } from '../../services/firebaseData';
import { Settings, Save, Trash2, AlertTriangle, School as SchoolIcon } from 'lucide-react';
import { belts } from '../../data';

interface ManualBulkEntryProps {
  onStudentsGenerated: (students: any[]) => void;
  selectedProgram: 'KARATE' | 'SELAMBAM';
  availableSchools: { id: string; name: string }[];
}

// Standard options matching the public Student Registration page
const STANDARD_OPTIONS = [
  'LKG', 'UKG',
  '1st Standard', '2nd Standard', '3rd Standard', '4th Standard',
  '5th Standard', '6th Standard', '7th Standard', '8th Standard',
  '9th Standard', '10th Standard', '11th Standard', '12th Standard',
  'College', 'Other'
];

export default function ManualBulkEntry({ onStudentsGenerated, selectedProgram, availableSchools }: ManualBulkEntryProps) {
  const [studentCount, setStudentCount] = useState<number>(() => {
    return Number(sessionStorage.getItem('manual_bulk_count')) || 1;
  });
  const [studentsData, setStudentsData] = useState<any[]>(() => {
    const cached = sessionStorage.getItem('manual_bulk_data');
    return cached ? JSON.parse(cached) : [];
  });
  
  const [karateFees, setKarateFees] = useState<FeeStructure[]>([]);
  const [silambamFees, setSilambamFees] = useState<SilambanFeeStructure[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorStudentIndex, setErrorStudentIndex] = useState<number | null>(null);

  useEffect(() => {
    if (errorStudentIndex !== null) {
      const el = document.getElementById(`student-card-${errorStudentIndex}`);
      if (el) {
        // smooth scroll with a slight delay to ensure render
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
      }
    }
  }, [errorStudentIndex]);

  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      try {
        const [kFees, sFees] = await Promise.all([
          firebaseFeeStructureService.getActive(),
          firebaseSilambanFeeService.getActive(),
        ]);
        setKarateFees(kFees);
        setSilambamFees(sFees);
      } catch (err) {
        console.error(err);
        setError("Failed to load configuration data.");
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [selectedProgram]);

  // Build belt options from Firestore fee structure
  const beltOptions = karateFees.map((fee) => {
    return {
      value: fee.id,
      label: fee.beltColor,
      fee: fee.fee
    };
  });

  // Build silambam stage options from Firestore
  const stageOptions = silambamFees.map(sf => ({
    label: sf.stageName || `Stage ${sf.stageNumber}`,
    value: sf.stageNumber,
    fee: sf.fee
  }));

  useEffect(() => {
    // Generate empty forms when count changes
    setStudentsData(prev => {
      const newDocs = [...prev];
      if (studentCount > prev.length) {
        for (let i = prev.length; i < studentCount; i++) {
          newDocs.push({
            name: '',
            gender: '',
            standard: '',
            contact: '',
            whatsapp: '',
            beltIndex: '',
            stageLevel: '',
            schoolId: '',
          });
        }
      } else if (studentCount < prev.length) {
        return newDocs.slice(0, studentCount);
      }
      return newDocs;
    });
  }, [studentCount, selectedProgram]);

  useEffect(() => {
    sessionStorage.setItem('manual_bulk_count', studentCount.toString());
    sessionStorage.setItem('manual_bulk_data', JSON.stringify(studentsData));
  }, [studentCount, studentsData]);

  const handleStudentChange = (index: number, field: string, value: any) => {
    const updated = [...studentsData];
    updated[index] = { ...updated[index], [field]: value };
    setStudentsData(updated);
    
    // Clear error if they are modifying the currently errored student
    if (errorStudentIndex === index) {
      setError(null);
      setErrorStudentIndex(null);
    }
  };

  // Get fee for a given silambam stage from Firestore fees
  const getSilambamFee = (stageNumber: number): number => {
    const matchingFee = silambamFees.find(f => f.stageNumber === stageNumber);
    return matchingFee ? matchingFee.fee : 800;
  };

  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to clear all typed data? This cannot be undone.")) {
      sessionStorage.removeItem('manual_bulk_count');
      sessionStorage.removeItem('manual_bulk_data');
      setStudentCount(1);
      setStudentsData([{
        name: '',
        gender: '',
        standard: '',
        contact: '',
        whatsapp: '',
        beltIndex: '',
        stageLevel: '',
        schoolId: '',
      }]);
      setError(null);
      setErrorStudentIndex(null);
    }
  };

  const handleGenerate = () => {
    // Validate each student
    for (let i = 0; i < studentsData.length; i++) {
      const s = studentsData[i];
      if (!s.name.trim()) {
        setError(`Student Name is required for Student ${i + 1}.`);
        setErrorStudentIndex(i);
        return;
      }
      if (!s.schoolId) {
        setError(`School selection is required for Student ${i + 1}.`);
        setErrorStudentIndex(i);
        return;
      }
      if (!s.gender) {
        setError(`Gender is required for Student ${i + 1}.`);
        setErrorStudentIndex(i);
        return;
      }
      if (!s.standard) {
        setError(`Standard is required for Student ${i + 1}.`);
        setErrorStudentIndex(i);
        return;
      }
      if (selectedProgram === 'KARATE' && (s.beltIndex === '' || s.beltIndex === undefined)) {
        setError(`Belt selection is required for Student ${i + 1}.`);
        setErrorStudentIndex(i);
        return;
      }
      if (selectedProgram === 'SELAMBAM' && !s.stageLevel) {
        setError(`Stage Level is required for Student ${i + 1}.`);
        setErrorStudentIndex(i);
        return;
      }
      if (!s.whatsapp || s.whatsapp.length !== 10) {
        setError(`Parent Mobile Number must be exactly 10 digits for Student ${i + 1}.`);
        setErrorStudentIndex(i);
        return;
      }
      if (s.contact && s.contact.length !== 10) {
        setError(`Student Mobile Number must be exactly 10 digits for Student ${i + 1}.`);
        setErrorStudentIndex(i);
        return;
      }
    }

    setError(null);
    setErrorStudentIndex(null);
    const year = new Date().getFullYear();

    const formattedStudents = studentsData.map((s, i) => {
      let fee = 0;
      let beltLevel = '';
      let beltIdx = 0;

      const schoolName = availableSchools.find(sch => sch.id === s.schoolId)?.name || 'Unknown School';

      if (selectedProgram === 'KARATE') {
        const matchingFee = karateFees.find(f => f.id === s.beltIndex);
        if (matchingFee) {
          beltLevel = matchingFee.beltColor;
          beltIdx = (matchingFee.order || 1) - 1;
          fee = matchingFee.fee || 800;
        }
      } else {
        const stageNum = Number(s.stageLevel);
        fee = getSilambamFee(stageNum);
      }

      return {
        tempId: `manual_${i}`,
        id: `SKT-${year}-${Math.floor(10000 + Math.random() * 90000)}`,
        name: s.name,
        gender: s.gender,
        registrationType: "school",
        schoolId: s.schoolId,
        school: schoolName,
        standard: s.standard,
        contact: s.contact ? `+91${s.contact}` : '',
        whatsapp: `+91${s.whatsapp}`,
        programType: selectedProgram,
        program: selectedProgram.toLowerCase(),
        beltLevel: beltLevel,
        beltIndex: beltIdx,
        stageLevel: s.stageLevel ? Number(s.stageLevel) : undefined,
        fee: fee
      };
    });

    onStudentsGenerated(formattedStudents);
  };

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading config...</div>;

  return (
    <div className="space-y-6">
      {/* Batch Configuration */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-500" />
            Batch Configuration
          </h2>
          <button 
            onClick={handleClearAll}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear All Data
          </button>
        </div>
        
        {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-sm">{error}</div>}

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Number of Students *</label>
            <input 
              type="number" 
              min={1} 
              max={100}
              value={studentCount}
              onChange={e => setStudentCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Student Forms */}
      <div className="space-y-4 md:max-h-[65vh] md:overflow-y-auto pr-1 custom-scrollbar">
        {studentsData.map((s, index) => (
          <div 
            key={index} 
            id={`student-card-${index}`}
            className={`bg-white dark:bg-zinc-950 border ${errorStudentIndex === index ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] dark:shadow-[0_0_15px_rgba(239,68,68,0.15)] ring-1 ring-red-500' : 'border-zinc-200 dark:border-zinc-800 shadow-sm'} rounded-2xl p-4 md:p-5 relative transition-all duration-300`}
          >
            {/* Student Number Badge */}
            <div className={`absolute top-0 left-0 ${errorStudentIndex === index ? 'bg-red-500 text-white' : 'bg-blue-500 text-zinc-950'} px-3 py-1 rounded-br-xl rounded-tl-2xl text-[10px] uppercase tracking-wider font-bold transition-colors`}>
              Student #{index + 1}
            </div>

            {errorStudentIndex === index && (
              <div className="mt-4 mb-2 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className={`grid grid-cols-2 md:grid-cols-6 gap-x-4 gap-y-4 ${errorStudentIndex === index ? 'mt-2' : 'mt-5'}`}>
              
              {/* Name */}
              <div className="col-span-2 md:col-span-2">
                <label className="block text-[11px] uppercase tracking-wider font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Student Name *</label>
                <input 
                  type="text" 
                  placeholder="Enter name"
                  value={s.name}
                  onChange={e => handleStudentChange(index, 'name', e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Gender */}
              <div className="col-span-1 md:col-span-1">
                <label className="block text-[11px] uppercase tracking-wider font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Gender *</label>
                <select 
                  value={s.gender}
                  onChange={e => handleStudentChange(index, 'gender', e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              {/* Standard */}
              <div className="col-span-1 md:col-span-2">
                <label className="block text-[11px] uppercase tracking-wider font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Standard *</label>
                <select 
                  value={s.standard}
                  onChange={e => handleStudentChange(index, 'standard', e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Select</option>
                  {STANDARD_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Belt/Stage */}
              <div className="col-span-2 md:col-span-2">
                <label className="block text-[11px] uppercase tracking-wider font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">
                  {selectedProgram === 'KARATE' ? 'Belt *' : 'Stage Level *'}
                </label>
                {selectedProgram === 'KARATE' ? (
                  <select 
                    value={s.beltIndex}
                    onChange={e => handleStudentChange(index, 'beltIndex', e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select Belt</option>
                    {beltOptions.map(b => (
                      <option key={b.value} value={b.value}>{b.label} — ₹{b.fee}</option>
                    ))}
                  </select>
                ) : (
                  <select 
                    value={s.stageLevel}
                    onChange={e => handleStudentChange(index, 'stageLevel', e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select Stage</option>
                    {stageOptions.map(st => (
                      <option key={st.value} value={st.value}>{st.label} — ₹{st.fee}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* School Selector */}
              <div className="col-span-2 md:col-span-3">
                <label className="block text-[11px] uppercase tracking-wider font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">School *</label>
                <div className="relative">
                  <SchoolIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  <select 
                    value={s.schoolId || ""}
                    onChange={e => handleStudentChange(index, 'schoolId', e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-9 pr-8 py-2.5 text-sm text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                  >
                    <option value="">Select School</option>
                    {availableSchools.map(sch => (
                      <option key={sch.id} value={sch.id}>{sch.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Parent Mobile */}
              <div className="col-span-2 md:col-span-3">
                <label className="block text-[11px] uppercase tracking-wider font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Parent Mobile *</label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-sm font-medium">
                    +91
                  </span>
                  <input 
                    type="tel" 
                    maxLength={10}
                    placeholder="10 digit number"
                    value={s.whatsapp}
                    onChange={e => handleStudentChange(index, 'whatsapp', e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-r-lg px-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Student Mobile */}
              <div className="col-span-2 md:col-span-3">
                <label className="block text-[11px] uppercase tracking-wider font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Student Mobile</label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-sm font-medium">
                    +91
                  </span>
                  <input 
                    type="tel" 
                    maxLength={10}
                    placeholder="Optional"
                    value={s.contact}
                    onChange={e => handleStudentChange(index, 'contact', e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-r-lg px-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Submit Button */}
      <div className="sticky bottom-4 z-10 flex justify-end mt-4">
        <button 
          onClick={handleGenerate}
          disabled={studentsData.length === 0}
          className="w-full md:w-auto bg-blue-500 hover:bg-blue-600 text-zinc-950 font-bold px-8 py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl active:scale-[0.98]"
        >
          <Save className="w-5 h-5" />
          Review & Calculate Fees
        </button>
      </div>
    </div>
  );
}
