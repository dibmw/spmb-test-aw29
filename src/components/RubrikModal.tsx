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

// Pertanyaan panduan wawancara orang tua (10 pertanyaan, skor 1-10)
interface InterviewQuestionItem {
  skorKey: string;
  catatanKey: string;
  fokus: string;
  text: string;
}

interface InterviewSectionItem {
  title: string;
  questions: InterviewQuestionItem[];
}

const INTERVIEW_SECTIONS: InterviewSectionItem[] = [
  {
    title: 'Aspek Psikologis, Kelekatan, dan Perkembangan',
    questions: [
      {
        skorKey: 'kelekatan_skor',
        catatanKey: 'kelekatan_catatan',
        fokus: 'Kelekatan anak & orang tua, aspek psikologis, respons emosional',
        text: 'Bagaimana cara Ayah/Bunda mengenali dan merespons ketika anak menunjukkan emosi kuat (seperti sedih, marah, atau frustrasi)? Bisakah Ayah/Bunda ceritakan contoh interaksi yang mencerminkan kualitas kelekatan anak dengan Ayah/Bunda?'
      },
      {
        skorKey: 'asertif_skor',
        catatanKey: 'asertif_catatan',
        fokus: 'Asertif anak, aspek psikologis',
        text: 'Dalam situasi yang membutuhkan anak untuk berani menyampaikan pendapat atau menolak ajakan negatif (seperti ajakan membolos), bagaimana Ayah/Bunda membimbing dan melihat tingkat keasertifan anak saat ini? Berikan contohnya'
      },
      {
        skorKey: 'kognitif_skor',
        catatanKey: 'kognitif_catatan',
        fokus: 'Perkembangan kognitif anak',
        text: 'Bagaimana cara Ayah/Bunda menstimulasi dan mendukung perkembangan kognitif anak di rumah (selain dari tugas sekolah)? Misalnya, dalam hal pemecahan masalah, berpikir kritis, atau kreativitas'
      }
    ]
  },
  {
    title: 'Keterlibatan Peran Ayah dan Bunda',
    questions: [
      {
        skorKey: 'peran_skor',
        catatanKey: 'peran_catatan',
        fokus: 'Keterlibatan peran Ayah dan Bunda',
        text: 'Jelaskan peran spesifik dan nyata yang diambil oleh Ayah dan Bunda dalam mendampingi anak dalam proses belajarnya, mengembangkan minat bakatnya, serta membentuk karakternya. Apakah peran tersebut sudah seimbang dan saling melengkapi?'
      },
      {
        skorKey: 'sentuhan_skor',
        catatanKey: 'sentuhan_catatan',
        fokus: 'Keterlibatan peran Ayah dan Bunda, sentuhan perkembangan',
        text: 'Menurut Ayah/Bunda, apa sentuhan perkembangan paling berharga yang sudah Ayah/Bunda berikan kepada anak, baik dari segi spiritual, mental, maupun keterampilan hidup, yang berbeda dari peran pasangan Ayah/Bunda?'
      }
    ]
  },
  {
    title: 'Perilaku Khusus dan Kebutuhan Anak',
    questions: [
      {
        skorKey: 'kebutuhan_khusus_skor',
        catatanKey: 'kebutuhan_khusus_catatan',
        fokus: 'Anak berkebutuhan khusus/ABK, perilaku spesial',
        text: 'Apakah Ayah/Bunda pernah mendapati atau mencurigai anak memiliki pola perilaku yang spesial atau membutuhkan penanganan khusus dalam belajar/sosialisasi? Jika ya, langkah intervensi atau dukungan apa yang sudah diberikan sejauh ini?'
      }
    ]
  },
  {
    title: 'Pantauan Spiritual (Ibadah) dan Sosial',
    questions: [
      {
        skorKey: 'pantauan_ibadah_skor',
        catatanKey: 'pantauan_ibadah_catatan',
        fokus: "Pantauan ibadah sholat dan hafalan Al-Qur'a",
        text: "Bagaimana rutinitas dan sistem pantauan yang Ayah/Bunda terapkan di rumah terkait pelaksanaan ibadah sholat (khususnya sholat wajib) dan capaian hafalan Al-Qur'an anak? Jelaskan target jangka pendek/panjang Ayah/Bunda"
      },
      {
        skorKey: 'pertemanan_skor',
        catatanKey: 'pertemanan_catatan',
        fokus: 'Pantauan pertemanan anak',
        text: 'Ceritakan bagaimana cara Ayah/Bunda mengawasi, mendiskusikan, dan memfilter pertemanan anak. Kriteria pertemanan seperti apa yang menurut Ayah/Bunda ideal, dan bagaimana anak merespons panduan ini?'
      }
    ]
  },
  {
    title: 'Pandangan Masa Depan dan Harapan Sekolah',
    questions: [
      {
        skorKey: 'nilai_karakter_skor',
        catatanKey: 'nilai_karakter_catatan',
        fokus: 'Visi pendidikan orang tua, kolaborasi, aspek psikologis',
        text: 'Apa tiga nilai karakter utama yang paling Ayah/Bunda ingin tanamkan pada anak selama menempuh pendidikan di Al-Wildan Islamic School 29 Depok, dan bagaimana cara Ayah/Bunda dan sekolah dapat bekerja sama untuk mewujudkan hal tersebut?'
      },
      {
        skorKey: 'kesulitan_skor',
        catatanKey: 'kesulitan_catatan',
        fokus: 'Pola asuh, aspek psikologis, respons orang tua terhadap kesulitan',
        text: 'Seandainya anak mengalami kegagalan besar di sekolah (misalnya nilai turun drastis, atau konflik serius dengan teman), bagaimana pendekatan yang akan Ayah/Bunda ambil untuk membantunya bangkit dan mengambil pelajaran dari situasi tersebut?'
      }
    ]
  }
];

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

  // Interview Walmur State (1-10 with per-question notes)
  const [interviewState, setInterviewState] = useState({
    kelekatan_skor: '' as ScoreInput,
    kelekatan_catatan: '',
    asertif_skor: '' as ScoreInput,
    asertif_catatan: '',
    kognitif_skor: '' as ScoreInput,
    kognitif_catatan: '',
    peran_skor: '' as ScoreInput,
    peran_catatan: '',
    sentuhan_skor: '' as ScoreInput,
    sentuhan_catatan: '',
    kebutuhan_khusus_skor: '' as ScoreInput,
    kebutuhan_khusus_catatan: '',
    pantauan_ibadah_skor: '' as ScoreInput,
    pantauan_ibadah_catatan: '',
    pertemanan_skor: '' as ScoreInput,
    pertemanan_catatan: '',
    nilai_karakter_skor: '' as ScoreInput,
    nilai_karakter_catatan: '',
    kesulitan_skor: '' as ScoreInput,
    kesulitan_catatan: ''
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
          kelekatan_skor: loadScore(d.kelekatan_skor),
          kelekatan_catatan: d.kelekatan_catatan || '',
          asertif_skor: loadScore(d.asertif_skor),
          asertif_catatan: d.asertif_catatan || '',
          kognitif_skor: loadScore(d.kognitif_skor),
          kognitif_catatan: d.kognitif_catatan || '',
          peran_skor: loadScore(d.peran_skor),
          peran_catatan: d.peran_catatan || '',
          sentuhan_skor: loadScore(d.sentuhan_skor),
          sentuhan_catatan: d.sentuhan_catatan || '',
          kebutuhan_khusus_skor: loadScore(d.kebutuhan_khusus_skor),
          kebutuhan_khusus_catatan: d.kebutuhan_khusus_catatan || '',
          pantauan_ibadah_skor: loadScore(d.pantauan_ibadah_skor),
          pantauan_ibadah_catatan: d.pantauan_ibadah_catatan || '',
          pertemanan_skor: loadScore(d.pertemanan_skor),
          pertemanan_catatan: d.pertemanan_catatan || '',
          nilai_karakter_skor: loadScore(d.nilai_karakter_skor),
          nilai_karakter_catatan: d.nilai_karakter_catatan || '',
          kesulitan_skor: loadScore(d.kesulitan_skor),
          kesulitan_catatan: d.kesulitan_catatan || ''
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
      vals = [
        interviewState.kelekatan_skor,
        interviewState.asertif_skor,
        interviewState.kognitif_skor,
        interviewState.peran_skor,
        interviewState.sentuhan_skor,
        interviewState.kebutuhan_khusus_skor,
        interviewState.pantauan_ibadah_skor,
        interviewState.pertemanan_skor,
        interviewState.nilai_karakter_skor,
        interviewState.kesulitan_skor
      ].map(toNum);
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
      let no = 1;
      INTERVIEW_SECTIONS.forEach((sec) => {
        sec.questions.forEach((q) => {
          if (isBlank((interviewState as any)[q.skorKey])) missing.push(`Pertanyaan ${no}`);
          no++;
        });
      });
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
          kelekatan_skor: toNum(interviewState.kelekatan_skor),
          kelekatan_catatan: interviewState.kelekatan_catatan,
          asertif_skor: toNum(interviewState.asertif_skor),
          asertif_catatan: interviewState.asertif_catatan,
          kognitif_skor: toNum(interviewState.kognitif_skor),
          kognitif_catatan: interviewState.kognitif_catatan,
          peran_skor: toNum(interviewState.peran_skor),
          peran_catatan: interviewState.peran_catatan,
          sentuhan_skor: toNum(interviewState.sentuhan_skor),
          sentuhan_catatan: interviewState.sentuhan_catatan,
          kebutuhan_khusus_skor: toNum(interviewState.kebutuhan_khusus_skor),
          kebutuhan_khusus_catatan: interviewState.kebutuhan_khusus_catatan,
          pantauan_ibadah_skor: toNum(interviewState.pantauan_ibadah_skor),
          pantauan_ibadah_catatan: interviewState.pantauan_ibadah_catatan,
          pertemanan_skor: toNum(interviewState.pertemanan_skor),
          pertemanan_catatan: interviewState.pertemanan_catatan,
          nilai_karakter_skor: toNum(interviewState.nilai_karakter_skor),
          nilai_karakter_catatan: interviewState.nilai_karakter_catatan,
          kesulitan_skor: toNum(interviewState.kesulitan_skor),
          kesulitan_catatan: interviewState.kesulitan_catatan
        };
        catatanUmum = '';
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
                  Catatan Penguji English (Opsional)
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
                  Catatan Penguji Al-Qur'an SD (Opsional)
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
                  Catatan Penguji Al-Qur'an SMP/SMA (Opsional)
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
                  Catatan Penguji Bahasa Arab (Opsional)
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

          {/* 6. WAWANCARA ORANG TUA (1-10 dengan catatan per pertanyaan) */}
          {kategori === 'Interview Walmur' && (
            <div className="space-y-5">
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 font-medium flex items-center justify-between flex-wrap gap-2">
                <div>
                  Wawancara Orang Tua. Rentang skor: <strong>1 s/d 10</strong>. Seluruh skor wajib diisi; catatan per pertanyaan bersifat opsional.
                </div>
                <div className="text-xs font-bold text-[#1E3A8A] bg-white px-2.5 py-1 rounded-lg border border-amber-200">
                  Pewawancara: {siswa.interview_walmur}
                </div>
              </div>

              {INTERVIEW_SECTIONS.map((section, sectionIndex) => (
                <div key={section.title} className="space-y-3">
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <span className="w-1.5 h-5 bg-[#D97706] rounded-full inline-block" />
                    {section.title}
                  </h4>

                  {section.questions.map((q, qi) => (
                    <div key={q.skorKey} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="space-y-1 flex-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#D97706] block">
                            Fokus: {q.fokus}
                          </span>
                          <p className="text-xs font-semibold text-slate-900 leading-relaxed">
                            {sectionIndex + 1}.{qi + 1}. {q.text}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-slate-500 text-[11px]">Skor (1-10):</span>
                          <select
                            value={(interviewState as any)[q.skorKey]}
                            onChange={(e) => setInterviewState({ ...interviewState, [q.skorKey]: e.target.value === '' ? '' : Number(e.target.value) })}
                            className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 text-xs focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
                            required
                          >
                            <option value="" disabled>-- Pilih --</option>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <input
                        type="text"
                        value={(interviewState as any)[q.catatanKey]}
                        onChange={(e) => setInterviewState({ ...interviewState, [q.catatanKey]: e.target.value })}
                        placeholder="Catatan penguji untuk pertanyaan ini (opsional)..."
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              ))}
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
