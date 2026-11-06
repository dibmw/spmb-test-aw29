import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc,
  setDoc, 
  getDocs, 
  deleteDoc, 
  onSnapshot, 
  writeBatch,
  query,
  where,
  Firestore,
  Unsubscribe,
  enableIndexedDbPersistence
} from 'firebase/firestore';
import { SiswaJadwal, PengujiAccount, PresensiRecord, NilaiRecord, SesiUjian, KategoriUjian } from '../types/spmb';

// Ambil konfigurasi dari environment variables Vite
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && 
  firebaseConfig.projectId && 
  firebaseConfig.apiKey !== 'YOUR_FIREBASE_API_KEY'
);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    db = getFirestore(app);
  } catch (error) {
    console.error('Error initializing Firebase:', error);
  }
}

export { db };

// Koleksi Firestore
export const COLLECTIONS = {
  JADWAL: 'spmb_jadwal',
  PENGUJI: 'spmb_penguji',
  PRESENSI: 'spmb_presensi',
  NILAI: 'spmb_nilai',
  SESI_UJIAN: 'spmb_sesi_ujian'
};

// ==========================================
// REAL-TIME SUBSCRIBERS (WITH ROBUST STRING NORMALIZATION)
// ==========================================

export function subscribeToJadwal(callback: (jadwal: SiswaJadwal[]) => void): Unsubscribe | null {
  if (!db) return null;
  const colRef = collection(db, COLLECTIONS.JADWAL);
  return onSnapshot(colRef, (snapshot) => {
    const list: SiswaJadwal[] = [];
    snapshot.forEach((docSnap) => {
      const item = docSnap.data() as any;
      list.push({
        ...item,
        id: String(item.id || docSnap.id).trim(),
        nama_siswa: String(item.nama_siswa || '').trim(),
        kelas: String(item.kelas || 'SD 1').trim(),
        gender: (item.gender === 'P' || String(item.gender).toLowerCase().startsWith('p') ? 'P' : 'L'),
        ruangan_siswa: String(item.ruangan_siswa || '').trim(),
        waktu_all: String(item.waktu_all || '').trim(),
        waktu_alq_arab: String(item.waktu_alq_arab || '').trim(),
        waktu_catung_eng: String(item.waktu_catung_eng || '').trim(),
        ruangan_walmur: String(item.ruangan_walmur || '').trim(),
        penguji_alq_arab: String(item.penguji_alq_arab || '').trim(),
        penguji_catung_eng: String(item.penguji_catung_eng || '').trim(),
        timekeeper_siswa: String(item.timekeeper_siswa || '').trim(),
        interview_walmur: String(item.interview_walmur || '').trim(),
        timekeeper_walmur: String(item.timekeeper_walmur || '').trim(),
        waktu_interview: String(item.waktu_interview || '').trim(),
        hari_tanggal: String(item.hari_tanggal || '').trim(),
        status: item.status === 'Selesai' ? 'Selesai' : item.status === 'Reschedule' ? 'Reschedule' : 'Aktif',
        status_kehadiran_siswa: item.status_kehadiran_siswa || '',
        status_kehadiran_walmur: item.status_kehadiran_walmur || '',
        gelombang: String(item.gelombang || '').trim()
      } as SiswaJadwal);
    });
    // Urutkan berdasarkan ID
    list.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    callback(list);
  }, (err) => {
    console.error('Firestore Jadwal subscription error:', err);
  });
}

export function subscribeToPenguji(callback: (penguji: PengujiAccount[]) => void): Unsubscribe | null {
  if (!db) return null;
  const colRef = collection(db, COLLECTIONS.PENGUJI);
  return onSnapshot(colRef, (snapshot) => {
    const list: PengujiAccount[] = [];
    snapshot.forEach((docSnap) => {
      const item = docSnap.data() as any;
      list.push({
        penguji: String(item.penguji || item.nama || '').trim(),
        email_penguji: String(item.email_penguji || item['email penguji'] || item.email || '').trim().toLowerCase()
      });
    });
    callback(list);
  }, (err) => {
    console.error('Firestore Penguji subscription error:', err);
  });
}

