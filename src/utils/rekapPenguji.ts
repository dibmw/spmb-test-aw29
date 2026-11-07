import { NilaiRecord, PresensiRecord, SiswaJadwal, toISODate } from '../types/spmb';

const TANPA_PENGUJI = 'Tanpa Nama Penguji';
const TANPA_TIMEKEEPER = 'Tanpa Nama Timekeeper';
const KETERANGAN_PRESENSI = 'Presensi Siswa + Walmur';
const TANPA_GELOMBANG = 'Tanpa Gelombang';

const ADMIN_NAME_OVERRIDE = 'ADIB MEIDITHA WIBOWO, S.Si.';

const KATEGORI_ORDER: Record<string, number> = {
  'Al-Quran SD': 1,
  'Al-Quran SMP/SMA': 2,
  'Bahasa Arab': 3,
  Calistung: 4,
  English: 5,
  'Interview Walmur': 6
};

const normalizeKey = (value: string): string =>
  String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

const cleanNama = (value: string, fallback: string): string => {
  const cleaned = String(value || '').trim().replace(/\s+/g, ' ');
  return cleaned || fallback;
};

const displayNama = (nama: string): string =>
  normalizeKey(nama) === normalizeKey('Tim Kurikulum AL-WILDAN 29 (Admin)')
    ? ADMIN_NAME_OVERRIDE
    : nama;

const cleanKategori = (value: string): string => String(value || '').trim();

const sortKategori = (a: string, b: string): number => {
  const orderA = KATEGORI_ORDER[a] ?? 999;
  const orderB = KATEGORI_ORDER[b] ?? 999;
  if (orderA !== orderB) return orderA - orderB;
  return a.localeCompare(b, 'id');
};

