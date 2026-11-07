import { SiswaJadwal, PengujiAccount, PresensiRecord, NilaiRecord, SesiUjian } from '../types/spmb';

export const ADMIN_EMAIL = 'kurikulum.alwildan29@gmail.com';

export const INITIAL_PENGUJI_LIST: PengujiAccount[] = [
  {
    penguji: 'Ustadz Ahmad Fauzan, Lc.',
    email_penguji: 'penguji1@example.local',
    assignedRoles: ['PENGUJI']
  },
  {
    penguji: 'Ustadzah Siti Maryam, S.Pd.',
    email_penguji: 'penguji2@example.local',
    assignedRoles: ['PENGUJI']
  },
  {
    penguji: 'Ustadz Muhammad Rizqi, B.A.',
    email_penguji: 'penguji3@example.local',
    assignedRoles: ['PENGUJI']
  },
  {
    penguji: 'Ustadzah Nurul Hidayah, M.Pd.',
    email_penguji: 'penguji4@example.local',
    assignedRoles: ['PENGUJI', 'TIMEKEEPER']
  },
  {
    penguji: 'Ustadz Abdullah Said, S.Pd.I',
    email_penguji: 'penguji5@example.local',
    assignedRoles: ['PENGUJI']
  },
  {
    penguji: 'Mr. David Wilson, B.Ed.',
    email_penguji: 'penguji6@example.local',
    assignedRoles: ['PENGUJI']
  },
  {
    penguji: 'Ustadz Ihsan Al-Hafidz',
    email_penguji: 'penguji7@example.local',
    assignedRoles: ['PENGUJI']
  },
  {
    penguji: 'Ustadzah Dewi Sartika, S.Psi.',
    email_penguji: 'penguji8@example.local',
    assignedRoles: ['PENGUJI']
  },
  {
    penguji: 'Ustadz Bambang Hermanto',
    email_penguji: 'timekeeper1@example.local',
    assignedRoles: ['TIMEKEEPER']
  },
  {
    penguji: 'Ustadzah Fatimah Zahra',
    email_penguji: 'timekeeper2@example.local',
    assignedRoles: ['TIMEKEEPER']
  },
  {
    penguji: 'Tim Kurikulum AL-WILDAN 29',
    email_penguji: ADMIN_EMAIL,
    assignedRoles: ['ADMIN', 'PENGUJI', 'TIMEKEEPER']
  }
];

