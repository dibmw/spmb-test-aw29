import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  FileCheck,
  ExternalLink,
  FileText
} from 'lucide-react';
import { SiswaJadwal, KategoriUjian, NilaiRecord, UserSession, formatKelas, getJenjangFromKelas } from '../types/spmb';
import { apiService } from '../services/apiService';

type ScoreInput = number | '';

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

// Link soal ujian per kategori & jenjang
function getExamLinks(
  kategori: KategoriUjian,
  unit: 'SD' | 'SMP' | 'SMA',
  kelas: string
): { label: string; url: string }[] {
  const links: { label: string; url: string }[] = [];
  const kelasNum = parseInt((kelas || '').replace(/\D+/g, ''), 10);

  if (kategori === 'Calistung') {
    const isKelas3Up = !isNaN(kelasNum) && kelasNum >= 3;
    links.push({
      label: isKelas3Up ? 'Soal Membaca Kelas 3-6' : 'Soal Membaca Kelas 1-2',
      url: isKelas3Up
        ? 'https://drive.google.com/file/d/18_OOUvxqRblOWpIaMatzOoYEROpJPh4O/view?usp=drive_link'
        : 'https://drive.google.com/file/d/1yZhTdjq2HNkN1PPhfzuzujn9kXt-8SPs/view?usp=drive_link'
    });
  } else if (kategori === 'Al-Quran SD') {
    links.push({
      label: "Soal Al-Qur'an SD",
      url: 'https://drive.google.com/file/d/1iyZQlU0LyCPuelvtjvwL0KfL6yd0qdo0/view?usp=drive_link'
    });
  } else if (kategori === 'Al-Quran SMP/SMA') {
    links.push({
      label: `Soal Al-Qur'an ${unit}`,
      url: 'https://drive.google.com/file/d/1whxNAj-nxIuSWc6tmeb-AGq4yaAnOMFt/view?usp=drive_link'
    });
  } else if (kategori === 'Bahasa Arab') {
    links.push({
      label: `Soal Bahasa Arab ${unit}`,
      url: unit === 'SMA'
        ? 'https://drive.google.com/file/d/18tHLew7fQDANlF0hnR4fYXqRlPiKmIOj/view?usp=drive_link'
        : 'https://drive.google.com/file/d/1bg_vUDvP3j_aptkjx3Wg6Wb1dkw8_TTE/view?usp=drive_link'
    });
  } else if (kategori === 'English') {
    links.push({
      label: `Soal English ${unit}`,
      url: unit === 'SMA'
        ? 'https://drive.google.com/file/d/1tCewRGBPdv0eAZvsvvNaHHOG3ch0FN-d/view?usp=drive_link'
        : 'https://drive.google.com/file/d/1_RytJ0IBYv25Z6GIAbj7gXr96bn21-g7/view?usp=drive_link'
    });
  }

  return links;
}

// Pertanyaan panduan wawancara orang tua per aspek
const INTERVIEW_QUESTIONS: Record<string, string[]> = {
  ibadah_skor: [
    'Bagaimana kebiasaan sholat anak di rumah?',
    'Apakah anak biasa sholat di masjid atau di rumah?',
    'Bagaimana kebiasaan anak dalam berdoa/dzikir?'
  ],
  akhlak_skor: [
    'Bagaimana sikap anak terhadap orang tua dan saudara?',
    'Jika anak marah, bagaimana cara ia mengekspresikannya?',
    'Karakter utama apa yang menonjol dari anak?'
  ],
  pola_asuh_skor: [
    'Siapa teman dekat anak dan bagaimana interaksinya?',
    'Bagaimana orang tua mengarahkan atau membatasi pergaulan anak?',
    'Bagaimana respon anak saat dinasihati terkait teman?'
  ],
  kebiasaan_belajar_skor: [
    'Anak biasanya belajar jam berapa di rumah?',
    'Jika kesulitan pelajaran, apa yang biasanya dilakukan?',
    'Anak lebih suka belajar sendiri atau ditemani orang tua?'
  ],
  gadget_skor: [
    'Berapa lama anak menggunakan gadget per hari?',
    'Biasanya digunakan untuk apa (belajar/game/sosmed)?',
    'Bagaimana orang tua mengatur penggunaannya?'
  ]
};

