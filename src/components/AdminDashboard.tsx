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
  Printer,
  Send,
  MessageCircle,
  CalendarDays,
  Wifi,
  WifiOff,
  RotateCcw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  SiswaJadwal,
  PresensiRecord,
  NilaiRecord,
  UserSession,
  KategoriUjian,
  SesiUjian,
  ModeUjian,
  formatKelas,
  getJenjangFromKelas,
  parseStartTimeMinutes,
  parseTimeRange,
  summarizeWaktuAll,
  toISODate,
  formatTanggalUjian,
  getModeUjianForDate,
  pickSesiUjianForDate,
  resolveKehadiran
} from '../types/spmb';
import { apiService } from '../services/apiService';
import { GOOGLE_APPS_SCRIPT_CODE } from '../services/gasCode';
import {
  buildPresentIncompleteRows,
  buildGradedButAbsentRows,
  groupBroadcastByPenguji,
  groupBroadcastByTimekeeper,
  buildPesanPenguji,
  buildPesanTimekeeper,
  buildPesanWaliMurid,
  buildPesanPengujiTanggal,
  displayKategori,
  hasPresensi,
} from '../utils/broadcast';
import { buildRekapPenguji } from '../utils/rekapPenguji';
import { getMeetingUrl } from '../utils/meeting';
import { SPREADSHEET_URL, SCHOOL_LOGO_URL } from '../data/mockData';
import { RubrikModal } from './RubrikModal';
import { ConfirmDialog } from './ConfirmDialog';

interface AdminDashboardProps {
  session: UserSession;
  jadwalList: SiswaJadwal[];
  presensiList: PresensiRecord[];
  nilaiList: NilaiRecord[];
  sesiUjianList: SesiUjian[];
  onDataChanged: () => void;
  showToast: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}

type TimeField = 'waktu_alq_arab' | 'waktu_catung_eng' | 'waktu_interview';
type TimeInputPair = { start: string; end: string };
type StudentTimeInputs = Record<TimeField, TimeInputPair>;
type StudentFormDraft = Omit<SiswaJadwal, 'gender'> & { gender: 'L' | 'P' | '' };
type KehadiranFilter = 'Semua' | 'Hadir' | 'Belum Hadir';

const TIME_FIELDS: TimeField[] = ['waktu_alq_arab', 'waktu_catung_eng', 'waktu_interview'];

const STUDENT_CLASS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'SD 1', label: 'SD - Kelas 1' },
  { value: 'SD 2', label: 'SD - Kelas 2' },
  { value: 'SD 3', label: 'SD - Kelas 3' },
  { value: 'SD 4', label: 'SD - Kelas 4' },
  { value: 'SD 5', label: 'SD - Kelas 5' },
  { value: 'SD 6', label: 'SD - Kelas 6' },
  { value: 'SMP 7', label: 'SMP - Kelas 7' },
  { value: 'SMP 8', label: 'SMP - Kelas 8' },
  { value: 'SMP 9', label: 'SMP - Kelas 9' },
  { value: 'SMA 10', label: 'SMA - Kelas 10' },
  { value: 'SMA 11', label: 'SMA - Kelas 11' },
  { value: 'SMA 12', label: 'SMA - Kelas 12' }
];

const EMPTY_STUDENT_FORM: StudentFormDraft = {
  id: '',
  nama_siswa: '',
  kelas: '',
  gender: '',
  ruangan_siswa: '',
  waktu_all: '',
  waktu_alq_arab: '',
  waktu_catung_eng: '',
  ruangan_walmur: '',
  penguji_alq_arab: '',
  penguji_catung_eng: '',
  timekeeper_siswa: '',
  interview_walmur: '',
  timekeeper_walmur: '',
  waktu_interview: '',
  hari_tanggal: '',
  status: 'Aktif',
  status_kehadiran_siswa: '',
  status_kehadiran_walmur: ''
};

const createEmptyTimeInputs = (): StudentTimeInputs => ({
  waktu_alq_arab: { start: '', end: '' },
  waktu_catung_eng: { start: '', end: '' },
  waktu_interview: { start: '', end: '' }
});

