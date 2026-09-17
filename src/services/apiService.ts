import { 
  SiswaJadwal, 
  PengujiAccount, 
  PresensiRecord, 
  NilaiRecord, 
  UserSession, 
  Role, 
  KategoriUjian 
} from '../types/spmb';
import { 
  INITIAL_JADWAL_LIST, 
  INITIAL_PENGUJI_LIST, 
  INITIAL_PRESENSI_LIST, 
  INITIAL_NILAI_LIST, 
  ADMIN_EMAIL 
} from '../data/mockData';

export const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbzq3IHLcodfvYCSuD8j4beiH30pdLV1zNMBWOcXMKUAHN8OEc5KENttMEmo7cDjBZaz/exec';

const STORAGE_KEYS = {
  JADWAL: 'spmb29_jadwal',
  PENGUJI: 'spmb29_penguji',
  PRESENSI: 'spmb29_presensi',
  NILAI: 'spmb29_nilai',
  USER_SESSION: 'spmb29_session',
  GAS_URL: 'spmb29_gas_url'
};

class ApiService {
  private gasUrl: string = DEFAULT_GAS_URL;

  constructor() {
    this.initStorage();
    const stored = localStorage.getItem(STORAGE_KEYS.GAS_URL);
    this.gasUrl = stored && stored.trim() ? stored.trim() : DEFAULT_GAS_URL;
    if (!stored) {
      localStorage.setItem(STORAGE_KEYS.GAS_URL, DEFAULT_GAS_URL);
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
  }

  // Sync all sheets from live Google Apps Script endpoint
  public async syncFromGas(): Promise<{ 
    success: boolean; 
    message: string; 
    counts?: { jadwal: number; penguji: number; presensi: number; nilai: number } 
  }> {
    if (!this.gasUrl) {
      return { success: false, message: 'URL Google Apps Script belum dikonfigurasi.' };
    }

    try {
      const res = await fetch(`${this.gasUrl}?action=getAllData`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        redirect: 'follow'
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();
      if (json.status === 'success' && json.data) {
        const { jadwal, penguji, presensi, nilai } = json.data;

        let jCount = 0;
        let pCount = 0;
        let prCount = 0;
        let nCount = 0;

        if (Array.isArray(jadwal) && jadwal.length > 0) {
          // Normalize field names if needed
          const normalizedJadwal: SiswaJadwal[] = jadwal.map((item: any) => ({
            id: String(item.id || item.id_siswa || '').trim(),
            nama_siswa: String(item.nama_siswa || '').trim(),
            kelas: String(item.kelas || 'SD 1').trim(),
            gender: (item.gender === 'P' ? 'P' : 'L') as 'L' | 'P',
            nomor_walmur: String(item.nomor_walmur || '').trim(),
            email_walmur: String(item.email_walmur || '').trim(),
            grade: (item.grade || (String(item.kelas || '').startsWith('SMP') ? 'SMP' : String(item.kelas || '').startsWith('SMA') ? 'SMA' : 'SD')) as 'SD' | 'SMP' | 'SMA',
            ruangan_siswa: String(item.ruangan_siswa || 'R. 101').trim(),
            ord_alq_arab: String(item.ord_alq_arab || '').trim(),
            ord_catung_eng: String(item.ord_catung_eng || '').trim(),
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
          }));
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

        return {
          success: true,
          message: 'Sinkronisasi berhasil! Data terbaru dari Google Spreadsheet berhasil dimuat.',
          counts: { jadwal: jCount, penguji: pCount, presensi: prCount, nilai: nCount }
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

    // Try Google Apps Script if URL provided
    if (this.gasUrl) {
      try {
        const res = await fetch(`${this.gasUrl}?action=verifyLogin&email=${encodeURIComponent(email)}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        const json = await res.json();
        if (json.status === 'success' && json.data) {
          const session: UserSession = json.data;
          this.setSession(session);
          return { success: true, session, message: `Selamat datang, ${session.nama}` };
        }
      } catch (err) {
        console.warn('GAS login failed, falling back to local database verify:', err);
      }
    }

    // Local Verification
    const pengujiList = this.getPengujiList();
    const jadwalList = this.getJadwalList();

    const isSuperAdmin = (email === ADMIN_EMAIL.toLowerCase());
    const matchedOfficer = pengujiList.find(p => p.email_penguji.trim().toLowerCase() === email);

    if (!matchedOfficer && !isSuperAdmin) {
      return {
        success: false,
        message: 'Email tidak ditemukan dalam daftar penguji resmi Al-Wildan 29 Depok.'
      };
    }

    const officialName = matchedOfficer ? matchedOfficer.penguji : 'Tim Kurikulum Al-Wildan 29 (Super Admin)';

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
    return raw ? JSON.parse(raw) : INITIAL_JADWAL_LIST;
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
      s.kelas.toLowerCase().includes(q) ||
      s.nomor_walmur.includes(q)
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

    // Async push to GAS if configured
    if (this.gasUrl) {
      try {
        fetch(this.gasUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'submitAttendance',
            id_siswa: siswa.id,
            nama_siswa: siswa.nama_siswa,
            tipe_presensi,
            petugas_timekeeper
          })
        }).catch(err => console.warn('GAS attendance push background notice:', err));
      } catch (err) {
        console.warn('GAS attendance push error:', err);
      }
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

    // Push to GAS if configured
    if (this.gasUrl) {
      try {
        fetch(this.gasUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'submitGrade',
            id_siswa: siswa.id,
            nama_siswa: siswa.nama_siswa,
            kategori_ujian,
            nama_penguji,
            email_penguji,
            detail_skor_json,
            skor_akhir_rata2,
            catatan_umum
          })
        }).catch(err => console.warn('GAS grade push background notice:', err));
      } catch (err) {
        console.warn('GAS grade push error:', err);
      }
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

    // GAS sync
    if (this.gasUrl) {
      fetch(this.gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isEdit ? 'adminUpdateSchedule' : 'adminAddSchedule',
          siswa
        })
      }).catch(err => console.warn('GAS schedule sync notice:', err));
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

    if (this.gasUrl) {
      fetch(this.gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'adminDeleteSchedule', id })
      }).catch(err => console.warn('GAS delete schedule sync notice:', err));
    }

    return { success: true, message: 'Data jadwal berhasil dihapus.' };
  }

  // Admin Update/Delete Grades
  public deleteNilai(id: string): { success: boolean; message: string } {
    let current = this.getNilaiList();
    current = current.filter(n => n.id !== id);
    localStorage.setItem(STORAGE_KEYS.NILAI, JSON.stringify(current));
    return { success: true, message: 'Data penilaian berhasil dihapus.' };
  }

  // Admin Attendance toggle/delete
  public deletePresensi(id: string): { success: boolean; message: string } {
    let current = this.getPresensiList();
    current = current.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.PRESENSI, JSON.stringify(current));
    return { success: true, message: 'Data presensi berhasil dihapus.' };
  }
}

export const apiService = new ApiService();
