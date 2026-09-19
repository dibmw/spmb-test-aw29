// ============================================================================
// Utilitas Monitoring & Broadcast WhatsApp (cek silang Presensi <-> Nilai)
// Modul ini 100% fungsi murni (tanpa DOM / localStorage) agar mudah ditest.
// ============================================================================
import {
  SiswaJadwal,
  PresensiRecord,
  NilaiRecord,
  KategoriUjian,
  getJenjangFromKelas,
} from '../types/spmb';

const normId = (v: string): string => (v || '').trim().toLowerCase();

/**
 * Kategori ujian yang WAJIB dinilai per jenjang siswa.
 * SD: 3 kategori. SMP/SMA: 4 kategori (Bahasa Arab terpisah, mengikuti alur penguji di RubrikModal).
 */
export function getRequiredKategori(siswa: SiswaJadwal): KategoriUjian[] {
  const jenjang = getJenjangFromKelas(siswa.kelas, siswa.grade);
  if (jenjang === 'SD') {
    return ['Al-Quran SD', 'Calistung', 'Interview Walmur'];
  }
  return ['Al-Quran SMP/SMA', 'Bahasa Arab', 'English', 'Interview Walmur'];
}

/** Nama tampilan kategori untuk tabel & pesan WA. */
export function displayKategori(kategori: KategoriUjian): string {
  return kategori === 'Interview Walmur' ? 'Wawancara Orang Tua' : kategori;
}

/**
 * Penguji penanggung jawab sebuah kategori untuk siswa ybs.
 * Pos Al-Qur'an & B. Arab -> penguji_alq_arab.
 * Pos Calistung / English -> penguji_catung_eng.
 * Interview Walmur -> interview_walmur.
 */
export function getPosPenguji(siswa: SiswaJadwal, kategori: KategoriUjian): string {
  if (kategori === 'Al-Quran SD' || kategori === 'Al-Quran SMP/SMA' || kategori === 'Bahasa Arab') {
    return (siswa.penguji_alq_arab || '').trim() || '-';
  }
  if (kategori === 'Calistung' || kategori === 'English') {
    return (siswa.penguji_catung_eng || '').trim() || '-';
  }
  return (siswa.interview_walmur || '').trim() || '-';
}

export interface MissingKategori {
  kategori: KategoriUjian;
  penguji: string;
}

/** Daftar kategori wajib yang BELUM ada nilainya + penguji penanggung jawabnya. */
export function getMissingKategori(siswa: SiswaJadwal, nilaiList: NilaiRecord[]): MissingKategori[] {
  return getRequiredKategori(siswa)
    .filter(
      (kat) =>
        !nilaiList.some(
          (n) => normId(n.id_siswa) === normId(siswa.id) && n.kategori_ujian === kat
        )
    )
    .map((kat) => ({ kategori: kat, penguji: getPosPenguji(siswa, kat) }));
}

export function hasPresensi(
  presensiList: PresensiRecord[],
  idSiswa: string,
  tipe: 'Siswa' | 'Walmur'
): boolean {
  return presensiList.some(
    (p) => normId(p.id_siswa) === normId(idSiswa) && p.tipe_presensi === tipe
  );
}

// ----------------------------------------------------------------------------
// KELOMPOK A: sudah presensi (Siswa dan/atau Walmur) tapi nilai BELUM lengkap
// ----------------------------------------------------------------------------
export interface PresentIncompleteRow {
  siswa: SiswaJadwal;
  presensiSiswa: boolean;
  presensiWalmur: boolean;
  missing: MissingKategori[];
  filledCount: number;
  requiredCount: number;
}

export function buildPresentIncompleteRows(
  jadwalList: SiswaJadwal[],
  presensiList: PresensiRecord[],
  nilaiList: NilaiRecord[]
): PresentIncompleteRow[] {
  return jadwalList
    .filter((s) => s.status === 'Aktif')
    .map((s): PresentIncompleteRow => {
      const presensiSiswa = hasPresensi(presensiList, s.id, 'Siswa');
      const presensiWalmur = hasPresensi(presensiList, s.id, 'Walmur');
      const requiredCount = getRequiredKategori(s).length;
      const missing = getMissingKategori(s, nilaiList);
      return {
        siswa: s,
        presensiSiswa,
        presensiWalmur,
        missing,
        filledCount: requiredCount - missing.length,
        requiredCount,
      };
    })
    .filter((r) => (r.presensiSiswa || r.presensiWalmur) && r.missing.length > 0)
    .sort((a, b) => a.siswa.nama_siswa.localeCompare(b.siswa.nama_siswa));
}

