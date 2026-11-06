import dotenv from 'dotenv';
dotenv.config();

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, writeBatch } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const GAS_URL = 'https://script.google.com/macros/s/AKfycbyCOLKJEtL480pr5f3YJP4nNq80OiBgeInZI6XWVNvQC1prD4K-8LX7K85UjxiEjOFJ/exec';
const SECRET_KEY = process.env.APP_SECRET_KEY || process.env.VITE_APP_SECRET_KEY || 'aa84e8445d76e5a72a983e78826fdb87';

async function runMigration() {
  console.log('🚀 Memulai migrasi data dari Google Spreadsheet ke Firebase Firestore...');

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error('❌ Error: Kredensial Firebase belum terisi di file .env!');
    console.error('Pastikan VITE_FIREBASE_API_KEY dan VITE_FIREBASE_PROJECT_ID sudah diisi.');
    process.exit(1);
  }

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  console.log('📥 Mengambil data terbaru dari Google Spreadsheet...');
  const targetUrl = `${GAS_URL}?action=getAllData&secret_key=${encodeURIComponent(SECRET_KEY)}`;
  
  const response = await fetch(targetUrl);
  if (!response.ok) {
    throw new Error(`Gagal fetch data: HTTP ${response.status}`);
  }

  const result = await response.json();
  if (result.status !== 'success' || !result.data) {
    throw new Error(result.message || 'Format data Google Spreadsheet tidak sesuai');
  }

  const { jadwal = [], penguji = [], presensi = [], nilai = [], sesi = [] } = result.data;
  console.log(`📊 Ditemukan:
  - Jadwal Siswa: ${jadwal.length}
  - Penguji: ${penguji.length}
  - Presensi: ${presensi.length}
  - Nilai: ${nilai.length}
  - Sesi Ujian: ${sesi.length}`);

  // Helper batch writer
  const commitInBatches = async (collectionName: string, items: Array<{ id: string; data: any }>) => {
    const BATCH_SIZE = 400;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = items.slice(i, i + BATCH_SIZE);
      for (const item of chunk) {
        const ref = doc(db, collectionName, item.id);
        batch.set(ref, item.data, { merge: true });
      }
      await batch.commit();
      console.log(`  ✓ ${collectionName}: Menulis ${chunk.length} data (${Math.min(i + BATCH_SIZE, items.length)}/${items.length})`);
    }
  };

  console.log('\n⏳ Menulis data ke Firestore...');

  // 1. Jadwal
  if (jadwal.length > 0) {
    const items = jadwal.map((j: any) => ({
      id: String(j.id),
      data: j
    }));
    await commitInBatches('spmb_jadwal', items);
  }

  // 2. Penguji
  if (penguji.length > 0) {
    const items = penguji.map((p: any, index: number) => {
      const email = String(p.email_penguji || p['email penguji'] || p.email || '').toLowerCase().trim();
      const safeId = email ? email.replace(/[.#$[\]/]/g, '_') : `penguji_${index + 1}`;
      return {
        id: safeId,
        data: {
          penguji: String(p.penguji || p.nama || '').trim(),
          email_penguji: email
        }
      };
    });
    await commitInBatches('spmb_penguji', items);
  }

  // 3. Presensi
  if (presensi.length > 0) {
    const items = presensi.map((pr: any, index: number) => {
      const docId = String(pr.id || `PRES_${pr.id_siswa || 'siswa'}_${pr.tipe_presensi || 'tipe'}_${index}`);
      return {
        id: docId.replace(/[.#$[\]/]/g, '_'),
        data: {
          ...pr,
          id: docId
        }
      };
    });
    await commitInBatches('spmb_presensi', items);
  }

  // 4. Nilai
  if (nilai.length > 0) {
    const items = nilai.map((n: any, index: number) => {
      const safeKat = String(n.kategori_ujian || '').replace(/\s+/g, '_');
      const docId = String(n.id || `NILAI_${n.id_siswa || 'siswa'}_${safeKat}_${index}`);
      return {
        id: docId.replace(/[.#$[\]/]/g, '_'),
        data: {
          ...n,
          id: docId
        }
      };
    });
    await commitInBatches('spmb_nilai', items);
  }

  // 5. Sesi Ujian
  if (sesi.length > 0) {
    const items = sesi.map((s: any, index: number) => {
      const docId = String(s.id_sesi || s.id || `SESI_${index}`);
      return {
        id: docId.replace(/[.#$[\]/]/g, '_'),
        data: {
          ...s,
          id_sesi: docId
        }
      };
    });
    await commitInBatches('spmb_sesi_ujian', items);
  }

  console.log('\n🎉 MIGRASI SUKSES 100%! Seluruh data spreadsheet kini aktif di Firebase Firestore.');
  process.exit(0);
}

runMigration().catch((err) => {
  console.error('\n❌ Terjadi kesalahan saat migrasi:', err);
  process.exit(1);
});
