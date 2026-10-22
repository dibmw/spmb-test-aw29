import { NilaiRecord, SiswaJadwal, toISODate } from '../types/spmb';

const TANPA_PENGUJI = 'Tanpa Nama Penguji';

const normalizeKey = (value: string): string =>
  String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

const cleanNama = (value: string): string => {
  const cleaned = String(value || '').trim().replace(/\s+/g, ' ');
  return cleaned || TANPA_PENGUJI;
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
  kategori: string[];
  counts: Record<string, number>;
  total: number;
}

export interface RekapPengujiResult {
  availableDates: string[];
  dates: string[];
  rows: RekapPengujiRow[];
  totalByDate: Record<string, number>;
  grandTotal: number;
}

export interface RekapPengujiOptions {
  from?: string;
  to?: string;
  search?: string;
}

interface RowAccumulator {
  nama: string;
  kategori: Set<string>;
  idsByDate: Map<string, Set<string>>;
}

interface InternalRow {
  key: string;
  nama: string;
  kategori: string[];
  counts: Record<string, number>;
  total: number;
  idsByDate: Map<string, Set<string>>;
  allIds: Set<string>;
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
      acc = { nama, kategori: new Set(), idsByDate: new Map() };
      accumulators.set(rowKey, acc);
    }

    acc.kategori.add(String(nilai.kategori_ujian || '').trim());
    let ids = acc.idsByDate.get(date);
    if (!ids) {
      ids = new Set();
      acc.idsByDate.set(date, ids);
    }
    ids.add(siswaKey);
  });

  const from = toISODate(options.from || '');
  const to = toISODate(options.to || '');
  const searchKey = normalizeKey(options.search || '');
  const inRange = (date: string) =>
    (!from || date >= from) && (!to || date <= to);
  const matchesSearch = (nama: string) =>
    !searchKey || normalizeKey(nama).includes(searchKey);

  const internalRows: InternalRow[] = Array.from(accumulators.entries())
    .filter(([, acc]) => matchesSearch(acc.nama))
    .map(([key, acc]) => {
      const idsByDate = new Map<string, Set<string>>();
      const allIds = new Set<string>();
      const counts: Record<string, number> = {};

      acc.idsByDate.forEach((ids, date) => {
        if (!inRange(date)) return;
        idsByDate.set(date, ids);
        counts[date] = ids.size;
        ids.forEach((id) => allIds.add(id));
      });

      return {
        key,
        nama: acc.nama,
        kategori: Array.from(acc.kategori)
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b, 'id')),
        counts,
        total: allIds.size,
        idsByDate,
        allIds
      };
    })
    .filter((row) => row.total > 0);

  const dateSet = new Set<string>();
  internalRows.forEach((row) => {
    Object.keys(row.counts).forEach((date) => dateSet.add(date));
  });
  const dates = Array.from(dateSet).sort();

  const idsByDateAll = new Map<string, Set<string>>();
  internalRows.forEach((row) => {
    row.idsByDate.forEach((ids, date) => {
      let combined = idsByDateAll.get(date);
      if (!combined) {
        combined = new Set();
        idsByDateAll.set(date, combined);
      }
      ids.forEach((id) => combined.add(id));
    });
  });

  const totalByDate: Record<string, number> = {};
  dates.forEach((date) => {
    totalByDate[date] = idsByDateAll.get(date)?.size || 0;
  });

  const grandIds = new Set<string>();
  internalRows.forEach((row) => {
    row.allIds.forEach((id) => grandIds.add(id));
  });

  const rows: RekapPengujiRow[] = internalRows
    .map(({ idsByDate, allIds, ...row }) => row)
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));

  return {
    availableDates: Array.from(availableDates).sort(),
    dates,
    rows,
    totalByDate,
    grandTotal: grandIds.size
  };
}
