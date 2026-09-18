import React, { useState, useMemo, useEffect } from 'react';
import { 
  Shield, 
  Users, 
  CheckCircle2, 
  BarChart3, 
  Download, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  ExternalLink, 
  Copy, 
  Check, 
  Code, 
  Database, 
  Clock, 
  FileSpreadsheet, 
  RefreshCw, 
  Filter, 
  X, 
  Save,
  Printer 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SiswaJadwal, PresensiRecord, NilaiRecord, UserSession, KategoriUjian, formatKelas, getJenjangFromKelas, parseStartTimeMinutes } from '../types/spmb';
import { apiService } from '../services/apiService';
import { GOOGLE_APPS_SCRIPT_CODE } from '../services/gasCode';
import { SPREADSHEET_URL, SCHOOL_LOGO_URL } from '../data/mockData';
import { RubrikModal } from './RubrikModal';

interface AdminDashboardProps {
  session: UserSession;
  jadwalList: SiswaJadwal[];
  presensiList: PresensiRecord[];
  nilaiList: NilaiRecord[];
  onDataChanged: () => void;
  showToast: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  session,
  jadwalList,
  presensiList,
  nilaiList,
  onDataChanged,
  showToast
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'kpi' | 'jadwal' | 'presensi' | 'nilai' | 'export' | 'gas' | 'cetak'>('kpi');
  const [searchFilter, setSearchFilter] = useState('');

  // Print target state untuk cetak jadwal per ruangan
  const [printTarget, setPrintTarget] = useState<null | { group: 'siswa' | 'walmur'; room: string | null }>(null);
  
  // GAS Web App URL state
  const [gasUrl, setGasUrl] = useState(apiService.getGasUrl());
  const [copiedCode, setCopiedCode] = useState(false);
  const [savingGasUrl, setSavingGasUrl] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Student CRUD Modal State
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [studentFormData, setStudentFormData] = useState<SiswaJadwal>({
    id: '',
    nama_siswa: '',
    kelas: 'SD 1',
    gender: 'L',
    nomor_walmur: '',
    email_walmur: '',
    grade: 'SD',
    ruangan_siswa: 'R. 101',
    ord_alq_arab: 'Pos 1 (08.00 - 08.45)',
    ord_catung_eng: 'Pos 2 (08.45 - 09.30)',
    waktu_all: '08.00 - 10.30 WIB',
    waktu_alq_arab: '08.00 - 08.45 WIB',
    waktu_catung_eng: '08.45 - 09.30 WIB',
    ruangan_walmur: 'R. Audiovisual 1',
    penguji_alq_arab: 'Ustadz Ihsan Al-Hafidz',
    penguji_catung_eng: 'Ustadzah Siti Maryam, S.Pd.',
    timekeeper_siswa: 'Ustadz Bambang Hermanto',
    interview_walmur: 'Ustadzah Dewi Sartika, S.Psi.',
    timekeeper_walmur: 'Ustadzah Fatimah Zahra',
    waktu_interview: '09.30 - 10.15 WIB',
    hari_tanggal: 'Minggu, 20 September 2026',
    status: 'Aktif'
  });

