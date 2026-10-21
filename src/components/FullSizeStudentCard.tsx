import React, { useRef, useState, useEffect } from "react";
import {
  Download,
  Check,
  UserCheck,
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { cardToPng } from "../utils/captureCard";
import QRCode from "qrcode";
import {
  SiswaJadwal,
  PresensiRecord,
  formatKelas,
  getJenjangFromKelas,
  getSortedSiswaExamStations,
  resolveKehadiran,
  formatTanggalUjian,
} from "../types/spmb";
import { SchoolLogo } from "./SchoolLogo";

interface FullSizeStudentCardProps {
  siswa: SiswaJadwal;
  presensiList: PresensiRecord[];
  onBackToSearch: () => void;
}

export const FullSizeStudentCard: React.FC<FullSizeStudentCardProps> = ({
  siswa,
  presensiList,
  onBackToSearch,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Generate QR Code
  useEffect(() => {
    QRCode.toDataURL(siswa.id, {
      width: 150,
      margin: 1,
      color: {
        dark: "#1E3A8A",
        light: "#FFFFFF",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("QR code generation error:", err));
  }, [siswa.id]);

  const unit = getJenjangFromKelas(siswa.kelas, siswa.grade);
  const sortedStations = getSortedSiswaExamStations(siswa, unit);

  // Check student attendance status (override admin > presensi timekeeper)
  const studentCheck = resolveKehadiran(siswa, presensiList, "Siswa") === "Hadir";
  const walmurCheck = resolveKehadiran(siswa, presensiList, "Walmur") === "Hadir";

  const handleDownloadPNG = async () => {
    if (!cardRef.current) return;
    try {
      setDownloading(true);
      setDownloadError(null);
      const element = cardRef.current;
      const dataUrl = await cardToPng(element, 2.2);
      const link = document.createElement("a");
      link.download = `KARTU_SPMB_${siswa.id}_${siswa.nama_siswa.replace(/\s+/g, "_")}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3500);
    } catch (err) {
      console.error("Failed to generate card image:", err);
      setDownloadError("Gagal membuat gambar kartu. Silakan coba lagi.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Action Toolbar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBackToSearch}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-700 hover:text-[#1E3A8A] transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Search className="w-4 h-4 text-slate-400" />
          <span>&larr; Cari Siswa Lain</span>
        </button>

        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          <button
            type="button"
            onClick={handleDownloadPNG}
            disabled={downloading}
            className="px-4 sm:px-5 py-2 bg-[#1E3A8A] hover:bg-blue-900 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-75 cursor-pointer"
          >
            {downloadSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Kartu Tersimpan!</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-amber-300" />
                <span>
                  {downloading ? "Memproses PNG..." : "Unduh Kartu PNG"}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {downloadError && (
        <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{downloadError}</span>
        </div>
      )}

      {/* FULL SIZE OFFICIAL CARD CONTAINER */}
      <div className="bg-slate-100 p-2 sm:p-6 rounded-3xl border border-slate-200 shadow-inner flex justify-center">
        <div
          ref={cardRef}
          id="fullsize-spmb-card"
          className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border-2 border-slate-300 overflow-hidden text-slate-800"
        >
          {/* Header Kop Resmi Berwarna Putih */}
          <div className="bg-white text-slate-800 px-6 py-5 flex items-center justify-between border-b-2 border-slate-200">
            <div className="flex items-center gap-3.5">
              <SchoolLogo size="lg" className="shrink-0" />
              <div>
                <span className="text-[11px] sm:text-xs tracking-wider uppercase font-black text-[#1E3A8A] block">
                  AL-WILDAN ISLAMIC SCHOOL 29 DEPOK
                </span>
                <h1 className="text-base sm:text-xl font-black tracking-tight leading-tight text-slate-900">
                  KARTU JADWAL PESERTA SPMB
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  Tahun Pelajaran 2027/2028
                </p>
              </div>
            </div>
          </div>

          {/* Candidate Identity & Barcode Row */}
          <div className="p-6 border-b border-slate-200 bg-gradient-to-br from-white to-slate-50/70">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="space-y-3 flex-1">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Nama Lengkap Calon Siswa
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-[#1E3A8A] leading-tight">
                    {siswa.nama_siswa}
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">
                      Nomor Pendaftaran:
                    </span>
                    <div className="font-mono font-bold text-slate-900 text-sm">
                      {siswa.id}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">
                      Estimasi Waktu:
                    </span>
                    <div className="font-bold text-[#1E3A8A]">
                      {siswa.waktu_all}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">
                      Jenis Kelamin:
                    </span>
                    <div className="font-semibold text-slate-800">
                      {siswa.gender === "L"
                        ? "Laki-laki"
                        : "Perempuan"}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">
                      Kelas:
                    </span>
                    <div className="font-bold text-[#1E3A8A]">
                      {formatKelas(siswa.kelas)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">
                      Hari & Tanggal:
                    </span>
                    <div className="font-semibold text-slate-800">
                      {formatTanggalUjian(siswa.hari_tanggal) || "-"}
                    </div>
                  </div>
                </div>
              </div>

              {/* QR Code Barcode */}
              <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-slate-200 shadow-sm shrink-0 self-center sm:self-auto">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR Code ${siswa.id}`}
                    className="w-28 h-28"
                  />
                ) : (
                  <div className="w-28 h-28 bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                    QR Code
                  </div>
                )}
                <span className="text-[11px] font-mono font-bold text-[#1E3A8A] mt-1.5 tracking-wider">
                  {siswa.id}
                </span>
              </div>
            </div>
          </div>

          {/* Presensi Check-in Status Banner */}
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
            <div className="grid grid-cols-2 gap-3">
              <div
                className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                  studentCheck
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-amber-50/70 border-amber-200/80 text-amber-900"
                }`}
              >
                <CheckCircle2
                  className={`w-4 h-4 shrink-0 ${studentCheck ? "text-emerald-600" : "text-amber-500"}`}
                />
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-500">
                    Presensi Siswa
                  </div>
                  <div className="text-xs font-bold">
                    {studentCheck ? "Hadir di Lokasi" : "Menunggu Check-in"}
                  </div>
                </div>
              </div>

              <div
                className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                  walmurCheck
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-amber-50/70 border-amber-200/80 text-amber-900"
                }`}
              >
                <CheckCircle2
                  className={`w-4 h-4 shrink-0 ${walmurCheck ? "text-emerald-600" : "text-amber-500"}`}
                />
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-500">
                    Presensi Orang Tua
                  </div>
                  <div className="text-xs font-bold">
                    {walmurCheck ? "Hadir di Lokasi" : "Menunggu Check-in"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SCHEDULES MATRIX */}
          <div className="p-6 space-y-5">
            {/* BAGIAN 1: JADWAL UJIAN CALON SISWA */}
            <div className="space-y-2.5">
              <div className="space-y-1 pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#1E3A8A]" />
                  <h3 className="text-xs sm:text-sm font-black text-[#1E3A8A] uppercase tracking-wide">
                    Jadwal Ujian Calon Siswa
                  </h3>
                </div>
                <div className="text-xs text-slate-700 pl-6 flex items-center gap-1.5">
                  <span className="font-semibold text-slate-500">
                    Ruangan Siswa:
                  </span>
                  <strong className="text-slate-900 font-bold">
                    {siswa.ruangan_siswa}
                  </strong>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sortedStations.map((station) => (
                  <div
                    key={station.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/80 flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                        {station.title}
                      </h4>
                      <div className="text-xs text-slate-700">
                        Waktu:{" "}
                        <strong className="text-slate-900">
                          {station.waktu}
                        </strong>
                      </div>
                    </div>

                    <div className="pt-2 mt-2 border-t border-slate-200/80 text-[11px] text-slate-600">
                      Penguji:{" "}
                      <strong className="text-slate-800">
                        {station.penguji}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* BAGIAN 2: JADWAL WAWANCARA ORANG TUA (PARALEL) */}
            <div className="space-y-2.5 pt-2">
              <div className="space-y-1 pb-2 border-b border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#D97706]" />
                    <h3 className="text-xs sm:text-sm font-black text-[#D97706] uppercase tracking-wide">
                      Jadwal Wawancara Orang Tua
                    </h3>
                  </div>
                  <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-md border border-amber-200 self-start sm:self-auto">
                    Berjalan Bersamaan / Paralel dengan Ujian Siswa
                  </span>
                </div>
                <div className="text-xs text-slate-700 pl-6 flex items-center gap-1.5">
                  <span className="font-semibold text-slate-500">
                    Ruangan Orang Tua:
                  </span>
                  <strong className="text-slate-900 font-bold">
                    {siswa.ruangan_walmur}
                  </strong>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                <div className="space-y-1">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                    Wawancara Orang Tua / Wali Calon Siswa
                  </h4>
                  <div className="text-xs text-slate-700">
                    Waktu Wawancara:{" "}
                    <strong className="text-slate-900">
                      {siswa.waktu_interview}
                    </strong>
                  </div>
                  <div className="text-xs text-slate-600">
                    Pewawancara:{" "}
                    <strong className="text-[#1E3A8A]">
                      {siswa.interview_walmur}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notice bottom */}
          <div className="bg-slate-100 px-6 py-3 text-[10px] text-slate-500 text-center border-t border-slate-200">
            *Tunjukkan kartu ini kepada petugas Timekeeper di meja registrasi
            sekolah untuk pemindaian presensi barcode kedatangan.
          </div>
        </div>
      </div>
    </div>
  );
};
