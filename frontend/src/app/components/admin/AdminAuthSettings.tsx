import { useState, useEffect } from "react";
import { ShieldAlert, Shield, ToggleLeft, ToggleRight, Lock, Save, AlertTriangle, Info, Clock, User, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "./AdminLayout";
import { firebaseAuthAccessService, AuthAccessConfig, AuthAccessRoleSettings } from "../../services/firebaseAuthAccessService";
import { firebaseAuthService } from "../../services/firebaseAuth";
import { useToast } from "../../hooks/useToast";
import { useDialog } from "../../contexts/DialogContext";

export default function AdminAuthSettings() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { showConfirm } = useDialog();
  const [config, setConfig] = useState<AuthAccessConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalConfigStr, setOriginalConfigStr] = useState("");
  const [adminUser, setAdminUser] = useState<{ uid: string; name: string } | null>(null);

  useEffect(() => {
    const user = firebaseAuthService.getCurrentUser();
    if (user) {
      setAdminUser({ uid: user.uid, name: user.displayName || "Administrator" });
    }
    
    // Subscribe to real-time config updates
    const unsubscribe = firebaseAuthAccessService.subscribe((updatedConfig) => {
      // If we are currently editing and haven't saved, we should probably warn, 
      // but to keep it simple, we just update if we don't have unsaved changes.
      // Optimistic locking handles the concurrent save conflict.
      
      setConfig((prevConfig) => {
        const prevStr = JSON.stringify(prevConfig);
        const hasUnsavedChanges = prevStr !== originalConfigStr && prevStr !== 'null';
        
        if (hasUnsavedChanges) {
          showToast("Settings were updated remotely. Your unsaved changes may conflict.", "error");
          return prevConfig; // Don't override unsaved changes immediately
        }
        
        setOriginalConfigStr(JSON.stringify(updatedConfig));
        return JSON.parse(JSON.stringify(updatedConfig));
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [originalConfigStr, showToast]);

  const hasUnsavedChanges = JSON.stringify(config) !== originalConfigStr;

  const handleToggle = (role: string, type: 'registration' | 'login') => {
    if (!config || !adminUser) return;
    
    const newConfig = { ...config };
    const currentState = newConfig.roles[role][type].enabled;
    const newState = !currentState;
    
    newConfig.roles[role][type].enabled = newState;
    
    // Auto-clear message if turning ON
    if (newState) {
      newConfig.roles[role][type].message = "";
    } else if (!newConfig.roles[role][type].message) {
      newConfig.roles[role][type].message = "Authentication is temporarily disabled by the administrator.";
    }
    
    newConfig.roles[role][type].updatedAt = new Date().toISOString();
    newConfig.roles[role][type].updatedBy = adminUser;
    
    setConfig(newConfig);
  };

  const handleMessageChange = (role: string, type: 'registration' | 'login', value: string) => {
    if (!config) return;
    const newConfig = { ...config };
    newConfig.roles[role][type].message = value;
    setConfig(newConfig);
  };

  const handleSave = async () => {
    if (!config || !adminUser) return;
    
    setSaving(true);
    try {
      await firebaseAuthAccessService.updateSettings(config, adminUser.uid, adminUser.name);
      setOriginalConfigStr(JSON.stringify(config));
      showToast("Authentication settings saved successfully.", "success");
    } catch (error: any) {
      showToast(error.message || "Failed to save settings.", "error");
      
      // If Optimistic Lock failed, force reload
      if (error.message.includes("another administrator")) {
        setLoading(true);
        const freshConfig = await firebaseAuthAccessService.getSettings();
        setConfig(freshConfig);
        setOriginalConfigStr(JSON.stringify(freshConfig));
        setLoading(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEmergencyLock = async () => {
    if (!adminUser) return;
    
    const confirmed = await showConfirm({
      title: "🚨 Emergency Lock",
      message: "This will immediately block all Coach authentication (Login & Registration). Are you sure you want to continue?",
      confirmText: "Yes, Lock Everything",
      variant: "danger"
    });

    if (confirmed) {
      setSaving(true);
      try {
        await firebaseAuthAccessService.emergencyLock(adminUser.uid, adminUser.name);
        showToast("Emergency lock activated.", "success");
      } catch (error: any) {
        showToast("Failed to activate emergency lock.", "error");
      } finally {
        setSaving(false);
      }
    }
  };

  const setBulkState = (enabled: boolean) => {
    if (!config || !adminUser) return;
    const newConfig = { ...config };
    
    Object.keys(newConfig.roles).forEach(role => {
      ['registration', 'login'].forEach(type => {
        const t = type as 'registration' | 'login';
        newConfig.roles[role][t].enabled = enabled;
        if (enabled) {
          newConfig.roles[role][t].message = "";
        } else if (!newConfig.roles[role][t].message) {
          newConfig.roles[role][t].message = "System lockdown enacted.";
        }
        newConfig.roles[role][t].updatedAt = new Date().toISOString();
        newConfig.roles[role][t].updatedBy = adminUser;
      });
    });
    
    setConfig(newConfig);
  };

  if (loading || !config) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </AdminLayout>
    );
  }

  const renderToggleCard = (role: string, type: 'registration' | 'login', label: string) => {
    const setting = config.roles[role][type];
    
    return (
      <div className={`p-4 border-2 rounded-xl transition-colors ${setting.enabled ? 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950' : 'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20'}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              {label} 
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${setting.enabled ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                {setting.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </h4>
          </div>
          <button
            onClick={() => handleToggle(role, type)}
            className={`transition-colors ${setting.enabled ? 'text-green-600' : 'text-red-600'}`}
          >
            {setting.enabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
          </button>
        </div>

        {!setting.enabled && (
          <div className="mt-4">
            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">Maintenance Message (Visible to users)</label>
            <textarea 
              value={setting.message}
              onChange={(e) => handleMessageChange(role, type, e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:text-zinc-300 resize-none"
              rows={2}
              placeholder="e.g. Registration is closed for the 2026 Championship."
            />
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(setting.updatedAt).toLocaleString()}</div>
          <div className="flex items-center gap-1"><User className="w-3 h-3" /> {setting.updatedBy.name}</div>
        </div>
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-10">
        
        {/* Header */}
        <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-500 rounded-xl">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "1px" }}>
                AUTHENTICATION ACCESS CONTROL
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage real-time access limits for roles across the platform.</p>
            </div>
          </div>
          <button 
            onClick={handleEmergencyLock}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg font-bold text-sm transition-colors border border-red-200 dark:border-red-900/50"
          >
            <ShieldAlert className="w-4 h-4" />
            Emergency Lock
          </button>
        </div>

        {/* Global Alert */}
        {hasUnsavedChanges && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded-r-lg flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-3">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="font-bold text-blue-900 dark:text-blue-100 text-sm">Unsaved Changes</p>
                <p className="text-xs text-blue-700 dark:text-blue-300">You have modified authentication settings. Save changes to apply them globally.</p>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-sm disabled:opacity-50"
            >
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        )}

        {/* Bulk Actions */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setBulkState(true)} className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-lg transition-colors border border-zinc-200 dark:border-zinc-800">
            Enable All
          </button>
          <button onClick={() => setBulkState(false)} className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-lg transition-colors border border-zinc-200 dark:border-zinc-800">
            Disable All
          </button>
        </div>

        {/* Roles Configuration */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Coach Role */}
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
              <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                Coach Authentication
              </h3>
            </div>
            <div className="p-6 space-y-4">
              {renderToggleCard('coach', 'registration', 'Registration Access')}
              {renderToggleCard('coach', 'login', 'Login Access')}
            </div>
          </div>

        </div>

        {/* Global Metadata Footer */}
        <div className="text-center text-xs text-zinc-500 dark:text-zinc-400 mt-8 flex flex-col items-center justify-center">
          <p>Global Version: {config.version}</p>
          <p>Last modified by {config.globalUpdatedBy.name} on {new Date(config.globalUpdatedAt).toLocaleString()}</p>
        </div>

      </div>
    </AdminLayout>
  );
}