const minutesToTimeValue = (total: number): string => {
  const hour = Math.floor(total / 60) % 24;
  const minute = total % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const timeRangeToInputs = (value: string): TimeInputPair => {
  const range = parseTimeRange(value);
  if (!range) return { start: '', end: '' };
  return {
    start: minutesToTimeValue(range.start),
    end: minutesToTimeValue(range.end)
  };
};

const composeTimeRange = (pair: TimeInputPair): string => {
  if (!pair.start || !pair.end) return '';
  return `${pair.start} - ${pair.end}`;
};

const timeValueToMinutes = (value: string): number => {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
};

const formatTanggalSingkat = (iso: string): string => {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  session,
  jadwalList,
  presensiList,
  nilaiList,
  sesiUjianList,
  onDataChanged,
  showToast
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'kpi' | 'jadwal' | 'presensi' | 'nilai' | 'rekap-penguji' | 'broadcast' | 'export' | 'gas' | 'cetak'>('kpi');
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<SiswaJadwal['status'] | 'Semua'>('Aktif');
  const [dateFilter, setDateFilter] = useState('');
  const [kehadiranSiswaFilter, setKehadiranSiswaFilter] = useState<KehadiranFilter>('Semua');
  const [kehadiranWalmurFilter, setKehadiranWalmurFilter] = useState<KehadiranFilter>('Semua');
  const [rekapDateFrom, setRekapDateFrom] = useState('');
  const [rekapDateTo, setRekapDateTo] = useState('');
  const [rekapSearch, setRekapSearch] = useState('');
  const [rekapPeranFilter, setRekapPeranFilter] = useState<'Semua' | 'Penguji' | 'Timekeeper'>('Semua');

  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    variant: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  } | null>(null);

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
  const [studentFormData, setStudentFormData] = useState<StudentFormDraft>({ ...EMPTY_STUDENT_FORM });
  const [studentTimeInputs, setStudentTimeInputs] = useState<StudentTimeInputs>(createEmptyTimeInputs);

  const [isSessionDateModalOpen, setIsSessionDateModalOpen] = useState(false);
  const [sessionDateForm, setSessionDateForm] = useState<{ date: string; mode: ModeUjian }>({
    date: '',
    mode: 'Offline'
  });

  const pengujiList = apiService.getPengujiList();

  const sessionDateRows = useMemo(() => {
    const map = new Map<string, { date: string; count: number; mode: ModeUjian; id_sesi: string }>();
    jadwalList.forEach((siswa) => {
      const iso = toISODate(siswa.hari_tanggal);
      if (!iso) return;
      const existing = map.get(iso);
      if (existing) {
        existing.count += 1;
      } else {
        const sesi = pickSesiUjianForDate(sesiUjianList, iso);
        map.set(iso, {
          date: iso,
          count: 1,
          mode: sesi?.mode_ujian === 'Online' ? 'Online' : 'Offline',
          id_sesi: sesi?.id_sesi || ''
        });
      }
    });
    const sessionDates = new Set<string>();
    sesiUjianList.forEach((sesi) => {
      const iso = toISODate(sesi.hari_tanggal);
      if (iso) sessionDates.add(iso);
    });
    sessionDates.forEach((iso) => {
      const sesi = pickSesiUjianForDate(sesiUjianList, iso);
      if (!sesi) return;
      const existing = map.get(iso);
      if (existing) {
        existing.mode = sesi.mode_ujian;
        existing.id_sesi = sesi.id_sesi;
      } else {
        map.set(iso, { date: iso, count: 0, mode: sesi.mode_ujian, id_sesi: sesi.id_sesi });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [jadwalList, sesiUjianList]);

  const waliBroadcastByDate = useMemo(() => {
    const map = new Map<string, { onlineUrl: string; message: string }>();
    sessionDateRows.forEach((row) => {
      const students = jadwalList.filter(
        (siswa) => siswa.status === 'Aktif' && toISODate(siswa.hari_tanggal) === row.date
      );
      let onlineUrl = '';
      if (row.mode === 'Online') {
        for (const siswa of students) {
          const url = getMeetingUrl(siswa.ruangan_siswa) || getMeetingUrl(siswa.ruangan_walmur);
          if (url) {
            onlineUrl = url;
            break;
          }
        }
      }

      map.set(row.date, {
        onlineUrl,
        message: buildPesanWaliMurid(row.date, row.mode, onlineUrl)
      });
    });
    return map;
  }, [sessionDateRows, jadwalList]);

  const pengujiBroadcastByDate = useMemo(() => {
    const map = new Map<string, { count: number; message: string }>();
    sessionDateRows.forEach((row) => {
      const students = jadwalList.filter(
        (siswa) => siswa.status === 'Aktif' && toISODate(siswa.hari_tanggal) === row.date
      );
      const pengujiMap = new Map<string, { nama: string; peran: Set<string> }>();
      const roleFields: Array<{ field: 'penguji_alq_arab' | 'penguji_catung_eng' | 'interview_walmur'; label: string }> = [
        { field: 'penguji_alq_arab', label: "Al-Qur'an/Bahasa Arab" },
        { field: 'penguji_catung_eng', label: 'Calistung/English' },
        { field: 'interview_walmur', label: 'Wawancara Orang Tua' },
      ];

      students.forEach((siswa) => {
        roleFields.forEach(({ field, label }) => {
          const nama = (siswa[field] || '').trim();
          if (!nama || nama === '-') return;
          const key = nama.toLowerCase();
          const existing = pengujiMap.get(key);
          if (existing) {
            existing.peran.add(label);
          } else {
            pengujiMap.set(key, { nama, peran: new Set([label]) });
          }
        });
      });

      const pengujiItems = Array.from(pengujiMap.values())
        .map((item) => ({ nama: item.nama, peran: Array.from(item.peran) }))
        .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
      const onlineUrl = waliBroadcastByDate.get(row.date)?.onlineUrl || '';

      map.set(row.date, {
        count: pengujiItems.length,
        message: buildPesanPengujiTanggal(row.date, row.mode, onlineUrl, pengujiItems, students.length),
      });
    });
    return map;
  }, [sessionDateRows, jadwalList, waliBroadcastByDate]);

  const jadwalDateOptions = useMemo(() => {
    const counts = new Map<string, number>();
    jadwalList.forEach((siswa) => {
      const iso = toISODate(siswa.hari_tanggal);
      if (!iso) return;
      counts.set(iso, (counts.get(iso) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [jadwalList]);

  useEffect(() => {
    if (dateFilter && !jadwalDateOptions.some((option) => option.date === dateFilter)) {
      setDateFilter('');
    }
  }, [dateFilter, jadwalDateOptions]);

  const filteredJadwalList = useMemo(() => {
    const query = searchFilter.trim().toLowerCase();
    return jadwalList.filter((siswa) => {
      if (statusFilter !== 'Semua' && siswa.status !== statusFilter) return false;
      if (dateFilter && toISODate(siswa.hari_tanggal) !== dateFilter) return false;
      if (kehadiranSiswaFilter !== 'Semua' && resolveKehadiran(siswa, presensiList, 'Siswa') !== kehadiranSiswaFilter) return false;
      if (kehadiranWalmurFilter !== 'Semua' && resolveKehadiran(siswa, presensiList, 'Walmur') !== kehadiranWalmurFilter) return false;
      if (!query) return true;
      return siswa.nama_siswa.toLowerCase().includes(query)
        || siswa.id.toLowerCase().includes(query)
        || siswa.kelas.toLowerCase().includes(query);
    });
  }, [
    jadwalList,
    statusFilter,
    dateFilter,
    kehadiranSiswaFilter,
    kehadiranWalmurFilter,
    searchFilter,
    presensiList
  ]);

  const hasJadwalFilter = Boolean(dateFilter)
    || kehadiranSiswaFilter !== 'Semua'
    || kehadiranWalmurFilter !== 'Semua';

  const resetJadwalFilters = () => {
    setDateFilter('');
    setKehadiranSiswaFilter('Semua');
    setKehadiranWalmurFilter('Semua');
  };

  const handleSetSessionMode = (date: string, mode: ModeUjian) => {
    const sesi = pickSesiUjianForDate(sesiUjianList, date);
    const res = apiService.saveSesiUjian({
      id_sesi: sesi?.id_sesi || '',
      hari_tanggal: date,
      mode_ujian: mode,
      catatan: sesi?.catatan || '',
      updated_at: ''
    });
    if (res.success) {
      showToast('Mode Ujian Disimpan', `Tanggal ${formatTanggalUjian(date)} diatur ke mode ${mode}.`, 'success');
      onDataChanged();
    } else {
      showToast('Gagal', res.message, 'error');
    }
  };

  const openSessionDateModal = () => {
    setSessionDateForm({ date: '', mode: 'Offline' });
    setIsSessionDateModalOpen(true);
  };

  const handleSessionDateChange = (value: string) => {
    const iso = toISODate(value);
    const existing = iso
      ? pickSesiUjianForDate(sesiUjianList, iso)
      : undefined;
    setSessionDateForm({
      date: value,
      mode: existing?.mode_ujian === 'Online' ? 'Online' : 'Offline'
    });
  };

  const handleSaveSessionDate = (e: React.FormEvent) => {
    e.preventDefault();
    const iso = toISODate(sessionDateForm.date);
    if (!iso) {
      showToast('Tanggal Belum Diisi', 'Pilih tanggal ujian terlebih dahulu.', 'error');
      return;
    }

    const existing = pickSesiUjianForDate(sesiUjianList, iso);
    const res = apiService.saveSesiUjian({
      id_sesi: existing?.id_sesi || '',
      hari_tanggal: iso,
      mode_ujian: sessionDateForm.mode,
      catatan: existing?.catatan || '',
      updated_at: ''
    });

    if (res.success) {
      showToast(
        existing ? 'Mode Tanggal Diperbarui' : 'Tanggal Ditambahkan',
        `Tanggal ${formatTanggalUjian(iso)} diatur ke mode ${sessionDateForm.mode}.`,
        'success'
      );
      setIsSessionDateModalOpen(false);
      onDataChanged();
    } else {
      showToast('Gagal', res.message, 'error');
    }
  };

  const handleDeleteSessionDate = (row: { date: string; id_sesi: string }) => {
    if (!row.id_sesi) return;
    setConfirmDialog({
      title: 'Hapus Tanggal Ujian?',
      message: `Tanggal ${formatTanggalUjian(row.date)} belum memiliki siswa. Hapus tanggal ini dari daftar?`,
      confirmLabel: 'Hapus',
      variant: 'danger',
      onConfirm: () => {
        const res = apiService.deleteSesiUjian(row.id_sesi);
        if (res.success) {
          showToast('Tanggal Dihapus', res.message, 'info');
          onDataChanged();
        } else {
          showToast('Gagal', res.message, 'error');
        }
      }
    });
  };

  // Admin Grade Edit Modal
  const [editingGradeStudent, setEditingGradeStudent] = useState<SiswaJadwal | null>(null);
  const [editingGradeKategori, setEditingGradeKategori] = useState<KategoriUjian>('Calistung');
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);

  // KPI Calculations
  const activeJadwalList = useMemo(() => jadwalList.filter(s => s.status === 'Aktif'), [jadwalList]);
  const activeIds = useMemo(() => new Set(activeJadwalList.map(s => s.id)), [activeJadwalList]);

  const kpiData = useMemo(() => {
    const totalSiswa = activeJadwalList.length;

    // Student Attendance (hormati override admin)
    const hadirSiswaIds = new Set(
      activeJadwalList
        .filter((s) => resolveKehadiran(s, presensiList, 'Siswa') === 'Hadir')
        .map((s) => s.id)
    );
    const hadirSiswaCount = hadirSiswaIds.size;
    const hadirSiswaPercent = totalSiswa ? Math.round((hadirSiswaCount / totalSiswa) * 100) : 0;

    // Walmur Attendance (hormati override admin)
    const hadirWalmurIds = new Set(
      activeJadwalList
        .filter((s) => resolveKehadiran(s, presensiList, 'Walmur') === 'Hadir')
        .map((s) => s.id)
    );
    const hadirWalmurCount = hadirWalmurIds.size;
    const hadirWalmurPercent = totalSiswa ? Math.round((hadirWalmurCount / totalSiswa) * 100) : 0;

    // Grades completion
    const quranDoneIds = new Set(
      nilaiList.filter(n => activeIds.has(n.id_siswa) && (n.kategori_ujian === 'Al-Quran SD' || n.kategori_ujian === 'Al-Quran SMP/SMA')).map(n => n.id_siswa)
    );
    const catungEngDoneIds = new Set(
      nilaiList.filter(n => activeIds.has(n.id_siswa) && (n.kategori_ujian === 'Calistung' || n.kategori_ujian === 'English')).map(n => n.id_siswa)
    );
    const interviewDoneIds = new Set(
      nilaiList.filter(n => activeIds.has(n.id_siswa) && n.kategori_ujian === 'Interview Walmur').map(n => n.id_siswa)
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
  }, [activeJadwalList, presensiList, nilaiList, activeIds]);

  const rekapPenguji = useMemo(
    () => buildRekapPenguji(jadwalList, nilaiList, presensiList, {
      from: rekapDateFrom,
      to: rekapDateTo,
      search: rekapSearch,
      peran: rekapPeranFilter
    }),
    [jadwalList, nilaiList, presensiList, rekapDateFrom, rekapDateTo, rekapSearch, rekapPeranFilter]
  );

  const rekapMinDate = rekapPenguji.availableDates[0] || '';
  const rekapMaxDate = rekapPenguji.availableDates[rekapPenguji.availableDates.length - 1] || '';

  const handleRekapDateFromChange = (value: string) => {
    setRekapDateFrom(value);
    if (value && rekapDateTo && value > rekapDateTo) {
      setRekapDateTo(value);
    }
  };

  const handleRekapDateToChange = (value: string) => {
    setRekapDateTo(value);
    if (value && rekapDateFrom && value < rekapDateFrom) {
      setRekapDateFrom(value);
    }
  };

  const resetRekapFilters = () => {
    setRekapDateFrom('');
    setRekapDateTo('');
    setRekapSearch('');
    setRekapPeranFilter('Semua');
  };

  const hasRekapFilter = Boolean(rekapDateFrom)
    || Boolean(rekapDateTo)
    || Boolean(rekapSearch.trim())
    || rekapPeranFilter !== 'Semua';

  // Handle Save Student (Add or Edit)
  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    const gender = studentFormData.gender;

    if (
      !studentFormData.id.trim() ||
      !studentFormData.nama_siswa.trim() ||
      !studentFormData.kelas.trim() ||
      !gender ||
      !toISODate(studentFormData.hari_tanggal)
    ) {
      showToast('Form Tidak Lengkap', 'ID, nama, kelas, jenis kelamin, dan tanggal ujian wajib diisi!', 'error');
      return;
    }

    const incompleteTime = TIME_FIELDS.find((field) => {
      const pair = studentTimeInputs[field];
      return Boolean(pair.start) !== Boolean(pair.end);
    });
    if (incompleteTime) {
      showToast('Waktu Belum Lengkap', 'Isi jam mulai dan jam selesai untuk setiap waktu ujian.', 'error');
      return;
    }

    const invalidTime = TIME_FIELDS.find((field) => {
      const pair = studentTimeInputs[field];
      return pair.start && pair.end && timeValueToMinutes(pair.end) <= timeValueToMinutes(pair.start);
    });
    if (invalidTime) {
      showToast('Waktu Tidak Valid', 'Jam selesai harus lebih besar dari jam mulai.', 'error');
      return;
    }

    const payload: SiswaJadwal = {
      ...studentFormData,
      gender,
      waktu_all: summarizeWaktuAll(
        studentFormData.waktu_alq_arab,
        studentFormData.waktu_catung_eng,
        studentFormData.waktu_interview
      )
    };

    const res = apiService.saveJadwal(payload, isEditMode);
    if (res.success) {
      showToast('Berhasil', res.message, 'success');
      setIsStudentModalOpen(false);
      onDataChanged();
    } else {
      showToast('Gagal', res.message, 'error');
    }
  };

  const handleDeleteStudent = (id: string, name: string) => {
    setConfirmDialog({
      title: 'Hapus Calon Siswa?',
      message: `Data "${name}" (${id}) akan dihapus dari jadwal. Tindakan ini tidak dapat dibatalkan.`,
      confirmLabel: 'Hapus',
      variant: 'danger',
      onConfirm: () => {
        const res = apiService.deleteJadwal(id);
        if (res.success) {
          showToast('Dihapus', res.message, 'info');
          onDataChanged();
        } else {
          showToast('Gagal', res.message, 'error');
        }
      }
    });
  };

  const handleChangeStudentStatus = (siswa: SiswaJadwal, nextStatus: SiswaJadwal['status']) => {
    if (nextStatus === siswa.status) return;
    const titles: Record<SiswaJadwal['status'], string> = {
      Aktif: 'Aktifkan Kembali?',
      Reschedule: 'Tandai Reschedule?',
      Selesai: 'Tandai Selesai?',
    };
    setConfirmDialog({
      title: titles[nextStatus],
      message: `Status jadwal "${siswa.nama_siswa}" (${siswa.id}) akan diubah menjadi ${nextStatus}.`,
      confirmLabel: 'Ya, Lanjutkan',
      variant: nextStatus === 'Aktif' ? 'info' : 'warning',
      onConfirm: () => {
        const res = apiService.saveJadwal({ ...siswa, status: nextStatus }, true);
        if (res.success) {
          showToast(nextStatus === 'Selesai' ? 'Ditandai Selesai' : nextStatus === 'Reschedule' ? 'Diubah ke Reschedule' : 'Diaktifkan', res.message, 'success');
          onDataChanged();
        } else {
          showToast('Gagal', res.message, 'error');
        }
      }
    });
  };

  const handleTimeInputChange = (
    field: TimeField,
    edge: 'start' | 'end',
    value: string
  ) => {
    const nextInputs: StudentTimeInputs = {
      ...studentTimeInputs,
      [field]: { ...studentTimeInputs[field], [edge]: value }
    };
    setStudentTimeInputs(nextInputs);

    const waktuAlqArab = composeTimeRange(nextInputs.waktu_alq_arab);
    const waktuCatungEng = composeTimeRange(nextInputs.waktu_catung_eng);
    const waktuInterview = composeTimeRange(nextInputs.waktu_interview);

    setStudentFormData((prev) => ({
      ...prev,
      waktu_alq_arab: waktuAlqArab,
      waktu_catung_eng: waktuCatungEng,
      waktu_interview: waktuInterview,
      waktu_all: summarizeWaktuAll(waktuAlqArab, waktuCatungEng, waktuInterview)
    }));
  };

  const handleChangeKehadiran = (
    siswa: SiswaJadwal,
    tipe: 'Siswa' | 'Walmur',
    value: '' | 'Hadir' | 'Belum Hadir'
  ) => {
    const payload: SiswaJadwal = tipe === 'Siswa'
      ? { ...siswa, status_kehadiran_siswa: value }
      : { ...siswa, status_kehadiran_walmur: value };
    const res = apiService.saveJadwal(payload, true);
    if (res.success) {
      showToast(
        'Kehadiran Diperbarui',
        `Status kehadiran ${tipe === 'Siswa' ? 'siswa' : 'wali murid'} ${siswa.nama_siswa} disimpan.`,
        'success'
      );
      onDataChanged();
    } else {
      showToast('Gagal', res.message, 'error');
    }
  };

  const openAddStudentModal = () => {
    setStudentFormData({ ...EMPTY_STUDENT_FORM });
    setStudentTimeInputs(createEmptyTimeInputs());
    setIsEditMode(false);
    setIsStudentModalOpen(true);
  };

  const openEditStudentModal = (siswa: SiswaJadwal) => {
    const nextTimeInputs: StudentTimeInputs = {
      waktu_alq_arab: timeRangeToInputs(siswa.waktu_alq_arab),
      waktu_catung_eng: timeRangeToInputs(siswa.waktu_catung_eng),
      waktu_interview: timeRangeToInputs(siswa.waktu_interview)
    };
    const waktuAlqArab = composeTimeRange(nextTimeInputs.waktu_alq_arab);
    const waktuCatungEng = composeTimeRange(nextTimeInputs.waktu_catung_eng);
    const waktuInterview = composeTimeRange(nextTimeInputs.waktu_interview);

    setStudentTimeInputs(nextTimeInputs);
    setStudentFormData({
      ...siswa,
      hari_tanggal: toISODate(siswa.hari_tanggal) || siswa.hari_tanggal,
      waktu_alq_arab: waktuAlqArab,
      waktu_catung_eng: waktuCatungEng,
      waktu_interview: waktuInterview,
      waktu_all: summarizeWaktuAll(waktuAlqArab, waktuCatungEng, waktuInterview)
    });
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
    setConfirmDialog({
      title: 'Hapus Entri Nilai?',
      message: 'Entri penilaian ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.',
      confirmLabel: 'Hapus',
      variant: 'danger',
      onConfirm: () => {
        apiService.deleteNilai(id);
        showToast('Berhasil', 'Entri nilai dihapus.', 'info');
        onDataChanged();
      }
    });
  };

  const handleDeletePresensi = (id: string) => {
    setConfirmDialog({
      title: 'Hapus Entri Presensi?',
      message: 'Entri presensi ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.',
      confirmLabel: 'Hapus',
      variant: 'danger',
      onConfirm: () => {
        apiService.deletePresensi(id);
        showToast('Berhasil', 'Entri presensi dihapus.', 'info');
        onDataChanged();
      }
    });
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

      // Sheet 4: Siswa Tidak Hadir (jadwal Aktif tapi belum ada presensi Siswa)
      const tidakHadir = jadwalList
        .filter((s) => s.status === 'Aktif')
        .filter((s) => !hasPresensi(presensiList, s.id, 'Siswa'))
        .map((s) => ({ id: s.id, nama: s.nama_siswa, kelas: s.kelas }))
        .sort((a, b) => a.nama.localeCompare(b.nama));
      const wsTidakHadir = XLSX.utils.json_to_sheet(tidakHadir, { header: ['id', 'nama', 'kelas'] });
      XLSX.utils.book_append_sheet(wb, wsTidakHadir, 'web_tidak_hadir');

      // Download
      XLSX.writeFile(wb, `REKAP_SPMB_ALWILDAN29_${Date.now()}.xlsx`);
      showToast('Ekspor Berhasil', `File Excel (.xlsx) lengkap berhasil diunduh (${tidakHadir.length} siswa tidak hadir).`, 'success');
    } catch (err: any) {
      showToast('Ekspor Gagal', err.message || 'Gagal membuat file excel.', 'error');
    }
  };

  const handleExportRekapPenguji = () => {
    if (rekapPenguji.rows.length === 0) {
      showToast('Belum Ada Data', 'Tidak ada data nilai atau presensi pada rentang tanggal yang dipilih.', 'info');
      return;
    }

    try {
      const dates = rekapPenguji.dates;
      const headerDate = [
        'Peran',
        'Nama',
        ...dates.flatMap((date) => [formatTanggalSingkat(date), '']),
        'Total'
      ];
      const headerSub = ['', '', ...dates.flatMap(() => ['Keterangan', 'Jumlah']), ''];
      const body = rekapPenguji.rows.map((row) => [
        row.peran,
        row.nama,
        ...dates.flatMap((date) => [
          (row.keteranganByDate[date] || [])
            .map((keterangan) => displayKategori(keterangan as KategoriUjian))
            .join(', ') || '-',
          row.counts[date] || 0
        ]),
        row.total
      ]);
      const footer = [
        '',
        'Total',
        ...dates.flatMap((date) => ['', rekapPenguji.totalByDate[date] || 0]),
        rekapPenguji.grandTotal
      ];

      const ws = XLSX.utils.aoa_to_sheet([headerDate, headerSub, ...body, footer]);
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
        { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
        ...dates.map((_, index) => ({
          s: { r: 0, c: 2 + index * 2 },
          e: { r: 0, c: 3 + index * 2 }
        })),
        { s: { r: 0, c: 2 + dates.length * 2 }, e: { r: 1, c: 2 + dates.length * 2 } }
      ];
      ws['!cols'] = [
        { wch: 12 },
        { wch: 34 },
        ...dates.flatMap(() => [{ wch: 30 }, { wch: 10 }]),
        { wch: 12 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'rekap_penguji');
      XLSX.writeFile(wb, `REKAP_PENGUJI_TIMEKEEPER_ALWILDAN29_${Date.now()}.xlsx`);
      showToast(
        'Ekspor Berhasil',
        `Rekap ${rekapPenguji.rows.length} penguji/timekeeper berhasil diunduh.`,
        'success'
      );
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

  // ====== MONITORING & BROADCAST WA (cek silang presensi <-> nilai) ======
  const [broadcastSearch, setBroadcastSearch] = useState('');
  const [broadcastJenjang, setBroadcastJenjang] = useState<'Semua' | 'SD' | 'SMP' | 'SMA'>('Semua');
  const [broadcastKelas, setBroadcastKelas] = useState<string>('Semua');

  const broadcastBaseA = useMemo(
    () => buildPresentIncompleteRows(jadwalList, presensiList, nilaiList),
    [jadwalList, presensiList, nilaiList]
  );
  const broadcastBaseB = useMemo(
    () => buildGradedButAbsentRows(jadwalList, presensiList, nilaiList),
    [jadwalList, presensiList, nilaiList]
  );

  const broadcastKelasOptions = useMemo(() => {
    const set = new Set<string>();
    jadwalList.forEach((s) => { if (s.kelas) set.add(s.kelas); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [jadwalList]);

  const broadcastRowsA = useMemo(() => {
    const q = broadcastSearch.trim().toLowerCase();
    return broadcastBaseA.filter((r) => {
      const s = r.siswa;
      const okQ = !q || s.nama_siswa.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
      const okJ = broadcastJenjang === 'Semua' || getJenjangFromKelas(s.kelas) === broadcastJenjang;
      const okK = broadcastKelas === 'Semua' || s.kelas === broadcastKelas;
      return okQ && okJ && okK;
    });
  }, [broadcastBaseA, broadcastSearch, broadcastJenjang, broadcastKelas]);

  const broadcastRowsB = useMemo(() => {
    const q = broadcastSearch.trim().toLowerCase();
    return broadcastBaseB.filter((r) => {
      const s = r.siswa;
      const okQ = !q || s.nama_siswa.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
      const okJ = broadcastJenjang === 'Semua' || getJenjangFromKelas(s.kelas) === broadcastJenjang;
      const okK = broadcastKelas === 'Semua' || s.kelas === broadcastKelas;
      return okQ && okJ && okK;
    });
  }, [broadcastBaseB, broadcastSearch, broadcastJenjang, broadcastKelas]);

  const broadcastPengujiGroups = useMemo(() => groupBroadcastByPenguji(broadcastRowsA), [broadcastRowsA]);
  const broadcastTimekeeperGroups = useMemo(() => groupBroadcastByTimekeeper(broadcastRowsB), [broadcastRowsB]);

  const handleCopyText = (text: string, label: string) => {
    if (!text.trim()) return;
    navigator.clipboard
      .writeText(text)
      .then(() => showToast('Disalin!', `${label} berhasil disalin. Tempel (paste) ke WhatsApp.`, 'success'))
      .catch(() => showToast('Gagal Menyalin', 'Clipboard tidak tersedia di browser ini. Salin manual dari kolom preview.', 'error'));
  };

  const handleSendWhatsAppText = (text: string, label: string) => {
    if (!text.trim()) return;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer'
    );
    showToast('WhatsApp Dibuka', `${label} siap dikirim. Silakan pilih kontak wali murid.`, 'info');
  };

  const handleCopyAllPenguji = () => {
    const all = broadcastPengujiGroups.map((g) => buildPesanPenguji(g.penguji, g.items)).join('\n\n———————————\n\n');
    handleCopyText(all, `Semua pesan penguji (${broadcastPengujiGroups.length} orang)`);
  };

  const handleCopyAllTimekeeper = () => {
    const all = broadcastTimekeeperGroups.map((g) => buildPesanTimekeeper(g.timekeeper, g.items)).join('\n\n———————————\n\n');
    handleCopyText(all, `Semua pesan timekeeper (${broadcastTimekeeperGroups.length} orang)`);
  };

  // ====== CETAK RUANGAN ======
  const buildRoomGroups = (
    getRoom: (s: SiswaJadwal) => string,
    getTime: (s: SiswaJadwal) => string,
  ): { room: string; date: string; siswa: SiswaJadwal[] }[] => {
    const map = new Map<string, SiswaJadwal[]>();
    activeJadwalList.forEach(s => {
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

  const siswaRoomGroups = useMemo(() => buildRoomGroups(s => s.ruangan_siswa, s => s.waktu_all), [activeJadwalList]);
  const walmurRoomGroups = useMemo(() => buildRoomGroups(s => s.ruangan_walmur, s => s.waktu_interview), [activeJadwalList]);

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
        <td className="p-2">{getJenjangFromKelas(s.kelas)} • {formatKelas(s.kelas)}</td>
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
              <div>
                <div className="text-sm font-black">TES SPMB AL-WILDAN ISLAMIC SCHOOL 29 DEPOK</div>
                <div className="text-xs font-bold mt-0.5">Daftar {title} per Ruangan</div>
                <div className="text-xs font-bold mt-0.5">
                  {g.room} — {formatTanggalUjian(g.date) || 'Tanggal tidak tercantum'}
                </div>
              </div>
            </div>
            <table className="print-table mt-2">
              <thead className={group === 'siswa' ? 'print-thead-siswa' : 'print-thead-walmur'}>
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
          onClick={() => setActiveSubTab('rekap-penguji')}
          className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeSubTab === 'rekap-penguji'
              ? 'bg-[#1E3A8A] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-emerald-300" />
          <span>Rekap Penguji & Timekeeper ({rekapPenguji.rows.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('broadcast')}
          className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeSubTab === 'broadcast'
              ? 'bg-[#1E3A8A] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Send className="w-4 h-4 text-emerald-300" />
          <span>Monitoring & Broadcast WA</span>
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
          {/* Mode Ujian per Tanggal */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-[#1E3A8A]" />
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Mode Ujian per Tanggal</h3>
                  <p className="text-[11px] text-slate-500">Satu tanggal/sesi berlaku untuk semua peserta di tanggal tersebut.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={openSessionDateModal}
                className="px-3 py-2 bg-[#1E3A8A] hover:bg-blue-900 text-white text-[11px] font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Tanggal
              </button>
            </div>
            <div className="p-4">
              {sessionDateRows.length === 0 ? (
                <p className="text-xs text-slate-500">Belum ada tanggal ujian pada jadwal.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {sessionDateRows.map((row) => {
                    const broadcast = waliBroadcastByDate.get(row.date);
                    const pengujiBroadcast = pengujiBroadcastByDate.get(row.date);
                    const missingOnlineLink = row.mode === 'Online' && !broadcast?.onlineUrl;
                    const missingPenguji = !pengujiBroadcast || pengujiBroadcast.count === 0;
                    const broadcastLabel = `Broadcast wali murid ${formatTanggalUjian(row.date)}`;
                    const pengujiBroadcastLabel = `Broadcast penguji ${formatTanggalUjian(row.date)}`;

                    return (
                      <div key={row.date} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{formatTanggalUjian(row.date)}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              {row.mode === 'Online' ? (
                                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <WifiOff className="w-3.5 h-3.5 text-slate-500" />
                              )}
                              <span className="text-[10px] text-slate-500">{row.count} siswa</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {row.count === 0 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteSessionDate(row)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Hapus tanggal"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <select
                              value={row.mode}
                              onChange={(e) => handleSetSessionMode(row.date, e.target.value as ModeUjian)}
                              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase border cursor-pointer focus:outline-none ${
                                row.mode === 'Online'
                                  ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                                  : 'bg-slate-200 text-slate-700 border-slate-300'
                              }`}
                              title="Ubah mode ujian sesi ini"
                            >
                              <option value="Offline">Offline</option>
                              <option value="Online">Online</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200">
                          <button
                            type="button"
                            onClick={() => handleCopyText(broadcast?.message || '', broadcastLabel)}
                            disabled={!broadcast?.message || missingOnlineLink}
                            className="px-2.5 py-1.5 bg-[#1E3A8A] hover:bg-blue-900 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            Salin
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendWhatsAppText(broadcast?.message || '', broadcastLabel)}
                            disabled={!broadcast?.message || missingOnlineLink}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            Kirim WA
                          </button>
                          {missingOnlineLink && (
                            <span className="text-[9px] font-semibold text-amber-700">Link Zoom belum tersedia</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-dashed border-slate-200">
                          <button
                            type="button"
                            onClick={() => handleCopyText(pengujiBroadcast?.message || '', pengujiBroadcastLabel)}
                            disabled={!pengujiBroadcast?.message || missingOnlineLink || missingPenguji}
                            className="px-2.5 py-1.5 bg-[#1E3A8A] hover:bg-blue-900 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            Salin Penguji
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendWhatsAppText(pengujiBroadcast?.message || '', pengujiBroadcastLabel)}
                            disabled={!pengujiBroadcast?.message || missingOnlineLink || missingPenguji}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            Kirim WA Penguji
                          </button>
                          {missingPenguji && (
                            <span className="text-[9px] font-semibold text-slate-500">Belum ada penguji</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Cari siswa, nomor pendaftaran, ruangan..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-slate-500" />
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] cursor-pointer"
                  title="Filter tanggal ujian"
                >
                  <option value="">Tanggal: Semua</option>
                  {jadwalDateOptions.map((option) => (
                    <option key={option.date} value={option.date}>
                      {formatTanggalUjian(option.date)} ({option.count})
                    </option>
                  ))}
                </select>
              </div>

              <select
                value={kehadiranSiswaFilter}
                onChange={(e) => setKehadiranSiswaFilter(e.target.value as KehadiranFilter)}
                className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] cursor-pointer"
                title="Filter kehadiran siswa"
              >
                <option value="Semua">Siswa: Semua Kehadiran</option>
                <option value="Hadir">Siswa: Hadir</option>
                <option value="Belum Hadir">Siswa: Belum Hadir</option>
              </select>

              <select
                value={kehadiranWalmurFilter}
                onChange={(e) => setKehadiranWalmurFilter(e.target.value as KehadiranFilter)}
                className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] cursor-pointer"
                title="Filter kehadiran wali murid"
              >
                <option value="Semua">Wali: Semua Kehadiran</option>
                <option value="Hadir">Wali: Hadir</option>
                <option value="Belum Hadir">Wali: Belum Hadir</option>
              </select>

              {hasJadwalFilter && (
                <button
                  type="button"
                  onClick={resetJadwalFilters}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Reset filter tanggal dan kehadiran"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as SiswaJadwal['status'] | 'Semua')}
                className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] cursor-pointer"
                title="Filter status siswa"
              >
                <option value="Aktif">Status: Aktif</option>
                <option value="Reschedule">Status: Reschedule</option>
                <option value="Selesai">Status: Selesai</option>
                <option value="Semua">Status: Semua</option>
              </select>

              <button
                onClick={openAddStudentModal}
                className="px-4 py-2 bg-[#1E3A8A] hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#D97706]" />
                <span>Tambah Calon Siswa</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1500px] text-left text-xs">
                <thead className="bg-[#1E3A8A] text-white font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3 w-[104px] min-w-[104px] whitespace-nowrap bg-[#1E3A8A] lg:sticky lg:left-0 lg:z-30">ID Siswa</th>
                    <th className="p-3 w-[180px] min-w-[180px] bg-[#1E3A8A] lg:sticky lg:left-[104px] lg:z-30">Nama Siswa</th>
                    <th className="p-3 w-[88px] min-w-[88px] bg-[#1E3A8A] lg:sticky lg:left-[284px] lg:z-30">Gender</th>
                    <th className="p-3 w-[112px] min-w-[112px] bg-[#1E3A8A] border-r border-blue-700/60 lg:sticky lg:left-[372px] lg:z-30 lg:shadow-[6px_0_10px_-8px_rgba(15,23,42,0.45)]">Unit & Kelas</th>
                    <th className="p-3">Tanggal Ujian</th>
                    <th className="p-3">Mode</th>
                    <th className="p-3">Ruang Siswa</th>
                    <th className="p-3">Penguji Qur'an/Arab</th>
                    <th className="p-3">Penguji Catung/Eng</th>
                    <th className="p-3">Wawancara Orang Tua</th>
                    <th className="p-3">Waktu Ujian (All)</th>
                    <th className="p-3">Kehadiran Siswa</th>
                    <th className="p-3">Kehadiran Wali Murid</th>
                    <th className="p-3">Status Jadwal</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredJadwalList.map((s) => {
                      const mode = getModeUjianForDate(sesiUjianList, s.hari_tanggal);
                      const kehadiranSiswa = resolveKehadiran(s, presensiList, 'Siswa');
                      const kehadiranWalmur = resolveKehadiran(s, presensiList, 'Walmur');
                      return (
                      <tr key={s.id} className="group hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-mono font-bold text-[#1E3A8A] whitespace-nowrap bg-white group-hover:bg-slate-50 w-[104px] min-w-[104px] lg:sticky lg:left-0 lg:z-20">{s.id}</td>
                        <td className="p-3 font-bold text-slate-900 bg-white group-hover:bg-slate-50 w-[180px] min-w-[180px] lg:sticky lg:left-[104px] lg:z-20">{s.nama_siswa}</td>
                        <td className="p-3 text-slate-700 bg-white group-hover:bg-slate-50 w-[88px] min-w-[88px] lg:sticky lg:left-[284px] lg:z-20">{s.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</td>
                        <td className="p-3 bg-white group-hover:bg-slate-50 w-[112px] min-w-[112px] border-r border-slate-200 lg:sticky lg:left-[372px] lg:z-20 lg:shadow-[6px_0_10px_-8px_rgba(15,23,42,0.45)]">
                          <span className="px-2 py-0.5 bg-[#D97706] text-white text-[10px] font-black rounded uppercase inline-block">
                            {getJenjangFromKelas(s.kelas)}
                          </span>
                          <span className="block mt-1 font-bold text-[#1E3A8A]">
                            {formatKelas(s.kelas)}
                          </span>
                        </td>
                        <td className="p-3 text-slate-700 font-medium whitespace-nowrap">
                          {formatTanggalUjian(s.hari_tanggal)}
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                            mode === 'Online'
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                              : 'bg-slate-100 text-slate-600 border-slate-300'
                          }`}>
                            {mode === 'Online' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                            {mode}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-slate-700">{s.ruangan_siswa}</td>
                        <td className="p-3 text-slate-600 truncate max-w-[150px]">
                          <span className="block font-medium text-slate-700">{s.penguji_alq_arab}</span>
                          <span className="block text-[10px] text-slate-500 font-mono">{s.waktu_alq_arab}</span>
                        </td>
                        <td className="p-3 text-slate-600 truncate max-w-[150px]">
                          <span className="block font-medium text-slate-700">{s.penguji_catung_eng}</span>
                          <span className="block text-[10px] text-slate-500 font-mono">{s.waktu_catung_eng}</span>
                        </td>
                        <td className="p-3 text-slate-700 truncate max-w-[170px]">
                          <strong>{s.interview_walmur}</strong>
                          <span className="block text-[10px] text-slate-500 font-mono">{s.waktu_interview}</span>
                          <span className="block text-[10px] text-slate-400 font-normal">{s.ruangan_walmur}</span>
                        </td>
                        <td className="p-3 font-mono font-bold text-[#1E3A8A] whitespace-nowrap">{s.waktu_all || '-'}</td>
                        <td className="p-3">
                          <select
                            value={s.status_kehadiran_siswa || ''}
                            onChange={(e) => handleChangeKehadiran(s, 'Siswa', e.target.value as '' | 'Hadir' | 'Belum Hadir')}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer focus:outline-none ${
                              kehadiranSiswa === 'Hadir'
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                                : 'bg-amber-100 text-amber-700 border-amber-300'
                            }`}
                            title="Status kehadiran siswa (otomatis dari presensi, bisa di-override admin)"
                          >
                            <option value="">Otomatis: {kehadiranSiswa}</option>
                            <option value="Hadir">Hadir</option>
                            <option value="Belum Hadir">Belum Hadir</option>
                          </select>
                        </td>
                        <td className="p-3">
                          <select
                            value={s.status_kehadiran_walmur || ''}
                            onChange={(e) => handleChangeKehadiran(s, 'Walmur', e.target.value as '' | 'Hadir' | 'Belum Hadir')}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer focus:outline-none ${
                              kehadiranWalmur === 'Hadir'
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                                : 'bg-amber-100 text-amber-700 border-amber-300'
                            }`}
                            title="Status kehadiran wali murid (otomatis dari presensi, bisa di-override admin)"
                          >
                            <option value="">Otomatis: {kehadiranWalmur}</option>
                            <option value="Hadir">Hadir</option>
                            <option value="Belum Hadir">Belum Hadir</option>
                          </select>
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
                      );
                    })}
                  {filteredJadwalList.length === 0 && (
                    <tr>
                      <td colSpan={15} className="p-8 text-center text-slate-500 text-xs font-semibold">
                        Tidak ada siswa yang sesuai dengan filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* TAB 3: PRESENSI & NILAI PER SISWA TABLE */}
      {activeSubTab === 'presensi' && (
        <div className="space-y-4">
          {/* Ringkasan cepat */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Belum Presensi Siswa</span>
                <Users className="w-4 h-4 text-rose-500" />
              </div>
              <span className="text-2xl font-extrabold text-rose-700 font-mono">
                {activeJadwalList.filter((s) => !presensiList.some((p) => p.id_siswa.toLowerCase() === s.id.toLowerCase() && p.tipe_presensi === 'Siswa')).length}
              </span>
              <p className="text-[10px] text-slate-400">dari {activeJadwalList.length} siswa aktif</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Belum Presensi Walmur</span>
                <Users className="w-4 h-4 text-amber-500" />
              </div>
              <span className="text-2xl font-extrabold text-amber-700 font-mono">
                {activeJadwalList.filter((s) => !presensiList.some((p) => p.id_siswa.toLowerCase() === s.id.toLowerCase() && p.tipe_presensi === 'Walmur')).length}
              </span>
              <p className="text-[10px] text-slate-400">dari {activeJadwalList.length} siswa aktif</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Siswa Aktif</span>
                <Users className="w-4 h-4 text-[#1E3A8A]" />
              </div>
              <span className="text-2xl font-extrabold text-[#1E3A8A] font-mono">{activeJadwalList.length}</span>
              <p className="text-[10px] text-slate-400">siswa terdaftar aktif</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                Rekap Presensi & Nilai per Siswa
              </h3>
              <span className="text-xs text-slate-500 font-mono">Total: {activeJadwalList.length}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1E3A8A] text-white uppercase text-[10px]">
                  <tr>
                    <th className="p-3">ID</th>
                    <th className="p-3">Nama Siswa</th>
                    <th className="p-3">Jenjang & Kelas</th>
                    <th className="p-3">Presensi Siswa</th>
                    <th className="p-3">Presensi Walmur</th>
                    <th className="p-3">Al-Qur'an / Arab</th>
                    <th className="p-3">Calistung / English</th>
                    <th className="p-3">Interview Walmur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activeJadwalList.map((s) => {
                    const jenjang = getJenjangFromKelas(s.kelas);
                    const hadirSiswa = presensiList.some((p) => p.id_siswa.toLowerCase() === s.id.toLowerCase() && p.tipe_presensi === 'Siswa');
                    const hadirWalmur = presensiList.some((p) => p.id_siswa.toLowerCase() === s.id.toLowerCase() && p.tipe_presensi === 'Walmur');
                    const alqCat: KategoriUjian = jenjang === 'SD' ? 'Al-Quran SD' : 'Al-Quran SMP/SMA';
                    const calCat: KategoriUjian = jenjang === 'SD' ? 'Calistung' : 'English';
                    const ivCat: KategoriUjian = 'Interview Walmur';
                    const alqNilai = nilaiList.find((n) => n.id_siswa.toLowerCase() === s.id.toLowerCase() && n.kategori_ujian === alqCat);
                    const calNilai = nilaiList.find((n) => n.id_siswa.toLowerCase() === s.id.toLowerCase() && n.kategori_ujian === calCat);
                    const ivNilai = nilaiList.find((n) => n.id_siswa.toLowerCase() === s.id.toLowerCase() && n.kategori_ujian === ivCat);
                    const renderNilai = (rec?: NilaiRecord) => rec ? (
                      <div className="space-y-0.5">
                        <span className="block font-mono font-bold text-emerald-700">{rec.skor_akhir_rata2.toFixed(2)}</span>
                        <span className="block text-[10px] text-slate-500 max-w-[140px] truncate">{rec.nama_penguji}</span>
                      </div>
                    ) : <span className="text-[10px] text-slate-400 italic">Belum Dinilai</span>;
                    return (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-[#1E3A8A]">{s.id}</td>
                        <td className="p-3 font-bold text-slate-800">{s.nama_siswa}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${jenjang === 'SD' ? 'bg-sky-100 text-sky-700' : jenjang === 'SMP' ? 'bg-blue-100 text-[#1E3A8A]' : 'bg-purple-100 text-purple-800'}`}>
                            {jenjang}
                          </span>
                          <span className="block mt-0.5 text-[10px] text-slate-500 font-semibold">{formatKelas(s.kelas)}</span>
                        </td>
                        <td className="p-3">
                          {hadirSiswa ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-[10px]">
                              <CheckCircle2 className="w-3 h-3" /> Hadir
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-700 font-bold text-[10px]">
                              <Clock className="w-3 h-3" /> Belum
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {hadirWalmur ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-[10px]">
                              <CheckCircle2 className="w-3 h-3" /> Hadir
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-700 font-bold text-[10px]">
                              <Clock className="w-3 h-3" /> Belum
                            </span>
                          )}
                        </td>
                        <td className="p-3">{renderNilai(alqNilai)}</td>
                        <td className="p-3">{renderNilai(calNilai)}</td>
                        <td className="p-3">{renderNilai(ivNilai)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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

      {/* TAB 4A: REKAP PENGUJI (siswa unik per tanggal ujian) */}
      {activeSubTab === 'rekap-penguji' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[10px] font-bold uppercase tracking-wider">Penguji Menilai</span>
                <Users className="w-5 h-5 text-[#1E3A8A]" />
              </div>
              <div className="text-2xl font-extrabold text-[#1E3A8A] font-mono">
                {rekapPenguji.totalPenguji}
              </div>
              <p className="text-[11px] text-slate-500">Penguji dengan nilai pada rentang terpilih</p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[10px] font-bold uppercase tracking-wider">Timekeeper Mencatat</span>
                <Users className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="text-2xl font-extrabold text-emerald-700 font-mono">
                {rekapPenguji.totalTimekeeper}
              </div>
              <p className="text-[11px] text-slate-500">Timekeeper dengan presensi pada rentang terpilih</p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[10px] font-bold uppercase tracking-wider">Total Penilaian</span>
                <BarChart3 className="w-5 h-5 text-[#1E3A8A]" />
              </div>
              <div className="text-2xl font-extrabold text-[#1E3A8A] font-mono">
                {rekapPenguji.totalPenilaian}
              </div>
              <p className="text-[11px] text-slate-500">Penjumlahan siswa-teruji per penguji per tanggal</p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[10px] font-bold uppercase tracking-wider">Total Presensi</span>
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="text-2xl font-extrabold text-emerald-700 font-mono">
                {rekapPenguji.totalPresensi}
              </div>
              <p className="text-[11px] text-slate-500">Penjumlahan siswa-tercatat per timekeeper per tanggal</p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[10px] font-bold uppercase tracking-wider">Tanggal Ujian</span>
                <CalendarDays className="w-5 h-5 text-[#D97706]" />
              </div>
              <div className="text-2xl font-extrabold text-[#D97706] font-mono">
                {rekapPenguji.dates.length}
              </div>
              <p className="text-[11px] text-slate-500">Tanggal dengan nilai atau presensi pada rentang terpilih</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={rekapSearch}
                onChange={(e) => setRekapSearch(e.target.value)}
                placeholder="Cari penguji, timekeeper, atau keterangan..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={rekapPeranFilter}
                onChange={(e) => setRekapPeranFilter(e.target.value as 'Semua' | 'Penguji' | 'Timekeeper')}
                className="px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none cursor-pointer"
                title="Filter peran"
              >
                <option value="Semua">Semua Peran</option>
                <option value="Penguji">Penguji</option>
                <option value="Timekeeper">Timekeeper</option>
              </select>

              <div className="flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-slate-500" />
                <input
                  type="date"
                  value={rekapDateFrom}
                  min={rekapMinDate || undefined}
                  max={rekapDateTo || rekapMaxDate || undefined}
                  onChange={(e) => handleRekapDateFromChange(e.target.value)}
                  className="px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none cursor-pointer"
                  title="Tanggal mulai"
                />
                <span className="text-[11px] font-semibold text-slate-500">s.d.</span>
                <input
                  type="date"
                  value={rekapDateTo}
                  min={rekapDateFrom || rekapMinDate || undefined}
                  max={rekapMaxDate || undefined}
                  onChange={(e) => handleRekapDateToChange(e.target.value)}
                  className="px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none cursor-pointer"
                  title="Tanggal akhir"
                />
              </div>

              {hasRekapFilter && (
                <button
                  type="button"
                  onClick={resetRekapFilters}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Reset filter rekap"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={handleExportRekapPenguji}
                disabled={rekapPenguji.rows.length === 0}
                className="px-3.5 py-2 bg-[#1E3A8A] hover:bg-blue-900 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 text-[#D97706]" />
                <span>Unduh Rekap</span>
              </button>
            </div>
          </div>

          {rekapPenguji.rows.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center mx-auto mb-3">
                <BarChart3 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Belum Ada Nilai</h3>
              <p className="text-xs text-slate-500 mt-1">
                Tidak ada data nilai atau presensi pada rentang tanggal, peran, dan pencarian saat ini.
              </p>
              {hasRekapFilter && (
                <button
                  type="button"
                  onClick={resetRekapFilters}
                  className="mt-4 px-4 py-2 bg-[#1E3A8A] hover:bg-blue-900 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Reset Filter
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                    Rekap Penguji & Timekeeper per Tanggal Ujian
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Penguji: siswa dinilai + kategori. Timekeeper: siswa dengan presensi (Siswa atau Walmur).
                  </p>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  {rekapDateFrom || rekapDateTo
                    ? `Rentang: ${rekapDateFrom ? formatTanggalSingkat(rekapDateFrom) : 'Awal'} s.d. ${rekapDateTo ? formatTanggalSingkat(rekapDateTo) : 'Akhir'}`
                    : 'Semua tanggal'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#1E3A8A] text-white uppercase text-[10px] tracking-wider">
                    <tr>
                      <th rowSpan={2} className="p-3 w-[88px] min-w-[88px] sticky left-0 z-20 bg-[#1E3A8A]">Peran</th>
                      <th rowSpan={2} className="p-3 min-w-[200px] sticky left-[88px] z-20 bg-[#1E3A8A] border-r border-blue-700/50">
                        Nama
                      </th>
                      {rekapPenguji.dates.map((date) => (
                        <th key={date} colSpan={2} className="p-3 text-center min-w-[210px] whitespace-nowrap border-l border-blue-700/50">
                          {formatTanggalSingkat(date)}
                        </th>
                      ))}
                      <th rowSpan={2} className="p-3 text-center min-w-[80px] bg-blue-900/60 whitespace-nowrap">
                        Total
                      </th>
                    </tr>
                    <tr>
                      {rekapPenguji.dates.map((date) => (
                        <React.Fragment key={date}>
                          <th className="p-2 min-w-[140px] text-left border-l border-blue-700/50">Keterangan</th>
                          <th className="p-2 min-w-[70px] text-center">Jumlah</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {rekapPenguji.rows.map((row) => (
                      <tr key={row.key} className="hover:bg-slate-50">
                        <td className="p-3 sticky left-0 z-10 bg-white">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${
                              row.peran === 'Penguji'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {row.peran}
                          </span>
                        </td>
                        <td className="p-3 sticky left-[88px] z-10 bg-white border-r border-slate-100">
                          <div className="font-bold text-slate-800">{row.nama}</div>
                        </td>
                        {rekapPenguji.dates.map((date) => {
                          const count = row.counts[date] || 0;
                          const keteranganText = (row.keteranganByDate[date] || [])
                            .map((keterangan) => displayKategori(keterangan as KategoriUjian))
                            .join(', ');
                          return (
                            <React.Fragment key={date}>
                              <td className="p-3 text-[10px] text-slate-600 leading-snug border-l border-slate-100">
                                {keteranganText || <span className="text-slate-300">-</span>}
                              </td>
                              <td className="p-3 text-center">
                                {count > 0 ? (
                                  <span
                                    className={`inline-flex min-w-7 justify-center px-2 py-0.5 rounded-md font-bold font-mono ${
                                      row.peran === 'Penguji'
                                        ? 'bg-blue-50 text-[#1E3A8A]'
                                        : 'bg-emerald-50 text-emerald-700'
                                    }`}
                                  >
                                    {count}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                            </React.Fragment>
                          );
                        })}
                        <td className="p-3 text-center bg-slate-50">
                          <span
                            className={`inline-flex min-w-8 justify-center px-2 py-0.5 rounded-md text-white font-bold font-mono ${
                              row.peran === 'Penguji' ? 'bg-[#1E3A8A]' : 'bg-emerald-600'
                            }`}
                          >
                            {row.total}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-blue-50 border-t-2 border-blue-200">
                      <td className="p-3 sticky left-0 z-10 bg-blue-50" />
                      <td className="p-3 sticky left-[88px] z-10 bg-blue-50 font-bold text-[#1E3A8A]">
                        Total
                      </td>
                      {rekapPenguji.dates.map((date) => (
                        <React.Fragment key={date}>
                          <td className="p-3 border-l border-blue-200" />
                          <td className="p-3 text-center font-bold text-[#1E3A8A] font-mono">
                            {rekapPenguji.totalByDate[date] || 0}
                          </td>
                        </React.Fragment>
                      ))}
                      <td className="p-3 text-center bg-blue-100 text-[#1E3A8A] font-extrabold font-mono">
                        {rekapPenguji.grandTotal}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <p className="px-4 py-3 text-[11px] leading-relaxed text-slate-500 border-t border-slate-200">
                Penguji: angka adalah siswa unik yang dinilai per tanggal, keterangan berisi kategori ujian.
                Timekeeper: angka adalah siswa unik yang presensinya dicatat per tanggal (Siswa atau Walmur dihitung sekali).
                Total adalah penjumlahan angka per tanggal.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 4B: MONITORING & BROADCAST WA (cek silang presensi <-> nilai) */}
      {activeSubTab === 'broadcast' && (
        <div className="space-y-6">
          {/* Filter bar */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={broadcastSearch}
                onChange={(e) => setBroadcastSearch(e.target.value)}
                placeholder="Cari nama / ID siswa..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={broadcastJenjang}
                onChange={(e) => setBroadcastJenjang(e.target.value as 'Semua' | 'SD' | 'SMP' | 'SMA')}
                className="flex-1 md:flex-none px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] cursor-pointer"
                title="Filter jenjang"
              >
                <option value="Semua">Jenjang: Semua</option>
                <option value="SD">Jenjang: SD</option>
                <option value="SMP">Jenjang: SMP</option>
                <option value="SMA">Jenjang: SMA</option>
              </select>
              <select
                value={broadcastKelas}
                onChange={(e) => setBroadcastKelas(e.target.value)}
                className="flex-1 md:flex-none px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] cursor-pointer"
                title="Filter kelas"
              >
                <option value="Semua">Kelas: Semua</option>
                {broadcastKelasOptions.map((k) => (
                  <option key={k} value={k}>Kelas: {k}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Ringkasan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl p-4 border border-rose-200 shadow-sm space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kelompok A — Sudah Presensi, Nilai Belum Lengkap</span>
                <Clock className="w-4 h-4 text-rose-500" />
              </div>
              <span className="text-2xl font-extrabold text-rose-700 font-mono">{broadcastRowsA.length}</span>
              <p className="text-[10px] text-slate-400">siswa • pesan ke {broadcastPengujiGroups.length} penguji</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-amber-200 shadow-sm space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kelompok B — Nilai Ada, Presensi Pasangan Belum</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <span className="text-2xl font-extrabold text-amber-700 font-mono">{broadcastRowsB.length}</span>
              <p className="text-[10px] text-slate-400">siswa • pesan ke {broadcastTimekeeperGroups.length} timekeeper</p>
            </div>
          </div>

          {/* Tabel Kelompok A */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-rose-50 border-b border-rose-200 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-rose-900 text-xs uppercase tracking-wider">
                  Kelompok A — Sudah Presensi, Nilai Belum Lengkap
                </h3>
                <p className="text-[11px] text-rose-700 mt-0.5">
                  Siswa sudah hadir tapi nilai belum diinput • tindak lanjut ke penguji penanggung jawab.
                </p>
              </div>
              <span className="text-xs text-rose-700 font-mono font-bold shrink-0">{broadcastRowsA.length} siswa</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1E3A8A] text-white uppercase text-[10px]">
                  <tr>
                    <th className="p-3">ID</th>
                    <th className="p-3">Nama Siswa</th>
                    <th className="p-3">Jenjang & Kelas</th>
                    <th className="p-3">Presensi Siswa</th>
                    <th className="p-3">Presensi Walmur</th>
                    <th className="p-3">Pos Belum Diisi + Penguji</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {broadcastRowsA.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">
                        <CheckCircle2 className="w-5 h-5 mx-auto mb-1.5 text-emerald-500" />
                        <span className="block text-xs font-bold text-slate-600">Semua siswa yang hadir sudah lengkap nilainya.</span>
                        <span className="block text-[11px] mt-0.5">Tidak ada yang perlu dibroadcast ke penguji.</span>
                      </td>
                    </tr>
                  ) : (
                    broadcastRowsA.map((r) => {
                      const jenjang = getJenjangFromKelas(r.siswa.kelas);
                      return (
                        <tr key={r.siswa.id} className="hover:bg-slate-50">
                          <td className="p-3 font-mono font-bold text-[#1E3A8A]">{r.siswa.id}</td>
                          <td className="p-3 font-bold text-slate-800">{r.siswa.nama_siswa}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${jenjang === 'SD' ? 'bg-sky-100 text-sky-700' : jenjang === 'SMP' ? 'bg-blue-100 text-[#1E3A8A]' : 'bg-purple-100 text-purple-800'}`}>
                              {jenjang}
                            </span>
                            <span className="block mt-0.5 text-[10px] text-slate-500 font-semibold">{formatKelas(r.siswa.kelas)}</span>
                          </td>
                          <td className="p-3">
                            {r.presensiSiswa ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-[10px]">
                                <CheckCircle2 className="w-3 h-3" /> Hadir
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-700 font-bold text-[10px]">
                                <Clock className="w-3 h-3" /> Belum
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            {r.presensiWalmur ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-[10px]">
                                <CheckCircle2 className="w-3 h-3" /> Hadir
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-700 font-bold text-[10px]">
                                <Clock className="w-3 h-3" /> Belum
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="space-y-1">
                              {r.missing.map((m) => (
                                <div key={m.kategori} className="flex items-center gap-1.5 flex-wrap">
                                  <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 font-bold text-[10px]">
                                    {displayKategori(m.kategori)}
                                  </span>
                                  <span className="text-[10px] text-slate-600">• {m.penguji}</span>
                                </div>
                              ))}
                              <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                                {r.filledCount}/{r.requiredCount} pos terisi
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tabel Kelompok B */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-amber-900 text-xs uppercase tracking-wider">
                  Kelompok B — Ada Nilai, Presensi Pasangannya Belum
                </h3>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Nilai ujian siswa harus dipasangkan presensi Siswa; nilai interview harus dipasangkan presensi Walmur • tindak lanjut ke timekeeper.
                </p>
              </div>
              <span className="text-xs text-amber-800 font-mono font-bold shrink-0">{broadcastRowsB.length} siswa</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#D97706] text-white uppercase text-[10px]">
                  <tr>
                    <th className="p-3">ID</th>
                    <th className="p-3">Nama Siswa</th>
                    <th className="p-3">Jenjang & Kelas</th>
                    <th className="p-3">Nilai Terisi</th>
                    <th className="p-3">Jenis Anomali</th>
                    <th className="p-3">Timekeeper Penanggung Jawab</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {broadcastRowsB.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">
                        <CheckCircle2 className="w-5 h-5 mx-auto mb-1.5 text-emerald-500" />
                        <span className="block text-xs font-bold text-slate-600">Tidak ada anomali.</span>
                        <span className="block text-[11px] mt-0.5">Semua nilai yang terisi didukung catatan kehadiran pasangannya.</span>
                      </td>
                    </tr>
                  ) : (
                    broadcastRowsB.map((r) => {
                      const jenjang = getJenjangFromKelas(r.siswa.kelas);
                      return (
                        <tr key={r.siswa.id} className="hover:bg-slate-50">
                          <td className="p-3 font-mono font-bold text-[#1E3A8A]">{r.siswa.id}</td>
                          <td className="p-3 font-bold text-slate-800">{r.siswa.nama_siswa}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${jenjang === 'SD' ? 'bg-sky-100 text-sky-700' : jenjang === 'SMP' ? 'bg-blue-100 text-[#1E3A8A]' : 'bg-purple-100 text-purple-800'}`}>
                              {jenjang}
                            </span>
                            <span className="block mt-0.5 text-[10px] text-slate-500 font-semibold">{formatKelas(r.siswa.kelas)}</span>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {r.filled.map((kat) => (
                                <span key={kat} className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 font-bold text-[10px]">
                                  {displayKategori(kat)}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="space-y-1">
                              {r.masalahSiswa.length > 0 && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 font-bold text-[10px]">
                                    Presensi Siswa belum
                                  </span>
                                  <span className="text-[10px] text-slate-600">• {r.masalahSiswa.map(displayKategori).join(', ')}</span>
                                </div>
                              )}
                              {r.masalahWalmur.length > 0 && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="px-2 py-0.5 rounded-lg bg-orange-100 text-orange-800 font-bold text-[10px]">
                                    Presensi Walmur belum
                                  </span>
                                  <span className="text-[10px] text-slate-600">• {r.masalahWalmur.map(displayKategori).join(', ')}</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-slate-700 space-y-0.5">
                            <div className="text-[11px]"><span className="font-bold text-slate-500">Siswa:</span> {r.timekeeperSiswa}</div>
                            <div className="text-[11px]"><span className="font-bold text-slate-500">Walmur:</span> {r.timekeeperWalmur}</div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pesan Broadcast (siap salin ke WhatsApp) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Kartu pesan per penguji */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-[#1E3A8A]" />
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                      Pesan Broadcast — Penguji ({broadcastPengujiGroups.length} orang)
                    </h3>
                    <p className="text-[11px] text-slate-500">Salin lalu tempel (paste) ke WhatsApp masing-masing penguji.</p>
                  </div>
                </div>
                <button
                  onClick={handleCopyAllPenguji}
                  disabled={broadcastPengujiGroups.length === 0}
                  className="px-3 py-1.5 bg-[#1E3A8A] hover:bg-blue-900 disabled:opacity-40 text-white rounded-xl text-[11px] font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
                  title="Salin semua pesan penguji sekaligus"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Semua</span>
                </button>
              </div>
              <div className="p-4 space-y-4 max-h-[560px] overflow-y-auto">
                {broadcastPengujiGroups.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-300 rounded-xl">
                    Tidak ada pesan. Semua nilai sudah terinput.
                  </div>
                ) : (
                  broadcastPengujiGroups.map((g) => {
                    const msg = buildPesanPenguji(g.penguji, g.items);
                    return (
                      <div key={g.penguji} className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="px-3 py-2 bg-blue-50/70 border-b border-slate-200 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <strong className="text-xs text-slate-900 block truncate">{g.penguji}</strong>
                            <span className="text-[10px] text-slate-500">{g.items.length} pos belum terinput</span>
                          </div>
                          <button
                            onClick={() => handleCopyText(msg, `Pesan untuk ${g.penguji}`)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Salin</span>
                          </button>
                        </div>
                        <pre className="p-3 text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap font-sans">{msg}</pre>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Kartu pesan per timekeeper */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-[#D97706]" />
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                      Pesan Broadcast — Timekeeper ({broadcastTimekeeperGroups.length} orang)
                    </h3>
                    <p className="text-[11px] text-slate-500">Salin lalu tempel (paste) ke WhatsApp masing-masing timekeeper.</p>
                  </div>
                </div>
                <button
                  onClick={handleCopyAllTimekeeper}
                  disabled={broadcastTimekeeperGroups.length === 0}
                  className="px-3 py-1.5 bg-[#D97706] hover:bg-amber-600 disabled:opacity-40 text-white rounded-xl text-[11px] font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
                  title="Salin semua pesan timekeeper sekaligus"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Semua</span>
                </button>
              </div>
              <div className="p-4 space-y-4 max-h-[560px] overflow-y-auto">
                {broadcastTimekeeperGroups.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-300 rounded-xl">
                    Tidak ada pesan. Tidak ada anomali kehadiran.
                  </div>
                ) : (
                  broadcastTimekeeperGroups.map((g) => {
                    const msg = buildPesanTimekeeper(g.timekeeper, g.items);
                    return (
                      <div key={g.timekeeper} className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="px-3 py-2 bg-amber-50/70 border-b border-slate-200 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <strong className="text-xs text-slate-900 block truncate">{g.timekeeper}</strong>
                            <span className="text-[10px] text-slate-500">{g.items.length} catatan perlu dicek</span>
                          </div>
                          <button
                            onClick={() => handleCopyText(msg, `Pesan untuk ${g.timekeeper}`)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Salin</span>
                          </button>
                        </div>
                        <pre className="p-3 text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap font-sans">{msg}</pre>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
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
              File Excel yang diunduh mencakup 4 worksheet terpisah: <strong>web_jadwal</strong>, <strong>web_presensi</strong>, <strong>web_nilai</strong> (termasuk rincian skor JSON per pos ujian), dan <strong>web_tidak_hadir</strong> (ID, Nama, Kelas siswa jadwal Aktif yang belum presensi Siswa).
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
                        <div className="text-[10px] text-blue-200">{formatTanggalUjian(g.date) || 'Tanggal tidak tercantum'} • {g.siswa.length} siswa</div>
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
                        <div className="text-[10px] text-amber-100">{formatTanggalUjian(g.date) || 'Tanggal tidak tercantum'} • {g.siswa.length} siswa</div>
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
                    placeholder="Contoh: 27282901001"
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
                      setStudentFormData({
                        ...studentFormData,
                        kelas: e.target.value
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                    required
                  >
                    <option value="">-- Pilih Kelas --</option>
                    {studentFormData.kelas && !STUDENT_CLASS_OPTIONS.some((option) => option.value === studentFormData.kelas) && (
                      <option value={studentFormData.kelas}>{studentFormData.kelas}</option>
                    )}
                    {STUDENT_CLASS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Jenis Kelamin</label>
                  <select
                    value={studentFormData.gender}
                    onChange={(e) => setStudentFormData({ ...studentFormData, gender: e.target.value as 'L' | 'P' | '' })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                    required
                  >
                    <option value="">-- Pilih Jenis Kelamin --</option>
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
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
                  <select
                    value={studentFormData.penguji_alq_arab}
                    onChange={(e) => setStudentFormData({ ...studentFormData, penguji_alq_arab: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                  >
                    <option value="">-- Pilih Penguji --</option>
                    {pengujiList.map((p) => (
                      <option key={`alq-${p.email_penguji}`} value={p.penguji}>{p.penguji}</option>
                    ))}
                    {studentFormData.penguji_alq_arab && !pengujiList.some((p) => p.penguji === studentFormData.penguji_alq_arab) && (
                      <option value={studentFormData.penguji_alq_arab}>{studentFormData.penguji_alq_arab}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Penguji Pos Catung / Eng</label>
                  <select
                    value={studentFormData.penguji_catung_eng}
                    onChange={(e) => setStudentFormData({ ...studentFormData, penguji_catung_eng: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                  >
                    <option value="">-- Pilih Penguji --</option>
                    {pengujiList.map((p) => (
                      <option key={`catung-${p.email_penguji}`} value={p.penguji}>{p.penguji}</option>
                    ))}
                    {studentFormData.penguji_catung_eng && !pengujiList.some((p) => p.penguji === studentFormData.penguji_catung_eng) && (
                      <option value={studentFormData.penguji_catung_eng}>{studentFormData.penguji_catung_eng}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Pewawancara Orang Tua</label>
                  <select
                    value={studentFormData.interview_walmur}
                    onChange={(e) => setStudentFormData({ ...studentFormData, interview_walmur: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                  >
                    <option value="">-- Pilih Pewawancara --</option>
                    {pengujiList.map((p) => (
                      <option key={`interview-${p.email_penguji}`} value={p.penguji}>{p.penguji}</option>
                    ))}
                    {studentFormData.interview_walmur && !pengujiList.some((p) => p.penguji === studentFormData.interview_walmur) && (
                      <option value={studentFormData.interview_walmur}>{studentFormData.interview_walmur}</option>
                    )}
                  </select>
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
                    type="date"
                    value={toISODate(studentFormData.hari_tanggal)}
                    onChange={(e) => setStudentFormData({ ...studentFormData, hari_tanggal: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                    required
                  />
                  <p className="mt-1.5 text-[10px] text-slate-500 flex items-center gap-1.5">
                    {getModeUjianForDate(sesiUjianList, studentFormData.hari_tanggal) === 'Online' ? (
                      <Wifi className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <WifiOff className="w-3 h-3 text-slate-400" />
                    )}
                    Mode sesi: <strong>{getModeUjianForDate(sesiUjianList, studentFormData.hari_tanggal)}</strong>
                    <span className="text-slate-400">(diatur lewat panel Mode Ujian per Tanggal)</span>
                  </p>
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Waktu Ujian Qur'an / Arab</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      step={300}
                      value={studentTimeInputs.waktu_alq_arab.start}
                      onChange={(e) => handleTimeInputChange('waktu_alq_arab', 'start', e.target.value)}
                      className="w-full min-w-0 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                      aria-label="Jam mulai ujian Qur'an / Arab"
                    />
                    <span className="text-slate-400 font-bold">-</span>
                    <input
                      type="time"
                      step={300}
                      value={studentTimeInputs.waktu_alq_arab.end}
                      onChange={(e) => handleTimeInputChange('waktu_alq_arab', 'end', e.target.value)}
                      className="w-full min-w-0 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                      aria-label="Jam selesai ujian Qur'an / Arab"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Waktu Ujian Catung / English</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      step={300}
                      value={studentTimeInputs.waktu_catung_eng.start}
                      onChange={(e) => handleTimeInputChange('waktu_catung_eng', 'start', e.target.value)}
                      className="w-full min-w-0 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                      aria-label="Jam mulai ujian Catung / English"
                    />
                    <span className="text-slate-400 font-bold">-</span>
                    <input
                      type="time"
                      step={300}
                      value={studentTimeInputs.waktu_catung_eng.end}
                      onChange={(e) => handleTimeInputChange('waktu_catung_eng', 'end', e.target.value)}
                      className="w-full min-w-0 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                      aria-label="Jam selesai ujian Catung / English"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Waktu Wawancara Orang Tua</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      step={300}
                      value={studentTimeInputs.waktu_interview.start}
                      onChange={(e) => handleTimeInputChange('waktu_interview', 'start', e.target.value)}
                      className="w-full min-w-0 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                      aria-label="Jam mulai wawancara orang tua"
                    />
                    <span className="text-slate-400 font-bold">-</span>
                    <input
                      type="time"
                      step={300}
                      value={studentTimeInputs.waktu_interview.end}
                      onChange={(e) => handleTimeInputChange('waktu_interview', 'end', e.target.value)}
                      className="w-full min-w-0 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                      aria-label="Jam selesai wawancara orang tua"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Waktu Ujian Keseluruhan (Otomatis)</label>
                  <input
                    type="text"
                    value={studentFormData.waktu_all}
                    readOnly
                    className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-[#1E3A8A] font-mono font-bold focus:outline-none"
                    placeholder="Otomatis dari tiga waktu ujian"
                  />
                  <p className="mt-1 text-[10px] text-slate-500">Diambil dari jam paling awal sampai paling akhir.</p>
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

      {/* MODAL: Tambah/Atur Tanggal Ujian */}
      {isSessionDateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="bg-[#1E3A8A] text-white p-5 flex items-start justify-between border-b-4 border-[#D97706]">
              <div>
                <h3 className="font-extrabold text-base">Tambah / Atur Tanggal Ujian</h3>
                <p className="text-[11px] text-blue-200 mt-0.5">Tanggal tanpa siswa tetap bisa disiapkan lebih awal.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsSessionDateModalOpen(false)}
                className="p-1 text-blue-200 hover:text-white"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSessionDate} className="p-6 space-y-4 text-xs text-slate-700">
              <div>
                <label className="font-bold text-slate-800 block mb-1">Tanggal Ujian</label>
                <input
                  type="date"
                  value={sessionDateForm.date}
                  onChange={(e) => handleSessionDateChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                  required
                />
                {sessionDateForm.date && (
                  <p className="mt-1.5 text-[10px] text-slate-500">
                    {formatTanggalUjian(sessionDateForm.date)}
                  </p>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">Mode Ujian</label>
                <select
                  value={sessionDateForm.mode}
                  onChange={(e) => setSessionDateForm({ ...sessionDateForm, mode: e.target.value as ModeUjian })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                >
                  <option value="Offline">Offline</option>
                  <option value="Online">Online</option>
                </select>
                <p className="mt-1.5 text-[10px] text-slate-500">
                  Jika tanggal sudah ada, mode pada tanggal tersebut akan diperbarui.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSessionDateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1E3A8A] hover:bg-blue-900 text-white font-bold rounded-xl shadow cursor-pointer"
                >
                  Simpan Tanggal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDialog && (
        <ConfirmDialog
          isOpen
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          variant={confirmDialog.variant}
          onCancel={() => setConfirmDialog(null)}
          onConfirm={() => {
            const action = confirmDialog.onConfirm;
            setConfirmDialog(null);
            action();
          }}
        />
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