export const INITIAL_JADWAL_LIST: SiswaJadwal[] = [
  {
    id: 'SPMB-29-001',
    nama_siswa: 'Muhammad Rayhan Al-Fatih',
    kelas: 'SD 1',
    gender: 'L',
    ruangan_siswa: 'R. 101 (Gedung A)',
    waktu_all: '08:00 - 10:30',
    waktu_alq_arab: '08:00 - 08:45',
    waktu_catung_eng: '08:45 - 09:30',
    ruangan_walmur: 'R. Audiovisual 1',
    penguji_alq_arab: 'Ustadz Ihsan Al-Hafidz',
    penguji_catung_eng: 'Ustadzah Siti Maryam, S.Pd.',
    timekeeper_siswa: 'Ustadz Bambang Hermanto',
    interview_walmur: 'Ustadzah Dewi Sartika, S.Psi.',
    timekeeper_walmur: 'Ustadzah Fatimah Zahra',
    waktu_interview: '09:30 - 10:15',
    hari_tanggal: 'Sabtu, 19 September 2026',
     status: 'Aktif',
     status_kehadiran_siswa: '',
     status_kehadiran_walmur: '',
     gelombang: 'Gel. 1 2027/2028'
   },
   {
     id: 'SPMB-29-002',
     nama_siswa: 'Aisyah Humaira Azzahra',
     kelas: 'SD 1',
     gender: 'P',
     ruangan_siswa: 'R. 102 (Gedung A)',
     waktu_all: '08:00 - 10:30',
     waktu_alq_arab: '08:45 - 09:30',
     waktu_catung_eng: '08:00 - 08:45',
     ruangan_walmur: 'R. Audiovisual 2',
     penguji_alq_arab: 'Ustadzah Nurul Hidayah, M.Pd.',
     penguji_catung_eng: 'Ustadzah Siti Maryam, S.Pd.',
     timekeeper_siswa: 'Ustadz Bambang Hermanto',
     interview_walmur: 'Ustadz Abdullah Said, S.Pd.I',
     timekeeper_walmur: 'Ustadzah Fatimah Zahra',
     waktu_interview: '08:45 - 09:30',
     hari_tanggal: 'Sabtu, 19 September 2026',
     status: 'Aktif',
     status_kehadiran_siswa: '',
     status_kehadiran_walmur: '',
     gelombang: 'Gel. 1 2027/2028'
   },
   {
     id: 'SPMB-29-003',
     nama_siswa: 'Zaidan Bilal Al-Ghazali',
     kelas: 'SMP 7',
     gender: 'L',
     ruangan_siswa: 'R. 201 (Gedung B)',
     waktu_all: '08:30 - 11:00',
     waktu_alq_arab: '08:30 - 09:20',
     waktu_catung_eng: '09:20 - 10:10',
     ruangan_walmur: 'R. Rapat Guru',
     penguji_alq_arab: 'Ustadz Ahmad Fauzan, Lc.',
     penguji_catung_eng: 'Mr. David Wilson, B.Ed.',
     timekeeper_siswa: 'Ustadzah Nurul Hidayah, M.Pd.',
     interview_walmur: 'Ustadzah Dewi Sartika, S.Psi.',
     timekeeper_walmur: 'Ustadz Bambang Hermanto',
     waktu_interview: '09:30 - 10:15',
     hari_tanggal: 'Sabtu, 19 September 2026',
     status: 'Aktif',
     status_kehadiran_siswa: '',
     status_kehadiran_walmur: '',
     gelombang: 'Gel. 1 2027/2028'
   },
   {
     id: 'SPMB-29-004',
     nama_siswa: 'Khadijah Nayla Putri',
     kelas: 'SMP 7',
     gender: 'P',
     ruangan_siswa: 'R. 202 (Gedung B)',
     waktu_all: '08:30 - 11:00',
     waktu_alq_arab: '09:20 - 10:10',
     waktu_catung_eng: '08:30 - 09:20',
     ruangan_walmur: 'R. Rapat Direktur',
     penguji_alq_arab: 'Ustadz Muhammad Rizqi, B.A.',
     penguji_catung_eng: 'Mr. David Wilson, B.Ed.',
     timekeeper_siswa: 'Ustadzah Nurul Hidayah, M.Pd.',
     interview_walmur: 'Ustadz Abdullah Said, S.Pd.I',
     timekeeper_walmur: 'Ustadzah Fatimah Zahra',
     waktu_interview: '08:30 - 09:15',
     hari_tanggal: 'Sabtu, 19 September 2026',
     status: 'Aktif',
     status_kehadiran_siswa: '',
     status_kehadiran_walmur: '',
     gelombang: 'Gel. 2 2027/2028'
   },
   {
     id: 'SPMB-29-005',
     nama_siswa: 'Fatih Al-Kautsar Pratama',
     kelas: 'SMA 10',
     gender: 'L',
     ruangan_siswa: 'R. 301 (Gedung C)',
     waktu_all: '09:00 - 11:30',
     waktu_alq_arab: '09:00 - 09:50',
     waktu_catung_eng: '09:50 - 10:40',
     ruangan_walmur: 'R. Konseling 1',
     penguji_alq_arab: 'Ustadz Ahmad Fauzan, Lc.',
     penguji_catung_eng: 'Mr. David Wilson, B.Ed.',
     timekeeper_siswa: 'Ustadz Bambang Hermanto',
     interview_walmur: 'Ustadzah Dewi Sartika, S.Psi.',
     timekeeper_walmur: 'Ustadzah Fatimah Zahra',
     waktu_interview: '10:00 - 10:45',
     hari_tanggal: 'Sabtu, 19 September 2026',
     status: 'Aktif',
     status_kehadiran_siswa: '',
     status_kehadiran_walmur: '',
     gelombang: 'Gel. 2 2027/2028'
   },
   {
     id: 'SPMB-29-006',
     nama_siswa: 'Maryam Syakira Annisa',
     kelas: 'SMA 10',
     gender: 'P',
     ruangan_siswa: 'R. 302 (Gedung C)',
     waktu_all: '09:00 - 11:30',
     waktu_alq_arab: '09:50 - 10:40',
     waktu_catung_eng: '09:00 - 09:50',
     ruangan_walmur: 'R. Konseling 2',
     penguji_alq_arab: 'Ustadz Muhammad Rizqi, B.A.',
     penguji_catung_eng: 'Mr. David Wilson, B.Ed.',
     timekeeper_siswa: 'Ustadzah Fatimah Zahra',
     interview_walmur: 'Ustadz Abdullah Said, S.Pd.I',
     timekeeper_walmur: 'Ustadz Bambang Hermanto',
     waktu_interview: '10:30 - 11:15',
     hari_tanggal: 'Sabtu, 19 September 2026',
     status: 'Aktif',
     status_kehadiran_siswa: '',
     status_kehadiran_walmur: '',
     gelombang: 'Gel. 2 2027/2028'
   }
];