const tanggalDariTimestamp = (value: string): string => {
  const iso = toISODate(value);
  if (iso) return iso;

  const match = String(value || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return '';

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export type PeranRekap = 'Penguji' | 'Timekeeper';

export interface RekapPengujiRow {
  key: string;
  peran: PeranRekap;
  nama: string;
  keteranganByDate: Record<string, string[]>;
  counts: Record<string, number>;
  total: number;
}

export interface RekapPengujiResult {
  availableDates: string[];
  dates: string[];
  rows: RekapPengujiRow[];
  totalByDate: Record<string, number>;
  grandTotal: number;
  totalPenguji: number;
  totalTimekeeper: number;
  totalPenilaian: number;
  totalPresensi: number;
}

export interface RekapPengujiOptions {
  from?: string;
  to?: string;
  search?: string;
  peran?: 'Semua' | PeranRekap;
  gelombang?: string[];
}

interface RowAccumulator {
  peran: PeranRekap;
  nama: string;
  idsByDate: Map<string, Set<string>>;
  keteranganByDate: Map<string, Set<string>>;
}

/**
 * Rekap data penguji dan timekeeper per tanggal ujian.
 * - Penguji: jumlah siswa unik yang sudah dinilai + kategori ujian.
 * - Timekeeper: jumlah siswa unik yang presensinya dicatat (Siswa atau Walmur).
 * Tanggal ujian diambil dari jadwal siswa; bila siswa tidak ditemukan,
 * dipakai tanggal timestamp nilai/presensi sebagai fallback.
 */
export function buildRekapPenguji(
  jadwalList: SiswaJadwal[],
  nilaiList: NilaiRecord[],
  presensiList: PresensiRecord[],
  options: RekapPengujiOptions = {}
): RekapPengujiResult {
   const jadwalDateById = new Map<string, string>();
   const gelombangById = new Map<string, string>();
   const availableDates = new Set<string>();

   jadwalList.forEach((siswa) => {
     const iso = toISODate(siswa.hari_tanggal);
     if (!iso) return;
     availableDates.add(iso);
     const id = normalizeKey(siswa.id);
     const gel = normalizeKey(siswa.gelombang) || normalizeKey(TANPA_GELOMBANG);
     if (id) {
       jadwalDateById.set(id, iso);
       gelombangById.set(id, gel);
     }
     const nama = normalizeKey(siswa.nama_siswa);
     if (nama) {
       gelombangById.set(nama, gel);
     }
   });

   const selectedGelombang = (options.gelombang || []).map((g) => normalizeKey(g));
   const matchesGelombang = (siswaKey: string): boolean => {
     if (selectedGelombang.length === 0) return true;
     const gel = gelombangById.get(siswaKey) || normalizeKey(TANPA_GELOMBANG);
     return selectedGelombang.includes(gel);
   };

  const accumulators = new Map<string, RowAccumulator>();

  const getAccumulator = (
    peran: PeranRekap,
    originalNama: string,
    fallback: string
  ): RowAccumulator => {
    const key = `${peran}:${normalizeKey(originalNama)}`;
    let acc = accumulators.get(key);
    if (!acc) {
      acc = {
        peran,
        nama: displayNama(cleanNama(originalNama, fallback)),
        idsByDate: new Map(),
        keteranganByDate: new Map()
      };
      accumulators.set(key, acc);
    }
    return acc;
  };

  const addKeterangan = (acc: RowAccumulator, date: string, keterangan: string) => {
    if (!keterangan) return;
    let set = acc.keteranganByDate.get(date);
    if (!set) {
      set = new Set();
      acc.keteranganByDate.set(date, set);
    }
    set.add(keterangan);
  };

   nilaiList.forEach((nilai) => {
     const siswaKey = normalizeKey(nilai.id_siswa) || normalizeKey(nilai.nama_siswa);
     if (!siswaKey) return;
     if (!matchesGelombang(siswaKey)) return;

     const date = jadwalDateById.get(siswaKey) || tanggalDariTimestamp(nilai.timestamp);
    if (!date) return;
    availableDates.add(date);

    const acc = getAccumulator('Penguji', nilai.nama_penguji, TANPA_PENGUJI);

    let ids = acc.idsByDate.get(date);
    if (!ids) {
      ids = new Set();
      acc.idsByDate.set(date, ids);
    }
    ids.add(siswaKey);

    addKeterangan(acc, date, cleanKategori(nilai.kategori_ujian));
  });

   presensiList.forEach((presensi) => {
     if (presensi.status && presensi.status !== 'Hadir') return;

     const siswaKey = normalizeKey(presensi.id_siswa) || normalizeKey(presensi.nama_siswa);
     if (!siswaKey) return;
     if (!matchesGelombang(siswaKey)) return;

     const date = jadwalDateById.get(siswaKey) || tanggalDariTimestamp(presensi.timestamp);
    if (!date) return;
    availableDates.add(date);

    const acc = getAccumulator('Timekeeper', presensi.petugas_timekeeper, TANPA_TIMEKEEPER);

    let ids = acc.idsByDate.get(date);
    if (!ids) {
      ids = new Set();
      acc.idsByDate.set(date, ids);
    }
    ids.add(siswaKey);

    addKeterangan(acc, date, KETERANGAN_PRESENSI);
  });

  const from = toISODate(options.from || '');
  const to = toISODate(options.to || '');
  const searchKey = normalizeKey(options.search || '');
  const peranFilter = options.peran || 'Semua';
  const inRange = (date: string) =>
    (!from || date >= from) && (!to || date <= to);
  const matchesSearch = (acc: RowAccumulator): boolean => {
    if (peranFilter !== 'Semua' && acc.peran !== peranFilter) return false;
    if (!searchKey) return true;
    if (normalizeKey(acc.nama).includes(searchKey)) return true;
    if (normalizeKey(acc.peran).includes(searchKey)) return true;
    return Array.from(acc.keteranganByDate.values()).some((keteranganSet) =>
      Array.from(keteranganSet).some((keterangan) => normalizeKey(keterangan).includes(searchKey))
    );
  };

  const rows: RekapPengujiRow[] = Array.from(accumulators.entries())
    .filter(([, acc]) => matchesSearch(acc))
    .map(([key, acc]) => {
      const counts: Record<string, number> = {};
      const keteranganByDate: Record<string, string[]> = {};

      acc.idsByDate.forEach((ids, date) => {
        if (!inRange(date)) return;
        counts[date] = ids.size;
        keteranganByDate[date] = Array.from(acc.keteranganByDate.get(date) || []).sort(sortKategori);
      });

      const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

      return {
        key,
        peran: acc.peran,
        nama: acc.nama,
        keteranganByDate,
        counts,
        total
      };
    })
    .filter((row) => row.total > 0);

  const dateSet = new Set<string>();
  rows.forEach((row) => {
    Object.keys(row.counts).forEach((date) => dateSet.add(date));
  });
  const dates = Array.from(dateSet).sort();

  const totalByDate: Record<string, number> = {};
  dates.forEach((date) => {
    totalByDate[date] = rows.reduce((sum, row) => sum + (row.counts[date] || 0), 0);
  });

  const pengujiRows = rows.filter((row) => row.peran === 'Penguji');
  const timekeeperRows = rows.filter((row) => row.peran === 'Timekeeper');
  const totalPenilaian = pengujiRows.reduce((sum, row) => sum + row.total, 0);
  const totalPresensi = timekeeperRows.reduce((sum, row) => sum + row.total, 0);

  const peranOrder: Record<PeranRekap, number> = { Penguji: 1, Timekeeper: 2 };

  return {
    availableDates: Array.from(availableDates).sort(),
    dates,
    rows: rows.sort((a, b) => {
      const peranDiff = peranOrder[a.peran] - peranOrder[b.peran];
      if (peranDiff !== 0) return peranDiff;
      return a.nama.localeCompare(b.nama, 'id');
    }),
    totalByDate,
    grandTotal: totalPenilaian + totalPresensi,
    totalPenguji: pengujiRows.length,
    totalTimekeeper: timekeeperRows.length,
    totalPenilaian,
    totalPresensi
  };
}
