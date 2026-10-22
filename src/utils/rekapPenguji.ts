import { NilaiRecord, SiswaJadwal, toISODate } from '../types/spmb';

const TANPA_PENGUJI = 'Tanpa Nama Penguji';

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

const cleanNama = (value: string): string => {
  const cleaned = String(value || '').trim().replace(/\s+/g, ' ');
  return cleaned || TANPA_PENGUJI;
};

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

export interface RekapPengujiRow {
  key: string;
  nama: string;
  kategoriByDate: Record<string, string[]>;
  counts: Record<string, number>;
  total: number;
}

export interface RekapPengujiResult {
  availableDates: string[];
  dates: string[];
  rows: RekapPengujiRow[];
  totalPenilaianByDate: Record<string, number>;
  grandTotal: number;
}

export interface RekapPengujiOptions {
  from?: string;
  to?: string;
  search?: string;
}

interface RowAccumulator {
  nama: string;
  idsByDate: Map<string, Set<string>>;
  kategoriByDate: Map<string, Set<string>>;
}

/**
 * Rekap jumlah siswa unik yang sudah dinilai, per penguji per tanggal ujian.
 * Tanggal ujian diambil dari jadwal siswa; bila siswa tidak ditemukan,
 * dipakai tanggal timestamp nilai sebagai fallback.
 */
export function buildRekapPenguji(
  jadwalList: SiswaJadwal[],
  nilaiList: NilaiRecord[],
  options: RekapPengujiOptions = {}
): RekapPengujiResult {
  const jadwalDateById = new Map<string, string>();
  const availableDates = new Set<string>();

  jadwalList.forEach((siswa) => {
    const iso = toISODate(siswa.hari_tanggal);
    if (!iso) return;
    availableDates.add(iso);
    const id = normalizeKey(siswa.id);
    if (id) jadwalDateById.set(id, iso);
  });

  const accumulators = new Map<string, RowAccumulator>();

  nilaiList.forEach((nilai) => {
    const nama = cleanNama(nilai.nama_penguji);
    const rowKey = normalizeKey(nama);
    const siswaKey = normalizeKey(nilai.id_siswa) || normalizeKey(nilai.nama_siswa);
    if (!siswaKey) return;

    const date = jadwalDateById.get(siswaKey) || tanggalDariTimestamp(nilai.timestamp);
    if (!date) return;
    availableDates.add(date);

    let acc = accumulators.get(rowKey);
    if (!acc) {
      acc = { nama, idsByDate: new Map(), kategoriByDate: new Map() };
      accumulators.set(rowKey, acc);
    }

    let ids = acc.idsByDate.get(date);
    if (!ids) {
      ids = new Set();
      acc.idsByDate.set(date, ids);
    }
    ids.add(siswaKey);

    const kategori = cleanKategori(nilai.kategori_ujian);
    if (kategori) {
      let kategoriSet = acc.kategoriByDate.get(date);
      if (!kategoriSet) {
        kategoriSet = new Set();
        acc.kategoriByDate.set(date, kategoriSet);
      }
      kategoriSet.add(kategori);
    }
  });

  const from = toISODate(options.from || '');
  const to = toISODate(options.to || '');
  const searchKey = normalizeKey(options.search || '');
  const inRange = (date: string) =>
    (!from || date >= from) && (!to || date <= to);
  const matchesSearch = (acc: RowAccumulator): boolean => {
    if (!searchKey) return true;
    if (normalizeKey(acc.nama).includes(searchKey)) return true;
    return Array.from(acc.kategoriByDate.values()).some((kategoriSet) =>
      Array.from(kategoriSet).some((kategori) => normalizeKey(kategori).includes(searchKey))
    );
  };

  const rows: RekapPengujiRow[] = Array.from(accumulators.entries())
    .filter(([, acc]) => matchesSearch(acc))
    .map(([key, acc]) => {
      const counts: Record<string, number> = {};
      const kategoriByDate: Record<string, string[]> = {};

      acc.idsByDate.forEach((ids, date) => {
        if (!inRange(date)) return;
        counts[date] = ids.size;
        kategoriByDate[date] = Array.from(acc.kategoriByDate.get(date) || []).sort(sortKategori);
      });

      const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

      return {
        key,
        nama: acc.nama,
        kategoriByDate,
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

  const totalPenilaianByDate: Record<string, number> = {};
  dates.forEach((date) => {
    totalPenilaianByDate[date] = rows.reduce((sum, row) => sum + (row.counts[date] || 0), 0);
  });

  const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);

  return {
    availableDates: Array.from(availableDates).sort(),
    dates,
    rows: rows.sort((a, b) => a.nama.localeCompare(b.nama, 'id')),
    totalPenilaianByDate,
    grandTotal
  };
}
