import React, { useMemo, useRef, useState } from 'react';
import {
  Search,
  Sparkles,
  Info,
  HelpCircle,
  X,
  Clock,
  UserCheck,
  Wifi,
  WifiOff,
  CalendarDays,
  ArrowRight,
  Monitor,
  BookOpen,
  AlertCircle
} from 'lucide-react';
import {
  SiswaJadwal,
  PresensiRecord,
  SesiUjian,
  formatKelas,
  getJenjangFromKelas,
  getModeUjianForDate,
  getSortedSiswaExamStations,
  parseStartTimeMinutes,
  toISODate,
  formatTanggalUjian
} from '../types/spmb';
import { FullSizeStudentCard } from './FullSizeStudentCard';

interface LandingPageProps {
  jadwalList: SiswaJadwal[];
  presensiList: PresensiRecord[];
  sesiUjianList: SesiUjian[];
  onSelectStudentForCard: (siswa: SiswaJadwal) => void;
  onOpenLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  jadwalList,
  presensiList,
  sesiUjianList
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<SiswaJadwal | null>(null);
  const [guideTab, setGuideTab] = useState<'offline' | 'online'>('offline');
  const inputRef = useRef<HTMLInputElement>(null);

  const activeStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return jadwalList
      .filter((item) => item.status === 'Aktif')
      .filter((item) => {
        if (!query) return true;
        return (
          item.nama_siswa.toLowerCase().includes(query) ||
          item.id.toLowerCase().includes(query) ||
          item.kelas.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const dateCompare = toISODate(a.hari_tanggal).localeCompare(toISODate(b.hari_tanggal));
        if (dateCompare !== 0) return dateCompare;
        const timeCompare = parseStartTimeMinutes(a.waktu_all) - parseStartTimeMinutes(b.waktu_all);
        if (timeCompare !== 0) return timeCompare;
        return a.nama_siswa.localeCompare(b.nama_siswa);
      });
  }, [jadwalList, searchQuery]);

  const totalActive = useMemo(
    () => jadwalList.filter((item) => item.status === 'Aktif').length,
    [jadwalList]
  );

  const handleClearSearch = () => {
    setSearchQuery('');
    setSelectedStudent(null);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  if (selectedStudent) {
    return (
      <div className="space-y-8 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <FullSizeStudentCard
            siswa={selectedStudent}
            presensiList={presensiList}
            onBackToSearch={handleClearSearch}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Hero Section with Search */}
      <section className="bg-gradient-to-b from-[#1E3A8A] via-blue-900 to-[#1E3A8A] text-white py-12 px-4 sm:px-6 lg:px-8 rounded-b-3xl shadow-xl relative">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-800/80 border border-blue-600/60 rounded-full text-xs font-semibold text-amber-300 mb-4 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>PENERIMAAN SISWA BARU (SPMB) T.P 2027/2028</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight uppercase">
            CEK JADWAL UJIAN SPMB
          </h1>
          <p className="mt-2.5 text-xs sm:text-sm text-blue-100 max-w-2xl mx-auto leading-relaxed">
            Seluruh peserta aktif ditampilkan di bawah. Gunakan kolom pencarian untuk menyaring berdasarkan nama,
            nomor pendaftaran, atau kelas.
          </p>

          <div className="mt-7 max-w-2xl mx-auto relative text-left">
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
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, nomor pendaftaran, atau kelas..."
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
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Daftar peserta */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">Daftar Peserta Ujian</h2>
              <p className="text-xs text-slate-500">
                {searchQuery
                  ? `Menampilkan ${activeStudents.length} dari ${totalActive} peserta aktif.`
                  : `${totalActive} peserta aktif terjadwal.`}
              </p>
            </div>
            <span className="text-[11px] font-bold text-[#1E3A8A] bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1 self-start sm:self-auto">
              Diurutkan sesuai tanggal & jam ujian
            </span>
          </div>

          {activeStudents.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 shadow-sm space-y-2">
              <Search className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">Tidak ada peserta yang cocok</p>
              <p className="text-xs text-slate-500">
                Pastikan penulisan nama atau nomor pendaftaran sudah benar.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeStudents.map((siswa) => {
                const unit = getJenjangFromKelas(siswa.kelas);
                const mode = getModeUjianForDate(sesiUjianList, siswa.hari_tanggal);
                const stations = getSortedSiswaExamStations(siswa, unit);
                const isOnline = mode === 'Online';

                return (
                  <div
                    key={siswa.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                  >
                    <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                            unit === 'SD'
                              ? 'bg-amber-100 text-amber-800'
                              : unit === 'SMP'
                              ? 'bg-blue-100 text-[#1E3A8A]'
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {unit}
                          </span>
                          <div className="min-w-0">
                            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                              {siswa.nama_siswa}
                            </h3>
                            <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                              <span className="font-mono font-bold text-slate-700">{siswa.id}</span>
                              <span>•</span>
                              <span>{formatKelas(siswa.kelas)}</span>
                              <span>•</span>
                              <span>{siswa.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border ${
                            isOnline
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                            {mode}
                          </span>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-50 text-[#1E3A8A] border border-blue-200">
                            <CalendarDays className="w-3.5 h-3.5" />
                            {formatTanggalUjian(siswa.hari_tanggal)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 sm:p-5 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {stations.map((station) => (
                          <div key={station.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/80">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                              {station.title}
                            </p>
                            <p className="text-xs font-bold text-[#1E3A8A] font-mono mt-1">{station.waktu}</p>
                            <p className="text-[11px] text-slate-600 mt-1">
                              Penguji: <strong className="text-slate-800">{station.penguji || '-'}</strong>
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {isOnline ? 'Ujian Online' : station.ruangan || '-'}
                            </p>
                          </div>
                        ))}

                        <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/70">
                          <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                            Wawancara Orang Tua
                          </p>
                          <p className="text-xs font-bold text-amber-800 font-mono mt-1">{siswa.waktu_interview}</p>
                          <p className="text-[11px] text-slate-600 mt-1">
                            Pewawancara: <strong className="text-slate-800">{siswa.interview_walmur || '-'}</strong>
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {isOnline ? 'Wawancara Online' : siswa.ruangan_walmur || '-'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                          <span className="inline-flex items-center gap-1.5 text-slate-600">
                            <Clock className="w-3.5 h-3.5 text-[#1E3A8A]" />
                            Total waktu ujian:
                            <strong className="text-slate-900 font-mono">{siswa.waktu_all || '-'}</strong>
                          </span>
                          {isOnline ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold">
                              <Monitor className="w-3.5 h-3.5" /> Ujian dilakukan secara online
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-slate-600">
                              <UserCheck className="w-3.5 h-3.5 text-[#D97706]" />
                              Ruang siswa: <strong className="text-slate-900">{siswa.ruangan_siswa}</strong>
                            </span>
                          )}
                        </div>

                        {!isOnline && (
                          <button
                            type="button"
                            onClick={() => setSelectedStudent(siswa)}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 self-start sm:self-auto cursor-pointer"
                          >
                            <BookOpen className="w-4 h-4 text-amber-300" />
                            Lihat Kartu & Unduh PNG
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Guidelines */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center font-bold shrink-0">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  PANDUAN TES SPMB AL-WILDAN ISLAMIC SCHOOL 29 DEPOK
                </h3>
                <p className="text-xs text-slate-500">
                  Pilih panduan sesuai mode ujian peserta.
                </p>
              </div>
            </div>

            <div className="inline-flex bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setGuideTab('offline')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  guideTab === 'offline' ? 'bg-white text-[#1E3A8A] shadow-sm' : 'text-slate-500'
                }`}
              >
                Panduan Offline
              </button>
              <button
                type="button"
                onClick={() => setGuideTab('online')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  guideTab === 'online' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
                }`}
              >
                Panduan Online
              </button>
            </div>
          </div>

          {guideTab === 'offline' ? (
            <>
              <div className="p-4 bg-blue-50/70 rounded-xl border border-blue-200 flex items-start gap-3">
                <HelpCircle className="w-5 h-5 text-[#1E3A8A] shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 leading-relaxed space-y-1">
                  <strong className="text-[#1E3A8A] text-sm block font-bold">
                    Apa Maksud Status Presensi "Menunggu Check-in"?
                  </strong>
                  <p>
                    Status <strong>"Menunggu Check-in"</strong> menunjukkan bahwa calon siswa terdaftar resmi pada jadwal sesi tes, namun <strong>belum melakukan pemindaian barcode fisik di meja registrasi Timekeeper</strong> di sekolah.
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
                    Pilih calon siswa pada daftar, klik <strong>"Lihat Kartu & Unduh PNG"</strong>, lalu unduh kartu ujian atau cetak langsung untuk dibawa saat hari tes.
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
            </>
          ) : (
            <>
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-start gap-3">
                <Monitor className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 leading-relaxed space-y-1">
                  <strong className="text-emerald-800 text-sm block font-bold">
                    Panduan Ujian Online
                  </strong>
                  <p>
                    Peserta dengan badge <strong>Online</strong> mengikuti seluruh rangkaian tes secara daring. Link atau platform resmi akan diinformasikan oleh panitia SPMB.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 text-xs text-slate-600 pt-2">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs">
                    1
                  </span>
                  <h4 className="font-bold text-slate-800 text-sm">Persiapan Perangkat</h4>
                  <p className="leading-relaxed">
                    Siapkan laptop/HP, koneksi internet stabil, kamera, mikrofon, dan ruangan yang tenang. Pastikan perangkat terisi daya.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs">
                    2
                  </span>
                  <h4 className="font-bold text-slate-800 text-sm">Check-in Online</h4>
                  <p className="leading-relaxed">
                    Masuk 15 menit sebelum jadwal. Gunakan nama lengkap dan nomor pendaftaran yang sama dengan data SPMB.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs">
                    3
                  </span>
                  <h4 className="font-bold text-slate-800 text-sm">Ikuti Alur Ujian</h4>
                  <p className="leading-relaxed">
                    Tes Al-Qur'an/Bahasa Arab, Calistung/English, dan wawancara orang tua mengikuti jadwal yang tertera pada kartu peserta.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs">
                    4
                  </span>
                  <h4 className="font-bold text-slate-800 text-sm">Tata Tertib</h4>
                  <p className="leading-relaxed">
                    Berpakaian rapi, tidak membuka aplikasi lain, dan tidak dibantu oleh orang lain selama ujian berlangsung.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 leading-relaxed">
                  <strong className="block text-amber-800 font-bold mb-0.5">Kendala Teknis</strong>
                  Jika mengalami kendala koneksi, perangkat, atau kesulitan masuk sesi ujian, segera hubungi panitia SPMB melalui kontak resmi yang tertera di halaman ini.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
