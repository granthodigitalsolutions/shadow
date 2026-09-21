import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../app/config/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../app/components/ui/card';
import { Button } from '../../app/components/ui/button';
import { Input } from '../../app/components/ui/input';
import { Label } from '../../app/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, QrCode, Search, User, Award, X, Camera, CheckCircle, AlertTriangle, Shield, School, RefreshCw, Info } from 'lucide-react';
import { Link } from 'react-router';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { motion } from 'motion/react';

export default function ScanQR() {
  const navigate = useNavigate();
  const [studentId, setStudentId] = useState('');
  const [scannedStudent, setScannedStudent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'checking' | 'granted' | 'denied' | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    const testStudentId = localStorage.getItem('testStudentId');
    if (testStudentId) {
      setStudentId(testStudentId);
      fetchStudent(testStudentId);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const initScanner = async () => {
      if (showScanner && !scannerRef.current) {
        setCameraError(null);
        setPermissionStatus('checking');
        
        // Small delay before starting scanner
        await new Promise(resolve => setTimeout(resolve, 300));
        
        if (!isMounted || !document.getElementById('qr-reader')) {
          return; // Prevent initialization if unmounted or closed during delay
        }

        // Initialize scanner - let it handle permissions itself
        try {
          if (!window.isSecureContext) {
            console.warn('Warning: Not running in a secure context. Camera APIs may be blocked by the browser.');
          }
          
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setPermissionStatus('denied');
            setCameraError('Camera access is blocked by your browser. If you are viewing this on a mobile device over WiFi, you MUST use HTTPS or a tunneling service (like ngrok) because browsers block cameras on insecure HTTP connections.');
            return;
          }

          const scanner = new Html5QrcodeScanner(
            'qr-reader',
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.0,
              rememberLastUsedCamera: true,
              showTorchButtonIfSupported: true,
              formatsToSupport: [0], // QR_CODE
            },
            false
          );

          scanner.render(
            (decodedText) => {
              // Success callback
//               console.log('QR Code scanned:', decodedText);
              
              // Handle both raw IDs and JSON-encoded QR data
              let parsedId = decodedText;
              try {
                const parsed = JSON.parse(decodedText);
                if (parsed && parsed.studentId) {
                  parsedId = parsed.studentId;
                }
              } catch (e) {
                // It's not JSON, so treat it as a raw string ID
              }
              
              setStudentId(parsedId);
              fetchStudent(parsedId);
              scanner.clear().catch(console.error);
              scannerRef.current = null;
              setShowScanner(false);
              setPermissionStatus('granted');
              toast.success('QR Code scanned!');
            },
            (errorMessage) => {
              // Error callback - handle permission errors here
//               console.log('Scanner error:', errorMessage);
              
              // Check for permission denied errors
              if (errorMessage.includes('NotAllowedError') || 
                  errorMessage.includes('Permission denied') ||
                  errorMessage.includes('permission denied')) {
                setPermissionStatus('denied');
                setCameraError('Camera permission denied. Please click "Allow" when your browser asks for camera access, then click "Retry Camera".');
                toast.error('Camera permission denied');
                
                // Clear scanner on permission error
                if (scannerRef.current) {
                  scanner.clear().catch(console.error);
                  scannerRef.current = null;
                }
              } else if (errorMessage.includes('NotFoundError') || 
                         errorMessage.includes('No camera found')) {
                setPermissionStatus('denied');
                setCameraError('No camera found on this device.');
                toast.error('No camera found');
              } else if (errorMessage.includes('NotReadableError') || 
                         errorMessage.includes('already in use')) {
                setPermissionStatus('denied');
                setCameraError('Camera is already in use. Please close other apps/tabs using the camera.');
                toast.error('Camera already in use');
              }
              // Ignore NotFoundException (normal scanning errors)
              else if (!errorMessage.includes('NotFoundException') && 
                       !errorMessage.includes('No MultiFormat Readers')) {
                // Other scanning errors - just log them
//                 console.log('Scanning...', errorMessage);
              } else {
                // Scanner is working, just hasn't found a QR code yet
                setPermissionStatus('granted');
              }
            }
          );

          scannerRef.current = scanner;
          
          // Set granted status after a short delay (scanner is initializing)
          setTimeout(() => {
            if (scannerRef.current) {
              setPermissionStatus('granted');
            }
          }, 1500);
          
        } catch (error: any) {
          console.error('Scanner initialization error:', error);
          setPermissionStatus('denied');
          
          if (error.message && (error.message.includes('NotAllowedError') || 
                                error.message.includes('Permission denied'))) {
            setCameraError('Camera permission denied. Please allow camera access and try again.');
          } else if (error.message && error.message.includes('NotFoundError')) {
            setCameraError('No camera found on this device.');
          } else {
            setCameraError(`Failed to start camera (${error.message || error}). Please ensure the camera is not being used by another application.`);
          }
        }
      }
    };

    initScanner();

    return () => {
      isMounted = false;
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
    };
  }, [showScanner]);

  const fetchStudent = async (id: string) => {
    setLoading(true);
    try {
      const studentRef = doc(db, 'students', id);
      const studentSnap = await getDoc(studentRef);
      
      if (studentSnap.exists()) {
        const studentData = { id: studentSnap.id, ...studentSnap.data() } as any;
        
        if (studentData.paymentStatus !== 'completed') {
          toast.error('Student payment not completed!');
          setScannedStudent(null);
          return;
        }
        
        if (studentData.testStatus !== 'pending') {
          toast.warning('Test already completed for this student!');
        }
        
        setScannedStudent(studentData);
        toast.success('Student found!');
      } else {
        toast.error('Student not found!');
        setScannedStudent(null);
      }
    } catch (error) {
      console.error('Error fetching student:', error);
      toast.error('Error loading student data');
      setScannedStudent(null);
    } finally {
      setLoading(false);
    }
  };

  const handleScan = () => {
    if (!studentId.trim()) {
      toast.error('Please enter a student ID');
      return;
    }
    fetchStudent(studentId.trim());
  };

  const handleQRScan = () => {
    setShowScanner(true);
    setCameraError(null);
    setPermissionStatus(null);
  };

  const handleStartTest = () => {
    if (scannedStudent) {
      localStorage.removeItem('testStudentId');
      navigate(`/referee-scoring/${scannedStudent.id}`);
    }
  };

  const handleCloseScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(console.error);
      scannerRef.current = null;
    }
    setCameraError(null);
    setPermissionStatus(null);
    setShowScanner(false);
  };

  const handleRetryCamera = async () => {
    setCameraError(null);
    setPermissionStatus(null);
    
    // Close and reopen scanner
    handleCloseScanner();
    setTimeout(() => {
      setShowScanner(true);
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-pink-950 pb-safe">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 pt-safe">
        <div className="px-4 py-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Link to="/admin/dashboard">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button variant="ghost" size="sm" className="gap-2 text-white hover:bg-white/20">
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              </motion.div>
            </Link>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-4"
          >
            <div className="flex items-center gap-3 mb-2">
              <motion.div
                animate={{
                  rotate: [0, 5, -5, 0],
                  scale: [1, 1.1, 1],
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="p-3 bg-white/20 backdrop-blur rounded-xl"
              >
                <QrCode className="w-6 h-6 text-white" />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold text-white">QR Scanner</h1>
                <p className="text-white/80 text-sm">Belt Test Verification</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 space-y-4">
        {!scannedStudent ? (
          <>
            {/* QR Scan Button - Large and Prominent */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              whileTap={{ scale: 0.95 }}
            >
              <div 
                onClick={handleQRScan}
                className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-8 shadow-2xl cursor-pointer active:scale-95 transition-transform"
              >
                <div className="text-center space-y-4">
                  <motion.div
                    animate={{
                      scale: [1, 1.15, 1],
                      rotate: [0, 5, -5, 0]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="inline-block p-6 bg-white/20 backdrop-blur rounded-2xl"
                  >
                    <Camera className="w-16 h-16 text-white" />
                  </motion.div>
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Scan QR Code</h2>
                    <p className="text-white/90 text-sm">Tap to open camera</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Divider */}
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t-2 border-white/20" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-indigo-950/50 px-4 text-white/60 text-sm font-semibold uppercase backdrop-blur">
                  Or Enter Manually
                </span>
              </div>
            </div>

            {/* Manual Entry Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-xl">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="studentId" className="text-white text-base font-semibold flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Student ID
                    </Label>
                    <Input
                      id="studentId"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      placeholder="Enter student ID"
                      onKeyPress={(e) => e.key === 'Enter' && handleScan()}
                      className="h-14 text-base bg-white/20 border-white/30 text-white placeholder:text-white/50 focus:bg-white/30 focus:border-white/50 rounded-xl"
                    />
                  </div>

                  <motion.div whileTap={{ scale: 0.98 }}>
                    <Button 
                      onClick={handleScan} 
                      className="w-full h-14 text-base font-semibold bg-white text-indigo-600 hover:bg-white/90 rounded-xl shadow-lg" 
                      disabled={loading}
                    >
                      <Search className="w-5 h-5 mr-2" />
                      {loading ? 'Searching...' : 'Search Student'}
                    </Button>
                  </motion.div>
                </div>
              </div>
            </motion.div>

            {/* Instructions Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="bg-cyan-500/20 backdrop-blur-xl rounded-2xl p-5 border border-cyan-400/30">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-cyan-400/30 rounded-lg shrink-0">
                    <Award className="w-5 h-5 text-cyan-200" />
                  </div>
                  <div>
                    <p className="text-cyan-100 font-semibold text-sm mb-2">
                      ðŸ“‹ Quick Guide
                    </p>
                    <p className="text-cyan-200/90 text-sm leading-relaxed">
                      Scan the QR code from student's hall ticket to fetch details. Click "Start Test" to begin evaluation.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        ) : (
          // Student Found Card
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="space-y-4"
          >
            {/* Success Header */}
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                  <CheckCircle className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Student Found</h3>
                  <p className="text-green-50 text-sm">Ready for belt test</p>
                </div>
              </div>
            </div>

            {/* Student Details */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-5 border border-white/20 shadow-xl space-y-3">
              <div className="bg-white/10 rounded-xl p-4">
                <p className="text-white/70 text-xs mb-1 uppercase tracking-wide">Full Name</p>
                <p className="text-white font-bold text-lg">{scannedStudent.studentName}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/10 rounded-xl p-4">
                  <p className="text-white/70 text-xs mb-1 uppercase tracking-wide">Standard</p>
                  <p className="text-white font-bold">{scannedStudent.standard}</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <p className="text-white/70 text-xs mb-1 uppercase tracking-wide flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Belt
                  </p>
                  <p className="text-white font-bold">{scannedStudent.applyingForBelt}</p>
                </div>
              </div>

              <div className="bg-white/10 rounded-xl p-4">
                <p className="text-white/70 text-xs mb-1 uppercase tracking-wide flex items-center gap-1">
                  <School className="w-3 h-3" />
                  School Name
                </p>
                <p className="text-white font-bold">{scannedStudent.schoolName}</p>
              </div>

              <div className="bg-white/10 rounded-xl p-4">
                <p className="text-white/70 text-xs mb-1 uppercase tracking-wide">Student ID</p>
                <p className="text-white/90 font-mono text-xs break-all">{scannedStudent.id}</p>
              </div>

              <div className="bg-green-500/20 border-2 border-green-400/30 rounded-xl p-4">
                <p className="text-green-100 font-bold flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Ready for Test
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <motion.div whileTap={{ scale: 0.98 }}>
                <Button 
                  onClick={handleStartTest} 
                  className="w-full h-16 text-lg font-bold bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl shadow-2xl"
                >
                  <Award className="w-6 h-6 mr-3" />
                  Start Belt Test
                </Button>
              </motion.div>
              
              <motion.div whileTap={{ scale: 0.98 }}>
                <Button 
                  onClick={() => {
                    setScannedStudent(null);
                    setStudentId('');
                    localStorage.removeItem('testStudentId');
                  }} 
                  variant="outline"
                  className="w-full h-14 text-base font-semibold bg-white/10 border-2 border-white/30 text-white hover:bg-white/20 rounded-xl"
                >
                  <X className="w-5 h-5 mr-2" />
                  Cancel
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Scanner Modal - Full Screen on Mobile */}
      {showScanner && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50"
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25 }}
            className="h-full bg-gradient-to-b from-gray-900 to-black flex flex-col"
          >
            {/* Scanner Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 pt-safe shrink-0">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 backdrop-blur rounded-lg">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white">QR Scanner</h3>
                    <p className="text-white/80 text-xs">Position QR code in frame</p>
                  </div>
                </div>
                <Button
                  onClick={handleCloseScanner}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20 rounded-full w-10 h-10 p-0"
                >
                  <X className="w-6 h-6" />
                </Button>
              </div>
            </div>
            
            {/* Scanner Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
              {permissionStatus === 'checking' && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="inline-block p-6 bg-indigo-500/20 backdrop-blur rounded-2xl"
                  >
                    <RefreshCw className="w-16 h-16 text-indigo-400" />
                  </motion.div>
                  <div className="mt-6 text-center">
                    <p className="text-white font-bold text-lg mb-2">Requesting Camera Access</p>
                    <p className="text-white/70 text-sm">Please allow camera permission</p>
                  </div>
                </div>
              )}

              {/* The element MUST be in the DOM for Javascript to find it during "checking" phase */}
              {!cameraError && (
                <div className={`w-full max-w-md space-y-4 transition-opacity duration-300 ${permissionStatus === 'checking' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                  <div className="relative">
                    <div id="qr-reader" className="w-full rounded-2xl overflow-hidden shadow-2xl bg-white p-2 min-h-[300px]"></div>
                    
                    {/* Corner Markers */}
                    <div className="absolute top-2 left-2 w-8 h-8 border-t-4 border-l-4 border-cyan-400 rounded-tl-lg"></div>
                    <div className="absolute top-2 right-2 w-8 h-8 border-t-4 border-r-4 border-cyan-400 rounded-tr-lg"></div>
                    <div className="absolute bottom-2 left-2 w-8 h-8 border-b-4 border-l-4 border-cyan-400 rounded-bl-lg"></div>
                    <div className="absolute bottom-2 right-2 w-8 h-8 border-b-4 border-r-4 border-cyan-400 rounded-br-lg"></div>
                  </div>
                  
                  <div className="text-center bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/20">
                    <p className="text-white font-semibold text-sm mb-1">
                      Align QR code within frame
                    </p>
                    <p className="text-white/70 text-xs">
                      Scanning automatically...
                    </p>
                  </div>
                </div>
              )}
              
              {cameraError && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full max-w-md"
                >
                  <div className="bg-gradient-to-br from-red-500/20 to-orange-500/20 backdrop-blur-xl border-2 border-red-400/30 rounded-2xl p-6 text-center space-y-4">
                    <div className="inline-block p-4 bg-red-500/20 rounded-2xl">
                      <AlertTriangle className="w-12 h-12 text-red-400" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-lg mb-2">Camera Access Denied</p>
                      <p className="text-red-200 text-sm">{cameraError}</p>
                    </div>
                    
                    <div className="bg-black/30 rounded-xl p-4 space-y-2 text-left">
                      <p className="text-white font-semibold text-sm flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        How to enable:
                      </p>
                      <div className="space-y-1 text-xs text-white/80 ml-6">
                        <p>1. Tap the lock ðŸ”’ icon in address bar</p>
                        <p>2. Enable Camera permission</p>
                        <p>3. Reload and try again</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Button 
                        onClick={handleRetryCamera}
                        className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl"
                      >
                        <RefreshCw className="w-5 h-5 mr-2" />
                        Retry Camera
                      </Button>
                      <Button 
                        onClick={handleCloseScanner} 
                        variant="outline"
                        className="w-full h-12 bg-white/10 border-2 border-white/30 text-white hover:bg-white/20 font-semibold rounded-xl"
                      >
                        Use Manual Entry
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