export async function firestoreVerifyOfficer(email: string): Promise<PengujiAccount | null> {
  if (!db) return null;
  const clean = email.trim().toLowerCase();
  const safeId = clean.replace(/[.#$[\]/]/g, '_');
  try {
    const docSnap = await getDoc(doc(db, COLLECTIONS.PENGUJI, safeId));
    if (docSnap.exists()) {
      const item = docSnap.data() as any;
      return {
        penguji: String(item.penguji || item.nama || '').trim(),
        email_penguji: clean
      };
    }
  } catch (err) {
    console.warn('Direct doc lookup fail:', err);
  }

  try {
    const colRef = collection(db, COLLECTIONS.PENGUJI);
    const q = query(colRef, where('email_penguji', '==', clean));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const item = snap.docs[0].data() as any;
      return {
        penguji: String(item.penguji || item.nama || '').trim(),
        email_penguji: clean
      };
    }
  } catch (err) {
    console.warn('Query lookup fail:', err);
  }

  return null;
}

export function subscribeToPresensi(callback: (presensi: PresensiRecord[]) => void): Unsubscribe | null {
  if (!db) return null;
  const colRef = collection(db, COLLECTIONS.PRESENSI);
  return onSnapshot(colRef, (snapshot) => {
    const list: PresensiRecord[] = [];
    snapshot.forEach((docSnap) => {
      const item = docSnap.data() as any;
      list.push({
        id: String(item.id || docSnap.id),
        timestamp: String(item.timestamp || ''),
        id_siswa: String(item.id_siswa || '').trim(),
        nama_siswa: String(item.nama_siswa || '').trim(),
        tipe_presensi: item.tipe_presensi === 'Walmur' ? 'Walmur' : 'Siswa',
        petugas_timekeeper: String(item.petugas_timekeeper || ''),
        status: 'Hadir'
      } as PresensiRecord);
    });
    // Urutkan terbaru di atas
    list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    callback(list);
  }, (err) => {
    console.error('Firestore Presensi subscription error:', err);
  });
}

export function subscribeToNilai(callback: (nilai: NilaiRecord[]) => void): Unsubscribe | null {
  if (!db) return null;
  const colRef = collection(db, COLLECTIONS.NILAI);
  return onSnapshot(colRef, (snapshot) => {
    const list: NilaiRecord[] = [];
    snapshot.forEach((docSnap) => {
      const item = docSnap.data() as any;
      let detail = item.detail_skor_json;
      if (typeof detail === 'string') {
        try { detail = JSON.parse(detail); } catch { detail = {}; }
      }
      list.push({
        id: String(item.id || docSnap.id),
        timestamp: String(item.timestamp || ''),
        id_siswa: String(item.id_siswa || '').trim(),
        nama_siswa: String(item.nama_siswa || '').trim(),
        kategori_ujian: item.kategori_ujian as KategoriUjian,
        nama_penguji: String(item.nama_penguji || ''),
        email_penguji: String(item.email_penguji || ''),
        detail_skor_json: detail || {},
        skor_akhir_rata2: Number(item.skor_akhir_rata2) || 0,
        catatan_umum: String(item.catatan_umum || '')
      } as NilaiRecord);
    });
    callback(list);
  }, (err) => {
    console.error('Firestore Nilai subscription error:', err);
  });
}

export function subscribeToSesiUjian(callback: (sesi: SesiUjian[]) => void): Unsubscribe | null {
  if (!db) return null;
  const colRef = collection(db, COLLECTIONS.SESI_UJIAN);
  return onSnapshot(colRef, (snapshot) => {
    const list: SesiUjian[] = [];
    snapshot.forEach((docSnap) => {
      const item = docSnap.data() as any;
      list.push({
        id_sesi: String(item.id_sesi || docSnap.id),
        hari_tanggal: String(item.hari_tanggal || ''),
        mode_ujian: item.mode_ujian === 'Online' ? 'Online' : 'Offline',
        catatan: String(item.catatan || ''),
        updated_at: String(item.updated_at || '')
      } as SesiUjian);
    });
    list.sort((a, b) => a.hari_tanggal.localeCompare(b.hari_tanggal));
    callback(list);
  }, (err) => {
    console.error('Firestore Sesi Ujian subscription error:', err);
  });
}

// ==========================================
// FIRESTORE CRUD OPERATIONS (INSTANT)
// ==========================================

export async function firestoreSaveJadwal(siswa: SiswaJadwal): Promise<void> {
  if (!db) throw new Error('Firebase belum dikonfigurasi.');
  const docRef = doc(db, COLLECTIONS.JADWAL, String(siswa.id));
  await setDoc(docRef, siswa, { merge: true });
}

export async function firestoreBulkUpsertJadwal(
  jadwals: SiswaJadwal[]
): Promise<{ total: number; message: string }> {
  if (!db) throw new Error('Firebase belum dikonfigurasi.');
  if (!jadwals || jadwals.length === 0) return { total: 0, message: 'Tidak ada data untuk diimpor.' };

  const BATCH_SIZE = 400;
  for (let i = 0; i < jadwals.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = jadwals.slice(i, i + BATCH_SIZE);
    for (const s of chunk) {
      const cleanId = String(s.id).trim();
      const docRef = doc(db, COLLECTIONS.JADWAL, cleanId);
      batch.set(docRef, { ...s, id: cleanId }, { merge: true });
    }
    await batch.commit();
  }

  return {
    total: jadwals.length,
    message: `Berhasil mengimpor ${jadwals.length} data calon siswa ke Firebase Firestore.`
  };
}

export async function firestoreBulkUpsertPenguji(
  pengujiList: PengujiAccount[]
): Promise<{ total: number; message: string }> {
  if (!db) throw new Error('Firebase belum dikonfigurasi.');
  if (!pengujiList || pengujiList.length === 0) return { total: 0, message: 'Tidak ada data penguji.' };

  const BATCH_SIZE = 400;
  for (let i = 0; i < pengujiList.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = pengujiList.slice(i, i + BATCH_SIZE);
    for (let j = 0; j < chunk.length; j++) {
      const p = chunk[j];
      const email = String(p.email_penguji || (p as any)['email penguji'] || (p as any).email || '').trim().toLowerCase();
      const safeId = email ? email.replace(/[.#$[\]/]/g, '_') : `penguji_${i + j + 1}`;
      const docRef = doc(db, COLLECTIONS.PENGUJI, safeId);
      batch.set(docRef, {
        penguji: String(p.penguji || (p as any).nama || '').trim(),
        email_penguji: email
      }, { merge: true });
    }
    await batch.commit();
  }

  return {
    total: pengujiList.length,
    message: `Berhasil menyinkronkan ${pengujiList.length} petugas penguji ke Firestore.`
  };
}

export async function firestoreDeleteJadwal(id: string): Promise<void> {
  if (!db) throw new Error('Firebase belum dikonfigurasi.');
  const docRef = doc(db, COLLECTIONS.JADWAL, String(id));
  await deleteDoc(docRef);
}

export async function firestoreSubmitPresensi(record: PresensiRecord): Promise<void> {
  if (!db) throw new Error('Firebase belum dikonfigurasi.');
  const docId = record.id || `PRES-${record.id_siswa}-${record.tipe_presensi}`;
  const docRef = doc(db, COLLECTIONS.PRESENSI, docId);
  await setDoc(docRef, { ...record, id: docId }, { merge: true });
}

export async function firestoreDeletePresensi(id: string): Promise<void> {
  if (!db) throw new Error('Firebase belum dikonfigurasi.');
  const docRef = doc(db, COLLECTIONS.PRESENSI, String(id));
  await deleteDoc(docRef);
}

export async function firestoreSubmitGrade(record: NilaiRecord): Promise<void> {
  if (!db) throw new Error('Firebase belum dikonfigurasi.');
  // ID komposit unik berdasarkan id_siswa dan kategori_ujian
  const docId = record.id || `NILAI-${record.id_siswa}-${record.kategori_ujian.replace(/\s+/g, '_')}`;
  const docRef = doc(db, COLLECTIONS.NILAI, docId);
  await setDoc(docRef, { ...record, id: docId }, { merge: true });
}

export async function firestoreDeleteGrade(id: string): Promise<void> {
  if (!db) throw new Error('Firebase belum dikonfigurasi.');
  const docRef = doc(db, COLLECTIONS.NILAI, String(id));
  await deleteDoc(docRef);
}

export async function firestoreSaveSesiUjian(sesi: SesiUjian): Promise<void> {
  if (!db) throw new Error('Firebase belum dikonfigurasi.');
  const docRef = doc(db, COLLECTIONS.SESI_UJIAN, String(sesi.id_sesi));
  await setDoc(docRef, sesi, { merge: true });
}

export async function firestoreDeleteSesiUjian(id_sesi: string): Promise<void> {
  if (!db) throw new Error('Firebase belum dikonfigurasi.');
  const docRef = doc(db, COLLECTIONS.SESI_UJIAN, String(id_sesi));
  await deleteDoc(docRef);
}

// Bulk migration helper (batch write sampai ratusan record sekaligus)
export async function firestoreBulkMigrate(data: {
  jadwal?: SiswaJadwal[];
  penguji?: PengujiAccount[];
  presensi?: PresensiRecord[];
  nilai?: NilaiRecord[];
  sesi?: SesiUjian[];
}): Promise<{ success: boolean; counts: Record<string, number>; message: string }> {
  if (!db) throw new Error('Firebase belum diinisialisasi. Cek konfigurasi di .env.');

  const counts: Record<string, number> = {
    jadwal: 0,
    penguji: 0,
    presensi: 0,
    nilai: 0,
    sesi: 0
  };

  // Helper commit in batches of max 400 (Firestore limit is 500)
  const commitInBatches = async (items: Array<{ ref: any; data: any }>) => {
    const BATCH_SIZE = 400;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = writeBatch(db!);
      const chunk = items.slice(i, i + BATCH_SIZE);
      for (const item of chunk) {
        batch.set(item.ref, item.data, { merge: true });
      }
      await batch.commit();
    }
  };

  // 1. Jadwal
  if (data.jadwal && data.jadwal.length > 0) {
    const ops = data.jadwal.map((s) => ({
      ref: doc(db!, COLLECTIONS.JADWAL, String(s.id)),
      data: s
    }));
    await commitInBatches(ops);
    counts.jadwal = data.jadwal.length;
  }

  // 2. Penguji
  if (data.penguji && data.penguji.length > 0) {
    const ops = data.penguji.map((p, index) => {
      const email = String(p.email_penguji || (p as any)['email penguji'] || '').trim().toLowerCase();
      const safeId = email ? email.replace(/[.#$[\]/]/g, '_') : `penguji_${index + 1}`;
      return {
        ref: doc(db!, COLLECTIONS.PENGUJI, safeId),
        data: {
          penguji: p.penguji,
          email_penguji: email
        }
      };
    });
    await commitInBatches(ops);
    counts.penguji = data.penguji.length;
  }

  // 3. Presensi
  if (data.presensi && data.presensi.length > 0) {
    const ops = data.presensi.map((pr, index) => {
      const docId = pr.id || `PRES-${pr.id_siswa}-${pr.tipe_presensi}-${index}`;
      return {
        ref: doc(db!, COLLECTIONS.PRESENSI, docId),
        data: { ...pr, id: docId }
      };
    });
    await commitInBatches(ops);
    counts.presensi = data.presensi.length;
  }

  // 4. Nilai
  if (data.nilai && data.nilai.length > 0) {
    const ops = data.nilai.map((n, index) => {
      const safeKat = String(n.kategori_ujian || '').replace(/\s+/g, '_');
      const docId = n.id || `NILAI-${n.id_siswa}-${safeKat}-${index}`;
      return {
        ref: doc(db!, COLLECTIONS.NILAI, docId),
        data: { ...n, id: docId }
      };
    });
    await commitInBatches(ops);
    counts.nilai = data.nilai.length;
  }

  // 5. Sesi Ujian
  if (data.sesi && data.sesi.length > 0) {
    const ops = data.sesi.map((s) => ({
      ref: doc(db!, COLLECTIONS.SESI_UJIAN, String(s.id_sesi)),
      data: s
    }));
    await commitInBatches(ops);
    counts.sesi = data.sesi.length;
  }

  return {
    success: true,
    counts,
    message: `Migrasi selesai: ${counts.jadwal} siswa, ${counts.penguji} penguji, ${counts.presensi} presensi, ${counts.nilai} nilai, ${counts.sesi} sesi ujian.`
  };
}
