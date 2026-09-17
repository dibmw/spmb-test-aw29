import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  BookOpen, 
  Languages, 
  HelpCircle, 
  UserCheck, 
  Star, 
  AlertTriangle,
  Award,
  FileCheck
} from 'lucide-react';
import { SiswaJadwal, KategoriUjian, NilaiRecord, UserSession, formatKelas } from '../types/spmb';
import { apiService } from '../services/apiService';

interface RubrikModalProps {
  isOpen: boolean;
  siswa: SiswaJadwal | null;
  kategori: KategoriUjian;
  existingNilai?: NilaiRecord;
  session: UserSession;
  onClose: () => void;
  onGradeSaved: (savedRecord: NilaiRecord) => void;
  showToast: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}

export const RubrikModal: React.FC<RubrikModalProps> = ({
  isOpen,
  siswa,
  kategori,
  existingNilai,
  session,
  onClose,
  onGradeSaved,
  showToast
}) => {
  // Calistung SD State (0-100)
  const [calistungState, setCalistungState] = useState({
    baca_indo: 80,
    paham_indo: 80,
    baca_inggris: 75,
    paham_inggris: 75,
    catatan: ''
  });

  // English SMP/SMA State (1-4)
  const [englishState, setEnglishState] = useState({
    fluency: 3,
    vocab_grammar: 3,
    critical_thinking: 3,
    expression_clarity: 3,
    catatan: ''
  });

  // Quran SD State (0-100)
  const [quranSdState, setQuranSdState] = useState({
    tilawah: 85,
    catatan: ''
  });

  // Quran SMP/SMA State (1-4)
  const [quranSmpSmaState, setQuranSmpSmaState] = useState({
    makhorijul_huruf: 3,
    sifatul_huruf: 3,
    kelancaran: 3,
    catatan: ''
  });

  // Bahasa Arab SMP/SMA State (1-4)
  const [arabState, setArabState] = useState({
    percaya_diri: 3,
    kelancaran: 3,
    kejelasan: 3,
    adab: 4,
    catatan: ''
  });

  // Interview Walmur State (1-5 with per-item notes)
  const [interviewState, setInterviewState] = useState({
    ibadah_skor: 4,
    ibadah_catatan: '',
    akhlak_skor: 4,
    akhlak_catatan: '',
    pola_asuh_skor: 4,
    pola_asuh_catatan: '',
    kebiasaan_belajar_skor: 4,
    kebiasaan_belajar_catatan: '',
    gadget_skor: 3,
    gadget_catatan: '',
    catatan_umum: ''
  });

  const [submitting, setSubmitting] = useState(false);

  // Initialize fields with existing grade if editing
  useEffect(() => {
    if (existingNilai && existingNilai.detail_skor_json) {
      const d = existingNilai.detail_skor_json as any;
      if (kategori === 'Calistung') {
        setCalistungState({
          baca_indo: Number(d.baca_indo) || 80,
          paham_indo: Number(d.paham_indo) || 80,
          baca_inggris: Number(d.baca_inggris) || 75,
          paham_inggris: Number(d.paham_inggris) || 75,
          catatan: existingNilai.catatan_umum || d.catatan || ''
        });
      } else if (kategori === 'English') {
        setEnglishState({
          fluency: Number(d.fluency) || 3,
          vocab_grammar: Number(d.vocab_grammar) || 3,
          critical_thinking: Number(d.critical_thinking) || 3,
          expression_clarity: Number(d.expression_clarity) || 3,
          catatan: existingNilai.catatan_umum || d.catatan || ''
        });
      } else if (kategori === 'Al-Quran SD') {
        setQuranSdState({
          tilawah: Number(d.tilawah) || 85,
          catatan: existingNilai.catatan_umum || d.catatan || ''
        });
      } else if (kategori === 'Al-Quran SMP/SMA') {
        setQuranSmpSmaState({
          makhorijul_huruf: Number(d.makhorijul_huruf) || 3,
          sifatul_huruf: Number(d.sifatul_huruf) || 3,
          kelancaran: Number(d.kelancaran) || 3,
          catatan: existingNilai.catatan_umum || d.catatan || ''
        });
      } else if (kategori === 'Bahasa Arab') {
        setArabState({
          percaya_diri: Number(d.percaya_diri) || 3,
          kelancaran: Number(d.kelancaran) || 3,
          kejelasan: Number(d.kejelasan) || 3,
          adab: Number(d.adab) || 4,
          catatan: existingNilai.catatan_umum || d.catatan || ''
        });
      } else if (kategori === 'Interview Walmur') {
        setInterviewState({
          ibadah_skor: Number(d.ibadah_skor) || 4,
          ibadah_catatan: d.ibadah_catatan || '',
          akhlak_skor: Number(d.akhlak_skor) || 4,
          akhlak_catatan: d.akhlak_catatan || '',
          pola_asuh_skor: Number(d.pola_asuh_skor) || 4,
          pola_asuh_catatan: d.pola_asuh_catatan || '',
          kebiasaan_belajar_skor: Number(d.kebiasaan_belajar_skor) || 4,
          kebiasaan_belajar_catatan: d.kebiasaan_belajar_catatan || '',
          gadget_skor: Number(d.gadget_skor) || 3,
          gadget_catatan: d.gadget_catatan || '',
          catatan_umum: existingNilai.catatan_umum || ''
        });
      }
    }
  }, [existingNilai, kategori]);

  if (!isOpen || !siswa) return null;

  // Real-time calculation of average score
  const calculateAverage = (): number => {
    if (kategori === 'Calistung') {
      const sum = calistungState.baca_indo + calistungState.paham_indo + calistungState.baca_inggris + calistungState.paham_inggris;
      return Math.round((sum / 4) * 100) / 100;
    }
    if (kategori === 'English') {
      const sum = englishState.fluency + englishState.vocab_grammar + englishState.critical_thinking + englishState.expression_clarity;
      return Math.round((sum / 4) * 100) / 100;
    }
    if (kategori === 'Al-Quran SD') {
      return Math.round(quranSdState.tilawah * 100) / 100;
    }
    if (kategori === 'Al-Quran SMP/SMA') {
      const sum = quranSmpSmaState.makhorijul_huruf + quranSmpSmaState.sifatul_huruf + quranSmpSmaState.kelancaran;
      return Math.round((sum / 3) * 100) / 100;
    }
    if (kategori === 'Bahasa Arab') {
      const sum = arabState.percaya_diri + arabState.kelancaran + arabState.kejelasan + arabState.adab;
      return Math.round((sum / 4) * 100) / 100;
    }
    if (kategori === 'Interview Walmur') {
      const sum = interviewState.ibadah_skor + interviewState.akhlak_skor + interviewState.pola_asuh_skor + interviewState.kebiasaan_belajar_skor + interviewState.gadget_skor;
      return Math.round((sum / 5) * 100) / 100;
    }
    return 0;
  };

  const currentAverage = calculateAverage();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      let detailPayload: any = {};
      let catatanUmum = '';

      if (kategori === 'Calistung') {
        detailPayload = calistungState;
        catatanUmum = calistungState.catatan;
      } else if (kategori === 'English') {
        detailPayload = englishState;
        catatanUmum = englishState.catatan;
      } else if (kategori === 'Al-Quran SD') {
        detailPayload = quranSdState;
        catatanUmum = quranSdState.catatan;
      } else if (kategori === 'Al-Quran SMP/SMA') {
        detailPayload = quranSmpSmaState;
        catatanUmum = quranSmpSmaState.catatan;
      } else if (kategori === 'Bahasa Arab') {
        detailPayload = arabState;
        catatanUmum = arabState.catatan;
      } else if (kategori === 'Interview Walmur') {
        detailPayload = interviewState;
        catatanUmum = interviewState.catatan_umum;
      }

      const res = await apiService.submitGrade(
        siswa.id,
        kategori,
        detailPayload,
        currentAverage,
        catatanUmum,
        session.nama,
        session.email
      );

      if (res.success && res.record) {
        onGradeSaved(res.record);
        showToast('Nilai Disimpan!', res.message, 'success');
        onClose();
      } else {
        showToast('Gagal Simpan', res.message, 'error');
      }
    } catch (err: any) {
      showToast('Kendala', err.message || 'Gagal menyimpan nilai.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 my-8">
        {/* Header */}
        <div className="bg-[#1E3A8A] text-white p-5 flex items-center justify-between border-b-4 border-[#D97706]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-300">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">
                Lembar Penilaian Resmi
              </span>
              <h2 className="text-base font-extrabold tracking-tight">
                {kategori === 'Interview Walmur' ? 'Wawancara Orang Tua' : kategori} • {siswa.grade}
              </h2>
              <p className="text-xs text-blue-200">
                Siswa: <strong>{siswa.nama_siswa}</strong> ({siswa.id} • {formatKelas(siswa.kelas)})
              </p>
              {kategori === 'Interview Walmur' && (
                <p className="text-[11px] text-amber-300 font-semibold mt-0.5">
                  Pewawancara Terjadwal: {siswa.interview_walmur} ({siswa.ruangan_walmur})
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-blue-200 hover:text-white hover:bg-blue-800/80 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Score KPI Bar */}
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-600">
            Penguji: <strong className="text-[#1E3A8A]">{session.nama}</strong>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Skor Rata-rata Akhir:</span>
            <span className="px-3 py-1 bg-[#1E3A8A] text-white font-extrabold font-mono text-sm rounded-lg shadow-sm">
              {currentAverage.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto text-xs text-slate-700">
          {/* 1. CALISTUNG SD (0-100) */}
          {kategori === 'Calistung' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-900 font-medium">
                Ujian Calistung Khusus Jenjang SD. Rentang nilai: <strong>0 s/d 100</strong> per aspek.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                  <label className="font-bold text-slate-800 block">
                    1. Membaca Bahasa Indonesia (0-100)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={calistungState.baca_indo}
                    onChange={(e) => setCalistungState({ ...calistungState, baca_indo: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
                    required
                  />
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                  <label className="font-bold text-slate-800 block">
                    2. Memahami Teks Bahasa Indonesia (0-100)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={calistungState.paham_indo}
                    onChange={(e) => setCalistungState({ ...calistungState, paham_indo: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
                    required
                  />
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                  <label className="font-bold text-slate-800 block">
                    3. Membaca Bahasa Inggris (0-100)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={calistungState.baca_inggris}
                    onChange={(e) => setCalistungState({ ...calistungState, baca_inggris: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
                    required
                  />
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                  <label className="font-bold text-slate-800 block">
                    4. Memahami Teks Bahasa Inggris (0-100)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={calistungState.paham_inggris}
                    onChange={(e) => setCalistungState({ ...calistungState, paham_inggris: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Catatan Penguji Calistung (Textarea)
                </label>
                <textarea
                  rows={3}
                  value={calistungState.catatan}
                  onChange={(e) => setCalistungState({ ...calistungState, catatan: e.target.value })}
                  placeholder="Catatan perkembangan membaca, fonetik, pengenalan huruf/angka anak..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* 2. ENGLISH (SMP & SMA) (1-4) */}
          {kategori === 'English' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-900 font-medium">
                English Proficiency (SMP & SMA). Rentang skor: <strong>1 s/d 4</strong> (1: Needs Improvement, 2: Fair, 3: Good, 4: Excellent).
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: 'fluency', label: '1. Fluency' },
                  { key: 'vocab_grammar', label: '2. Vocabulary & Grammar' },
                  { key: 'critical_thinking', label: '3. Critical Thinking' },
                  { key: 'expression_clarity', label: '4. Expression & Clarity' },
                ].map((item) => (
                  <div key={item.key} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="font-bold text-slate-800">{item.label}</label>
                      <span className="font-bold text-[#1E3A8A] font-mono text-sm">
                        {(englishState as any)[item.key]} / 4
                      </span>
                    </div>
                    <select
                      value={(englishState as any)[item.key]}
                      onChange={(e) => setEnglishState({ ...englishState, [item.key]: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
                    >
                      <option value={4}>4 - Sangat Lancar / Excellent</option>
                      <option value={3}>3 - Baik / Good</option>
                      <option value={2}>2 - Cukup / Fair</option>
                      <option value={1}>1 - Perlu Bimbingan / Needs Improvement</option>
                    </select>
                  </div>
                ))}
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Catatan Penguji English (Textarea)
                </label>
                <textarea
                  rows={3}
                  value={englishState.catatan}
                  onChange={(e) => setEnglishState({ ...englishState, catatan: e.target.value })}
                  placeholder="Observasi penguji terkait kepercayaan diri berbicara, struktur kalimat, dan kosakata..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* 3. AL-QURAN SD (0-100) */}
          {kategori === 'Al-Quran SD' && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-emerald-900 font-medium">
                Ujian Al-Qur'an Calon Siswa SD. Skala nilai: <strong>0 s/d 100</strong>.
              </div>

              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                <label className="font-bold text-slate-800 block text-sm">
                  Skor Al-Qur'an / Iqra (0 - 100)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={quranSdState.tilawah}
                  onChange={(e) => setQuranSdState({ ...quranSdState, tilawah: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-base font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Catatan Penguji Al-Qur'an SD (Textarea)
                </label>
                <textarea
                  rows={3}
                  value={quranSdState.catatan}
                  onChange={(e) => setQuranSdState({ ...quranSdState, catatan: e.target.value })}
                  placeholder="Catatan capaian jilid/surat, ketepatan makhraj, dan kelancaran membaca..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* 4. AL-QURAN SMP & SMA (1-4) */}
          {kategori === 'Al-Quran SMP/SMA' && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-emerald-900 font-medium">
                Tahsin & Tahfidz Al-Qur'an (SMP & SMA). Rentang skor: <strong>1 s/d 4</strong>.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { key: 'makhorijul_huruf', label: '1. Makhorijul Huruf' },
                  { key: 'sifatul_huruf', label: '2. Sifatul Huruf' },
                  { key: 'kelancaran', label: '3. Kelancaran' },
                ].map((item) => (
                  <div key={item.key} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="font-bold text-slate-800">{item.label}</label>
                      <span className="font-bold text-[#1E3A8A] font-mono">
                        {(quranSmpSmaState as any)[item.key]} / 4
                      </span>
                    </div>
                    <select
                      value={(quranSmpSmaState as any)[item.key]}
                      onChange={(e) => setQuranSmpSmaState({ ...quranSmpSmaState, [item.key]: Number(e.target.value) })}
                      className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
                    >
                      <option value={4}>4 - Mumtaz (Istimewa)</option>
                      <option value={3}>3 - Jayyid Jiddan (Sangat Baik)</option>
                      <option value={2}>2 - Jayyid (Baik/Cukup)</option>
                      <option value={1}>1 - Maqbul (Perlu Bimbingan)</option>
                    </select>
                  </div>
                ))}
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Catatan Penguji Al-Qur'an SMP/SMA (Textarea)
                </label>
                <textarea
                  rows={3}
                  value={quranSmpSmaState.catatan}
                  onChange={(e) => setQuranSmpSmaState({ ...quranSmpSmaState, catatan: e.target.value })}
                  placeholder="Jumlah hafalan juz, konsistensi hukum mad, ghunnah, dan catatan tahsin..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* 5. BAHASA ARAB (SMP & SMA) (1-4) */}
          {kategori === 'Bahasa Arab' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-900 font-medium">
                Tes Kemahiran Bahasa Arab (SMP & SMA). Rentang skor: <strong>1 s/d 4</strong>.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: 'percaya_diri', label: '1. Percaya Diri' },
                  { key: 'kelancaran', label: '2. Kelancaran' },
                  { key: 'kejelasan', label: '3. Kejelasan' },
                  { key: 'adab', label: '4. Adab' },
                ].map((item) => (
                  <div key={item.key} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="font-bold text-slate-800">{item.label}</label>
                      <span className="font-bold text-[#1E3A8A] font-mono">
                        {(arabState as any)[item.key]} / 4
                      </span>
                    </div>
                    <select
                      value={(arabState as any)[item.key]}
                      onChange={(e) => setArabState({ ...arabState, [item.key]: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
                    >
                      <option value={4}>4 - Sangat Baik</option>
                      <option value={3}>3 - Baik</option>
                      <option value={2}>2 - Cukup</option>
                      <option value={1}>1 - Kurang</option>
                    </select>
                  </div>
                ))}
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Catatan Penguji Bahasa Arab (Textarea)
                </label>
                <textarea
                  rows={3}
                  value={arabState.catatan}
                  onChange={(e) => setArabState({ ...arabState, catatan: e.target.value })}
                  placeholder="Kosa kata harian, pemahaman instruksi sederhana bahasa Arab..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* 6. WAWANCARA ORANG TUA (1-5 with per-item notes) */}
          {kategori === 'Interview Walmur' && (
            <div className="space-y-5">
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 font-medium flex items-center justify-between flex-wrap gap-2">
                <div>
                  Wawancara Orang Tua. Rentang skor: <strong>1 s/d 5</strong>. Wajib melengkapi catatan per aspek penilaian.
                </div>
                <div className="text-xs font-bold text-[#1E3A8A] bg-white px-2.5 py-1 rounded-lg border border-amber-200">
                  Pewawancara: {siswa.interview_walmur}
                </div>
              </div>

              {/* 5 Aspect Rows */}
              {[
                {
                  skorKey: 'ibadah_skor',
                  catatanKey: 'ibadah_catatan',
                  label: '1. Aspek Ibadah (Sholat berjamaah, tilawah keluarga)',
                  placeholder: 'Catatan komitmen sholat 5 waktu di rumah, pembiasaan puasa...'
                },
                {
                  skorKey: 'akhlak_skor',
                  catatanKey: 'akhlak_catatan',
                  label: '2. Aspek Akhlak & Karakter (Sopan santun, kejujuran)',
                  placeholder: 'Catatan keteladanan orang tua, adab anak terhadap orang yang lebih tua...'
                },
                {
                  skorKey: 'pola_asuh_skor',
                  catatanKey: 'pola_asuh_catatan',
                  label: '3. Aspek Pola Asuh & Pergaulan Lingkungan',
                  placeholder: 'Catatan lingkungan tempat tinggal, pembatasan pergaulan luar...'
                },
                {
                  skorKey: 'kebiasaan_belajar_skor',
                  catatanKey: 'kebiasaan_belajar_catatan',
                  label: '4. Aspek Kebiasaan Belajar Anak',
                  placeholder: 'Catatan pendampingan belajar, kemandirian menyelesaikan tugas...'
                },
                {
                  skorKey: 'gadget_skor',
                  catatanKey: 'gadget_catatan',
                  label: '5. Aspek Penggunaan Gadget / Screen Time',
                  placeholder: 'Catatan aturan durasi gadget harian, kontrol konten yang diakses...'
                },
              ].map((row) => (
                <div key={row.skorKey} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="font-bold text-slate-900">{row.label}</label>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-[11px]">Skor (1-5):</span>
                      <select
                        value={(interviewState as any)[row.skorKey]}
                        onChange={(e) => setInterviewState({ ...interviewState, [row.skorKey]: Number(e.target.value) })}
                        className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 text-xs focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
                      >
                        <option value={5}>5 - Sangat Selaras / Ideal</option>
                        <option value={4}>4 - Baik / Positif</option>
                        <option value={3}>3 - Cukup / Moderat</option>
                        <option value={2}>2 - Kurang / Butuh Perhatian</option>
                        <option value={1}>1 - Sangat Berisiko</option>
                      </select>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={(interviewState as any)[row.catatanKey]}
                    onChange={(e) => setInterviewState({ ...interviewState, [row.catatanKey]: e.target.value })}
                    placeholder={row.placeholder}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
                  />
                </div>
              ))}

              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Catatan Umum / Rekomendasi Akhir Walmur (Textarea)
                </label>
                <textarea
                  rows={3}
                  value={interviewState.catatan_umum}
                  onChange={(e) => setInterviewState({ ...interviewState, catatan_umum: e.target.value })}
                  placeholder="Rekomendasi penerimaan, keselarasan visi dengan sekolah, komitmen finansial & kerjasama..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-[#1E3A8A] hover:bg-blue-900 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-75"
            >
              <Save className="w-4 h-4 text-[#D97706]" />
              <span>{submitting ? 'Menyimpan Nilai...' : 'Simpan Hasil Penilaian'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
