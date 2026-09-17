import React, { useState, useMemo } from 'react';
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
  Sparkles 
} from 'lucide-react';
import { SiswaJadwal, NilaiRecord, PresensiRecord, UserSession, KategoriUjian, formatKelas } from '../types/spmb';
import { RubrikModal } from './RubrikModal';

interface PengujiDashboardProps {
  session: UserSession;
  jadwalList: SiswaJadwal[];
  nilaiList: NilaiRecord[];
  presensiList: PresensiRecord[];
  onGradeSaved: (savedRecord: NilaiRecord) => void;
  showToast: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}

export const PengujiDashboard: React.FC<PengujiDashboardProps> = ({
  session,
  jadwalList,
  nilaiList,
  presensiList,
  onGradeSaved,
  showToast
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'GRADED'>('ALL');
  const [postFilter, setPostFilter] = useState<string>('ALL');

  // Modal State
  const [selectedStudent, setSelectedStudent] = useState<SiswaJadwal | null>(null);
  const [selectedKategori, setSelectedKategori] = useState<KategoriUjian>('Calistung');
  const [isRubrikOpen, setIsRubrikOpen] = useState(false);

  // Filter students assigned to this examiner (or all if admin)
  const isSuperAdmin = session.activeRole === 'ADMIN';

  const myStudents = useMemo(() => {
    return jadwalList.filter((s) => {
      if (isSuperAdmin) return true;
      const examinerName = session.nama.trim().toLowerCase();
      return (
        s.penguji_alq_arab.trim().toLowerCase() === examinerName ||
        s.penguji_catung_eng.trim().toLowerCase() === examinerName ||
        s.interview_walmur.trim().toLowerCase() === examinerName
      );
    });
  }, [jadwalList, session.nama, isSuperAdmin]);

  // Determine what exam categories this examiner handles for a given student
  const getExaminerCategoriesForStudent = (s: SiswaJadwal): KategoriUjian[] => {
    const examinerName = session.nama.trim().toLowerCase();
    const categories: KategoriUjian[] = [];

    const isAlqExaminer = isSuperAdmin || s.penguji_alq_arab.trim().toLowerCase() === examinerName;
    const isCatungExaminer = isSuperAdmin || s.penguji_catung_eng.trim().toLowerCase() === examinerName;
    const isInterviewExaminer = isSuperAdmin || s.interview_walmur.trim().toLowerCase() === examinerName;

    if (isAlqExaminer) {
      if (s.grade === 'SD') {
        categories.push('Al-Quran SD');
      } else {
        categories.push('Al-Quran SMP/SMA');
        categories.push('Bahasa Arab');
      }
    }

    if (isCatungExaminer) {
      if (s.grade === 'SD') {
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

  // Find grades submitted for a student
  const getStudentGrades = (studentId: string) => {
    return nilaiList.filter(n => n.id_siswa.toUpperCase() === studentId.toUpperCase());
  };

  // Filtered student list
  const filteredStudents = useMemo(() => {
    return myStudents.filter((s) => {
      const q = searchQuery.trim().toLowerCase();
      const matchQuery = !q || s.nama_siswa.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || s.kelas.toLowerCase().includes(q);
      
      const studentGrades = getStudentGrades(s.id);
      const categories = getExaminerCategoriesForStudent(s);
      const isAllGraded = categories.length > 0 && categories.every(cat => studentGrades.some(g => g.kategori_ujian === cat));
      
      let matchStatus = true;
      if (statusFilter === 'GRADED') matchStatus = isAllGraded;
      if (statusFilter === 'PENDING') matchStatus = !isAllGraded;

      return matchQuery && matchStatus;
    });
  }, [myStudents, searchQuery, statusFilter, nilaiList]);

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
            <span className="text-[10px] text-blue-200 block uppercase font-bold">Total Antrean</span>
            <span className="text-lg font-extrabold text-white">{myStudents.length}</span>
          </div>
          <div className="bg-emerald-950/80 px-4 py-2 rounded-xl border border-emerald-700/60 text-center">
            <span className="text-[10px] text-emerald-200 block uppercase font-bold">Total Entri Nilai</span>
            <span className="text-lg font-extrabold text-emerald-300">{nilaiList.length}</span>
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
              {st === 'PENDING' && 'Belum Lengkap'}
              {st === 'GRADED' && 'Sudah Dinilai'}
            </button>
          ))}
        </div>
      </div>

      {/* Students Queue Table/Cards */}
      {filteredStudents.length === 0 ? (
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredStudents.map((siswa) => {
            const categories = getExaminerCategoriesForStudent(siswa);
            const studentGrades = getStudentGrades(siswa.id);
            const hasStudentAttendance = presensiList.some(p => p.id_siswa === siswa.id && p.tipe_presensi === 'Siswa');

            return (
              <div
                key={siswa.id}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col"
              >
                {/* Header */}
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-[#1E3A8A] text-white text-[10px] font-black rounded uppercase">
                        {siswa.grade}
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-600">{siswa.id}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        hasStudentAttendance 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {hasStudentAttendance ? 'Hadir di Lokasi' : 'Belum Presensi'}
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 mt-1">
                      {siswa.nama_siswa}
                    </h3>
                    <p className="text-xs text-slate-500">
                      <strong className="text-[#1E3A8A] font-semibold">{formatKelas(siswa.kelas)}</strong> • Ruangan Siswa: <strong>{siswa.ruangan_siswa}</strong>
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Jadwal Sesi</span>
                    <span className="text-xs font-bold text-[#1E3A8A] font-mono">{siswa.waktu_all}</span>
                  </div>
                </div>

                {/* Categories & Actions */}
                <div className="p-4 space-y-3 flex-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Penugasan Penilaian Anda:
                  </span>

                  <div className="space-y-2">
                    {categories.map((cat) => {
                      const gradeRecord = studentGrades.find(g => g.kategori_ujian === cat);
                      const isGraded = !!gradeRecord;
                      const displayCategoryName = cat === 'Interview Walmur' ? 'Wawancara Orang Tua' : cat;

                      return (
                        <div
                          key={cat}
                          className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all ${
                            isGraded 
                              ? 'bg-emerald-50/50 border-emerald-200' 
                              : 'bg-slate-50 border-slate-200 hover:border-blue-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-800">{displayCategoryName}</span>
                              {isGraded ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Sudah Dinilai</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded">
                                  <Clock className="w-3 h-3" />
                                  <span>Belum Dinilai</span>
                                </span>
                              )}
                            </div>

                            {isGraded && (
                              <div className="text-[11px] text-slate-600 mt-1">
                                Skor Akhir: <strong className="text-emerald-800 font-mono">{gradeRecord.skor_akhir_rata2.toFixed(2)}</strong>
                                {gradeRecord.catatan_umum && (
                                  <span className="text-slate-500 italic block truncate max-w-xs mt-0.5">
                                    "{gradeRecord.catatan_umum}"
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => handleOpenGrading(siswa, cat)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              isGraded
                                ? 'bg-white border border-slate-300 hover:bg-slate-100 text-slate-700'
                                : 'bg-[#1E3A8A] hover:bg-blue-900 text-white shadow-sm'
                            }`}
                          >
                            {isGraded ? (
                              <>
                                <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                                <span>Koreksi / Edit Nilai</span>
                              </>
                            ) : (
                              <>
                                <PlusCircle className="w-3.5 h-3.5 text-[#D97706]" />
                                <span>Input Nilai</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer notes */}
                <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-1">
                  <span>
                    Wawancara Orang Tua ({siswa.ruangan_walmur}) • Pewawancara: <strong className="text-slate-800">{siswa.interview_walmur}</strong>
                  </span>
                  <span className="font-mono text-slate-500">{siswa.waktu_interview}</span>
                </div>
              </div>
            );
          })}
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
