import * as XLSX from 'xlsx';
import { SiswaJadwal, toISODate } from '../types/spmb';

export const JADWAL_CSV_HEADERS = [
  'id',
  'nama_siswa',
  'kelas',
  'gender',
  'ruangan_siswa',
  'waktu_all',
  'waktu_alq_arab',
  'waktu_catung_eng',
  'ruangan_walmur',
  'penguji_alq_arab',
  'penguji_catung_eng',
  'timekeeper_siswa',
  'interview_walmur',
  'timekeeper_walmur',
  'waktu_interview',
  'hari_tanggal',
  'status',
  'status_kehadiran_siswa',
  'status_kehadiran_walmur',
  'gelombang'
];

export const JADWAL_SAMPLE_ROWS = [
  {
    id: 'SPMB-29-102',
    nama_siswa: 'MUHAMMAD AL FATIH',
    kelas: 'SD 1',
    gender: 'L',
    ruangan_siswa: 'Lantai 1 - R. 101',
    waktu_all: '08:00 - 09:30',
    waktu_alq_arab: '08:00 - 08:30',
    waktu_catung_eng: '08:30 - 09:00',
    ruangan_walmur: 'Lantai 2 - R. Audiovisual',
    penguji_alq_arab: 'USTADZ FIRDAMANSYAH, S.Pd.I',
    penguji_catung_eng: 'LENY FEBRIYANTI, S.T.',
    timekeeper_siswa: "NISI JUNIATUN NISA'",
    interview_walmur: 'ABDUL MUTHALIB, M.Pd.',
    timekeeper_walmur: 'MUHAMMAD RIDWAN, S.Pd.I.',
    waktu_interview: '09:00 - 09:30',
    hari_tanggal: '2026-11-15',
    status: 'Aktif',
    status_kehadiran_siswa: '',
    status_kehadiran_walmur: '',
    gelombang: 'GELOMBANG 1'
  },
  {
    id: 'SPMB-29-103',
    nama_siswa: 'AISYAH AQILAH PUTRI',
    kelas: '7 AE',
    gender: 'P',
    ruangan_siswa: 'https://us06web.zoom.us/j/87890900887',
    waktu_all: '09:30 - 11:00',
    waktu_alq_arab: '09:30 - 10:00',
    waktu_catung_eng: '10:00 - 10:30',
    ruangan_walmur: 'https://us06web.zoom.us/j/87890900887',
    penguji_alq_arab: 'THAIF TAMIMAH',
    penguji_catung_eng: 'CILIA HAKIKY, S.Si.',
    timekeeper_siswa: "NISI JUNIATUN NISA'",
    interview_walmur: 'ABDUL MUTHALIB, M.Pd.',
    timekeeper_walmur: 'MUHAMMAD RIDWAN, S.Pd.I.',
    waktu_interview: '10:30 - 11:00',
    hari_tanggal: '2026-11-15',
    status: 'Aktif',
    status_kehadiran_siswa: '',
    status_kehadiran_walmur: '',
    gelombang: 'INDEN 2027/2028'
  }
];

// Generate CSV content string
export function generateJadwalCsvTemplate(): string {
  const ws = XLSX.utils.json_to_sheet(JADWAL_SAMPLE_ROWS, { header: JADWAL_CSV_HEADERS });
  return XLSX.utils.sheet_to_csv(ws);
}