// ----------------------------------------------------------------------------
// KELOMPOK B: ada nilai yang presensi PASANGANNYA belum tercatat.
// - Nilai ujian siswa (Al-Quran/Bhs Arab/Calistung/English) dipasangkan dengan presensi Siswa.
// - Nilai Interview Walmur dipasangkan dengan presensi Walmur.
// ----------------------------------------------------------------------------
export type JenisAnomaliPresensi = 'Siswa' | 'Walmur';

export interface GradedAbsentRow {
  siswa: SiswaJadwal;
  filled: KategoriUjian[];
  /** Nilai ujian siswa yang sudah terisi padahal presensi Siswa belum tercatat. */
  masalahSiswa: KategoriUjian[];
  /** Nilai interview yang sudah terisi padahal presensi Walmur belum tercatat. */
  masalahWalmur: KategoriUjian[];
  timekeeperSiswa: string;
  timekeeperWalmur: string;
}

/** True bila kategori termasuk ujian siswa (bukan wawancara orang tua). */
export function isKategoriUjianSiswa(kategori: KategoriUjian): boolean {
  return kategori !== 'Interview Walmur';
}

export function buildGradedButAbsentRows(
  jadwalList: SiswaJadwal[],
  presensiList: PresensiRecord[],
  nilaiList: NilaiRecord[]
): GradedAbsentRow[] {
  return jadwalList
    .filter((s) => s.status === 'Aktif')
    .map((s): GradedAbsentRow => {
      const presensiSiswa = hasPresensi(presensiList, s.id, 'Siswa');
      const presensiWalmur = hasPresensi(presensiList, s.id, 'Walmur');
      const filled: KategoriUjian[] = [];
      nilaiList.forEach((n) => {
        if (normId(n.id_siswa) === normId(s.id) && !filled.includes(n.kategori_ujian)) {
          filled.push(n.kategori_ujian);
        }
      });
      return {
        siswa: s,
        filled,
        masalahSiswa: presensiSiswa
          ? []
          : filled.filter((kat) => isKategoriUjianSiswa(kat)),
        masalahWalmur: presensiWalmur
          ? []
          : filled.filter((kat) => !isKategoriUjianSiswa(kat)),
        timekeeperSiswa: (s.timekeeper_siswa || '').trim() || '-',
        timekeeperWalmur: (s.timekeeper_walmur || '').trim() || '-',
      };
    })
    .filter((r) => r.masalahSiswa.length > 0 || r.masalahWalmur.length > 0)
    .sort((a, b) => a.siswa.nama_siswa.localeCompare(b.siswa.nama_siswa));
}

// ----------------------------------------------------------------------------
// Pengelompokan pesan per petugas
// ----------------------------------------------------------------------------
export interface PengujiBroadcastItem {
  siswa: SiswaJadwal;
  kategori: KategoriUjian;
}

export interface PengujiBroadcast {
  penguji: string;
  items: PengujiBroadcastItem[];
}

/** Kelompokkan Kelompok A per penguji penanggung jawab (1 siswa bisa tampil di >1 penguji bila posnya beda). */
export function groupBroadcastByPenguji(rows: PresentIncompleteRow[]): PengujiBroadcast[] {
  const map = new Map<string, PengujiBroadcast>();
  rows.forEach((r) => {
    r.missing.forEach((m) => {
      const key = (m.penguji || '').trim() || '-';
      if (!map.has(key)) map.set(key, { penguji: key, items: [] });
      map.get(key)!.items.push({ siswa: r.siswa, kategori: m.kategori });
    });
  });
  return [...map.values()]
    .map((g) => ({
      ...g,
      items: [...g.items].sort((a, b) => a.siswa.nama_siswa.localeCompare(b.siswa.nama_siswa)),
    }))
    .sort((a, b) => a.penguji.localeCompare(b.penguji));
}