  // Admin Grade Edit Modal
  const [editingGradeStudent, setEditingGradeStudent] = useState<SiswaJadwal | null>(null);
  const [editingGradeKategori, setEditingGradeKategori] = useState<KategoriUjian>('Calistung');
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);

  // KPI Calculations
  const kpiData = useMemo(() => {
    const totalSiswa = jadwalList.length;

    // Student Attendance
    const hadirSiswaIds = new Set(presensiList.filter(p => p.tipe_presensi === 'Siswa').map(p => p.id_siswa));
    const hadirSiswaCount = hadirSiswaIds.size;
    const hadirSiswaPercent = totalSiswa ? Math.round((hadirSiswaCount / totalSiswa) * 100) : 0;

    // Walmur Attendance
    const hadirWalmurIds = new Set(presensiList.filter(p => p.tipe_presensi === 'Walmur').map(p => p.id_siswa));
    const hadirWalmurCount = hadirWalmurIds.size;
    const hadirWalmurPercent = totalSiswa ? Math.round((hadirWalmurCount / totalSiswa) * 100) : 0;

    // Grades completion
    const quranDoneIds = new Set(
      nilaiList.filter(n => n.kategori_ujian === 'Al-Quran SD' || n.kategori_ujian === 'Al-Quran SMP/SMA').map(n => n.id_siswa)
    );
    const catungEngDoneIds = new Set(
      nilaiList.filter(n => n.kategori_ujian === 'Calistung' || n.kategori_ujian === 'English').map(n => n.id_siswa)
    );
    const interviewDoneIds = new Set(
      nilaiList.filter(n => n.kategori_ujian === 'Interview Walmur').map(n => n.id_siswa)
    );

    return {
      totalSiswa,
      hadirSiswaCount,
      hadirSiswaPercent,
      hadirWalmurCount,
      hadirWalmurPercent,
      quranDoneCount: quranDoneIds.size,
      quranDonePercent: totalSiswa ? Math.round((quranDoneIds.size / totalSiswa) * 100) : 0,
      catungEngDoneCount: catungEngDoneIds.size,
      catungEngDonePercent: totalSiswa ? Math.round((catungEngDoneIds.size / totalSiswa) * 100) : 0,
      interviewDoneCount: interviewDoneIds.size,
      interviewDonePercent: totalSiswa ? Math.round((interviewDoneIds.size / totalSiswa) * 100) : 0,
    };
  }, [jadwalList, presensiList, nilaiList]);

  // Handle Save Student (Add or Edit)
  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentFormData.id.trim() || !studentFormData.nama_siswa.trim()) {
      showToast('Form Tidak Lengkap', 'ID dan Nama Siswa wajib diisi!', 'error');
      return;
    }

    const res = apiService.saveJadwal(studentFormData, isEditMode);
    if (res.success) {
      showToast('Berhasil', res.message, 'success');
      setIsStudentModalOpen(false);
      onDataChanged();
    } else {
      showToast('Gagal', res.message, 'error');
    }
  };

  const handleDeleteStudent = (id: string, name: string) => {
    if (window.confirm(`Yakin ingin menghapus calon siswa "${name}" (${id}) dari jadwal?`)) {
      const res = apiService.deleteJadwal(id);
      if (res.success) {
        showToast('Dihapus', res.message, 'info');
        onDataChanged();
      } else {
        showToast('Gagal', res.message, 'error');
      }
    }
  };

  const handleChangeStudentStatus = (siswa: SiswaJadwal, nextStatus: SiswaJadwal['status']) => {
    if (nextStatus === siswa.status) return;
    const label: Record<SiswaJadwal['status'], string> = {
      Aktif: 'mengaktifkan kembali',
      Reschedule: 'menandai Reschedule',
      Selesai: 'menandai Selesai',
    };
    if (window.confirm(`Yakin ingin ${label[nextStatus]} "${siswa.nama_siswa}" (${siswa.id})?`)) {
      const res = apiService.saveJadwal({ ...siswa, status: nextStatus }, true);
      if (res.success) {
        showToast(nextStatus === 'Selesai' ? 'Ditandai Selesai' : nextStatus === 'Reschedule' ? 'Diubah ke Reschedule' : 'Diaktifkan', res.message, 'success');
        onDataChanged();
      } else {
        showToast('Gagal', res.message, 'error');
      }
    }
  };

  const openAddStudentModal = () => {
    const nextNum = (jadwalList.length + 1).toString().padStart(3, '0');
    setStudentFormData({
      id: `SPMB-29-${nextNum}`,
      nama_siswa: '',
      kelas: 'SD 1',
      gender: 'L',
      nomor_walmur: '',
      email_walmur: '',
      grade: 'SD',
      ruangan_siswa: 'R. 101',
      ord_alq_arab: 'Pos 1 (08.00 - 08.45)',
      ord_catung_eng: 'Pos 2 (08.45 - 09.30)',
      waktu_all: '08.00 - 10.30 WIB',
      waktu_alq_arab: '08.00 - 08.45 WIB',
      waktu_catung_eng: '08.45 - 09.30 WIB',
      ruangan_walmur: 'R. Audiovisual 1',
      penguji_alq_arab: 'Ustadz Ihsan Al-Hafidz',
      penguji_catung_eng: 'Ustadzah Siti Maryam, S.Pd.',
      timekeeper_siswa: 'Ustadz Bambang Hermanto',
      interview_walmur: 'Ustadzah Dewi Sartika, S.Psi.',
      timekeeper_walmur: 'Ustadzah Fatimah Zahra',
      waktu_interview: '09.30 - 10.15 WIB',
      hari_tanggal: 'Minggu, 20 September 2026',
      status: 'Aktif'
    });
    setIsEditMode(false);
    setIsStudentModalOpen(true);
  };

  const openEditStudentModal = (siswa: SiswaJadwal) => {
    setStudentFormData({ ...siswa });
    setIsEditMode(true);
    setIsStudentModalOpen(true);
  };

  // Handle Edit Grade from Admin
  const openEditGrade = (nilai: NilaiRecord) => {
    const siswa = jadwalList.find(s => s.id.toUpperCase() === nilai.id_siswa.toUpperCase());
    if (siswa) {
      setEditingGradeStudent(siswa);
      setEditingGradeKategori(nilai.kategori_ujian);
      setIsGradeModalOpen(true);
    } else {
      showToast('Error', 'Data siswa tidak ditemukan di jadwal.', 'error');
    }
  };

  const handleDeleteGrade = (id: string) => {
    if (window.confirm('Hapus entri penilaian ini?')) {
      apiService.deleteNilai(id);
      showToast('Berhasil', 'Entri nilai dihapus.', 'info');
      onDataChanged();
    }
  };

  const handleDeletePresensi = (id: string) => {
    if (window.confirm('Hapus entri presensi ini?')) {
      apiService.deletePresensi(id);
      showToast('Berhasil', 'Entri presensi dihapus.', 'info');
      onDataChanged();
    }
  };

  // Export to Excel Workbook
  const handleExportWorkbook = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Jadwal Siswa
      const wsJadwal = XLSX.utils.json_to_sheet(jadwalList);
      XLSX.utils.book_append_sheet(wb, wsJadwal, 'web_jadwal');

      // Sheet 2: Presensi
      const wsPresensi = XLSX.utils.json_to_sheet(presensiList);
      XLSX.utils.book_append_sheet(wb, wsPresensi, 'web_presensi');

      // Sheet 3: Rekap Nilai
      const flatNilai = nilaiList.map(n => ({
        timestamp: n.timestamp,
        id_siswa: n.id_siswa,
        nama_siswa: n.nama_siswa,
        kategori_ujian: n.kategori_ujian,
        nama_penguji: n.nama_penguji,
        email_penguji: n.email_penguji,
        skor_akhir_rata2: n.skor_akhir_rata2,
        catatan_umum: n.catatan_umum,
        detail_skor: JSON.stringify(n.detail_skor_json)
      }));
      const wsNilai = XLSX.utils.json_to_sheet(flatNilai);
      XLSX.utils.book_append_sheet(wb, wsNilai, 'web_nilai');

      // Download
      XLSX.writeFile(wb, `REKAP_SPMB_ALWILDAN29_${Date.now()}.xlsx`);
      showToast('Ekspor Berhasil', 'File Excel (.xlsx) lengkap berhasil diunduh.', 'success');
    } catch (err: any) {
      showToast('Ekspor Gagal', err.message || 'Gagal membuat file excel.', 'error');
    }
  };

  // Copy Code.gs
  const handleCopyGasCode = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopiedCode(true);
    showToast('Tersalin!', 'Script Code.gs berhasil disalin ke clipboard.', 'success');
    setTimeout(() => setCopiedCode(false), 3000);
  };

  // Save GAS Endpoint URL
  const handleSaveGasUrl = () => {
    setSavingGasUrl(true);
    apiService.setGasUrl(gasUrl);
    setTimeout(() => {
      setSavingGasUrl(false);
      showToast('Tersimpan', 'URL Web App Google Apps Script berhasil diperbarui.', 'success');
    }, 400);
  };

  // Live Sync with Google Spreadsheet
  const handleSyncFromSpreadsheet = async () => {
    setIsSyncing(true);
    try {
      const res = await apiService.syncFromGas();
      if (res.success) {
        showToast('Sinkronisasi Berhasil', res.message, 'success');
        onDataChanged();
      } else {
        showToast('Sinkronisasi Info', res.message, 'info');
      }
    } catch (err: any) {
      showToast('Gagal Sinkron', err.message || 'Terjadi kesalahan saat mengambil data.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // ====== CETAK RUANGAN ======
  const buildRoomGroups = (
    getRoom: (s: SiswaJadwal) => string,
    getTime: (s: SiswaJadwal) => string,
  ): { room: string; date: string; siswa: SiswaJadwal[] }[] => {
    const map = new Map<string, SiswaJadwal[]>();
    jadwalList.forEach(s => {
      const key = getRoom(s) || 'Tanpa Ruangan';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return Array.from(map.entries())
      .map(([room, siswa]) => ({
        room,
        date: siswa[0]?.hari_tanggal || '',
        siswa: [...siswa].sort((a, b) => {
          const ta = parseStartTimeMinutes(getTime(a));
          const tb = parseStartTimeMinutes(getTime(b));
          if (ta !== tb) return ta - tb;
          return a.nama_siswa.localeCompare(b.nama_siswa);
        }),
      }))
      .sort((a, b) => a.room.localeCompare(b.room, undefined, { numeric: true, sensitivity: 'base' }));
  };

  const siswaRoomGroups = useMemo(() => buildRoomGroups(s => s.ruangan_siswa, s => s.waktu_all), [jadwalList]);
  const walmurRoomGroups = useMemo(() => buildRoomGroups(s => s.ruangan_walmur, s => s.waktu_interview), [jadwalList]);

  const triggerPrint = (group: 'siswa' | 'walmur', room: string | null) => {
    setPrintTarget({ group, room });
    setTimeout(() => {
      window.print();
    }, 150);
  };

  useEffect(() => {
    const clearTarget = () => setPrintTarget(null);
    window.addEventListener('afterprint', clearTarget);
    return () => window.removeEventListener('afterprint', clearTarget);
  }, []);

  const printRoomRows = (siswa: SiswaJadwal[], group: 'siswa' | 'walmur') =>
    siswa.map((s, idx) => (
      <tr key={s.id} className="even:bg-slate-50">
        <td className="p-2 font-mono">{idx + 1}</td>
        <td className="p-2 font-mono">{s.id}</td>
        <td className="p-2 font-bold">{s.nama_siswa}</td>
        <td className="p-2">{getJenjangFromKelas(s.kelas, s.grade)} • {formatKelas(s.kelas)}</td>
        <td className="p-2">{s.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</td>
        <td className="p-2 font-mono">{group === 'siswa' ? s.waktu_all : s.waktu_interview}</td>
      </tr>
    ));

  const renderPrintBlocks = (group: 'siswa' | 'walmur') => {
    const groups = group === 'siswa' ? siswaRoomGroups : walmurRoomGroups;
    const roomFilter = printTarget && printTarget.group === group ? printTarget.room : null;
    const title = group === 'siswa' ? 'Ruang Ujian Siswa' : 'Ruang Wawancara Orang Tua';
    return groups
      .filter(g => !roomFilter || g.room === roomFilter)
      .map(g => {
        const first = g.siswa[0];
        return (
          <div key={group + g.room} className="print-block">
            <div className="text-center mb-2">
              <img
                src={SCHOOL_LOGO_URL}
                alt="Al-Wildan 29"
                className="w-14 h-14 mx-auto object-contain mb-1"
              />
              <div className="text-sm font-black">SPMB AL-WILDAN 29 — Daftar {title} per Ruangan</div>
              <div className="text-xs font-bold">
                {g.room} — {g.date || 'Tanggal tidak tercantum'}
              </div>
            </div>
            <table className="print-table mt-2">
              <thead>
                <tr>
                  <th>No</th>
                  <th>ID Siswa</th>
                  <th>Nama Siswa</th>
                  <th>Unit & Kelas</th>
                  <th>Gender</th>
                  <th>Waktu</th>
                </tr>
              </thead>
              <tbody>{printRoomRows(g.siswa, group)}</tbody>
            </table>
            <div className="mt-3 text-[11px] space-y-1">
              {group === 'siswa' ? (
                <>
                  <div>Penguji Al-Qur'an/Arab: <strong>{first?.penguji_alq_arab || '-'}</strong></div>
                  <div>Penguji Calistung/English: <strong>{first?.penguji_catung_eng || '-'}</strong></div>
                  <div>Timekeeper Siswa: <strong>{first?.timekeeper_siswa || '-'}</strong></div>
                </>
              ) : (
                <>
                  <div>Pewawancara Orang Tua: <strong>{first?.interview_walmur || '-'}</strong></div>
                  <div>Timekeeper Orang Tua: <strong>{first?.timekeeper_walmur || '-'}</strong></div>
                </>
              )}
            </div>
          </div>
        );
      });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Admin Title Banner */}
      <div className="bg-[#1E3A8A] text-white rounded-2xl p-6 shadow-lg relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#D97706] text-white text-[10px] font-bold uppercase rounded-md">
            Super Administrator Portal
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Controlling Center SPMB Al-Wildan 29
          </h1>
          <p className="text-xs text-blue-100">
            Akses Penuh: <strong className="text-amber-300">Admin</strong> • Manajemen CRUD & Live Monitoring
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSyncFromSpreadsheet}
            disabled={isSyncing}
            className="px-3 py-2 bg-[#D97706] hover:bg-amber-600 active:scale-[0.98] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition-all cursor-pointer disabled:opacity-75"
            title="Sinkronkan data terbaru langsung dari Google Spreadsheet"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Spreadsheet'}</span>
          </button>

          <a
            href={SPREADSHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 bg-blue-900/80 hover:bg-blue-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-blue-700/60 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Buka Sheet</span>
            <ExternalLink className="w-3.5 h-3.5 text-blue-300" />
          </a>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setActiveSubTab('kpi')}
          className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeSubTab === 'kpi'
              ? 'bg-[#1E3A8A] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-amber-300" />
          <span>Live Monitoring (KPI)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('jadwal')}
          className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeSubTab === 'jadwal'
              ? 'bg-[#1E3A8A] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4 text-[#D97706]" />
          <span>Kelola Jadwal ({jadwalList.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('presensi')}
          className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeSubTab === 'presensi'
              ? 'bg-[#1E3A8A] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Rekap Presensi ({presensiList.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('nilai')}
          className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeSubTab === 'nilai'
              ? 'bg-[#1E3A8A] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-blue-300" />
          <span>Rekapitulasi Nilai ({nilaiList.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('export')}
          className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeSubTab === 'export'
              ? 'bg-[#1E3A8A] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Download className="w-4 h-4 text-[#D97706]" />
          <span>Ekspor Excel / CSV</span>
        </button>

        <button
          onClick={() => setActiveSubTab('cetak')}
          className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeSubTab === 'cetak'
              ? 'bg-[#1E3A8A] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Printer className="w-4 h-4 text-[#D97706]" />
          <span>Cetak Ruangan</span>
        </button>

        <button
          onClick={() => setActiveSubTab('gas')}
          className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeSubTab === 'gas'
              ? 'bg-[#D97706] text-white shadow'
              : 'text-amber-800 hover:bg-amber-50'
          }`}
        >
          <Code className="w-4 h-4" />
          <span>Backend GAS & Setup</span>
        </button>
      </div>

      {/* TAB 1: KPI & MONITORING */}
      {activeSubTab === 'kpi' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Total Siswa */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Total Calon Siswa</span>
                <Users className="w-5 h-5 text-[#1E3A8A]" />
              </div>
              <div className="text-3xl font-extrabold text-[#1E3A8A] font-mono">
                {kpiData.totalSiswa}
              </div>
              <p className="text-[11px] text-slate-500">Terdaftar di sheet jadwal SPMB</p>
            </div>

            {/* Presensi Siswa */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Kehadiran Siswa</span>
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-700 font-mono">
                  {kpiData.hadirSiswaPercent}%
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  ({kpiData.hadirSiswaCount}/{kpiData.totalSiswa} Hadir)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${kpiData.hadirSiswaPercent}%` }}
                ></div>
              </div>
            </div>

            {/* Presensi Walmur */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Kehadiran Wali Murid</span>
                <Users className="w-5 h-5 text-[#D97706]" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-[#D97706] font-mono">
                  {kpiData.hadirWalmurPercent}%
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  ({kpiData.hadirWalmurCount}/{kpiData.totalSiswa} Hadir)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#D97706] h-2 rounded-full transition-all duration-500"
                  style={{ width: `${kpiData.hadirWalmurPercent}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Pos Pengujian Progress */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Statistik Penyelesaian Penilaian per Pos Ujian
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Pos Qur'an & Arab */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800">Pos Al-Qur'an & B. Arab</span>
                  <span className="font-mono font-bold text-[#1E3A8A]">
                    {kpiData.quranDoneCount} / {kpiData.totalSiswa}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-[#1E3A8A] h-2.5 rounded-full"
                    style={{ width: `${kpiData.quranDonePercent}%` }}
                  ></div>
                </div>
                <div className="text-[11px] text-slate-500 text-right font-medium">
                  {kpiData.quranDonePercent}% Selesai
                </div>
              </div>

              {/* Pos Calistung / English */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800">Pos Calistung / English</span>
                  <span className="font-mono font-bold text-[#D97706]">
                    {kpiData.catungEngDoneCount} / {kpiData.totalSiswa}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-[#D97706] h-2.5 rounded-full"
                    style={{ width: `${kpiData.catungEngDonePercent}%` }}
                  ></div>
                </div>
                <div className="text-[11px] text-slate-500 text-right font-medium">
                  {kpiData.catungEngDonePercent}% Selesai
                </div>
              </div>

              {/* Wawancara Orang Tua */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800">Wawancara Orang Tua</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {kpiData.interviewDoneCount} / {kpiData.totalSiswa}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-2.5 rounded-full"
                    style={{ width: `${kpiData.interviewDonePercent}%` }}
                  ></div>
                </div>
                <div className="text-[11px] text-slate-500 text-right font-medium">
                  {kpiData.interviewDonePercent}% Selesai
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: JADWAL CRUD */}
      {activeSubTab === 'jadwal' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Cari siswa, nomor walmur, ruangan..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
              />
            </div>

            <button
              onClick={openAddStudentModal}
              className="px-4 py-2 bg-[#1E3A8A] hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#D97706]" />
              <span>Tambah Calon Siswa</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1E3A8A] text-white font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3">ID Siswa</th>
                    <th className="p-3">Nama Siswa</th>
                    <th className="p-3">Gender</th>
                    <th className="p-3">Unit & Kelas</th>
                    <th className="p-3">Ruang Siswa</th>
                    <th className="p-3">Penguji Qur'an/Arab</th>
                    <th className="p-3">Penguji Catung/Eng</th>
                    <th className="p-3">Wawancara Orang Tua</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {jadwalList
                    .filter(s => 
                      !searchFilter || 
                      s.nama_siswa.toLowerCase().includes(searchFilter.toLowerCase()) ||
                      s.id.toLowerCase().includes(searchFilter.toLowerCase()) ||
                      s.kelas.toLowerCase().includes(searchFilter.toLowerCase())
                    )
                    .map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-mono font-bold text-[#1E3A8A]">{s.id}</td>
                        <td className="p-3 font-bold text-slate-900">
                          {s.nama_siswa}
                          <span className="block text-[10px] text-slate-400 font-normal">
                            Kontak: {s.nomor_walmur}
                          </span>
                        </td>
                        <td className="p-3 text-slate-700">{s.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-[#D97706] text-white text-[10px] font-black rounded uppercase inline-block">
                            {getJenjangFromKelas(s.kelas, s.grade)}
                          </span>
                          <span className="block mt-1 font-bold text-[#1E3A8A]">
                            {formatKelas(s.kelas)}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-slate-700">{s.ruangan_siswa}</td>
                        <td className="p-3 text-slate-600 truncate max-w-[140px]">{s.penguji_alq_arab}</td>
                        <td className="p-3 text-slate-600 truncate max-w-[140px]">{s.penguji_catung_eng}</td>
                        <td className="p-3 text-slate-700 truncate max-w-[160px]">
                          <strong>{s.interview_walmur}</strong>
                          <span className="block text-[10px] text-slate-400 font-normal">{s.ruangan_walmur}</span>
                        </td>
                        <td className="p-3">
                          <select
                            value={s.status || 'Aktif'}
                            onChange={(e) => handleChangeStudentStatus(s, e.target.value as SiswaJadwal['status'])}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/30 ${
                              s.status === 'Selesai'
                                ? 'bg-slate-200 text-slate-600 border-slate-300'
                                : s.status === 'Reschedule'
                                ? 'bg-amber-100 text-amber-700 border-amber-300'
                                : 'bg-emerald-100 text-emerald-700 border-emerald-300'
                            }`}
                            title="Ubah status siswa"
                          >
                            <option value="Aktif">Aktif</option>
                            <option value="Reschedule">Reschedule</option>
                            <option value="Selesai">Selesai</option>
                          </select>
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => openEditStudentModal(s)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors mr-1"
                            title="Edit Data Jadwal"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(s.id, s.nama_siswa)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Hapus Siswa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PRESENSI TABLE */}
      {activeSubTab === 'presensi' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
              Rekapitulasi Sheet web_presensi
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              Total Entri: {presensiList.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1E3A8A] text-white uppercase text-[10px]">
                <tr>
                  <th className="p-3">Waktu Presensi</th>
                  <th className="p-3">ID Siswa</th>
                  <th className="p-3">Nama Siswa</th>
                  <th className="p-3">Tipe</th>
                  <th className="p-3">Petugas Timekeeper</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {presensiList.map((p) => (
                  <tr key={p.id || p.timestamp} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-slate-500">{p.timestamp}</td>
                    <td className="p-3 font-mono font-bold text-[#1E3A8A]">{p.id_siswa}</td>
                    <td className="p-3 font-bold text-slate-800">{p.nama_siswa}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        p.tipe_presensi === 'Siswa' ? 'bg-blue-100 text-[#1E3A8A]' : 'bg-amber-100 text-amber-900'
                      }`}>
                        {p.tipe_presensi}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600">{p.petugas_timekeeper}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{p.status}</span>
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {p.id && (
                        <button
                          onClick={() => handleDeletePresensi(p.id!)}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                          title="Hapus Entri Presensi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: NILAI TABLE (WITH EDIT GRADE) */}
      {activeSubTab === 'nilai' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
              Rekapitulasi Sheet web_nilai (Hasil Penilaian Ujian)
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              Total Input Nilai: {nilaiList.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1E3A8A] text-white uppercase text-[10px]">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">ID Siswa</th>
                  <th className="p-3">Nama Siswa</th>
                  <th className="p-3">Kategori Ujian</th>
                  <th className="p-3">Skor Rata2</th>
                  <th className="p-3">Penguji</th>
                  <th className="p-3">Catatan</th>
                  <th className="p-3 text-right">Koreksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {nilaiList.map((n) => (
                  <tr key={n.id || `${n.id_siswa}-${n.kategori_ujian}`} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-slate-500">{n.timestamp}</td>
                    <td className="p-3 font-mono font-bold text-[#1E3A8A]">{n.id_siswa}</td>
                    <td className="p-3 font-bold text-slate-800">{n.nama_siswa}</td>
                    <td className="p-3 font-semibold text-slate-700">{n.kategori_ujian}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 font-bold font-mono rounded">
                        {n.skor_akhir_rata2.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600 truncate max-w-[120px]">{n.nama_penguji}</td>
                    <td className="p-3 text-slate-500 italic truncate max-w-[160px]">{n.catatan_umum || '-'}</td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => openEditGrade(n)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg mr-1"
                        title="Koreksi Nilai Sebagai Admin"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      {n.id && (
                        <button
                          onClick={() => handleDeleteGrade(n.id!)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                          title="Hapus Nilai"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: EXPORT DATA */}
      {activeSubTab === 'export' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6 max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-[#D97706] flex items-center justify-center">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Ekspor Data Rekapitulasi SPMB
              </h3>
              <p className="text-xs text-slate-500">
                Unduh seluruh data jadwal, kehadiran, dan penilaian peserta ke format Microsoft Excel (.xlsx)
              </p>
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-950 space-y-2">
            <div className="font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#1E3A8A]" />
              <span>Format Rekapitulasi Terpadu Al-Wildan 29</span>
            </div>
            <p className="leading-relaxed">
              File Excel yang diunduh mencakup 3 worksheet terpisah: <strong>web_jadwal</strong>, <strong>web_presensi</strong>, dan <strong>web_nilai</strong> (termasuk rincian skor JSON per pos ujian).
            </p>
          </div>

          <button
            onClick={handleExportWorkbook}
            className="w-full py-3.5 px-4 bg-[#1E3A8A] hover:bg-blue-900 active:scale-[0.99] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <FileSpreadsheet className="w-5 h-5 text-[#D97706]" />
            <span>Unduh File Excel Rekapitulasi (.XLSX)</span>
          </button>
        </div>
      )}

      {/* TAB 6: GOOGLE APPS SCRIPT BACKEND & DEPLOYMENT */}
      {activeSubTab === 'gas' && (
        <div className="space-y-6">
          {/* Endpoint URL configuration */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-[#1E3A8A]" />
                <h3 className="text-sm font-bold text-slate-900">
                  Konfigurasi Web App URL Google Apps Script
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                Hybrid Cloud Sync
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Aplikasi ini beroperasi dengan persistensi lokal berkinerja tinggi dan dapat disinkronkan secara langsung ke Google Spreadsheet Al-Wildan 29 melalui Web App URL Google Apps Script di bawah ini:
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={gasUrl}
                onChange={(e) => setGasUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
              />
              <button
                onClick={handleSaveGasUrl}
                disabled={savingGasUrl}
                className="px-4 py-2.5 bg-[#1E3A8A] hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-70"
              >
                <Save className="w-4 h-4 text-[#D97706]" />
                <span>{savingGasUrl ? 'Menyimpan...' : 'Simpan URL'}</span>
              </button>
              <button
                onClick={handleSyncFromSpreadsheet}
                disabled={isSyncing}
                className="px-4 py-2.5 bg-[#D97706] hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-70"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Menyinkronkan...' : 'Tarik Data Sheet'}</span>
              </button>
            </div>
          </div>

          {/* Deployment Step-by-Step Guide */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-[#D97706]" />
                <h3 className="text-sm font-bold text-slate-900">
                  Instruksi Deployment Google Apps Script (Code.gs)
                </h3>
              </div>
              <button
                onClick={handleCopyGasCode}
                className="px-3.5 py-1.5 bg-[#1E3A8A] hover:bg-blue-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-[#D97706]" />}
                <span>{copiedCode ? 'Tersalin!' : 'Salin Script Code.gs'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs text-slate-600">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="w-5 h-5 rounded-full bg-[#1E3A8A] text-white flex items-center justify-center font-bold text-[10px]">
                  1
                </span>
                <strong className="block text-slate-800">Buka Spreadsheet</strong>
                <p>Buka Spreadsheet SPMB Al-Wildan, lalu klik menu <strong>Extensions &gt; Apps Script</strong>.</p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="w-5 h-5 rounded-full bg-[#1E3A8A] text-white flex items-center justify-center font-bold text-[10px]">
                  2
                </span>
                <strong className="block text-slate-800">Tempel Code.gs</strong>
                <p>Hapus seluruh kode bawaan di editor, lalu paste kode yang telah disalin dari tombol di atas.</p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="w-5 h-5 rounded-full bg-[#D97706] text-white flex items-center justify-center font-bold text-[10px]">
                  3
                </span>
                <strong className="block text-slate-800">Deploy as Web App</strong>
                <p>Klik tombol <strong>Deploy &gt; New deployment</strong>. Pilih type <strong>Web App</strong>.</p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-[10px]">
                  4
                </span>
                <strong className="block text-slate-800">Atur Hak Akses</strong>
                <p>Set <em>Execute as: Me</em> dan <em>Who has access: Anyone</em>. Salin URL Web App ke kolom di atas.</p>
              </div>
            </div>

            {/* Code Box Preview */}
            <div className="relative mt-4">
              <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto max-h-60 border border-slate-800">
                {GOOGLE_APPS_SCRIPT_CODE}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: CETAK RUANGAN */}
      {activeSubTab === 'cetak' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber-50 text-[#D97706] flex items-center justify-center">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Cetak Daftar Siswa per Ruangan</h3>
                  <p className="text-[11px] text-slate-500">
                    Tampilkan daftar siswa lengkap dengan penguji dan timekeeper; cetak semua sekaligus (halaman per ruangan) atau per ruangan.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => triggerPrint('siswa', null)}
                  className="px-3.5 py-2 bg-[#1E3A8A] hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-[#D97706]" />
                  <span>Cetak Semua Ruang Ujian</span>
                </button>
                <button
                  onClick={() => triggerPrint('walmur', null)}
                  className="px-3.5 py-2 bg-[#D97706] hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Semua Ruang Wawancara</span>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Ruang Ujian Siswa ({siswaRoomGroups.length})</h4>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {siswaRoomGroups.length === 0 && (
                  <div className="bg-white rounded-2xl p-6 border border-dashed border-slate-300 text-center text-xs text-slate-400">
                    Tidak ada data ruangan ujian siswa.
                  </div>
                )}
                {siswaRoomGroups.map(g => (
                  <div key={'s-' + g.room} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-[#1E3A8A] text-white px-4 py-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-extrabold text-sm">{g.room}</div>
                        <div className="text-[10px] text-blue-200">{g.date || 'Tanggal tidak tercantum'} • {g.siswa.length} siswa</div>
                      </div>
                      <button
                        onClick={() => triggerPrint('siswa', g.room)}
                        className="px-2.5 py-1.5 bg-white text-[#1E3A8A] hover:bg-blue-50 font-bold text-[10px] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" /> Cetak
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[9px] tracking-wider">
                          <tr>
                            <th className="p-2">No</th>
                            <th className="p-2">Nama Siswa</th>
                            <th className="p-2">ID</th>
                            <th className="p-2">Unit & Kelas</th>
                            <th className="p-2">Gender</th>
                            <th className="p-2">Waktu</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">{printRoomRows(g.siswa, 'siswa')}</tbody>
                      </table>
                    </div>
                    <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-600 space-y-0.5">
                      <div>Penguji Al-Qur'an/Arab: <strong className="text-slate-800">{g.siswa[0]?.penguji_alq_arab || '-'}</strong></div>
                      <div>Penguji Calistung/English: <strong className="text-slate-800">{g.siswa[0]?.penguji_catung_eng || '-'}</strong></div>
                      <div>Timekeeper Siswa: <strong className="text-slate-800">{g.siswa[0]?.timekeeper_siswa || '-'}</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Ruang Wawancara Orang Tua ({walmurRoomGroups.length})</h4>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {walmurRoomGroups.length === 0 && (
                  <div className="bg-white rounded-2xl p-6 border border-dashed border-slate-300 text-center text-xs text-slate-400">
                    Tidak ada data ruang wawancara orang tua.
                  </div>
                )}
                {walmurRoomGroups.map(g => (
                  <div key={'w-' + g.room} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-[#D97706] text-white px-4 py-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-extrabold text-sm">{g.room}</div>
                        <div className="text-[10px] text-amber-100">{g.date || 'Tanggal tidak tercantum'} • {g.siswa.length} siswa</div>
                      </div>
                      <button
                        onClick={() => triggerPrint('walmur', g.room)}
                        className="px-2.5 py-1.5 bg-white text-[#D97706] hover:bg-amber-50 font-bold text-[10px] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" /> Cetak
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[9px] tracking-wider">
                          <tr>
                            <th className="p-2">No</th>
                            <th className="p-2">Nama Siswa</th>
                            <th className="p-2">ID</th>
                            <th className="p-2">Unit & Kelas</th>
                            <th className="p-2">Gender</th>
                            <th className="p-2">Waktu</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">{printRoomRows(g.siswa, 'walmur')}</tbody>
                      </table>
                    </div>
                    <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-600 space-y-0.5">
                      <div>Pewawancara Orang Tua: <strong className="text-slate-800">{g.siswa[0]?.interview_walmur || '-'}</strong></div>
                      <div>Timekeeper Orang Tua: <strong className="text-slate-800">{g.siswa[0]?.timekeeper_walmur || '-'}</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT LAYER */}
      <div id="print-area">
        {printTarget?.group === 'siswa' && renderPrintBlocks('siswa')}
        {printTarget?.group === 'walmur' && renderPrintBlocks('walmur')}
      </div>

      {/* MODAL: Tambah/Edit Siswa Jadwal */}
      {isStudentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 my-8">
            <div className="bg-[#1E3A8A] text-white p-5 flex items-center justify-between border-b-4 border-[#D97706]">
              <h3 className="font-extrabold text-base">
                {isEditMode ? 'Edit Data Calon Siswa' : 'Tambah Calon Siswa Baru'}
              </h3>
              <button
                onClick={() => setIsStudentModalOpen(false)}
                className="p-1 text-blue-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs text-slate-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">ID Siswa</label>
                  <input
                    type="text"
                    value={studentFormData.id}
                    disabled={isEditMode}
                    onChange={(e) => setStudentFormData({ ...studentFormData, id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:bg-white focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Nama Lengkap Siswa</label>
                  <input
                    type="text"
                    value={studentFormData.nama_siswa}
                    onChange={(e) => setStudentFormData({ ...studentFormData, nama_siswa: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:bg-white focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Unit & Kelas</label>
                  <select
                    value={studentFormData.kelas}
                    onChange={(e) => {
                      const k = e.target.value;
                      let g: 'SD' | 'SMP' | 'SMA' = 'SD';
                      if (k.startsWith('SMP')) g = 'SMP';
                      if (k.startsWith('SMA')) g = 'SMA';
                      setStudentFormData({ ...studentFormData, kelas: k, grade: g });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                  >
                    <option value="SD 1">SD - Kelas 1</option>
                    <option value="SD 2">SD - Kelas 2</option>
                    <option value="SMP 7">SMP - Kelas 7</option>
                    <option value="SMP 8">SMP - Kelas 8</option>
                    <option value="SMA 10">SMA - Kelas 10</option>
                    <option value="SMA 11">SMA - Kelas 11</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Jenis Kelamin</label>
                  <select
                    value={studentFormData.gender}
                    onChange={(e) => setStudentFormData({ ...studentFormData, gender: e.target.value as 'L' | 'P' })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                  >
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Nomor Kontak Walmur</label>
                  <input
                    type="text"
                    value={studentFormData.nomor_walmur}
                    onChange={(e) => setStudentFormData({ ...studentFormData, nomor_walmur: e.target.value })}
                    placeholder="0812xxxxxxxx"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Ruangan Ujian Siswa</label>
                  <input
                    type="text"
                    value={studentFormData.ruangan_siswa}
                    onChange={(e) => setStudentFormData({ ...studentFormData, ruangan_siswa: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Penguji Pos Qur'an & Arab</label>
                  <input
                    type="text"
                    value={studentFormData.penguji_alq_arab}
                    onChange={(e) => setStudentFormData({ ...studentFormData, penguji_alq_arab: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Penguji Pos Catung / Eng</label>
                  <input
                    type="text"
                    value={studentFormData.penguji_catung_eng}
                    onChange={(e) => setStudentFormData({ ...studentFormData, penguji_catung_eng: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Pewawancara Orang Tua</label>
                  <input
                    type="text"
                    value={studentFormData.interview_walmur}
                    onChange={(e) => setStudentFormData({ ...studentFormData, interview_walmur: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Ruangan Wawancara Orang Tua</label>
                  <input
                    type="text"
                    value={studentFormData.ruangan_walmur}
                    onChange={(e) => setStudentFormData({ ...studentFormData, ruangan_walmur: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Hari & Tanggal Ujian</label>
                  <input
                    type="text"
                    value={studentFormData.hari_tanggal}
                    onChange={(e) => setStudentFormData({ ...studentFormData, hari_tanggal: e.target.value })}
                    placeholder="Contoh: Minggu, 20 September 2026"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsStudentModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1E3A8A] hover:bg-blue-900 text-white font-bold rounded-xl shadow cursor-pointer"
                >
                  {isEditMode ? 'Simpan Perubahan' : 'Tambahkan Siswa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Grade Edit Modal */}
      {isGradeModalOpen && editingGradeStudent && (
        <RubrikModal
          isOpen={isGradeModalOpen}
          siswa={editingGradeStudent}
          kategori={editingGradeKategori}
          existingNilai={nilaiList.find(
            n => n.id_siswa.toUpperCase() === editingGradeStudent.id.toUpperCase() && n.kategori_ujian === editingGradeKategori
          )}
          session={session}
          onClose={() => setIsGradeModalOpen(false)}
          onGradeSaved={() => {
            setIsGradeModalOpen(false);
            onDataChanged();
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
};
