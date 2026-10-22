import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileCheck, 
  Search, 
  Filter, 
  Clock, 
  MapPin, 
  User, 
  Award, 
  CheckCircle2, 
  AlertCircle, 
  Edit3, 
  PlusCircle, 
  BookOpen, 
  Sparkles,
  Video,
  ExternalLink
} from 'lucide-react';
import { SiswaJadwal, NilaiRecord, PresensiRecord, UserSession, KategoriUjian, SesiUjian, formatKelas, getJenjangFromKelas, parseStartTimeMinutes, resolveKehadiran, getModeUjianForDate } from '../types/spmb';
import { apiService } from '../services/apiService';
import { getMeetingUrl } from '../utils/meeting';
import { RubrikModal } from './RubrikModal';

interface PengujiDashboardProps {
  session: UserSession;
  jadwalList: SiswaJadwal[];
  nilaiList: NilaiRecord[];
  presensiList: PresensiRecord[];
  sesiUjianList: SesiUjian[];
  onGradeSaved: (savedRecord: NilaiRecord) => void;
  showToast: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}

export const PengujiDashboard: React.FC<PengujiDashboardProps> = ({
  session,
  jadwalList,
  nilaiList,
  presensiList,
  sesiUjianList,
  onGradeSaved,
  showToast
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'GRADED'>('ALL');

  // Modal State
  const [selectedStudent, setSelectedStudent] = useState<SiswaJadwal | null>(null);
  const [selectedKategori, setSelectedKategori] = useState<KategoriUjian>('Calistung');
  const [isRubrikOpen, setIsRubrikOpen] = useState(false);

  // Filter students assigned to this examiner (or all if admin)
  const isSuperAdmin = session.activeRole === 'ADMIN';

  // Robust jenjang resolution (falls back to parsing "kelas" if grade field is missing/bad)
  const gradeOf = (s: SiswaJadwal): 'SD' | 'SMP' | 'SMA' => getJenjangFromKelas(s.kelas);

  const myStudents = useMemo(() => {
    return jadwalList.filter((s) => {
      if (s.status !== 'Aktif') return false;
      if (isSuperAdmin) return true;
      const examinerName = session.nama.trim().toLowerCase();
      return (
        s.penguji_alq_arab.trim().toLowerCase() === examinerName ||
        s.penguji_catung_eng.trim().toLowerCase() === examinerName ||
        s.interview_walmur.trim().toLowerCase() === examinerName
      );
    });
  }, [jadwalList, session.nama, isSuperAdmin]);

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

  // Determine what exam categories this examiner handles for a given student
  const getExaminerCategoriesForStudent = (s: SiswaJadwal): KategoriUjian[] => {
    const examinerName = session.nama.trim().toLowerCase();
    const categories: KategoriUjian[] = [];
    const unit = gradeOf(s);

    const isAlqExaminer = isSuperAdmin || s.penguji_alq_arab.trim().toLowerCase() === examinerName;
    const isCatungExaminer = isSuperAdmin || s.penguji_catung_eng.trim().toLowerCase() === examinerName;
    const isInterviewExaminer = isSuperAdmin || s.interview_walmur.trim().toLowerCase() === examinerName;

    if (isAlqExaminer) {
      if (unit === 'SD') {
        categories.push('Al-Quran SD');
      } else {
        categories.push('Al-Quran SMP/SMA');
        categories.push('Bahasa Arab');
      }
    }

    if (isCatungExaminer) {
      if (unit === 'SD') {
        categories.push('Calistung');
      } else {
        categories.push('English');
      }
    }

    if (isInterviewExaminer) {
      categories.push('Interview Walmur');
    }

    return categories;
  };

  // Session time for a student based on the categories handled by THIS examiner
  const getExaminerSessionTime = (s: SiswaJadwal, cats: KategoriUjian[]): string => {
    const candidates: { label: string; t: number }[] = [];
    const hasAlq = cats.includes('Al-Quran SD') || cats.includes('Al-Quran SMP/SMA') || cats.includes('Bahasa Arab');
    const hasCatung = cats.includes('Calistung') || cats.includes('English');
    const hasInterview = cats.includes('Interview Walmur');
    if (hasAlq) candidates.push({ label: s.waktu_alq_arab, t: parseStartTimeMinutes(s.waktu_alq_arab) });
    if (hasCatung) candidates.push({ label: s.waktu_catung_eng, t: parseStartTimeMinutes(s.waktu_catung_eng) });
    if (hasInterview) candidates.push({ label: s.waktu_interview, t: parseStartTimeMinutes(s.waktu_interview) });
    if (candidates.length === 0) return s.waktu_all;
    candidates.sort((a, b) => a.t - b.t);
    return candidates[0].label;
  };

  // One row per exam category, with the student's meeting link shown once per unique URL
  const tableRows = useMemo(() => {
    return [...myStudents]
      .sort((a, b) => {
        const ta = parseStartTimeMinutes(getExaminerSessionTime(a, getExaminerCategoriesForStudent(a)));
        const tb = parseStartTimeMinutes(getExaminerSessionTime(b, getExaminerCategoriesForStudent(b)));
        return ta - tb;
      })
      .flatMap((siswa) => {
        const categories = getExaminerCategoriesForStudent(siswa);
        const studentGrades = nilaiList.filter(n => n.id_siswa.toUpperCase() === siswa.id.toUpperCase());
        const mode = getModeUjianForDate(sesiUjianList, siswa.hari_tanggal);
        const isOnline = mode === 'Online';
        const studentMeetingUrl = isOnline ? getMeetingUrl(siswa.ruangan_siswa) : null;
        const walmurMeetingUrl = isOnline ? getMeetingUrl(siswa.ruangan_walmur) : null;
        const displayedMeetingUrls = new Set<string>();

        return categories.map((kategori) => {
          const isInterview = kategori === 'Interview Walmur';
          const meetingUrl = isInterview ? walmurMeetingUrl : studentMeetingUrl;
          const showMeeting = Boolean(meetingUrl) && !displayedMeetingUrls.has(meetingUrl as string);
          if (showMeeting && meetingUrl) displayedMeetingUrls.add(meetingUrl);

          return {
            siswa,
            kategori,
            gradeRecord: studentGrades.find((grade) => grade.kategori_ujian === kategori),
            categoryTime: isInterview
              ? siswa.waktu_interview
              : kategori === 'Calistung' || kategori === 'English'
                ? siswa.waktu_catung_eng
                : siswa.waktu_alq_arab,
            categoryRoom: isInterview ? siswa.ruangan_walmur : siswa.ruangan_siswa,
            attendance: resolveKehadiran(siswa, livePresensi, isInterview ? 'Walmur' : 'Siswa'),
            attendanceType: isInterview ? 'Wali' : 'Siswa',
            isOnline,
            hasMeetingUrl: Boolean(meetingUrl),
            joinUrl: showMeeting ? meetingUrl : null
          };
        });
      });
  }, [myStudents, nilaiList, livePresensi, sesiUjianList]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return tableRows.filter((row) => {
      if (query) {
        const matchesQuery = row.siswa.nama_siswa.toLowerCase().includes(query)
          || row.siswa.id.toLowerCase().includes(query)
          || row.siswa.kelas.toLowerCase().includes(query)
          || row.kategori.toLowerCase().includes(query);
        if (!matchesQuery) return false;
      }
      if (statusFilter === 'GRADED') return Boolean(row.gradeRecord);
      if (statusFilter === 'PENDING') return !row.gradeRecord;
      return true;
    });
  }, [tableRows, searchQuery, statusFilter]);

  const handleOpenGrading = (siswa: SiswaJadwal, kategori: KategoriUjian) => {
    setSelectedStudent(siswa);
    setSelectedKategori(kategori);
    setIsRubrikOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-[#1E3A8A] text-white rounded-2xl p-6 shadow-lg relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#D97706] text-white text-[10px] font-bold uppercase rounded-md">
            Portal Penguji & Evaluator
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Antrean Ujian & Pengisian Nilai SPMB
          </h1>
          <p className="text-xs text-blue-100">
            Penguji: <strong className="text-amber-300">{session.nama}</strong> {isSuperAdmin && '(Akses Penguji Admin)'}
          </p>
        </div>

        {/* Quick Stats Pill */}
        <div className="flex items-center gap-3">
          <div className="bg-blue-900/80 px-4 py-2 rounded-xl border border-blue-700/60 text-center">
            <span className="text-[10px] text-blue-200 block uppercase font-bold">Total Siswa</span>
            <span className="text-lg font-extrabold text-white">{myStudents.length}</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari siswa berdasarkan nama / ID..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 w-full md:w-auto justify-end">
          <span className="text-xs text-slate-500 font-semibold mr-1">Status:</span>
          {(['ALL', 'PENDING', 'GRADED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === st
                  ? 'bg-[#1E3A8A] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'ALL' && 'Semua'}
              {st === 'PENDING' && 'Belum Dinilai'}
              {st === 'GRADED' && 'Sudah Dinilai'}
            </button>
          ))}
        </div>
      </div>

      {/* Students Queue Table */}
      {filteredRows.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center mx-auto mb-3">
            <User className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Tidak Ada Antrean</h3>
          <p className="text-xs text-slate-500 mt-1">
            Tidak ada siswa yang cocok dengan filter atau Anda belum ditugaskan pada pos ujian saat ini.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-xs">
              <thead className="bg-[#1E3A8A] text-white">
                <tr>
                  <th className="px-3 py-3 text-center font-semibold w-12">No</th>
                  <th className="px-3 py-3 font-semibold">Siswa</th>
                  <th className="px-3 py-3 font-semibold">Unit/Kelas</th>
                  <th className="px-3 py-3 font-semibold">Kategori</th>
                  <th className="px-3 py-3 font-semibold">Jadwal</th>
                  <th className="px-3 py-3 font-semibold">Kehadiran</th>
                  <th className="px-3 py-3 font-semibold">Zoom/Ruang</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row, index) => (
                  <tr key={`${row.siswa.id}-${row.kategori}`} className="hover:bg-slate-50/80 transition-colors align-middle">
                    <td className="px-3 py-3 text-center font-mono text-slate-500">{index + 1}</td>
                    <td className="px-3 py-3">
                      <div className="font-bold text-slate-900">{row.siswa.nama_siswa}</div>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">{row.siswa.id}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <span className="px-1.5 py-0.5 bg-blue-50 text-[#1E3A8A] text-[10px] font-black rounded">
                          {gradeOf(row.siswa)}
                        </span>
                        <span className="font-semibold text-slate-700">{formatKelas(row.siswa.kelas)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-700">
                      {row.kategori === 'Interview Walmur' ? 'Wawancara Orang Tua' : row.kategori}
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-mono text-[11px] font-bold text-[#1E3A8A]">{row.categoryTime || '-'}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                        row.attendance === 'Hadir'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {row.attendanceType}: {row.attendance}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {row.isOnline ? (
                        row.joinUrl ? (
                          <a
                            href={row.joinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition-all"
                          >
                            <Video className="w-3 h-3" />
                            Gabung Zoom
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : row.hasMeetingUrl ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <span className="text-[10px] font-semibold text-amber-700">Link belum tersedia</span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                          <MapPin className="w-3 h-3 text-[#D97706]" />
                          {row.categoryRoom || '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                        row.gradeRecord
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {row.gradeRecord ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {row.gradeRecord ? 'Sudah Dinilai' : 'Belum Dinilai'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => handleOpenGrading(row.siswa, row.kategori)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                          row.gradeRecord
                            ? 'bg-white border border-slate-300 hover:bg-slate-100 text-slate-700'
                            : 'bg-[#1E3A8A] hover:bg-blue-900 text-white shadow-sm'
                        }`}
                      >
                        {row.gradeRecord ? (
                          <>
                            <Edit3 className="w-3 h-3 text-blue-600" />
                            Edit Nilai
                          </>
                        ) : (
                          <>
                            <PlusCircle className="w-3 h-3 text-[#D97706]" />
                            Input Nilai
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rubrik Grading Modal */}
      {selectedStudent && (
        <RubrikModal
          isOpen={isRubrikOpen}
          siswa={selectedStudent}
          kategori={selectedKategori}
          existingNilai={nilaiList.find(
            n => n.id_siswa.toUpperCase() === selectedStudent.id.toUpperCase() && n.kategori_ujian === selectedKategori
          )}
          session={session}
          onClose={() => setIsRubrikOpen(false)}
          onGradeSaved={(record) => {
            onGradeSaved(record);
            setIsRubrikOpen(false);
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
};
