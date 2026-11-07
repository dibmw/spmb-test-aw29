export type Role = 'ADMIN' | 'TIMEKEEPER' | 'PENGUJI' | 'PUBLIC';

export interface SiswaJadwal {
  id: string; // e.g. "SPMB-29-001"
  nama_siswa: string;
  kelas: string; // e.g. "SD 1", "SMP 7", "SMA 10"
  gender: 'L' | 'P';
  ruangan_siswa: string;
  waktu_all: string; // e.g. "07:30 - 11:30"
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
  status: 'Aktif' | 'Reschedule' | 'Selesai';
   status_kehadiran_siswa?: 'Hadir' | 'Belum Hadir' | '';
   status_kehadiran_walmur?: 'Hadir' | 'Belum Hadir' | '';
   gelombang?: string;
 }

export type ModeUjian = 'Online' | 'Offline';

export interface SesiUjian {
  id_sesi: string;
  hari_tanggal: string;
  mode_ujian: ModeUjian;
  catatan: string;
  updated_at: string;
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
  kelekatan_skor: number; // 1 - 10
  kelekatan_catatan: string;
  asertif_skor: number; // 1 - 10
  asertif_catatan: string;
  kognitif_skor: number; // 1 - 10
  kognitif_catatan: string;
  peran_skor: number; // 1 - 10
  peran_catatan: string;
  sentuhan_skor: number; // 1 - 10
  sentuhan_catatan: string;
  kebutuhan_khusus_skor: number; // 1 - 10
  kebutuhan_khusus_catatan: string;
  pantauan_ibadah_skor: number; // 1 - 10
  pantauan_ibadah_catatan: string;
  pertemanan_skor: number; // 1 - 10
  pertemanan_catatan: string;
  nilai_karakter_skor: number; // 1 - 10
  nilai_karakter_catatan: string;
  kesulitan_skor: number; // 1 - 10
  kesulitan_catatan: string;
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
export function getJenjangFromKelas(rawKelas: string): 'SD' | 'SMP' | 'SMA' {
  const digits = rawKelas ? parseInt(rawKelas.replace(/\D+/g, ''), 10) : NaN;
  if (!isNaN(digits)) {
    if (digits < 7) return 'SD';
    if (digits >= 7 && digits <= 9) return 'SMP';
    if (digits > 9) return 'SMA';
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

const BULAN_INDONESIA: Record<string, number> = {
  januari: 1,
  februari: 2,
  maret: 3,
  april: 4,
  mei: 5,
  juni: 6,
  juli: 7,
  agustus: 8,
  september: 9,
  oktober: 10,
  november: 11,
  desember: 12
};

/**
 * Normalisasi tanggal ke format ISO (yyyy-mm-dd).
 * Mendukung format:
 * - ISO: "2026-11-14", "2026-11-14T07:00:00Z"
 * - Excel Serial Date: "46340.291666666664" atau 46340
 * - Format Indonesia teks: "Sabtu, 14 November 2026", "14 November 2026"
 * - Format DMY numerik: "14/11/2026", "14-11-2026"
 */
export function toISODate(value: string | number): string {
  const raw = String(value || '').trim();
  if (!raw) return '';

  // 1. Excel Serial Date Number (contoh: 46340.291666666664 -> 2026-11-14)
  const num = parseFloat(raw);
  if (!isNaN(num) && /^\d+(\.\d+)?$/.test(raw) && num > 25000 && num < 80000) {
    const utcDays = Math.floor(num - 25569);
    const dateInfo = new Date(utcDays * 86400 * 1000);
    const y = dateInfo.getUTCFullYear();
    const m = String(dateInfo.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dateInfo.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. ISO DateTime yyyy-mm-ddTHH:mm:ss
  const isoDateTimeMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (isoDateTimeMatch) {
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
      const jakarta = new Date(parsed.getTime() + 7 * 60 * 60 * 1000);
      return `${jakarta.getUTCFullYear()}-${String(jakarta.getUTCMonth() + 1).padStart(2, '0')}-${String(jakarta.getUTCDate()).padStart(2, '0')}`;
    }
    return `${isoDateTimeMatch[1]}-${isoDateTimeMatch[2]}-${isoDateTimeMatch[3]}`;
  }

  // 3. ISO Date yyyy-mm-dd atau yyyy/mm/dd
  const isoMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${String(isoMatch[2]).padStart(2, '0')}-${String(isoMatch[3]).padStart(2, '0')}`;
  }

  // 4. Format DMY numerik: DD/MM/YYYY atau DD-MM-YYYY
  const dmyMatch = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const day = String(dmyMatch[1]).padStart(2, '0');
    const month = String(dmyMatch[2]).padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // 5. Format teks Indonesia: "14 November 2026" atau "Sabtu, 14 November 2026"
  const textMatch = raw.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (textMatch) {
    const day = parseInt(textMatch[1], 10);
    const month = BULAN_INDONESIA[textMatch[2].toLowerCase()];
    const year = parseInt(textMatch[3], 10);
    if (month && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 6. Fallback parse JS Date umum (asalkan bukan angka string acak)
  if (!/^\d+$/.test(raw)) {
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    }
  }

  return '';
}

/**
 * Format tanggal menjadi "Minggu, 20 September 2026".
 */
export function formatTanggalUjian(value: string): string {
  const iso = toISODate(value);
  if (!iso) return value || '-';
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Ambil jam mulai dan selesai dari teks rentang waktu, contoh "08:00 - 08:45".
 */
export function parseTimeRange(value: string): { start: number; end: number } | null {
  const matches = String(value || '').match(/(\d{1,2})[.:](\d{2})/g);
  if (!matches || matches.length === 0) return null;
  const toMinutes = (text: string) => {
    const match = text.match(/(\d{1,2})[.:](\d{2})/);
    if (!match) return NaN;
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  };
  const start = toMinutes(matches[0]);
  const end = matches.length > 1 ? toMinutes(matches[matches.length - 1]) : start;
  if (isNaN(start) || isNaN(end)) return null;
  return { start, end };
}

function formatMinutes(total: number): string {
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Rangkum waktu_all dari tiga waktu ujian: ambil mulai paling awal dan selesai paling akhir.
 */
export function summarizeWaktuAll(
  waktuAlqArab: string,
  waktuCatungEng: string,
  waktuInterview: string
): string {
  const ranges = [waktuAlqArab, waktuCatungEng, waktuInterview]
    .map(parseTimeRange)
    .filter((range): range is { start: number; end: number } => range !== null);

  if (ranges.length === 0) return '';

  const start = Math.min(...ranges.map((range) => range.start));
  const end = Math.max(...ranges.map((range) => range.end));

  return `${formatMinutes(start)} - ${formatMinutes(end)}`;
}

/**
 * Rentang waktu ujian seluruh siswa aktif pada satu tanggal:
 * jam mulai paling awal hingga jam selesai paling akhir.
 */
export function getWaktuRangeForDate(jadwalList: SiswaJadwal[], hariTanggal: string): string {
  const iso = toISODate(hariTanggal);
  if (!iso) return '';

  const ranges = jadwalList
    .filter((siswa) => siswa.status === 'Aktif' && toISODate(siswa.hari_tanggal) === iso)
    .flatMap((siswa) => [
      siswa.waktu_all,
      siswa.waktu_alq_arab,
      siswa.waktu_catung_eng,
      siswa.waktu_interview,
    ])
    .map(parseTimeRange)
    .filter((range): range is { start: number; end: number } => range !== null);

  if (ranges.length === 0) return '';

  const start = Math.min(...ranges.map((range) => range.start));
  const end = Math.max(...ranges.map((range) => range.end));

  return `${formatMinutes(start)} - ${formatMinutes(end)}`;
}

/**
 * Pilih data sesi terbaik untuk satu tanggal.
 */
export function pickSesiUjianForDate(sesiList: SesiUjian[], hariTanggal: string): SesiUjian | undefined {
  const iso = toISODate(hariTanggal);
  if (!iso) return undefined;
  const matches = sesiList.filter((item) => toISODate(item.hari_tanggal) === iso);
  if (matches.length === 0) return undefined;

  return [...matches].sort((a, b) => {
    const aHasId = a.id_sesi ? 1 : 0;
    const bHasId = b.id_sesi ? 1 : 0;
    if (aHasId !== bHasId) return bHasId - aHasId;
    const aTime = Date.parse(a.updated_at) || 0;
    const bTime = Date.parse(b.updated_at) || 0;
    return bTime - aTime;
  })[0];
}

/**
 * Cari mode ujian berdasarkan tanggal sesi. Default Offline.
 */
export function getModeUjianForDate(sesiList: SesiUjian[], hariTanggal: string): ModeUjian {
  const sesi = pickSesiUjianForDate(sesiList, hariTanggal);
  return sesi?.mode_ujian === 'Online' ? 'Online' : 'Offline';
}

/**
 * Status kehadiran efektif: override admin menang, jika kosong ikut presensi timekeeper.
 */
export function resolveKehadiran(
  siswa: SiswaJadwal,
  presensiList: PresensiRecord[],
  tipe: 'Siswa' | 'Walmur'
): 'Hadir' | 'Belum Hadir' {
  const override = tipe === 'Siswa'
    ? siswa.status_kehadiran_siswa
    : siswa.status_kehadiran_walmur;

  if (override === 'Hadir' || override === 'Belum Hadir') return override;

  const hadir = presensiList.some(
    (p) => p.id_siswa.toUpperCase() === siswa.id.toUpperCase() && p.tipe_presensi === tipe
  );
  return hadir ? 'Hadir' : 'Belum Hadir';
}

export function getSortedSiswaExamStations(siswa: SiswaJadwal, unit: 'SD' | 'SMP' | 'SMA'): ExamStationItem[] {
  const stationA: ExamStationItem = {
    id: 'ALQ_ARAB',
    title: unit === 'SD' ? "Ujian Al-Qur'an" : "Ujian Al-Qur'an & Bahasa Arab",
    waktu: siswa.waktu_alq_arab,
    posBadge: 'Pos A',
    penguji: siswa.penguji_alq_arab,
    ruangan: siswa.ruangan_siswa,
    startMinutes: parseStartTimeMinutes(siswa.waktu_alq_arab)
  };

  const stationB: ExamStationItem = {
    id: 'CATUNG_ENG',
    title: unit === 'SD' ? "Ujian Calistung" : "Ujian English",
    waktu: siswa.waktu_catung_eng,
    posBadge: 'Pos B',
    penguji: siswa.penguji_catung_eng,
    ruangan: siswa.ruangan_siswa,
    startMinutes: parseStartTimeMinutes(siswa.waktu_catung_eng)
  };

  return [stationA, stationB].sort((a, b) => a.startMinutes - b.startMinutes);
}
