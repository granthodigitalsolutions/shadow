import { useState, useEffect } from 'react';
import { ChevronDown, Plus, MapPin } from 'lucide-react';
import { branchService } from '../../services/programService';
import { Branch } from '../../types/program';
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuSeparator,
 DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';

interface BranchSelectorProps {
 programId: string | null;
 selectedBranch: Branch | null;
 onSelectBranch: (branch: Branch | null) => void;
 showCreateOption?: boolean;
 onCreateBranch?: () => void;
}

export default function BranchSelector({
 programId,
 selectedBranch,
 onSelectBranch,
 showCreateOption = false,
 onCreateBranch,
}: BranchSelectorProps) {
 const [branches, setBranches] = useState<Branch[]>([]);
 const [loading, setLoading] = useState(false);

 useEffect(() => {
 if (!programId) {
 setBranches([]);
 onSelectBranch(null);
 return;
 }

 const fetchBranches = async () => {
 setLoading(true);
 try {
 const programBranches = await branchService.getByProgram(programId);
 const activeBranches = programBranches.filter(b => b.active);
 setBranches(activeBranches);

 // Auto-select first branch if none selected
 if (activeBranches.length > 0 && !selectedBranch) {
 onSelectBranch(activeBranches[0]);
 }
 } catch (error) {
 console.error('Failed to load branches:', error);
 } finally {
 setLoading(false);
 }
 };

 fetchBranches();
 }, [programId]);

 if (!programId) {
 return null;
 }

 if (loading) {
 return (
 <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 rounded-lg">
 <MapPin size={18} className="text-gray-400" />
 <span className="text-sm text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">Loading branches...</span>
 </div>
 );
 }

 if (branches.length === 0) {
 return (
 <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
 <MapPin size={18} className="text-blue-600" />
 <span className="text-sm text-blue-700">No branches available</span>
 {showCreateOption && onCreateBranch && (
 <Button
 onClick={onCreateBranch}
 size="sm"
 variant="outline"
 className="ml-auto"
 >
 <Plus size={16} className="mr-1" />
 Create Branch
 </Button>
 )}
 </div>
 );
 }

 return (
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button
 variant="outline"
 className="min-w-[200px] justify-between"
 >
 <div className="flex items-center gap-2">
 <MapPin size={18} />
 <span>{selectedBranch?.name || 'Select Branch'}</span>
 </div>
 <ChevronDown size={16} />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="start" className="w-[240px]">
 {branches.map((branch) => (
 <DropdownMenuItem
 key={branch.id}
 onClick={() => onSelectBranch(branch)}
 className={selectedBranch?.id === branch.id ? 'bg-gray-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800' : ''}
 >
 <MapPin size={16} className="mr-2" />
 {branch.name}
 </DropdownMenuItem>
 ))}
 {showCreateOption && onCreateBranch && (
 <>
 <DropdownMenuSeparator />
 <DropdownMenuItem onClick={onCreateBranch}>
 <Plus size={16} className="mr-2" />
 Create New Branch
 </DropdownMenuItem>
 </>
 )}
 </DropdownMenuContent>
 </DropdownMenu>
 );
}
