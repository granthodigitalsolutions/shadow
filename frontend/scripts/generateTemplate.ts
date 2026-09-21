import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

// Define the template data
const data = [
  {
    Name: 'John Doe',
    Gender: 'Male',
    SchoolId: 'sch_example123',
    Standard: '8th',
    StudentMobile: '9876543210',
    ParentNumber: '9988776655',
    Program: 'KARATE',
    BeltLevel: 'White',
    StageLevel: ''
  },
  {
    Name: 'Jane Smith',
    Gender: 'Female',
    SchoolId: 'sch_example123',
    Standard: '9th',
    StudentMobile: '9876543211',
    ParentNumber: '9988776656',
    Program: 'SILAMBAM',
    BeltLevel: '',
    StageLevel: '1'
  }
];

const worksheet = XLSX.utils.json_to_sheet(data);

// Adjust column widths
const wscols = [
  {wch: 25}, // Name
  {wch: 10}, // Gender
  {wch: 20}, // SchoolId
  {wch: 10}, // Standard
  {wch: 15}, // StudentMobile
  {wch: 15}, // ParentNumber
  {wch: 15}, // Program
  {wch: 15}, // BeltLevel
  {wch: 15}, // StageLevel
];
worksheet['!cols'] = wscols;

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');

const filePath = path.join('d:', 'shadow-kai-main', 'frontend', 'public', 'templates', 'bulk_registration_template.xlsx');

// Ensure directory exists
const dir = path.dirname(filePath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Write file
XLSX.writeFile(workbook, filePath);
console.log('Successfully generated new Excel template at:', filePath);
