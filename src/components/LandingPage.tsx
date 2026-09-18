import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  Sparkles,
  Info,
  HelpCircle,
  X,
  ChevronRight,
  Clock,
  UserCheck
} from 'lucide-react';
import { SiswaJadwal, PresensiRecord, formatKelas, getJenjangFromKelas } from '../types/spmb';
import { FullSizeStudentCard } from './FullSizeStudentCard';

interface LandingPageProps {
  jadwalList: SiswaJadwal[];
  presensiList: PresensiRecord[];
  onSelectStudentForCard: (siswa: SiswaJadwal) => void;
  onOpenLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  jadwalList,
  presensiList,
  onSelectStudentForCard,
  onOpenLogin
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<SiswaJadwal | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter suggestions from query
  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return jadwalList.filter((item) => {
      if (item.status === 'Selesai') return false;
      return (
        item.nama_siswa.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.kelas.toLowerCase().includes(q) ||
        item.nomor_walmur.includes(q)
      );
    }).slice(0, 8); // Top 8 suggestions
  }, [jadwalList, searchQuery]);

  const handleSelectStudent = (siswa: SiswaJadwal) => {
    setSelectedStudent(siswa);
    setSearchQuery(siswa.nama_siswa);
    setIsDropdownOpen(false);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSelectedStudent(null);
    setIsDropdownOpen(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && suggestions.length > 0) {
      handleSelectStudent(suggestions[0]);
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Hero Section with Integrated Search Bar */}
      <section className="bg-gradient-to-b from-[#1E3A8A] via-blue-900 to-[#1E3A8A] text-white py-12 px-4 sm:px-6 lg:px-8 rounded-b-3xl shadow-xl relative">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-800/80 border border-blue-600/60 rounded-full text-xs font-semibold text-amber-300 mb-4 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>PENERIMAAN SISWA BARU (SPMB) T.P 2027/2028</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight uppercase">
            CEK JADWAL & KARTU UJIAN SPMB
          </h1>
          <p className="mt-2.5 text-xs sm:text-sm text-blue-100 max-w-2xl mx-auto leading-relaxed">
            Ketik Nama Calon Siswa atau Nomor Pendaftaran untuk memilih peserta dan menampilkan kartu ujian.
          </p>

          {/* Search Box with Autocomplete Suggestions (No Unit Filter) */}
          <div ref={searchContainerRef} className="mt-7 max-w-2xl mx-auto relative text-left">
            <div className="relative bg-white rounded-2xl shadow-xl border-2 border-[#D97706]/40 flex items-center transition-all focus-within:ring-4 focus-within:ring-amber-400/20 focus-within:border-[#D97706]">
              <div className="pl-4 pr-2 flex items-center pointer-events-none text-[#1E3A8A]">
                <Search className="w-5 h-5" />
              </div>
              
              <input
                ref={inputRef}
                id="input-cari-calon-siswa"
                name="search_query_spmb_siswa"
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="words"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                value={searchQuery}
                onFocus={() => setIsDropdownOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                  if (selectedStudent && e.target.value !== selectedStudent.nama_siswa) {
                    setSelectedStudent(null);
                  }
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ketik Nama Calon Siswa atau Nomor Pendaftaran..."
                className="w-full py-3.5 pl-2 pr-10 bg-transparent text-slate-800 text-sm placeholder-slate-400 font-medium focus:outline-none"
              />

              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="pr-4 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title="Hapus pencarian"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* LIVE SUGGESTION DROPDOWN */}
            {isDropdownOpen && searchQuery.trim().length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-30 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="p-2.5 bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider flex justify-between items-center">
                  <span>Saran Peserta ({suggestions.length})</span>
                  <span className="text-[10px] text-slate-400">Klik untuk melihat kartu full size</span>
                </div>

                {suggestions.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 space-y-1">
                    <p className="text-xs font-semibold text-slate-700">Tidak ada peserta yang cocok</p>
                    <p className="text-[11px] text-slate-400">
                      Pastikan penulisan nama atau nomor pendaftaran (contoh: "Rayhan" atau "SPMB-29-001") sudah benar.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {suggestions.map((item) => {
                      const unit = getJenjangFromKelas(item.kelas, item.grade);
                      const isSelected = selectedStudent?.id === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelectStudent(item)}
                          className={`p-3 sm:px-4 sm:py-3 flex items-center justify-between gap-3 hover:bg-blue-50/70 transition-colors cursor-pointer group ${
                            isSelected ? 'bg-blue-50 border-l-4 border-[#1E3A8A]' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 shadow-xs ${
                              unit === 'SD' 
                                ? 'bg-amber-100 text-amber-800' 
                                : unit === 'SMP'
                                ? 'bg-blue-100 text-[#1E3A8A]'
                                : 'bg-purple-100 text-purple-800'
                            }`}>
                              {unit}
                            </span>
                            <div className="min-w-0">
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#1E3A8A] transition-colors truncate">
                                {item.nama_siswa}
                              </h4>
                              <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                <span className="font-mono font-semibold text-slate-700">{item.id}</span>
                                <span>•</span>
                                <span>{formatKelas(item.kelas)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex items-center gap-2">
                            <div className="hidden sm:block">
                              <span className="text-[10px] text-slate-400 block truncate max-w-[130px]">{item.hari_tanggal || 'Hari & Tanggal'}</span>
                              <span className="text-xs font-bold text-[#1E3A8A]">{item.waktu_all}</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#1E3A8A] group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* CASE 1: Student is Selected -> Show Full Size Card */}
        {selectedStudent ? (
          <FullSizeStudentCard
            siswa={selectedStudent}
            presensiList={presensiList}
            onBackToSearch={handleClearSearch}
          />
        ) : (
          /* CASE 2: No Student Selected Yet -> Prompt and Instructions */
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-8 sm:p-12 text-center border border-slate-200 shadow-sm max-w-2xl mx-auto space-y-4">
              <div className="w-16 h-16 bg-blue-50 text-[#1E3A8A] rounded-2xl flex items-center justify-center mx-auto shadow-xs border border-blue-100">
                <Search className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-slate-900">
                  Pencarian & Pratinjau Kartu Ujian Resmi
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
                  Ketik nama calon siswa atau nomor pendaftaran pada kolom pencarian di atas, lalu <strong>klik pada nama siswa di daftar saran</strong> untuk memunculkan kartu ujian.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Guidelines & Explanation of SPMB System */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center font-bold shrink-0">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                PANDUAN & PENJELASAN SISTEM TES SPMB AL-WILDAN ISLAMIC SCHOOL 29 DEPOK
              </h3>
              <p className="text-xs text-slate-500">
                Informasi alur kedatangan, tes paralel, dan presensi kedatangan untuk orang tua calon siswa
              </p>
            </div>
          </div>

          {/* Status Explanation Highlight Box */}
          <div className="p-4 bg-blue-50/70 rounded-xl border border-blue-200 flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-[#1E3A8A] shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 leading-relaxed space-y-1">
              <strong className="text-[#1E3A8A] text-sm block font-bold">
                Apa Maksud Status Presensi "Menunggu Check-in"?
              </strong>
              <p>
                Status <strong>"Menunggu Check-in"</strong> menunjukkan bahwa calon siswa terdaftar resmi pada jadwal sesi tes hari ini, namun <strong>belum melakukan pemindaian barcode fisik di meja registrasi Timekeeper</strong> di sekolah.
              </p>
              <p className="text-slate-600">
                Setelah tiba di sekolah dan kartu ujian dipindai oleh petugas registrasi, status otomatis berubah menjadi <strong>"Hadir di Lokasi"</strong>.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-600 pt-2">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="w-6 h-6 rounded-full bg-[#1E3A8A] text-white flex items-center justify-center font-bold text-xs">
                1
              </span>
              <h4 className="font-bold text-slate-800 text-sm">Unduh & Bawa Kartu Tes</h4>
              <p className="leading-relaxed">
                Pilih calon siswa melalui kotak pencarian di atas, lalu unduh kartu ujian format PNG atau cetak langsung untuk dibawa saat hari tes.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="w-6 h-6 rounded-full bg-[#D97706] text-white flex items-center justify-center font-bold text-xs">
                2
              </span>
              <h4 className="font-bold text-slate-800 text-sm">Scan QR Code di Meja Registrasi</h4>
              <p className="leading-relaxed">
                Tiba di sekolah 15 menit sebelum sesi dimulai. Petugas Timekeeper memindai Barcode/QR Code pada kartu peserta untuk mencatat kehadiran siswa dan orang tua.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs">
                3
              </span>
              <h4 className="font-bold text-slate-800 text-sm">Ujian Siswa & Wawancara Paralel</h4>
              <p className="leading-relaxed">
                Ujian calon siswa (Al-Qur'an & Ujian Calistung untuk SD / English untuk SMP-SMA) dan Wawancara Orang Tua berjalan secara paralel bersamaan di ruangan masing-masing yang telah ditentukan.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