export const INITIAL_SESI_UJIAN: SesiUjian[] = [];

export const INITIAL_PRESENSI_LIST: PresensiRecord[] = [
  {
    id: 'PRES-001',
    timestamp: '2026-09-17 07:45:12',
    id_siswa: 'SPMB-29-001',
    nama_siswa: 'Muhammad Rayhan Al-Fatih',
    tipe_presensi: 'Siswa',
    petugas_timekeeper: 'Ustadz Bambang Hermanto',
    status: 'Hadir'
  },
  {
    id: 'PRES-002',
    timestamp: '2026-09-17 07:48:03',
    id_siswa: 'SPMB-29-001',
    nama_siswa: 'Muhammad Rayhan Al-Fatih',
    tipe_presensi: 'Walmur',
    petugas_timekeeper: 'Ustadzah Fatimah Zahra',
    status: 'Hadir'
  },
  {
    id: 'PRES-003',
    timestamp: '2026-09-17 07:55:40',
    id_siswa: 'SPMB-29-002',
    nama_siswa: 'Aisyah Humaira Azzahra',
    tipe_presensi: 'Siswa',
    petugas_timekeeper: 'Ustadz Bambang Hermanto',
    status: 'Hadir'
  },
  {
    id: 'PRES-004',
    timestamp: '2026-09-17 08:15:10',
    id_siswa: 'SPMB-29-003',
    nama_siswa: 'Zaidan Bilal Al-Ghazali',
    tipe_presensi: 'Siswa',
    petugas_timekeeper: 'Ustadzah Nurul Hidayah, M.Pd.',
    status: 'Hadir'
  }
];

export const INITIAL_NILAI_LIST: NilaiRecord[] = [
  {
    id: 'NILAI-001',
    timestamp: '2026-09-17 08:35:22',
    id_siswa: 'SPMB-29-001',
    nama_siswa: 'Muhammad Rayhan Al-Fatih',
    kategori_ujian: 'Al-Quran SD',
    nama_penguji: 'Ustadz Ihsan Al-Hafidz',
    email_penguji: 'ihsan.hafidz@alwildan29.sch.id',
    detail_skor_json: {
      tilawah: 88,
      catatan: 'Makhraj huruf konsisten, tajwid dasar mad thabi\'i baik.'
    },
    skor_akhir_rata2: 88,
    catatan_umum: 'Sangat baik, siap masuk tahfidz reguler.'
  },
  {
    id: 'NILAI-002',
    timestamp: '2026-09-17 09:12:05',
    id_siswa: 'SPMB-29-001',
    nama_siswa: 'Muhammad Rayhan Al-Fatih',
    kategori_ujian: 'Calistung',
    nama_penguji: 'Ustadzah Siti Maryam, S.Pd.',
    email_penguji: 'siti.maryam@alwildan29.sch.id',
    detail_skor_json: {
      baca_indo: 90,
      paham_indo: 85,
      baca_inggris: 80,
      paham_inggris: 78,
      catatan: 'Kecakapan membaca sangat lancar, kosakata bahasa Inggris dasar sudah dikuasai.'
    },
    skor_akhir_rata2: 83.25,
    catatan_umum: 'Lulus tes kesiapan akademik SD AL-WILDAN.'
  }
];

export const SCHOOL_LOGO_URL = '/logo-alwildan29.png';
export const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1HWv5c9qK1VckVO533mFHrhGGNFFLtl8a0KKiIyTfxrk/edit?usp=sharing';
