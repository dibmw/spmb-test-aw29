export type Role = 'ADMIN' | 'TIMEKEEPER' | 'PENGUJI' | 'PUBLIC';

export interface SiswaJadwal {
  id: string; // e.g. "SPMB-29-001"
  nama_siswa: string;
  kelas: string; // e.g. "SD 1", "SMP 7", "SMA 10"
  gender: 'L' | 'P';
  nomor_walmur: string;
  email_walmur: string;
  grade: 'SD' | 'SMP' | 'SMA';
  ruangan_siswa: string;
  ord_alq_arab: string; // e.g. "Pos 1 (08.00 - 08.45)"
  ord_catung_eng: string; // e.g. "Pos 2 (08.45 - 09.30)"
  waktu_all: string; // e.g. "07.30 - 11.30 WIB"
  waktu_alq_arab: string;
  waktu_catung_eng: string;
  ruangan_walmur: string;
  penguji_alq_arab: string;
  penguji_catung_eng: string;
  timekeeper_siswa: string;
  interview_walmur: string;
  timekeeper_walmur: string;
  waktu_interview: string;
  hari_tanggal: string;
  status: 'Aktif' | 'Selesai';
}

export interface PengujiAccount {
  penguji: string;
  email_penguji: string;
  assignedRoles?: Role[];
}

export interface PresensiRecord {
  id?: string;
  timestamp: string;
  id_siswa: string;
  nama_siswa: string;
  tipe_presensi: 'Siswa' | 'Walmur';
  petugas_timekeeper: string;
  status: 'Hadir' | 'Belum Hadir';
}

export type KategoriUjian = 
  | 'Calistung' 
  | 'English' 
  | 'Al-Quran SD' 
  | 'Al-Quran SMP/SMA' 
  | 'Bahasa Arab' 
  | 'Interview Walmur';

export interface NilaiRecord {
  id?: string;
  timestamp: string;
  id_siswa: string;
  nama_siswa: string;
  kategori_ujian: KategoriUjian;
  nama_penguji: string;
  email_penguji: string;
  detail_skor_json: Record<string, number | string>;
  skor_akhir_rata2: number;
  catatan_umum: string;
}

export interface UserSession {
  email: string;
  nama: string;
  availableRoles: Role[];
  activeRole: Role;
}

// Scoring breakdown schemas
export interface SkorCalistungSD {
  baca_indo: number; // 0 - 100
  paham_indo: number; // 0 - 100
  baca_inggris: number; // 0 - 100
  paham_inggris: number; // 0 - 100
  catatan_baca_indo: string;
  catatan_paham_indo: string;
  catatan_baca_inggris: string;
  catatan_paham_inggris: string;
  catatan: string;
}

export interface SkorEnglishSMP_SMA {
  fluency: number; // 1 - 4
  vocab_grammar: number; // 1 - 4
  critical_thinking: number; // 1 - 4
  expression_clarity: number; // 1 - 4
  catatan: string;
}

export interface SkorQuranSD {
  tilawah: number; // 0 - 100
  catatan: string;
}

export interface SkorQuranSMP_SMA {
  makhorijul_huruf: number; // 1 - 4
  sifatul_huruf: number; // 1 - 4
  kelancaran: number; // 1 - 4
  catatan: string;
}

export interface SkorBahasaArabSMP_SMA {
  percaya_diri: number; // 1 - 4
  kelancaran: number; // 1 - 4
  kejelasan: number; // 1 - 4
  adab: number; // 1 - 4
  catatan: string;
}

export interface SkorInterviewWalmur {
  ibadah_skor: number; // 1 - 5
  ibadah_catatan: string;
  akhlak_skor: number; // 1 - 5
  akhlak_catatan: string;
  pola_asuh_skor: number; // 1 - 5
  pola_asuh_catatan: string;
  kebiasaan_belajar_skor: number; // 1 - 5
  kebiasaan_belajar_catatan: string;
  gadget_skor: number; // 1 - 5
  gadget_catatan: string;
  catatan_umum: string;
}

/**
 * Format string kelas menjadi format "Kelas {angka}", contoh: "Kelas 1", "Kelas 7", "Kelas 10"
 */
export function formatKelas(rawKelas: string): string {
  if (!rawKelas) return 'Kelas 1';
  const digits = rawKelas.replace(/\D+/g, '').trim();
  if (digits) {
    return `Kelas ${digits}`;
  }
  return rawKelas.startsWith('Kelas') ? rawKelas : `Kelas ${rawKelas}`;
}

/**
 * Mendapatkan jenjang unit (SD, SMP, SMA):
 * SD jika < 7, SMP jika 7-9, SMA jika > 9
 */
export function getJenjangFromKelas(rawKelas: string, fallbackGrade?: string): 'SD' | 'SMP' | 'SMA' {
  const digits = rawKelas ? parseInt(rawKelas.replace(/\D+/g, ''), 10) : NaN;
  if (!isNaN(digits)) {
    if (digits < 7) return 'SD';
    if (digits >= 7 && digits <= 9) return 'SMP';
    if (digits > 9) return 'SMA';
  }
  if (fallbackGrade === 'SD' || fallbackGrade === 'SMP' || fallbackGrade === 'SMA') {
    return fallbackGrade;
  }
  const upper = (rawKelas || '').toUpperCase();
  if (upper.includes('SMA')) return 'SMA';
  if (upper.includes('SMP')) return 'SMP';
  return 'SD';
}

export interface ExamStationItem {
  id: 'ALQ_ARAB' | 'CATUNG_ENG';
  title: string;
  waktu: string;
  posBadge: string;
  penguji: string;
  ruangan: string;
  startMinutes: number;
}

export function parseStartTimeMinutes(timeStr: string): number {
  if (!timeStr) return 9999;
  const match = timeStr.match(/(\d{1,2})[.:](\d{2})/);
  if (!match) return 9999;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

export function getSortedSiswaExamStations(siswa: SiswaJadwal, unit: 'SD' | 'SMP' | 'SMA'): ExamStationItem[] {
  const stationA: ExamStationItem = {
    id: 'ALQ_ARAB',
    title: unit === 'SD' ? "Ujian Al-Qur'an" : "Ujian Al-Qur'an & Bahasa Arab",
    waktu: siswa.waktu_alq_arab,
    posBadge: siswa.ord_alq_arab || 'Pos A',
    penguji: siswa.penguji_alq_arab,
    ruangan: siswa.ruangan_siswa,
    startMinutes: parseStartTimeMinutes(siswa.waktu_alq_arab)
  };

  const stationB: ExamStationItem = {
    id: 'CATUNG_ENG',
    title: unit === 'SD' ? "Ujian Calistung" : "Ujian English",
    waktu: siswa.waktu_catung_eng,
    posBadge: siswa.ord_catung_eng || 'Pos B',
    penguji: siswa.penguji_catung_eng,
    ruangan: siswa.ruangan_siswa,
    startMinutes: parseStartTimeMinutes(siswa.waktu_catung_eng)
  };

  return [stationA, stationB].sort((a, b) => a.startMinutes - b.startMinutes);
}

