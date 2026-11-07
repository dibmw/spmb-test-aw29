import { 
  SiswaJadwal, 
  PengujiAccount, 
  PresensiRecord, 
  NilaiRecord, 
  UserSession, 
  Role, 
  KategoriUjian,
  SesiUjian,
  toISODate
} from '../types/spmb';
import { 
  INITIAL_JADWAL_LIST, 
  INITIAL_PENGUJI_LIST, 
  INITIAL_PRESENSI_LIST, 
  INITIAL_NILAI_LIST, 
  INITIAL_SESI_UJIAN,
  ADMIN_EMAIL 
} from '../data/mockData';
import {
  isFirebaseConfigured,
  firestoreSaveJadwal,
  firestoreDeleteJadwal,
  firestoreSubmitPresensi,
  firestoreDeletePresensi,
  firestoreSubmitGrade,
  firestoreDeleteGrade,
  firestoreSaveSesiUjian,
  firestoreDeleteSesiUjian,
  firestoreBulkMigrate,
  firestoreVerifyOfficer,
  firestoreBulkUpsertJadwal,
  firestoreBulkUpsertPenguji,
  firestoreSanitizeLegacyDates
} from './firebase';

export const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbyCOLKJEtL480pr5f3YJP4nNq80OiBgeInZI6XWVNvQC1prD4K-8LX7K85UjxiEjOFJ/exec';
const PREV_DEFAULT_GAS_URLS = [
  'https://script.google.com/macros/s/AKfycbzq3IHLcodfvYCSuD8j4beiH30pdLV1zNMBWOcXMKUAHN8OEc5KENttMEmo7cDjBZaz/exec'
];
export const DEFAULT_APP_SECRET_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APP_SECRET_KEY)
    ? String(import.meta.env.VITE_APP_SECRET_KEY).trim()
    : '';

const STORAGE_KEYS = {
  JADWAL: 'spmb29_jadwal',
  PENGUJI: 'spmb29_penguji',
  PRESENSI: 'spmb29_presensi',
  NILAI: 'spmb29_nilai',
  SESI_UJIAN: 'spmb29_sesi_ujian',
  USER_SESSION: 'spmb29_session',
  GAS_URL: 'spmb29_gas_url'
};

class ApiService {
  private gasUrl: string = DEFAULT_GAS_URL;

  constructor() {
    this.initStorage();
    const stored = localStorage.getItem(STORAGE_KEYS.GAS_URL);
    if (!stored || PREV_DEFAULT_GAS_URLS.includes(stored.trim())) {
      this.gasUrl = DEFAULT_GAS_URL;
      localStorage.setItem(STORAGE_KEYS.GAS_URL, DEFAULT_GAS_URL);
    } else {
      this.gasUrl = stored.trim();
    }
  }

