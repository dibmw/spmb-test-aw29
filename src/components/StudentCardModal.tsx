import React, { useRef, useState, useEffect } from 'react';
import { X, Download, Check, UserCheck, Users } from 'lucide-react';
import { cardToPng } from '../utils/captureCard';
import QRCode from 'qrcode';
import { SiswaJadwal, formatKelas, getJenjangFromKelas, getSortedSiswaExamStations, formatTanggalUjian } from '../types/spmb';
import { SchoolLogo } from './SchoolLogo';

interface StudentCardModalProps {
  siswa: SiswaJadwal | null;
  onClose: () => void;
}

export const StudentCardModal: React.FC<StudentCardModalProps> = ({ siswa, onClose }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Generate QR Code
  useEffect(() => {
    if (siswa) {
      QRCode.toDataURL(siswa.id, {
        width: 140,
        margin: 1,
        color: {
          dark: '#1E3A8A',
          light: '#FFFFFF'
        }
      })
        .then(url => setQrDataUrl(url))
        .catch(err => console.error('QR code generation error:', err));
    }
  }, [siswa]);

  if (!siswa) return null;

  const unit = getJenjangFromKelas(siswa.kelas, siswa.grade);
  const sortedStations = getSortedSiswaExamStations(siswa, unit);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    try {
      setDownloading(true);
      setDownloadError(null);
      const element = cardRef.current;
      const dataUrl = await cardToPng(element, 2);
      const link = document.createElement('a');
      link.download = `KARTU_UJIAN_${siswa.id}_${siswa.nama_siswa.replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3500);
    } catch (err) {
      console.error('Failed to generate card image:', err);
      setDownloadError('Gagal membuat gambar kartu. Silakan coba lagi.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200 my-4 sm:my-8">
        {/* Modal Header Actions */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]"></span>
            <h3 className="font-bold text-slate-800 text-sm sm:text-base">Kartu Resmi Jadwal Peserta SPMB</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="px-3 sm:px-3.5 py-1.5 sm:py-2 bg-[#1E3A8A] hover:bg-blue-900 text-white rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-75 cursor-pointer"
            >
              {downloadSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Tersimpan!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-amber-300" />
                  <span>{downloading ? 'Memproses...' : 'Unduh PNG'}</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors ml-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {downloadError && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800">
            <span>{downloadError}</span>
          </div>
        )}

        {/* Printable Card Area */}
        <div className="p-3 sm:p-5 bg-slate-100 flex justify-center">
          <div
            ref={cardRef}
            id="spmb-student-card-render"
            className="w-full bg-white rounded-xl shadow-md border-2 border-slate-300 overflow-hidden text-slate-800"
            style={{ width: '540px', maxWidth: '100%' }}
          >
            {/* Kop Kartu Berwarna Putih */}
            <div className="bg-white text-slate-800 px-5 py-4 flex items-center justify-between border-b-2 border-slate-200">
              <div className="flex items-center gap-3">
                <SchoolLogo size="lg" className="shrink-0" />
                <div>
                  <span className="text-[11px] tracking-wider uppercase font-extrabold text-[#1E3A8A] block">
                    AL-WILDAN ISLAMIC SCHOOL 29 DEPOK
                  </span>
                  <h1 className="text-base font-extrabold tracking-tight leading-tight text-slate-900">
                    KARTU JADWAL PESERTA SPMB
                  </h1>
                  <p className="text-xs text-slate-500">Tahun Pelajaran 2027/2028</p>
                </div>
              </div>
            </div>

            {/* Candidate Identity & Barcode Row */}
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-br from-white to-slate-50/70">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2.5 flex-1">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nama Calon Siswa</span>
                    <h2 className="text-lg font-black text-[#1E3A8A] leading-tight">
                      {siswa.nama_siswa}
                    </h2>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Nomor Pendaftaran:</span>
                      <div className="font-mono font-bold text-slate-800 text-sm">{siswa.id}</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Estimasi Waktu:</span>
                      <div className="font-bold text-[#1E3A8A]">{siswa.waktu_all}</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Jenis Kelamin:</span>
                      <div className="font-semibold text-slate-800">
                        {siswa.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Kelas:</span>
                      <div className="font-bold text-[#1E3A8A]">{formatKelas(siswa.kelas)}</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Hari & Tanggal:</span>
                      <div className="font-semibold text-slate-800">{formatTanggalUjian(siswa.hari_tanggal) || '-'}</div>
                    </div>
                  </div>
                </div>

                {/* QR Code */}
                <div className="flex flex-col items-center justify-center p-2 bg-white rounded-lg border border-slate-200 shadow-sm shrink-0">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt={`QR Code ${siswa.id}`} className="w-22 h-22 sm:w-24 sm:h-24" />
                  ) : (
                    <div className="w-22 h-22 bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                      QR Code
                    </div>
                  )}
                  <span className="text-[10px] font-mono font-bold text-[#1E3A8A] mt-1 tracking-wider">
                    {siswa.id}
                  </span>
                </div>
              </div>
            </div>

            {/* Test Schedules Section */}
            <div className="p-4 sm:p-5 space-y-4">
              {/* BAGIAN 1: JADWAL UJIAN CALON SISWA */}
              <div className="space-y-2">
                <div className="space-y-1 pb-1.5 border-b border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-[#1E3A8A]" />
                    <h3 className="text-xs font-black text-[#1E3A8A] uppercase tracking-wide">
                      Jadwal Ujian Calon Siswa
                    </h3>
                  </div>
                  <div className="text-[11px] text-slate-700 pl-5.5 flex items-center gap-1.5">
                    <span className="font-semibold text-slate-500">Ruangan Siswa:</span>
                    <strong className="text-slate-900 font-bold">{siswa.ruangan_siswa}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {sortedStations.map((station) => (
                    <div 
                      key={station.id}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/80 flex flex-col justify-between"
                    >
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          {station.title}
                        </span>
                        <div className="text-[11px] text-slate-600 mt-1">
                          <span>Waktu: <strong className="text-slate-900">{station.waktu}</strong></span>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-700 mt-2 pt-1.5 border-t border-slate-200 font-medium">
                        Penguji: <strong className="text-slate-900">{station.penguji}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* BAGIAN 2: JADWAL WAWANCARA ORANG TUA (PARALEL) */}
              <div className="space-y-2 pt-1">
                <div className="space-y-1 pb-1.5 border-b border-slate-200">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-[#D97706]" />
                      <h3 className="text-xs font-black text-[#D97706] uppercase tracking-wide">
                        Jadwal Wawancara Orang Tua (Paralel)
                      </h3>
                    </div>
                    <span className="text-[10px] font-extrabold text-amber-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                      Berjalan Bersamaan / Paralel dengan Ujian Siswa
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-700 pl-5.5 flex items-center gap-1.5">
                    <span className="font-semibold text-slate-500">Ruangan Orang Tua:</span>
                    <strong className="text-slate-900 font-bold">{siswa.ruangan_walmur}</strong>
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-xs font-bold text-slate-800 block">
                    Wawancara Orang Tua / Wali Calon Siswa
                  </span>
                  <div className="text-[11px] text-slate-600 mt-1">
                    Waktu Wawancara: <strong className="text-slate-900">{siswa.waktu_interview}</strong>
                  </div>
                  <div className="text-[11px] text-slate-700 mt-1 font-medium">
                    Pewawancara: <strong className="text-[#1E3A8A]">{siswa.interview_walmur}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Notice */}
            <div className="bg-slate-100 px-5 py-2.5 text-[9px] text-slate-500 text-center border-t border-slate-200">
              *Harap tunjukkan kartu ini kepada petugas Timekeeper di meja registrasi untuk scan presensi kedatangan.
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="px-4 sm:px-6 py-3 bg-white flex items-center justify-between border-t border-slate-200 text-xs text-slate-500">
          <span>Gambar kartu terunduh otomatis dalam format PNG.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