// Trigger direct browser download of CSV template
export function downloadJadwalCsvTemplate(): void {
  const csvContent = generateJadwalCsvTemplate();
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `template_jadwal_spmb29_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Normalisasi header (case/space/underscore insensitive)
function normKey(k: string): string {
  return String(k || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export interface ParseJadwalResult {
  valid: SiswaJadwal[];
  invalidCount: number;
  totalParsed: number;
  errors: string[];
}

// Parse uploaded CSV / Excel file into standardized SiswaJadwal[]
export async function parseJadwalFile(file: File): Promise<ParseJadwalResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('File tidak memiliki sheet data yang valid.');
  }

  const rawRows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  if (rawRows.length === 0) {
    throw new Error('File excel / CSV kosong atau tidak memiliki data.');
  }

  const valid: SiswaJadwal[] = [];
  const errors: string[] = [];
  let invalidCount = 0;

  rawRows.forEach((row, index) => {
    // Normalisasi kunci baris
    const normalizedRow: Record<string, any> = {};
    Object.keys(row).forEach((k) => {
      normalizedRow[normKey(k)] = row[k];
    });

    const rawId = normalizedRow['id'] || normalizedRow['id_siswa'] || normalizedRow['no_pendaftaran'];
    const rawNama = normalizedRow['nama_siswa'] || normalizedRow['nama'] || normalizedRow['nama_lengkap'];

    if (!rawId || !String(rawId).trim()) {
      invalidCount++;
      errors.push(`Baris ${index + 2}: ID Siswa kosong.`);
      return;
    }

    if (!rawNama || !String(rawNama).trim()) {
      invalidCount++;
      errors.push(`Baris ${index + 2}: Nama Siswa kosong (ID: ${rawId}).`);
      return;
    }

    const gVal = String(normalizedRow['gender'] || normalizedRow['jenis_kelamin'] || '').trim().toLowerCase();
    const isFemale = gVal === 'p' || gVal === 'perempuan' || gVal === 'female' || gVal === 'wanita';

    const rawStatus = String(normalizedRow['status'] || 'Aktif').trim();
    const status: SiswaJadwal['status'] =
      rawStatus.toLowerCase() === 'selesai' ? 'Selesai' :
      rawStatus.toLowerCase() === 'reschedule' ? 'Reschedule' : 'Aktif';

    const rawDateVal = normalizedRow['hari_tanggal'] !== undefined && normalizedRow['hari_tanggal'] !== ''
      ? normalizedRow['hari_tanggal']
      : normalizedRow['tanggal'];
    const cleanDate = toISODate(rawDateVal) || String(rawDateVal || '').trim();

    const siswa: SiswaJadwal = {
      id: String(rawId).trim(),
      nama_siswa: String(rawNama).trim().toUpperCase(),
      kelas: String(normalizedRow['kelas'] || 'SD 1').trim(),
      gender: isFemale ? 'P' : 'L',
      ruangan_siswa: String(normalizedRow['ruangan_siswa'] || normalizedRow['ruangan'] || 'R. 101').trim(),
      waktu_all: String(normalizedRow['waktu_all'] || normalizedRow['waktu'] || '').trim(),
      waktu_alq_arab: String(normalizedRow['waktu_alq_arab'] || '').trim(),
      waktu_catung_eng: String(normalizedRow['waktu_catung_eng'] || '').trim(),
      ruangan_walmur: String(normalizedRow['ruangan_walmur'] || 'R. Audiovisual').trim(),
      penguji_alq_arab: String(normalizedRow['penguji_alq_arab'] || '').trim(),
      penguji_catung_eng: String(normalizedRow['penguji_catung_eng'] || '').trim(),
      timekeeper_siswa: String(normalizedRow['timekeeper_siswa'] || '').trim(),
      interview_walmur: String(normalizedRow['interview_walmur'] || '').trim(),
      timekeeper_walmur: String(normalizedRow['timekeeper_walmur'] || '').trim(),
      waktu_interview: String(normalizedRow['waktu_interview'] || '').trim(),
      hari_tanggal: cleanDate,
      status,
      status_kehadiran_siswa: normalizedRow['status_kehadiran_siswa'] === 'Hadir' ? 'Hadir' :
                              normalizedRow['status_kehadiran_siswa'] === 'Belum Hadir' ? 'Belum Hadir' : '',
      status_kehadiran_walmur: normalizedRow['status_kehadiran_walmur'] === 'Hadir' ? 'Hadir' :
                               normalizedRow['status_kehadiran_walmur'] === 'Belum Hadir' ? 'Belum Hadir' : '',
      gelombang: String(normalizedRow['gelombang'] || '').trim()
    };

    valid.push(siswa);
  });

  return {
    valid,
    invalidCount,
    totalParsed: rawRows.length,
    errors
  };
}