  private initStorage() {
    if (!localStorage.getItem(STORAGE_KEYS.JADWAL)) {
      localStorage.setItem(STORAGE_KEYS.JADWAL, JSON.stringify(INITIAL_JADWAL_LIST));
    }
    if (!localStorage.getItem(STORAGE_KEYS.PENGUJI)) {
      localStorage.setItem(STORAGE_KEYS.PENGUJI, JSON.stringify(INITIAL_PENGUJI_LIST));
    }
    if (!localStorage.getItem(STORAGE_KEYS.PRESENSI)) {
      localStorage.setItem(STORAGE_KEYS.PRESENSI, JSON.stringify(INITIAL_PRESENSI_LIST));
    }
    if (!localStorage.getItem(STORAGE_KEYS.NILAI)) {
      localStorage.setItem(STORAGE_KEYS.NILAI, JSON.stringify(INITIAL_NILAI_LIST));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SESI_UJIAN)) {
      localStorage.setItem(STORAGE_KEYS.SESI_UJIAN, JSON.stringify(INITIAL_SESI_UJIAN));
    }
  }

  public getGasUrl(): string {
    return this.gasUrl;
  }

  public setGasUrl(url: string): void {
    this.gasUrl = url.trim();
    localStorage.setItem(STORAGE_KEYS.GAS_URL, this.gasUrl);
  }

  public resetToDefault(): void {
    localStorage.setItem(STORAGE_KEYS.JADWAL, JSON.stringify(INITIAL_JADWAL_LIST));
    localStorage.setItem(STORAGE_KEYS.PENGUJI, JSON.stringify(INITIAL_PENGUJI_LIST));
    localStorage.setItem(STORAGE_KEYS.PRESENSI, JSON.stringify(INITIAL_PRESENSI_LIST));
    localStorage.setItem(STORAGE_KEYS.NILAI, JSON.stringify(INITIAL_NILAI_LIST));
    localStorage.setItem(STORAGE_KEYS.SESI_UJIAN, JSON.stringify(INITIAL_SESI_UJIAN));
  }

  // Kirim POST ke GAS melalui serverless proxy dengan retry
  private async pushWithRetry(body: unknown, attempts = 3): Promise<void> {
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await fetch('/api/sheets-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: this.gasUrl,
            method: 'POST',
            body: body
          })
        });
        if (res.ok) return;
      } catch (err) {
        console.warn(`Proxy push gagal (percobaan ${i + 1}/${attempts}):`, err);
        if (i < attempts - 1) {
          await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
        }
      }
    }
  }

  // Sync all sheets from live Google Apps Script endpoint via proxy
  public async syncFromGas(): Promise<{ 
    success: boolean; 
    message: string; 
    counts?: { jadwal: number; penguji: number; presensi: number; nilai: number; sesi: number }
  }> {
    if (!this.gasUrl) {
      return { success: false, message: 'URL Google Apps Script belum dikonfigurasi.' };
    }

    try {
      const session = this.getCurrentSession();
      const emailParam = session && session.email ? `&email=${encodeURIComponent(session.email)}` : '';
      const targetUrl = `${this.gasUrl}?action=getAllData${emailParam}`;

      const res = await fetch('/api/sheets-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: targetUrl,
          method: 'GET'
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();
      if (json.status === 'success' && json.data) {
        const { jadwal, penguji, presensi, nilai, sesi, sesi_ujian } = json.data;

        let jCount = 0;
        let pCount = 0;
        let prCount = 0;
        let nCount = 0;
        let sCount = 0;

        if (Array.isArray(jadwal) && jadwal.length > 0) {
          // Normalize field names if needed
          const normalizedJadwal: SiswaJadwal[] = jadwal.map((item: any) => {
            const gv = String(item.gender ?? '').trim().toLowerCase();
            const isPerempuan = gv === 'perempuan' || gv === 'p' || gv === 'wanita' || gv === 'female' || gv === 'pr';
            return {
            id: String(item.id || item.id_siswa || '').trim(),
            nama_siswa: String(item.nama_siswa || '').trim(),
            kelas: String(item.kelas || 'SD 1').trim(),
            gender: (isPerempuan ? 'P' : 'L') as 'L' | 'P',
            ruangan_siswa: String(item.ruangan_siswa || 'R. 101').trim(),
            waktu_all: String(item.waktu_all || '').trim(),
            waktu_alq_arab: String(item.waktu_alq_arab || '').trim(),
            waktu_catung_eng: String(item.waktu_catung_eng || '').trim(),
            ruangan_walmur: String(item.ruangan_walmur || 'R. Audiovisual').trim(),
            penguji_alq_arab: String(item.penguji_alq_arab || '').trim(),
            penguji_catung_eng: String(item.penguji_catung_eng || '').trim(),
            timekeeper_siswa: String(item.timekeeper_siswa || '').trim(),
            interview_walmur: String(item.interview_walmur || '').trim(),
            timekeeper_walmur: String(item.timekeeper_walmur || '').trim(),
            waktu_interview: String(item.waktu_interview || '').trim(),
            hari_tanggal: String(item.hari_tanggal || item['hari tanggal'] || '').trim(),
            status: item.status === 'Selesai' ? 'Selesai' : item.status === 'Reschedule' ? 'Reschedule' : 'Aktif',
            status_kehadiran_siswa: item.status_kehadiran_siswa === 'Hadir' || item.status_kehadiran_siswa === 'Belum Hadir'
              ? item.status_kehadiran_siswa
              : '',
             status_kehadiran_walmur: item.status_kehadiran_walmur === 'Hadir' || item.status_kehadiran_walmur === 'Belum Hadir'
               ? item.status_kehadiran_walmur
               : '',
             gelombang: String(item.gelombang || '').trim(),
           } as SiswaJadwal;
          });
          localStorage.setItem(STORAGE_KEYS.JADWAL, JSON.stringify(normalizedJadwal));
          jCount = normalizedJadwal.length;
        }

        if (Array.isArray(penguji) && penguji.length > 0) {
          const normalizedPenguji: PengujiAccount[] = penguji.map((item: any) => ({
            penguji: String(item.penguji || item.nama || '').trim(),
            email_penguji: String(item.email_penguji || item['email penguji'] || item.email || '').trim().toLowerCase()
          }));
          localStorage.setItem(STORAGE_KEYS.PENGUJI, JSON.stringify(normalizedPenguji));
          pCount = normalizedPenguji.length;
        }

        if (Array.isArray(presensi)) {
          const normalizedPresensi: PresensiRecord[] = presensi.map((item: any) => ({
            id: item.id || `PRES-${Math.random().toString().slice(2, 8)}`,
            timestamp: String(item.timestamp || ''),
            id_siswa: String(item.id_siswa || ''),
            nama_siswa: String(item.nama_siswa || ''),
            tipe_presensi: item.tipe_presensi === 'Walmur' ? 'Walmur' : 'Siswa',
            petugas_timekeeper: String(item.petugas_timekeeper || ''),
            status: 'Hadir'
          }));
          localStorage.setItem(STORAGE_KEYS.PRESENSI, JSON.stringify(normalizedPresensi));
          prCount = normalizedPresensi.length;
        }

        if (Array.isArray(nilai)) {
          const normalizedNilai: NilaiRecord[] = nilai.map((item: any) => {
            let detail = item.detail_skor_json;
            if (typeof detail === 'string') {
              try { detail = JSON.parse(detail); } catch { detail = {}; }
            }
            return {
              id: item.id || `NILAI-${Math.random().toString().slice(2, 8)}`,
              timestamp: String(item.timestamp || ''),
              id_siswa: String(item.id_siswa || ''),
              nama_siswa: String(item.nama_siswa || ''),
              kategori_ujian: item.kategori_ujian as KategoriUjian,
              nama_penguji: String(item.nama_penguji || ''),
              email_penguji: String(item.email_penguji || ''),
              detail_skor_json: detail || {},
              skor_akhir_rata2: Number(item.skor_akhir_rata2) || 0,
              catatan_umum: String(item.catatan_umum || '')
            };
          });
          localStorage.setItem(STORAGE_KEYS.NILAI, JSON.stringify(normalizedNilai));
          nCount = normalizedNilai.length;
        }

        const rawSesi = Array.isArray(sesi) ? sesi : Array.isArray(sesi_ujian) ? sesi_ujian : null;
        if (rawSesi) {
          const candidatesByDate = new Map<string, { sesi: SesiUjian; hasExplicitId: boolean; updatedAtMs: number }>();

          rawSesi.forEach((item: any) => {
            const date = toISODate(String(item.hari_tanggal || item['hari tanggal'] || item.tanggal || '').trim());
            const rawId = String(item.id_sesi || item.id || '').trim();
            const rawMode = String(item.mode_ujian || item.mode || '').trim();
            if (!date || (!rawId && !rawMode)) return;

            const updatedAt = String(item.updated_at || item.timestamp || '').trim();
            const sesiItem: SesiUjian = {
              id_sesi: rawId || `SESI-${date.replace(/-/g, '')}`,
              hari_tanggal: date,
              mode_ujian: rawMode.toLowerCase() === 'online' ? 'Online' : 'Offline',
              catatan: String(item.catatan || '').trim(),
              updated_at: updatedAt
            };
            const candidate = {
              sesi: sesiItem,
              hasExplicitId: Boolean(rawId),
              updatedAtMs: Date.parse(updatedAt) || 0
            };
            const current = candidatesByDate.get(date);
            if (
              !current
              || (candidate.hasExplicitId && !current.hasExplicitId)
              || (candidate.hasExplicitId === current.hasExplicitId && candidate.updatedAtMs > current.updatedAtMs)
            ) {
              candidatesByDate.set(date, candidate);
            }
          });

          const normalizedSesi = Array.from(candidatesByDate.values())
            .map((candidate) => candidate.sesi)
            .sort((a, b) => a.hari_tanggal.localeCompare(b.hari_tanggal));
          localStorage.setItem(STORAGE_KEYS.SESI_UJIAN, JSON.stringify(normalizedSesi));
          sCount = normalizedSesi.length;
        }

        return {
          success: true,
          message: 'Sinkronisasi berhasil! Data terbaru dari Google Spreadsheet berhasil dimuat.',
          counts: { jadwal: jCount, penguji: pCount, presensi: prCount, nilai: nCount, sesi: sCount }
        };
      } else {
        return { success: false, message: json.message || 'Format respons Google Apps Script tidak sesuai.' };
      }
    } catch (err: any) {
      console.warn('Sync from GAS error:', err);
      return { 
        success: false, 
        message: `Gagal tersambung ke Google Apps Script: ${err.message || 'CORS / Jaringan'}. Menggunakan database lokal.`
      };
    }
  }

  // Session Management
  public getCurrentSession(): UserSession | null {
    const raw = localStorage.getItem(STORAGE_KEYS.USER_SESSION);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  public setSession(session: UserSession | null): void {
    if (session) {
      localStorage.setItem(STORAGE_KEYS.USER_SESSION, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER_SESSION);
    }
  }

  public switchRole(role: Role): UserSession | null {
    const session = this.getCurrentSession();
    if (!session) return null;
    if (session.availableRoles.includes(role)) {
      session.activeRole = role;
      this.setSession(session);
      return session;
    }
    return session;
  }

  // Authentication by Email without password
  public async loginByEmail(rawEmail: string): Promise<{ success: boolean; session?: UserSession; message: string }> {
    const email = rawEmail.trim().toLowerCase();
    if (!email) {
      return { success: false, message: 'Harap masukkan alamat email petugas.' };
    }

    // Try Google Apps Script via secure serverless proxy only if Firebase is not configured
    if (this.gasUrl && !isFirebaseConfigured) {
      try {
        const targetUrl = `${this.gasUrl}?action=verifyLogin&email=${encodeURIComponent(email)}`;
        const res = await fetch('/api/sheets-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: targetUrl,
            method: 'GET'
          })
        });
        const json = await res.json();
        if (json.status === 'success' && json.data) {
          const session: UserSession = json.data;
          this.setSession(session);
          return { success: true, session, message: `Selamat datang, ${session.nama}` };
        }
      } catch (err) {
        console.warn('Proxy login failed, falling back to local database verify:', err);
      }
    }

    // Verification (Local Cache + Firestore Direct Check)
    const SUPER_ADMIN_EMAILS = [
      ADMIN_EMAIL.toLowerCase(),
      'kurikulum.alwildan29@gmail.com',
      'admin@alwildan29.sch.id'
    ];
    const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(email);

    let pengujiList = this.getPengujiList();
    let matchedOfficer = pengujiList.find(p => p.email_penguji.trim().toLowerCase() === email);

    // Jika belum ada di cache browser lokal, verifikasi langsung ke Firestore
    if (!matchedOfficer && isFirebaseConfigured) {
      try {
        const remoteOfficer = await firestoreVerifyOfficer(email);
        if (remoteOfficer) {
          matchedOfficer = remoteOfficer;
          pengujiList.push(remoteOfficer);
          localStorage.setItem(STORAGE_KEYS.PENGUJI, JSON.stringify(pengujiList));
        }
      } catch (err) {
        console.warn('Firestore direct officer verification error:', err);
      }
    }

    if (!matchedOfficer && !isSuperAdmin) {
      return {
        success: false,
        message: 'Email tidak ditemukan dalam daftar penguji resmi AL-WILDAN 29 DEPOK.'
      };
    }

    const officialName = matchedOfficer ? matchedOfficer.penguji : 'Tim Kurikulum AL-WILDAN 29 (Super Admin)';
    const jadwalList = this.getJadwalList();

    // Determine roles from schedule sheet
    const isTimekeeper = isSuperAdmin || jadwalList.some(
      j => j.timekeeper_siswa === officialName || j.timekeeper_walmur === officialName
    );
    const isPenguji = isSuperAdmin || jadwalList.some(
      j => j.penguji_alq_arab === officialName || 
           j.penguji_catung_eng === officialName || 
           j.interview_walmur === officialName
    );

    const availableRoles: Role[] = [];
    if (isSuperAdmin) availableRoles.push('ADMIN');
    if (isTimekeeper) availableRoles.push('TIMEKEEPER');
    if (isPenguji) availableRoles.push('PENGUJI');

    if (availableRoles.length === 0) {
      availableRoles.push('PENGUJI'); // Default fallback
    }

    const session: UserSession = {
      email,
      nama: officialName,
      availableRoles,
      activeRole: availableRoles[0]
    };

    this.setSession(session);
    return { success: true, session, message: `Login berhasil sebagai ${session.nama}` };
  }

  // Data Fetching
  public getJadwalList(): SiswaJadwal[] {
    const raw = localStorage.getItem(STORAGE_KEYS.JADWAL);
    const list: SiswaJadwal[] = raw ? JSON.parse(raw) : INITIAL_JADWAL_LIST;
    let modified = false;
    const normalized = list.map((item) => {
      const cleanDate = toISODate(item.hari_tanggal);
      if (cleanDate && cleanDate !== item.hari_tanggal) {
        modified = true;
        return { ...item, hari_tanggal: cleanDate };
      }
      return item;
    });
    if (modified) {
      localStorage.setItem(STORAGE_KEYS.JADWAL, JSON.stringify(normalized));
      if (isFirebaseConfigured) {
        firestoreSanitizeLegacyDates(normalized).catch((err) => {
          console.warn('Silent sanitize legacy dates fail:', err);
        });
      }
    }
    return normalized;
  }

  public getPengujiList(): PengujiAccount[] {
    const raw = localStorage.getItem(STORAGE_KEYS.PENGUJI);
    return raw ? JSON.parse(raw) : INITIAL_PENGUJI_LIST;
  }

  public getPresensiList(): PresensiRecord[] {
    const raw = localStorage.getItem(STORAGE_KEYS.PRESENSI);
    return raw ? JSON.parse(raw) : INITIAL_PRESENSI_LIST;
  }

  public getNilaiList(): NilaiRecord[] {
    const raw = localStorage.getItem(STORAGE_KEYS.NILAI);
    return raw ? JSON.parse(raw) : INITIAL_NILAI_LIST;
  }

  public getSesiUjianList(): SesiUjian[] {
    const raw = localStorage.getItem(STORAGE_KEYS.SESI_UJIAN);
    return raw ? JSON.parse(raw) : INITIAL_SESI_UJIAN;
  }

  public getSiswaById(id: string): SiswaJadwal | undefined {
    const list = this.getJadwalList();
    const cleanId = id.trim().toUpperCase();
    return list.find(s => s.id.toUpperCase() === cleanId);
  }

  public searchSiswa(query: string): SiswaJadwal[] {
    const list = this.getJadwalList();
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(s => 
      s.nama_siswa.toLowerCase().includes(q) || 
      s.id.toLowerCase().includes(q) ||
      s.kelas.toLowerCase().includes(q)
    );
  }

  // Timekeeper Attendance Submit
  public async submitPresensi(
    id_siswa: string, 
    tipe_presensi: 'Siswa' | 'Walmur', 
    petugas_timekeeper: string
  ): Promise<{ success: boolean; message: string; record?: PresensiRecord }> {
    const siswa = this.getSiswaById(id_siswa);
    if (!siswa) {
      return { success: false, message: `Siswa dengan ID "${id_siswa}" tidak ditemukan!` };
    }

    const currentPresensi = this.getPresensiList();
    // Check if already checked in for this type
    const alreadyExists = currentPresensi.find(
      p => p.id_siswa.toUpperCase() === id_siswa.toUpperCase() && p.tipe_presensi === tipe_presensi
    );

    if (alreadyExists) {
      return {
        success: false,
        message: `${tipe_presensi} dari ananda ${siswa.nama_siswa} sudah presensi sebelumnya pada ${alreadyExists.timestamp} (oleh ${alreadyExists.petugas_timekeeper}).`
      };
    }

    const now = new Date();
    const timestamp = now.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }) + ' ' + 
                      now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const newRecord: PresensiRecord = {
      id: `PRES-${Date.now().toString().slice(-6)}`,
      timestamp,
      id_siswa: siswa.id,
      nama_siswa: siswa.nama_siswa,
      tipe_presensi,
      petugas_timekeeper,
      status: 'Hadir'
    };

    currentPresensi.unshift(newRecord);
    localStorage.setItem(STORAGE_KEYS.PRESENSI, JSON.stringify(currentPresensi));

    // Instant save to Firestore
    if (isFirebaseConfigured) {
      firestoreSubmitPresensi(newRecord).catch((err) => {
        console.error('Firestore submit presensi error:', err);
      });
    } else if (this.gasUrl) {
      // Fallback legacy GAS jika Firebase tidak aktif
      void this.pushWithRetry({
        action: 'submitAttendance',
        id_siswa: siswa.id,
        nama_siswa: siswa.nama_siswa,
        tipe_presensi,
        petugas_timekeeper
      });
    }

    return {
      success: true,
      message: `Presensi ${tipe_presensi} untuk ${siswa.nama_siswa} berhasil disimpan!`,
      record: newRecord
    };
  }

  // Examiner Submit Grade
  public async submitGrade(
    id_siswa: string,
    kategori_ujian: KategoriUjian,
    detail_skor_json: Record<string, number | string>,
    skor_akhir_rata2: number,
    catatan_umum: string,
    nama_penguji: string,
    email_penguji: string
  ): Promise<{ success: boolean; message: string; record?: NilaiRecord }> {
    const siswa = this.getSiswaById(id_siswa);
    if (!siswa) {
      return { success: false, message: 'Data siswa tidak ditemukan.' };
    }

    const currentNilai = this.getNilaiList();
    const existingIndex = currentNilai.findIndex(
      n => n.id_siswa.toUpperCase() === id_siswa.toUpperCase() && n.kategori_ujian === kategori_ujian
    );

    const now = new Date();
    const timestamp = now.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }) + ' ' + 
                      now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const newRecord: NilaiRecord = {
      id: existingIndex >= 0 ? currentNilai[existingIndex].id : `NILAI-${Date.now().toString().slice(-6)}`,
      timestamp,
      id_siswa: siswa.id,
      nama_siswa: siswa.nama_siswa,
      kategori_ujian,
      nama_penguji,
      email_penguji,
      detail_skor_json,
      skor_akhir_rata2,
      catatan_umum
    };

    if (existingIndex >= 0) {
      currentNilai[existingIndex] = newRecord;
    } else {
      currentNilai.unshift(newRecord);
    }

    localStorage.setItem(STORAGE_KEYS.NILAI, JSON.stringify(currentNilai));

    // Instant save to Firestore
    if (isFirebaseConfigured) {
      firestoreSubmitGrade(newRecord).catch((err) => {
        console.error('Firestore submit grade error:', err);
      });
    } else if (this.gasUrl) {
      // Fallback legacy GAS
      void this.pushWithRetry({
        action: 'submitGrade',
        id_siswa: siswa.id,
        nama_siswa: siswa.nama_siswa,
        kategori_ujian,
        nama_penguji,
        email_penguji,
        detail_skor_json,
        skor_akhir_rata2,
        catatan_umum
      });
    }

    return {
      success: true,
      message: `Nilai ${kategori_ujian} untuk ${siswa.nama_siswa} berhasil disimpan.`,
      record: newRecord
    };
  }

  // Admin CRUD for Schedules
  public saveJadwal(siswa: SiswaJadwal, isEdit: boolean): { success: boolean; message: string } {
    const current = this.getJadwalList();
    if (isEdit) {
      const idx = current.findIndex(s => s.id.toUpperCase() === siswa.id.toUpperCase());
      if (idx === -1) return { success: false, message: 'Data siswa tidak ditemukan.' };
      current[idx] = siswa;
    } else {
      if (current.some(s => s.id.toUpperCase() === siswa.id.toUpperCase())) {
        return { success: false, message: `ID "${siswa.id}" sudah digunakan!` };
      }
      current.push(siswa);
    }
    localStorage.setItem(STORAGE_KEYS.JADWAL, JSON.stringify(current));

    // Instant save to Firestore
    if (isFirebaseConfigured) {
      firestoreSaveJadwal(siswa).catch((err) => {
        console.error('Firestore save jadwal error:', err);
      });
    } else if (this.gasUrl) {
      void this.pushWithRetry({
        action: isEdit ? 'adminUpdateSchedule' : 'adminAddSchedule',
        siswa
      });
    }

    return { success: true, message: isEdit ? 'Data jadwal berhasil diperbarui.' : 'Siswa baru berhasil ditambahkan ke jadwal.' };
  }

  public deleteJadwal(id: string): { success: boolean; message: string } {
    let current = this.getJadwalList();
    const initialLen = current.length;
    current = current.filter(s => s.id.toUpperCase() !== id.toUpperCase());
    if (current.length === initialLen) {
      return { success: false, message: 'ID siswa tidak ditemukan.' };
    }
    localStorage.setItem(STORAGE_KEYS.JADWAL, JSON.stringify(current));

    if (isFirebaseConfigured) {
      firestoreDeleteJadwal(id).catch((err) => {
        console.error('Firestore delete jadwal error:', err);
      });
    } else if (this.gasUrl) {
      void this.pushWithRetry({ action: 'adminDeleteSchedule', id });
    }

    return { success: true, message: 'Data jadwal berhasil dihapus.' };
  }

  // Admin Update/Delete Grades
  public deleteNilai(id: string): { success: boolean; message: string } {
    const current = this.getNilaiList();
    const target = current.find(n => n.id === id);
    const next = current.filter(n => n.id !== id);
    localStorage.setItem(STORAGE_KEYS.NILAI, JSON.stringify(next));

    if (isFirebaseConfigured) {
      firestoreDeleteGrade(id).catch((err) => {
        console.error('Firestore delete grade error:', err);
      });
    } else if (target && this.gasUrl) {
      void this.pushWithRetry({
        action: 'deleteGrade',
        id_siswa: target.id_siswa,
        kategori_ujian: target.kategori_ujian
      });
    }

    return { success: true, message: 'Data penilaian berhasil dihapus.' };
  }

  // Admin Attendance toggle/delete
  public deletePresensi(id: string): { success: boolean; message: string } {
    let current = this.getPresensiList();
    current = current.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.PRESENSI, JSON.stringify(current));
    if (isFirebaseConfigured) {
      firestoreDeletePresensi(id).catch((err) => {
        console.error('Firestore delete presensi error:', err);
      });
    }
    return { success: true, message: 'Data presensi berhasil dihapus.' };
  }

  // Admin CRUD for Exam Sessions (mode Online/Offline per date)
  public saveSesiUjian(sesi: SesiUjian): { success: boolean; message: string; record?: SesiUjian } {
    const current = this.getSesiUjianList();
    const now = new Date();
    const updatedAt = now.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }) + ' ' +
      now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const next: SesiUjian = {
      id_sesi: sesi.id_sesi || `SESI-${Date.now().toString().slice(-6)}`,
      hari_tanggal: sesi.hari_tanggal,
      mode_ujian: sesi.mode_ujian === 'Online' ? 'Online' : 'Offline',
      catatan: sesi.catatan || '',
      updated_at: updatedAt
    };

    const idx = current.findIndex(
      (item) => item.id_sesi === next.id_sesi || item.hari_tanggal === next.hari_tanggal
    );

    if (idx >= 0) {
      next.id_sesi = current[idx].id_sesi;
      current[idx] = next;
    } else {
      current.push(next);
    }

    localStorage.setItem(STORAGE_KEYS.SESI_UJIAN, JSON.stringify(current));

    if (isFirebaseConfigured) {
      firestoreSaveSesiUjian(next).catch((err) => {
        console.error('Firestore save sesi error:', err);
      });
    } else if (this.gasUrl) {
      void this.pushWithRetry({ action: 'adminSaveSession', sesi: next });
    }

    return { success: true, message: 'Mode ujian per tanggal berhasil disimpan.', record: next };
  }

  public deleteSesiUjian(id: string): { success: boolean; message: string } {
    const current = this.getSesiUjianList();
    const next = current.filter((item) => item.id_sesi !== id);
    if (next.length === current.length) {
      return { success: false, message: 'Sesi ujian tidak ditemukan.' };
    }
    localStorage.setItem(STORAGE_KEYS.SESI_UJIAN, JSON.stringify(next));

    if (isFirebaseConfigured) {
      firestoreDeleteSesiUjian(id).catch((err) => {
        console.error('Firestore delete sesi error:', err);
      });
    } else if (this.gasUrl) {
      void this.pushWithRetry({ action: 'adminDeleteSession', id_sesi: id });
    }

    return { success: true, message: 'Sesi ujian berhasil dihapus.' };
  }

  // Migrasi Spreadsheet langsung ke Firebase melalui Frontend
  public async migrateSpreadsheetToFirestore(): Promise<{ success: boolean; message: string }> {
    if (!isFirebaseConfigured) {
      return { success: false, message: 'Firebase belum dikonfigurasi. Silakan isi kredensial di file .env terlebih dahulu.' };
    }

    // Ambil data terbaru dari Spreadsheet
    const res = await this.syncFromGas();
    if (!res.success) {
      return { success: false, message: `Gagal membaca spreadsheet: ${res.message}` };
    }

    const payload = {
      jadwal: this.getJadwalList(),
      penguji: this.getPengujiList(),
      presensi: this.getPresensiList(),
      nilai: this.getNilaiList(),
      sesi: this.getSesiUjianList()
    };

    try {
      const result = await firestoreBulkMigrate(payload);
      return { success: true, message: result.message };
    } catch (err: any) {
      return { success: false, message: `Gagal migrasi ke Firestore: ${err.message}` };
    }
  }

  // Bulk import & upsert data calon siswa (jika ID sama, timpa data lama)
  public async bulkUpsertJadwal(
    newJadwals: SiswaJadwal[]
  ): Promise<{ success: boolean; total: number; updated: number; added: number; message: string }> {
    if (!newJadwals || newJadwals.length === 0) {
      return { success: false, total: 0, updated: 0, added: 0, message: 'Tidak ada data calon siswa yang diimpor.' };
    }

    const sanitizedJadwals = newJadwals.map((s) => ({
      ...s,
      hari_tanggal: toISODate(s.hari_tanggal) || String(s.hari_tanggal || '').trim()
    }));

    const current = this.getJadwalList();
    const currentMap = new Map<string, number>();
    current.forEach((s, idx) => {
      currentMap.set(String(s.id).trim().toUpperCase(), idx);
    });

    let added = 0;
    let updated = 0;

    sanitizedJadwals.forEach((siswa) => {
      const cleanId = String(siswa.id).trim().toUpperCase();
      const existingIdx = currentMap.get(cleanId);
      if (existingIdx !== undefined) {
        // Timpa data lama dengan data baru
        current[existingIdx] = siswa;
        updated++;
      } else {
        // Tambahkan data baru
        current.push(siswa);
        currentMap.set(cleanId, current.length - 1);
        added++;
      }
    });

    // Simpan ke cache lokal
    localStorage.setItem(STORAGE_KEYS.JADWAL, JSON.stringify(current));

    // Simpan ke Firestore secara batch
    if (isFirebaseConfigured) {
      try {
        await firestoreBulkUpsertJadwal(sanitizedJadwals);
      } catch (err) {
        console.error('Firestore bulk upsert error:', err);
      }
    }

    return {
      success: true,
      total: newJadwals.length,
      updated,
      added,
      message: `Berhasil mengimpor ${newJadwals.length} calon siswa (${added} data baru, ${updated} data lama diperbarui/ditimpa).`
    };
  }

  // Sinkronisasi otomatis data Penguji dari Spreadsheet (web_penguji) ke Firebase Firestore
  public async syncPengujiFromSpreadsheet(): Promise<{ success: boolean; count: number; message: string }> {
    try {
      const targetUrl = `${this.gasUrl}?action=getAllData`;
      let rawData: any = null;

      // Coba fetch melalui serverless proxy atau direct
      try {
        const res = await fetch('/api/sheets-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: targetUrl,
            method: 'GET'
          })
        });
        if (res.ok) {
          const json = await res.json();
          if (json.status === 'success' && json.data) {
            rawData = json.data;
          }
        }
      } catch (proxyErr) {
        console.warn('Proxy fetch penguji gagal, mencoba direct fetch:', proxyErr);
      }

      if (!rawData) {
        const res = await fetch(`${targetUrl}&secret_key=${encodeURIComponent(DEFAULT_APP_SECRET_KEY)}`);
        const json = await res.json();
        if (json.status === 'success' && json.data) {
          rawData = json.data;
        }
      }

      if (!rawData || !Array.isArray(rawData.penguji)) {
        return { success: false, count: 0, message: 'Gagal mengambil data penguji dari Google Spreadsheet.' };
      }

      const normalizedPenguji: PengujiAccount[] = rawData.penguji.map((item: any) => ({
        penguji: String(item.penguji || item.nama || '').trim(),
        email_penguji: String(item.email_penguji || item['email penguji'] || item.email || '').trim().toLowerCase()
      })).filter((p: PengujiAccount) => Boolean(p.penguji && p.email_penguji));

      // Simpan ke Firestore jika Firebase terkonfigurasi
      if (isFirebaseConfigured) {
        await firestoreBulkUpsertPenguji(normalizedPenguji);
      }

      // Update cache lokal
      localStorage.setItem(STORAGE_KEYS.PENGUJI, JSON.stringify(normalizedPenguji));

      return {
        success: true,
        count: normalizedPenguji.length,
        message: `Sinkronisasi berhasil! ${normalizedPenguji.length} penguji dari sheet web_penguji telah diperbarui.`
      };
    } catch (err: any) {
      console.error('syncPengujiFromSpreadsheet error:', err);
      return { success: false, count: 0, message: `Gagal sinkron penguji: ${err.message || 'Jaringan bermasalah'}` };
    }
  }
}

export const apiService = new ApiService();