const toNum = (v: ScoreInput): number => (v === '' || v === null || v === undefined ? NaN : Number(v));
const isBlank = (v: ScoreInput): boolean => v === '' || v === null || v === undefined || Number.isNaN(Number(v));
const disp = (v: ScoreInput): string => (isBlank(v) ? '—' : String(v));
const loadScore = (v: any): ScoreInput => (v === undefined || v === null || v === '' ? '' : Number(v));

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
  // Calistung SD State (0-100) with per-component notes
  const [calistungState, setCalistungState] = useState({
    baca_indo: '' as ScoreInput,
    paham_indo: '' as ScoreInput,
    baca_inggris: '' as ScoreInput,
    paham_inggris: '' as ScoreInput,
    catatan_baca_indo: '',
    catatan_paham_indo: '',
    catatan_baca_inggris: '',
    catatan_paham_inggris: ''
  });

  // English SMP/SMA State (1-4)
  const [englishState, setEnglishState] = useState({
    fluency: '' as ScoreInput,
    vocab_grammar: '' as ScoreInput,
    critical_thinking: '' as ScoreInput,
    expression_clarity: '' as ScoreInput,
    catatan: ''
  });

  // Quran SD State (0-100)
  const [quranSdState, setQuranSdState] = useState({
    tilawah: '' as ScoreInput,
    catatan: ''
  });

  // Quran SMP/SMA State (1-4)
  const [quranSmpSmaState, setQuranSmpSmaState] = useState({
    makhorijul_huruf: '' as ScoreInput,
    sifatul_huruf: '' as ScoreInput,
    kelancaran: '' as ScoreInput,
    catatan: ''
  });

  // Bahasa Arab SMP/SMA State (1-4)
  const [arabState, setArabState] = useState({
    percaya_diri: '' as ScoreInput,
    kelancaran: '' as ScoreInput,
    kejelasan: '' as ScoreInput,
    adab: '' as ScoreInput,
    catatan: ''
  });

  // Interview Walmur State (1-5 with per-item notes)
  const [interviewState, setInterviewState] = useState({
    ibadah_skor: '' as ScoreInput,
    ibadah_catatan: '',
    akhlak_skor: '' as ScoreInput,
    akhlak_catatan: '',
    pola_asuh_skor: '' as ScoreInput,
    pola_asuh_catatan: '',
    kebiasaan_belajar_skor: '' as ScoreInput,
    kebiasaan_belajar_catatan: '',
    gadget_skor: '' as ScoreInput,
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
          baca_indo: loadScore(d.baca_indo),
          paham_indo: loadScore(d.paham_indo),
          baca_inggris: loadScore(d.baca_inggris),
          paham_inggris: loadScore(d.paham_inggris),
          catatan_baca_indo: d.catatan_baca_indo || '',
          catatan_paham_indo: d.catatan_paham_indo || '',
          catatan_baca_inggris: d.catatan_baca_inggris || '',
          catatan_paham_inggris: d.catatan_paham_inggris || ''
        });
      } else if (kategori === 'English') {
        setEnglishState({
          fluency: loadScore(d.fluency),
          vocab_grammar: loadScore(d.vocab_grammar),
          critical_thinking: loadScore(d.critical_thinking),
          expression_clarity: loadScore(d.expression_clarity),
          catatan: existingNilai.catatan_umum || d.catatan || ''
        });
      } else if (kategori === 'Al-Quran SD') {
        setQuranSdState({
          tilawah: loadScore(d.tilawah),
          catatan: existingNilai.catatan_umum || d.catatan || ''
        });
      } else if (kategori === 'Al-Quran SMP/SMA') {
        setQuranSmpSmaState({
          makhorijul_huruf: loadScore(d.makhorijul_huruf),
          sifatul_huruf: loadScore(d.sifatul_huruf),
          kelancaran: loadScore(d.kelancaran),
          catatan: existingNilai.catatan_umum || d.catatan || ''
        });
      } else if (kategori === 'Bahasa Arab') {
        setArabState({
          percaya_diri: loadScore(d.percaya_diri),
          kelancaran: loadScore(d.kelancaran),
          kejelasan: loadScore(d.kejelasan),
          adab: loadScore(d.adab),
          catatan: existingNilai.catatan_umum || d.catatan || ''
        });
      } else if (kategori === 'Interview Walmur') {
        setInterviewState({
          ibadah_skor: loadScore(d.ibadah_skor),
          ibadah_catatan: d.ibadah_catatan || '',
          akhlak_skor: loadScore(d.akhlak_skor),
          akhlak_catatan: d.akhlak_catatan || '',
          pola_asuh_skor: loadScore(d.pola_asuh_skor),
          pola_asuh_catatan: d.pola_asuh_catatan || '',
          kebiasaan_belajar_skor: loadScore(d.kebiasaan_belajar_skor),
          kebiasaan_belajar_catatan: d.kebiasaan_belajar_catatan || '',
          gadget_skor: loadScore(d.gadget_skor),
          gadget_catatan: d.gadget_catatan || '',
          catatan_umum: existingNilai.catatan_umum || ''
        });
      }
    }
  }, [existingNilai, kategori]);

  if (!isOpen || !siswa) return null;

  const unit = getJenjangFromKelas(siswa.kelas, siswa.grade);
  const examLinks = getExamLinks(kategori, unit, siswa.kelas);

  // Real-time calculation of average score (NaN when incomplete)
  const calculateAverage = (): number => {
    let vals: number[] = [];
    if (kategori === 'Calistung') {
      vals = [calistungState.baca_indo, calistungState.paham_indo, calistungState.baca_inggris, calistungState.paham_inggris].map(toNum);
    } else if (kategori === 'English') {
      vals = [englishState.fluency, englishState.vocab_grammar, englishState.critical_thinking, englishState.expression_clarity].map(toNum);
    } else if (kategori === 'Al-Quran SD') {
      vals = [quranSdState.tilawah].map(toNum);
    } else if (kategori === 'Al-Quran SMP/SMA') {
      vals = [quranSmpSmaState.makhorijul_huruf, quranSmpSmaState.sifatul_huruf, quranSmpSmaState.kelancaran].map(toNum);
    } else if (kategori === 'Bahasa Arab') {
      vals = [arabState.percaya_diri, arabState.kelancaran, arabState.kejelasan, arabState.adab].map(toNum);
    } else if (kategori === 'Interview Walmur') {
      vals = [interviewState.ibadah_skor, interviewState.akhlak_skor, interviewState.pola_asuh_skor, interviewState.kebiasaan_belajar_skor, interviewState.gadget_skor].map(toNum);
    }
    if (vals.length === 0 || vals.some(v => Number.isNaN(v))) return NaN;
    const sum = vals.reduce((a, b) => a + b, 0);
    return Math.round((sum / vals.length) * 100) / 100;
  };

  const currentAverage = calculateAverage();

  // Collect missing score fields
  const getMissingFields = (): string[] => {
    const missing: string[] = [];
    if (kategori === 'Calistung') {
      if (isBlank(calistungState.baca_indo)) missing.push('Membaca B. Indonesia');
      if (isBlank(calistungState.paham_indo)) missing.push('Memahami Teks B. Indonesia');
      if (isBlank(calistungState.baca_inggris)) missing.push('Membaca B. Inggris');
      if (isBlank(calistungState.paham_inggris)) missing.push('Memahami Teks B. Inggris');
    } else if (kategori === 'English') {
      if (isBlank(englishState.fluency)) missing.push('Fluency');
      if (isBlank(englishState.vocab_grammar)) missing.push('Vocabulary & Grammar');
      if (isBlank(englishState.critical_thinking)) missing.push('Critical Thinking');
      if (isBlank(englishState.expression_clarity)) missing.push('Expression & Clarity');
    } else if (kategori === 'Al-Quran SD') {
      if (isBlank(quranSdState.tilawah)) missing.push('Skor Al-Qur\'an');
    } else if (kategori === 'Al-Quran SMP/SMA') {
      if (isBlank(quranSmpSmaState.makhorijul_huruf)) missing.push('Makhorijul Huruf');
      if (isBlank(quranSmpSmaState.sifatul_huruf)) missing.push('Sifatul Huruf');
      if (isBlank(quranSmpSmaState.kelancaran)) missing.push('Kelancaran');
    } else if (kategori === 'Bahasa Arab') {
      if (isBlank(arabState.percaya_diri)) missing.push('Percaya Diri');
      if (isBlank(arabState.kelancaran)) missing.push('Kelancaran');
      if (isBlank(arabState.kejelasan)) missing.push('Kejelasan');
      if (isBlank(arabState.adab)) missing.push('Adab');
    } else if (kategori === 'Interview Walmur') {
      if (isBlank(interviewState.ibadah_skor)) missing.push('Ibadah');
      if (isBlank(interviewState.akhlak_skor)) missing.push('Akhlak & Karakter');
      if (isBlank(interviewState.pola_asuh_skor)) missing.push('Pola Asuh & Pergaulan');
      if (isBlank(interviewState.kebiasaan_belajar_skor)) missing.push('Kebiasaan Belajar');
      if (isBlank(interviewState.gadget_skor)) missing.push('Penggunaan Gadget');
    }
    return missing;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const missing = getMissingFields();
    if (missing.length > 0) {
      showToast('Nilai Belum Lengkap', `Semua komponen skor wajib diisi: ${missing.join(', ')}.`, 'error');
      return;
    }

    setSubmitting(true);

    try {
      let detailPayload: any = {};
      let catatanUmum = '';

      if (kategori === 'Calistung') {
        const catatanGabungan = [
          calistungState.catatan_baca_indo && `Membaca B. Indonesia: ${calistungState.catatan_baca_indo}`,
          calistungState.catatan_paham_indo && `Memahami Teks B. Indonesia: ${calistungState.catatan_paham_indo}`,
          calistungState.catatan_baca_inggris && `Membaca B. Inggris: ${calistungState.catatan_baca_inggris}`,
          calistungState.catatan_paham_inggris && `Memahami Teks B. Inggris: ${calistungState.catatan_paham_inggris}`
        ].filter(Boolean).join(' | ');
        detailPayload = {
          baca_indo: toNum(calistungState.baca_indo),
          paham_indo: toNum(calistungState.paham_indo),
          baca_inggris: toNum(calistungState.baca_inggris),
          paham_inggris: toNum(calistungState.paham_inggris),
          catatan_baca_indo: calistungState.catatan_baca_indo,
          catatan_paham_indo: calistungState.catatan_paham_indo,
          catatan_baca_inggris: calistungState.catatan_baca_inggris,
          catatan_paham_inggris: calistungState.catatan_paham_inggris
        };
        catatanUmum = catatanGabungan;
      } else if (kategori === 'English') {
        detailPayload = {
          fluency: toNum(englishState.fluency),
          vocab_grammar: toNum(englishState.vocab_grammar),
          critical_thinking: toNum(englishState.critical_thinking),
          expression_clarity: toNum(englishState.expression_clarity),
          catatan: englishState.catatan
        };
        catatanUmum = englishState.catatan;
      } else if (kategori === 'Al-Quran SD') {
        detailPayload = { tilawah: toNum(quranSdState.tilawah), catatan: quranSdState.catatan };
        catatanUmum = quranSdState.catatan;
      } else if (kategori === 'Al-Quran SMP/SMA') {
        detailPayload = {
          makhorijul_huruf: toNum(quranSmpSmaState.makhorijul_huruf),
          sifatul_huruf: toNum(quranSmpSmaState.sifatul_huruf),
          kelancaran: toNum(quranSmpSmaState.kelancaran),
          catatan: quranSmpSmaState.catatan
        };
        catatanUmum = quranSmpSmaState.catatan;
      } else if (kategori === 'Bahasa Arab') {
        detailPayload = {
          percaya_diri: toNum(arabState.percaya_diri),
          kelancaran: toNum(arabState.kelancaran),
          kejelasan: toNum(arabState.kejelasan),
          adab: toNum(arabState.adab),
          catatan: arabState.catatan
        };
        catatanUmum = arabState.catatan;
      } else if (kategori === 'Interview Walmur') {
        detailPayload = {
          ibadah_skor: toNum(interviewState.ibadah_skor),
          ibadah_catatan: interviewState.ibadah_catatan,
          akhlak_skor: toNum(interviewState.akhlak_skor),
          akhlak_catatan: interviewState.akhlak_catatan,
          pola_asuh_skor: toNum(interviewState.pola_asuh_skor),
          pola_asuh_catatan: interviewState.pola_asuh_catatan,
          kebiasaan_belajar_skor: toNum(interviewState.kebiasaan_belajar_skor),
          kebiasaan_belajar_catatan: interviewState.kebiasaan_belajar_catatan,
          gadget_skor: toNum(interviewState.gadget_skor),
          gadget_catatan: interviewState.gadget_catatan
        };
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
                {kategori === 'Interview Walmur' ? 'Wawancara Orang Tua' : kategori} • {unit}
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
              {Number.isNaN(currentAverage) ? '—' : currentAverage.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto text-xs text-slate-700">
          {/* Link Soal Ujian */}
          {examLinks.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-bold">
                <FileText className="w-4 h-4" />
                <span>Soal Ujian</span>
              </div>
              <p className="text-[11px] text-amber-800">
                Klik tautan berikut untuk membuka lembar soal sebelum melakukan penilaian.
              </p>
              <div className="flex flex-wrap gap-2">
                {examLinks.map((l) => (
                  <a
                    key={l.url}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#1E3A8A] hover:bg-blue-900 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#D97706]" />
                    <span>{l.label}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 1. CALISTUNG SD (0-100) */}
          {kategori === 'Calistung' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-900 font-medium">
                Ujian Calistung Khusus Jenjang SD. Rentang nilai: <strong>0 s/d 100</strong> per aspek. Seluruh skor wajib diisi.
              </div>

              {[
                { scoreKey: 'baca_indo', noteKey: 'catatan_baca_indo', label: '1. Membaca Bahasa Indonesia (0-100)' },
                { scoreKey: 'paham_indo', noteKey: 'catatan_paham_indo', label: '2. Memahami Teks Bahasa Indonesia (0-100)' },
                { scoreKey: 'baca_inggris', noteKey: 'catatan_baca_inggris', label: '3. Membaca Bahasa Inggris (0-100)' },
                { scoreKey: 'paham_inggris', noteKey: 'catatan_paham_inggris', label: '4. Memahami Teks Bahasa Inggris (0-100)' },
              ].map((item) => (
                <div key={item.scoreKey} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                  <label className="font-bold text-slate-800 block">{item.label}</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={(calistungState as any)[item.scoreKey]}
                    onChange={(e) => setCalistungState({ ...calistungState, [item.scoreKey]: e.target.value === '' ? '' : Number(e.target.value) })}
                    placeholder="0 - 100"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
                    required
                  />
                  <input
                    type="text"
                    value={(calistungState as any)[item.noteKey]}
                    onChange={(e) => setCalistungState({ ...calistungState, [item.noteKey]: e.target.value })}
                    placeholder="Catatan penguji untuk komponen ini (opsional)..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
                  />
                </div>
              ))}
            </div>
          )}

          {/* 2. ENGLISH (SMP & SMA) (1-4) */}
          {kategori === 'English' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-900 font-medium">
                English Proficiency (SMP & SMA). Rentang skor: <strong>1 s/d 4</strong> (1: Needs Improvement, 2: Fair, 3: Good, 4: Excellent). Seluruh skor wajib diisi.
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
                        {disp((englishState as any)[item.key])} / 4
                      </span>
                    </div>
                    <select
                      value={(englishState as any)[item.key]}
                      onChange={(e) => setEnglishState({ ...englishState, [item.key]: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
                      required
                    >
                      <option value="" disabled>-- Pilih Skor --</option>
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
                  Catatan Penguji English
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
                Ujian Al-Qur'an Calon Siswa SD. Skala nilai: <strong>0 s/d 100</strong>. Skor wajib diisi.
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
                  onChange={(e) => setQuranSdState({ ...quranSdState, tilawah: e.target.value === '' ? '' : Number(e.target.value) })}
                  placeholder="0 - 100"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-base font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Catatan Penguji Al-Qur'an SD
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
                Tahsin & Tahfidz Al-Qur'an (SMP & SMA). Rentang skor: <strong>1 s/d 4</strong>. Seluruh skor wajib diisi.
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
                        {disp((quranSmpSmaState as any)[item.key])} / 4
                      </span>
                    </div>
                    <select
                      value={(quranSmpSmaState as any)[item.key]}
                      onChange={(e) => setQuranSmpSmaState({ ...quranSmpSmaState, [item.key]: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
                      required
                    >
                      <option value="" disabled>-- Pilih Skor --</option>
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
                  Catatan Penguji Al-Qur'an SMP/SMA
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
                Tes Kemahiran Bahasa Arab (SMP & SMA). Rentang skor: <strong>1 s/d 4</strong>. Seluruh skor wajib diisi.
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
                        {disp((arabState as any)[item.key])} / 4
                      </span>
                    </div>
                    <select
                      value={(arabState as any)[item.key]}
                      onChange={(e) => setArabState({ ...arabState, [item.key]: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
                      required
                    >
                      <option value="" disabled>-- Pilih Skor --</option>
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
                  Catatan Penguji Bahasa Arab
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
                  Wawancara Orang Tua. Rentang skor: <strong>1 s/d 5</strong>. Seluruh skor wajib diisi dan lengkapi catatan per aspek.
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
                        onChange={(e) => setInterviewState({ ...interviewState, [row.skorKey]: e.target.value === '' ? '' : Number(e.target.value) })}
                        className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 text-xs focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
                        required
                      >
                        <option value="" disabled>-- Pilih --</option>
                        <option value={5}>5 - Sangat Selaras / Ideal</option>
                        <option value={4}>4 - Baik / Positif</option>
                        <option value={3}>3 - Cukup / Moderat</option>
                        <option value={2}>2 - Kurang / Butuh Perhatian</option>
                        <option value={1}>1 - Sangat Berisiko</option>
                      </select>
                    </div>
                  </div>

                  {/* Panduan pertanyaan wawancara */}
                  {INTERVIEW_QUESTIONS[row.skorKey] && (
                    <ul className="list-disc pl-5 text-[11px] text-slate-500 space-y-0.5">
                      {INTERVIEW_QUESTIONS[row.skorKey].map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  )}

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
                  Catatan Umum / Rekomendasi Akhir Walmur
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
