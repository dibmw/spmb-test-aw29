import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  QrCode, 
  Camera, 
  CameraOff, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  User, 
  Users, 
  Clock, 
  MapPin, 
  RefreshCw, 
  Sparkles,
  Check,
  ShieldCheck,
  CalendarClock
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { SiswaJadwal, PresensiRecord, UserSession, formatKelas, getJenjangFromKelas, parseStartTimeMinutes, getSortedSiswaExamStations, resolveKehadiran, formatTanggalUjian } from '../types/spmb';
import { apiService } from '../services/apiService';

interface TimekeeperDashboardProps {
  session: UserSession;
  jadwalList: SiswaJadwal[];
  presensiList: PresensiRecord[];
  onAttendanceSubmitted: (record: PresensiRecord) => void;
  showToast: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}

export const TimekeeperDashboard: React.FC<TimekeeperDashboardProps> = ({
  session,
  jadwalList,
  presensiList,
  onAttendanceSubmitted,
  showToast
}) => {
  const [attendanceType, setAttendanceType] = useState<'Siswa' | 'Walmur'>('Siswa');
  const [manualId, setManualId] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedStudent, setScannedStudent] = useState<SiswaJadwal | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string>('');

  // Live presensi auto-refresh (sync from localStorage periodically)
  const [livePresensi, setLivePresensi] = useState<PresensiRecord[]>(presensiList);

  useEffect(() => {
    setLivePresensi(presensiList);
  }, [presensiList]);

  useEffect(() => {
    const interval = setInterval(() => {
      setLivePresensi(apiService.getPresensiList());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const qrReaderRef = useRef<Html5Qrcode | null>(null);
  const scannerElementId = 'timekeeper-reader';

  const tkName = session.nama.trim().toLowerCase();
  const isAdmin = session.activeRole === 'ADMIN';

  // Peran timekeeper sesuai plot: hanya siswa, hanya walmur, atau keduanya
  const timekeeperRoles = useMemo(() => {
    if (isAdmin) return { siswa: true, walmur: true };
    const canSiswa = jadwalList.some(
      s => s.status === 'Aktif' && s.timekeeper_siswa.trim().toLowerCase() === tkName
    );
    const canWalmur = jadwalList.some(
      s => s.status === 'Aktif' && s.timekeeper_walmur.trim().toLowerCase() === tkName
    );
    return { siswa: canSiswa, walmur: canWalmur };
  }, [jadwalList, tkName, isAdmin]);

  // Sinkronkan mode presensi dengan peran timekeeper
  useEffect(() => {
    if (timekeeperRoles.siswa && !timekeeperRoles.walmur) setAttendanceType('Siswa');
    else if (!timekeeperRoles.siswa && timekeeperRoles.walmur) setAttendanceType('Walmur');
  }, [timekeeperRoles]);

  const canTakeAttendanceFor = (siswa: SiswaJadwal, type: 'Siswa' | 'Walmur'): boolean => {
    if (isAdmin) return true;
    if (type === 'Siswa') return siswa.timekeeper_siswa.trim().toLowerCase() === tkName;
    return siswa.timekeeper_walmur.trim().toLowerCase() === tkName;
  };

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (qrReaderRef.current) {
        if (qrReaderRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
          qrReaderRef.current.stop().catch(err => console.error('Error stopping QR scanner:', err));
        }
      }
    };
  }, []);

  const startScanner = async () => {
    setCameraError(null);
    try {
      if (!qrReaderRef.current) {
        qrReaderRef.current = new Html5Qrcode(scannerElementId);
      }
      if (qrReaderRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
        return;
      }

      // Show scanner container BEFORE starting so the video renders properly
      // (html5-qrcode cannot render into a display:none element on laptops/Mac).
      setIsScanning(true);

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };
      const onDetect = (decodedText: string) => handleCodeDetected(decodedText);

      try {
        // Try back camera first (mobile), then fall back to default webcam (laptop/Mac)
        await qrReaderRef.current.start({ facingMode: 'environment' }, config, onDetect, () => {});
      } catch (err) {
        await qrReaderRef.current.start({}, config, onDetect, () => {});
      }
    } catch (err: any) {
      console.error('Failed to start camera:', err);
      setCameraError('Gagal mengakses kamera. Pastikan izin kamera aktif atau gunakan form input manual ID.');
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (qrReaderRef.current) {
      try {
        if (qrReaderRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
          await qrReaderRef.current.stop();
        }
      } catch (err) {
        console.error('Failed to stop scanner:', err);
      }
    }
    setIsScanning(false);
  };

  const handleCodeDetected = (rawCode: string) => {
    const clean = rawCode.trim().toUpperCase();
    if (clean === lastScannedCode) return; // Prevent double rapid scan
    setLastScannedCode(clean);

    const student = apiService.getSiswaById(clean);
    if (student) {
      if (student.status !== 'Aktif') {
        showToast('Presensi Ditolak', `Siswa ${student.nama_siswa} tidak berstatus Aktif dan tidak dapat melakukan presensi.`, 'error');
        return;
      }
      if (!canTakeAttendanceFor(student, attendanceType)) {
        showToast('Presensi Ditolak', `Anda tidak bertugas sebagai ${attendanceType === 'Siswa' ? 'timekeeper siswa' : 'timekeeper orang tua'} untuk ${student.nama_siswa} (${student.id}).`, 'error');
        return;
      }
      setScannedStudent(student);
      // Play audio beep tone
      playAudioBeep();
      showToast('Scan Barcode Berhasil', `Data calon siswa ${student.nama_siswa} ditemukan.`, 'success');
    } else {
      showToast('ID Tidak Ditemukan', `Kode barcode "${clean}" tidak terdaftar dalam jadwal SPMB.`, 'error');
    }

    // Reset lastScannedCode after 3s to allow rescan
    setTimeout(() => {
      setLastScannedCode('');
    }, 3000);
  };

  const playAudioBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      // Audio context might be restricted before user gesture
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualId.trim().toUpperCase();
    if (!clean) return;

    const student = apiService.getSiswaById(clean);
    if (student) {
      if (student.status !== 'Aktif') {
        showToast('Presensi Ditolak', `Siswa ${student.nama_siswa} tidak berstatus Aktif dan tidak dapat melakukan presensi.`, 'error');
        return;
      }
      if (!canTakeAttendanceFor(student, attendanceType)) {
        showToast('Presensi Ditolak', `Anda tidak bertugas sebagai ${attendanceType === 'Siswa' ? 'timekeeper siswa' : 'timekeeper orang tua'} untuk ${student.nama_siswa} (${student.id}).`, 'error');
        return;
      }
      setScannedStudent(student);
      showToast('Data Ditemukan', `Calon siswa: ${student.nama_siswa}`, 'info');
    } else {
      showToast('Pencarian Gagal', `Siswa dengan ID "${clean}" tidak ditemukan.`, 'error');
    }
  };

  const handleConfirmAttendance = async () => {
    if (!scannedStudent) return;
    if (!canTakeAttendanceFor(scannedStudent, attendanceType)) {
      showToast('Presensi Ditolak', 'Siswa ini tidak berada dalam lingkup tugas Anda untuk mode presensi aktif.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiService.submitPresensi(
        scannedStudent.id,
        attendanceType,
        session.nama
      );

      if (res.success && res.record) {
        onAttendanceSubmitted(res.record);
        showToast('Presensi Berhasil!', res.message, 'success');
        setScannedStudent(null);
        setManualId('');
      } else {
        showToast('Presensi Ditolak', res.message, 'error');
      }
    } catch (err: any) {
      showToast('Kendala Teknis', err.message || 'Gagal mengirim data presensi ke server.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Schedule plot: students assigned to this timekeeper, sorted by session time
  const scheduleList = useMemo(() => {
    const list = isAdmin
      ? [...jadwalList]
      : jadwalList.filter(s =>
          s.timekeeper_siswa.trim().toLowerCase() === tkName ||
          s.timekeeper_walmur.trim().toLowerCase() === tkName
        );
    return list
      .filter(s => s.status === 'Aktif')
      .sort((a, b) => parseStartTimeMinutes(a.waktu_all) - parseStartTimeMinutes(b.waktu_all));
  }, [jadwalList, tkName, isAdmin]);

  const isPresent = (siswa: SiswaJadwal, type: 'Siswa' | 'Walmur') =>
    resolveKehadiran(siswa, livePresensi, type) === 'Hadir';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-[#1E3A8A] text-white rounded-2xl p-6 shadow-lg relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#D97706] text-white text-[10px] font-bold uppercase rounded-md">
            Meja Registrasi & Timekeeper
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Presensi Barcode / QR Peserta SPMB
          </h1>
          <p className="text-xs text-blue-100">
            Petugas Aktif: <strong className="text-amber-300">{session.nama}</strong>
          </p>
        </div>

        {/* Tipe Presensi Switcher */}
        {timekeeperRoles.siswa && timekeeperRoles.walmur ? (
          <div className="bg-blue-950/70 p-1.5 rounded-xl flex items-center gap-1 border border-blue-700/60 shrink-0">
            <button
              onClick={() => setAttendanceType('Siswa')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                attendanceType === 'Siswa'
                  ? 'bg-[#D97706] text-white shadow'
                  : 'text-blue-200 hover:text-white'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Presensi Siswa</span>
            </button>
            <button
              onClick={() => setAttendanceType('Walmur')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                attendanceType === 'Walmur'
                  ? 'bg-[#D97706] text-white shadow'
                  : 'text-blue-200 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Presensi Orang Tua</span>
            </button>
          </div>
        ) : timekeeperRoles.siswa ? (
          <div className="bg-blue-950/70 px-4 py-2.5 rounded-xl flex items-center gap-2 border border-blue-700/60 shrink-0 text-xs font-bold text-white">
            <User className="w-4 h-4 text-[#D97706]" />
            <span>Mode Presensi Siswa</span>
          </div>
        ) : timekeeperRoles.walmur ? (
          <div className="bg-blue-950/70 px-4 py-2.5 rounded-xl flex items-center gap-2 border border-blue-700/60 shrink-0 text-xs font-bold text-white">
            <Users className="w-4 h-4 text-[#D97706]" />
            <span>Mode Presensi Orang Tua</span>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Scanner & Manual Input (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-[#1E3A8A]" />
                <h2 className="text-sm font-bold text-slate-800">
                  Pemindai Barcode / QR Kamera
                </h2>
              </div>
              <button
                onClick={isScanning ? stopScanner : startScanner}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  isScanning
                    ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                    : 'bg-[#1E3A8A] text-white hover:bg-blue-900 shadow-sm'
                }`}
              >
                {isScanning ? (
                  <>
                    <CameraOff className="w-4 h-4" />
                    <span>Matikan Kamera</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 text-[#D97706]" />
                    <span>Aktifkan Kamera</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-6 flex items-center justify-center bg-slate-900 min-h-[300px] text-white relative">
              <div
                id={scannerElementId}
                className="w-full max-w-sm rounded-xl overflow-hidden min-h-[220px] flex items-center justify-center"
              ></div>

              {!isScanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-3 bg-slate-900/95 p-6">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-amber-400">
                    <QrCode className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">Kamera Pemindai Siap</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                      Klik "Aktifkan Kamera" lalu arahkan kamera ke barcode/QR kartu ujian peserta.
                    </p>
                  </div>
                  <button
                    onClick={startScanner}
                    className="px-4 py-2 bg-[#D97706] hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer"
                  >
                    Mulai Pindai Sekarang
                  </button>
                </div>
              )}

              {cameraError && (
                <div className="absolute bottom-4 left-4 right-4 p-3 bg-rose-900/90 border border-rose-700 text-rose-200 text-xs rounded-xl flex items-center gap-2 max-w-md mx-auto z-10">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
              <span>Mode aktif: <strong className="text-[#1E3A8A]">Presensi {attendanceType}</strong></span>
              <span className="text-[11px] text-slate-400">Auto-detect ID siswa secara instan</span>
            </div>
          </div>

          {/* Fallback Manual Input */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-3">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-[#1E3A8A]" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Input Manual ID Peserta (Tekan Enter Langsung Cari)
              </h3>
            </div>

            <form onSubmit={handleManualSearch} className="flex gap-2">
              <input
                type="text"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                placeholder="Contoh: SPMB-29-001"
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-[#1E3A8A] hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
              >
                Cari Peserta
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Scanned Confirmation Card (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Scanned Verification Card */}
          {scannedStudent ? (
            <div className="bg-white rounded-2xl shadow-md border-2 border-emerald-500 overflow-hidden animate-in fade-in zoom-in-95">
              <div className="bg-emerald-600 text-white px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                  <span className="text-xs font-extrabold uppercase tracking-wide">
                    Konfirmasi Presensi {attendanceType}
                  </span>
                </div>
                <span className="text-xs font-mono font-bold bg-white/20 px-2 py-0.5 rounded">
                  {scannedStudent.id}
                </span>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Nama Calon Siswa</span>
                  <h3 className="text-lg font-extrabold text-[#1E3A8A] leading-tight">
                    {scannedStudent.nama_siswa}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    <span className="font-bold text-[#1E3A8A]">{getJenjangFromKelas(scannedStudent.kelas)}</span> • <strong className="text-slate-800">{formatKelas(scannedStudent.kelas)}</strong> ({scannedStudent.gender === 'L' ? 'Laki-laki' : 'Perempuan'})
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Hari & Tanggal:</span>
                    <strong className="text-slate-800">{formatTanggalUjian(scannedStudent.hari_tanggal) || '-'}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Waktu Sesi:</span>
                    <strong className="text-[#1E3A8A] font-mono">{scannedStudent.waktu_all}</strong>
                  </div>
                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Ruangan Ujian Siswa:</span>
                      <strong className="text-slate-800">{scannedStudent.ruangan_siswa}</strong>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-slate-500 block font-bold">Penguji Ujian (sesuai urutan waktu):</span>
                      {getSortedSiswaExamStations(scannedStudent, getJenjangFromKelas(scannedStudent.kelas)).map((st, idx) => (
                        <div key={st.id} className="flex items-center justify-between gap-2">
                          <span className="text-slate-600">
                            <span className="inline-block w-4 font-bold text-[#1E3A8A]">{idx + 1}.</span>
                            {st.title} <span className="text-slate-400 font-mono">({st.posBadge})</span>
                          </span>
                          <strong className="text-slate-800 text-right">{st.penguji}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Ruang Wawancara Orang Tua:</span>
                      <strong className="text-slate-800">{scannedStudent.ruangan_walmur}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Pewawancara Orang Tua:</span>
                      <strong className="text-[#1E3A8A]">{scannedStudent.interview_walmur}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setScannedStudent(null)}
                    className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleConfirmAttendance}
                    disabled={submitting}
                    className="flex-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-75"
                  >
                    {submitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>Simpan Kehadiran ({attendanceType})</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-6 border border-dashed border-slate-300 text-center text-slate-500 space-y-2">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Menunggu Pemindaian / Input ID
              </h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Arahkan kamera ke kartu ujian siswa atau ketik ID di form untuk menampilkan kartu konfirmasi kehadiran.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Plot Jadwal Ujian */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-[#1E3A8A]" />
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Plot Jadwal Ujian Hari Ini
            </h2>
          </div>
          <span className="text-[11px] font-bold text-[#D97706]">
            {scheduleList.length} Peserta
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#1E3A8A] text-white font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3">Waktu Sesi</th>
                <th className="p-3">Nama Siswa</th>
                <th className="p-3">Gender</th>
                <th className="p-3">Jenjang</th>
                <th className="p-3">Ruangan</th>
                <th className="p-3">Status Presensi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {scheduleList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">
                    Tidak ada jadwal peserta yang ditugaskan kepada Anda.
                  </td>
                </tr>
              ) : (
                scheduleList.map((s) => {
                  const present = isPresent(s, attendanceType);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono font-bold text-[#1E3A8A] whitespace-nowrap">{s.waktu_all}</td>
                      <td className="p-3 font-bold text-slate-900">
                        {s.nama_siswa}
                        <span className="block text-[10px] text-slate-400 font-normal font-mono">{s.id}</span>
                      </td>
                      <td className="p-3 text-slate-700">{s.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-100 text-[#1E3A8A]">
                          {getJenjangFromKelas(s.kelas)}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600">{s.ruangan_siswa}</td>
                      <td className="p-3">
                        {present ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Hadir
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
                            <AlertCircle className="w-3.5 h-3.5" /> Belum Hadir
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