export interface TimekeeperBroadcastItem {
  siswa: SiswaJadwal;
  /** Jenis presensi pasangan yang belum tercatat. */
  jenis: JenisAnomaliPresensi;
  /** Nilai pada jenis tsb yang sudah terisi. */
  filled: KategoriUjian[];
}

export interface TimekeeperBroadcast {
  timekeeper: string;
  items: TimekeeperBroadcastItem[];
}

/**
 * Kelompokkan Kelompok B per timekeeper sesuai jenis masalahnya:
 * masalah Siswa -> timekeeper_siswa, masalah Walmur -> timekeeper_walmur.
 * Satu siswa bisa tampil di dua timekeeper berbeda bila dua-duanya bermasalah.
 */
export function groupBroadcastByTimekeeper(rows: GradedAbsentRow[]): TimekeeperBroadcast[] {
  const map = new Map<string, TimekeeperBroadcast>();
  const push = (key: string, item: TimekeeperBroadcastItem) => {
    const k = (key || '').trim() || '-';
    if (!map.has(k)) map.set(k, { timekeeper: k, items: [] });
    map.get(k)!.items.push(item);
  };
  rows.forEach((r) => {
    if (r.masalahSiswa.length > 0) {
      push(r.timekeeperSiswa, { siswa: r.siswa, jenis: 'Siswa', filled: r.masalahSiswa });
    }
    if (r.masalahWalmur.length > 0) {
      push(r.timekeeperWalmur, { siswa: r.siswa, jenis: 'Walmur', filled: r.masalahWalmur });
    }
  });
  return [...map.values()]
    .map((g) => ({
      ...g,
      items: [...g.items].sort((a, b) => a.siswa.nama_siswa.localeCompare(b.siswa.nama_siswa)),
    }))
    .sort((a, b) => a.timekeeper.localeCompare(b.timekeeper));
}

// ----------------------------------------------------------------------------
// Template pesan WhatsApp (teks siap salin)
// ----------------------------------------------------------------------------
export function buildPesanPenguji(
  penguji: string,
  items: PengujiBroadcastItem[]
): string {
  const list = items
    .map(
      (it, i) =>
        `${i + 1}. ${it.siswa.nama_siswa} (${it.siswa.id}) — Pos: ${displayKategori(it.kategori)}`
    )
    .join('\n');
  return [
    `Assalamu'alaikum warahmatullahi wabarakatuh`,
    ``,
    `Yth. Bapak/Ibu ${penguji},`,
    ``,
    `Mohon izin mengingatkan. Berikut ${items.length} pos penilaian yang BELUM terinput untuk siswa yang SUDAH presensi:`,
    ``,
    list,
    ``,
    `Mohon segera melengkapi nilai pada aplikasi Tes SPMB.`,
    ``,
    `Jazakumullah khairan.`,
    `Panitia SPMB Al-Wildan 29`,
  ].join('\n');
}

export function buildPesanTimekeeper(
  timekeeper: string,
  items: TimekeeperBroadcastItem[]
): string {
  const list = items
    .map((it, i) => {
      const katStr = it.filled.map(displayKategori).join(', ');
      return it.jenis === 'Walmur'
        ? `${i + 1}. ${it.siswa.nama_siswa} (${it.siswa.id}) — Nilai ${katStr} sudah ada, presensi Walmur belum tercatat`
        : `${i + 1}. ${it.siswa.nama_siswa} (${it.siswa.id}) — Nilai ujian siswa sudah ada (${katStr}), presensi Siswa belum tercatat`;
    })
    .join('\n');
  return [
    `Assalamu'alaikum warahmatullahi wabarakatuh`,
    ``,
    `Yth. Bapak/Ibu ${timekeeper},`,
    ``,
    `Mohon izin. Ditemukan ${items.length} catatan nilai yang presensi pasangannya BELUM tercatat:`,
    ``,
    list,
    ``,
    `Mohon cek & pastikan kehadiran mereka tercatat pada aplikasi Tes SPMB.`,
    ``,
    `Jazakumullah khairan.`,
    `Panitia SPMB Al-Wildan 29`,
  ].join('\n');
}
