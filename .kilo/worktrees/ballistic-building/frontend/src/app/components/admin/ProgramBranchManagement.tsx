import { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, MapPin, Layers, Save, X } from 'lucide-react';
import { firebaseProgramService, branchService } from '../../services/programService';
import { Program, Branch } from '../../types/program';
import AdminLayout from './AdminLayout';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { toast } from 'sonner';
import { useDialog } from "../../contexts/DialogContext";

export default function ProgramBranchManagement() {
 const { showConfirm } = useDialog();

 const [programs, setPrograms] = useState<Program[]>([]);
 const [branches, setBranches] = useState<Branch[]>([]);
 const [loading, setLoading] = useState(true);
 const [editingProgram, setEditingProgram] = useState<Program | null>(null);
 const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
 const [newProgramName, setNewProgramName] = useState('');
 const [newBranchName, setNewBranchName] = useState('');
 const [newBranchProgramId, setNewBranchProgramId] = useState('');

 useEffect(() => {
 loadData();
 }, []);

 const loadData = async () => {
 setLoading(true);
 try {
 const [programsData, branchesData] = await Promise.all([
 firebaseProgramService.getAll(),
 branchService.getAll(),
 ]);
 setPrograms(programsData);
 setBranches(branchesData);
 } catch (error) {
 console.error('Failed to load data:', error);
 toast.error('Failed to load programs and branches');
 } finally {
 setLoading(false);
 }
 };

 const handleCreateProgram = async () => {
 if (!newProgramName.trim()) {
 toast.error('Program name is required');
 return;
 }

 try {
 const id = newProgramName.toLowerCase().replace(/\s+/g, '-');
 await firebaseProgramService.create({
 id,
 name: newProgramName,
 shortName: newProgramName,
 color: '#' + Math.floor(Math.random()*16777215).toString(16), // Random color
 icon: '🎯',
 active: true,
 });
 toast.success('Program created successfully');
 setNewProgramName('');
 loadData();
 } catch (error) {
 console.error('Failed to create program:', error);
 toast.error('Failed to create program');
 }
 };

 const handleCreateBranch = async () => {
 if (!newBranchName.trim() || !newBranchProgramId) {
 toast.error('Branch name and program are required');
 return;
 }

 try {
 await branchService.create({
 name: newBranchName,
 programId: newBranchProgramId,
 active: true,
 });
 toast.success('Branch created successfully');
 setNewBranchName('');
 setNewBranchProgramId('');
 loadData();
 } catch (error) {
 console.error('Failed to create branch:', error);
 toast.error('Failed to create branch');
 }
 };

 const handleDeleteProgram = async (id: string) => {
 const ok = await showConfirm({
 title: "Deactivate Program",
 message: "Are you sure you want to deactivate this program?",
 confirmText: "Deactivate",
 variant: "warning",
 });
 if (!ok) return;

 try {
 await firebaseProgramService.delete(id);
 toast.success('Program deactivated');
 loadData();
 } catch (error) {
 console.error('Failed to delete program:', error);
 toast.error('Failed to deactivate program');
 }
 };

 const handleDeleteBranch = async (id: string) => {
 const ok = await showConfirm({
 title: "Deactivate Branch",
 message: "Are you sure you want to deactivate this branch?",
 confirmText: "Deactivate",
 variant: "warning",
 });
 if (!ok) return;

 try {
 await branchService.delete(id);
 toast.success('Branch deactivated');
 loadData();
 } catch (error) {
 console.error('Failed to delete branch:', error);
 toast.error('Failed to deactivate branch');
 }
 };

 if (loading) {
 return (
 <AdminLayout>
 <div className="flex items-center justify-center min-h-[60vh]">
 <div className="text-center">
 <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
 <p className="text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">Loading...</p>
 </div>
 </div>
 </AdminLayout>
 );
 }

 return (
 <AdminLayout>
 <div className="space-y-6">
 <div>
 <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
 Program & Branch Management
 </h1>
 <p className="text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mt-1">Manage programs and branches for your organization</p>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {/* Programs Section */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Layers className="w-5 h-5" />
 Programs
 </CardTitle>
 <CardDescription>Manage your programs (Karate, Selambam, etc.)</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 {/* Create New Program */}
 <div className="flex gap-2">
 <Input
 placeholder="New program name..."
 value={newProgramName}
 onChange={(e) => setNewProgramName(e.target.value)}
 />
 <Button onClick={handleCreateProgram}>
 <Plus className="w-4 h-4 mr-1" />
 Add
 </Button>
 </div>

 {/* Programs List */}
 <div className="space-y-2">
 {programs.map((program) => (
 <div
 key={program.id}
 className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800"
 >
 <div className="flex items-center gap-3">
 <span className="text-2xl">{program.icon}</span>
 <div>
 <div className="font-semibold">{program.name}</div>
 <div className="text-xs text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">{program.id}</div>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <div
 className="w-4 h-4 rounded-full"
 style={{ backgroundColor: program.color }}
 />
 <Button
 variant="ghost"
 size="sm"
 onClick={() => handleDeleteProgram(program.id)}
 >
 <Trash2 className="w-4 h-4 text-red-600" />
 </Button>
 </div>
 </div>
 ))}
 {programs.length === 0 && (
 <div className="text-center py-8 text-gray-400">
 No programs found
 </div>
 )}
 </div>
 </CardContent>
 </Card>

 {/* Branches Section */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <MapPin className="w-5 h-5" />
 Branches
 </CardTitle>
 <CardDescription>Manage branches for each program</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 {/* Create New Branch */}
 <div className="space-y-2">
 <div className="flex gap-2">
 <Input
 placeholder="Branch name..."
 value={newBranchName}
 onChange={(e) => setNewBranchName(e.target.value)}
 />
 <select
 value={newBranchProgramId}
 onChange={(e) => setNewBranchProgramId(e.target.value)}
 className="px-3 py-2 border border-gray-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 rounded-md bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 >
 <option value="">Select Program</option>
 {programs.map((p) => (
 <option key={p.id} value={p.id}>
 {p.shortName}
 </option>
 ))}
 </select>
 <Button onClick={handleCreateBranch}>
 <Plus className="w-4 h-4" />
 </Button>
 </div>
 </div>

 {/* Branches List */}
 <div className="space-y-2">
 {branches.map((branch) => {
 const program = programs.find((p) => p.id === branch.programId);
 return (
 <div
 key={branch.id}
 className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800"
 >
 <div className="flex items-center gap-3">
 <MapPin className="w-4 h-4 text-gray-400" />
 <div>
 <div className="font-semibold">{branch.name}</div>
 <div className="text-xs text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">
 {program?.shortName || branch.programId}
 </div>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <span
 className={`px-2 py-1 text-xs rounded-full ${
 branch.active
 ? 'bg-green-100 text-green-700'
 : 'bg-gray-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300'
 }`}
 >
 {branch.active ? 'Active' : 'Inactive'}
 </span>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => handleDeleteBranch(branch.id)}
 >
 <Trash2 className="w-4 h-4 text-red-600" />
 </Button>
 </div>
 </div>
 );
 })}
 {branches.length === 0 && (
 <div className="text-center py-8 text-gray-400">
 No branches found
 </div>
 )}
 </div>
 </CardContent>
 </Card>
 </div>
 </div>
 </AdminLayout>
 );
}
