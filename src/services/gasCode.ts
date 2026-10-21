/**
 * Google Apps Script Backend: Code.gs
 * Aplikasi Tes SPMB AL-WILDAN ISLAMIC SCHOOL 29 DEPOK
 * 
 * Fitur:
 * 1. Concurrency Lock: LockService.getScriptLock() (mencegah race condition saat puluhan penguji submit serentak)
 * 2. Auto-initialize sheet `web_nilai`, `web_presensi`, dan `web_sesi_ujian` jika belum ada
 *    serta migrasi otomatis kolom baru pada `web_jadwal`
 * 3. Auth verification tanpa password via email petugas (sheet `web_penguji`)
 * 4. Full CRUD operations untuk Admin & Live endpoints untuk Timekeeper & Penguji
 * 5. High-performance cached getValues()
 */

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * =========================================================================
 * TES SPMB AL-WILDAN ISLAMIC SCHOOL 29 DEPOK - GOOGLE APPS SCRIPT BACKEND
 * =========================================================================
 * Spreadsheet ID: Dihubungkan ke Spreadsheet penampung data SPMB
 */

var ADMIN_EMAIL = "kurikulum.alwildan29@gmail.com";

// Skema terkunci header web_jadwal (kolom A s/d X) dan key kanoniknya
var JADWAL_HEADERS = [
  "id", "nama siswa", "kelas", "gender", "nomor walmur", "email walmur", "grade",
  "ruangan_siswa", "ord_alq_arab", "ord_catung_eng", "waktu_all", "waktu_alq_arab",
  "waktu_catung_eng", "ruangan_walmur", "penguji_alq_arab", "penguji_catung_eng",
  "timekeeper_siswa", "interview_walmur", "timekeeper_walmur", "waktu_interview",
  "hari tanggal", "Status", "status_kehadiran_siswa", "status_kehadiran_walmur"
];
var JADWAL_KEYS = [
  "id", "nama_siswa", "kelas", "gender", "nomor_walmur", "email_walmur", "grade",
  "ruangan_siswa", "ord_alq_arab", "ord_catung_eng", "waktu_all", "waktu_alq_arab",
  "waktu_catung_eng", "ruangan_walmur", "penguji_alq_arab", "penguji_catung_eng",
  "timekeeper_siswa", "interview_walmur", "timekeeper_walmur", "waktu_interview",
  "hari_tanggal", "status", "status_kehadiran_siswa", "status_kehadiran_walmur"
];

// Baca web_jadwal dengan skema terkunci: header dicocokkan case/space-insensitive,
// hasilnya selalu punya key kanonik sehingga nama siswa tidak pernah kosong.
function jadwalSheetToObjects(sheet) {
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];

  // Cocokkan tiap expected header ke posisi kolom aktual
  var colIdx = [];
  var matched = true;
  for (var j = 0; j < JADWAL_HEADERS.length; j++) {
    var expected = normHeader(JADWAL_HEADERS[j]);
    var found = -1;
    for (var c = 0; c < headers.length; c++) {
      if (normHeader(headers[c]) === expected) {
        found = c;
        break;
      }
    }
    if (found === -1) {
      matched = false;
      break;
    }
    colIdx.push(found);
  }

  var result = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    if (matched) {
      for (var k = 0; k < JADWAL_KEYS.length; k++) {
        obj[JADWAL_KEYS[k]] = row[colIdx[k]];
      }
    } else {
      // Fallback: mapping dinamis sesuai header apa adanya
      for (var jj = 0; jj < headers.length; jj++) {
        obj[normHeader(headers[jj])] = row[jj];
      }
    }
    result.push(obj);
  }
  return result;
}

function normHeader(h) {
  return String(h || "").trim().replace(/\\s+/g, "_").toLowerCase();
}

// Normalisasi tanggal dari cell Spreadsheet (Date object / string) ke yyyy-mm-dd.
function dateKey(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, "Asia/Jakarta", "yyyy-MM-dd");
  }
  var text = String(value || "").trim();
  var iso = text.match(/^(\\d{4})-(\\d{2})-(\\d{2})/);
  if (iso) return iso[1] + "-" + iso[2] + "-" + iso[3];
  return text;
}

// Inisialisasi Sheet jika belum ada
function initSheets(ss) {
  var sheetNilai = ss.getSheetByName("web_nilai");
  if (!sheetNilai) {
    sheetNilai = ss.insertSheet("web_nilai");
    sheetNilai.appendRow([
      "timestamp",
      "id_siswa",
      "nama_siswa",
      "kategori_ujian",
      "nama_penguji",
      "email_penguji",
      "detail_skor_json",
      "skor_akhir_rata2",
      "catatan_umum"
    ]);
    sheetNilai.setFrozenRows(1);
    sheetNilai.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#1E3A8A").setFontColor("#FFFFFF");
  }

  var sheetPresensi = ss.getSheetByName("web_presensi");
  if (!sheetPresensi) {
    sheetPresensi = ss.insertSheet("web_presensi");
    sheetPresensi.appendRow([
      "timestamp",
      "id_siswa",
      "nama_siswa",
      "tipe_presensi",
      "petugas_timekeeper",
      "status"
    ]);
    sheetPresensi.setFrozenRows(1);
    sheetPresensi.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#1E3A8A").setFontColor("#FFFFFF");
  }

  var sheetSesi = ss.getSheetByName("web_sesi_ujian");
  if (!sheetSesi) {
    sheetSesi = ss.insertSheet("web_sesi_ujian");
    sheetSesi.appendRow([
      "id_sesi",
      "hari_tanggal",
      "mode_ujian",
      "catatan",
      "updated_at"
    ]);
    sheetSesi.setFrozenRows(1);
    sheetSesi.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#1E3A8A").setFontColor("#FFFFFF");
  }

  var jadwalSheet = ss.getSheetByName("web_jadwal");
  if (jadwalSheet) {
    ensureJadwalHeaderColumns(jadwalSheet);
  }
}

// Pastikan kolom baru web_jadwal otomatis ditambahkan tanpa merusak data lama.
function ensureJadwalHeaderColumns(sheet) {
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var normalized = [];
  for (var h = 0; h < headers.length; h++) {
    normalized.push(normHeader(headers[h]));
  }

  var additions = [];
  for (var i = 0; i < JADWAL_HEADERS.length; i++) {
    if (normalized.indexOf(normHeader(JADWAL_HEADERS[i])) === -1) {
      additions.push(JADWAL_HEADERS[i]);
    }
  }

  if (additions.length > 0) {
    sheet.getRange(1, lastCol + 1, 1, additions.length).setValues([additions]);
    sheet.getRange(1, lastCol + 1, 1, additions.length)
      .setFontWeight("bold")
      .setBackground("#1E3A8A")
      .setFontColor("#FFFFFF");
  }
}

// Helper output CORS JSON
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// GET Handler
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    initSheets(ss);
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "getAllData";

    if (action === "getAllData" || action === "getSchedule") {
      var jadwalSheet = ss.getSheetByName("web_jadwal");
      var pengujiSheet = ss.getSheetByName("web_penguji");
      var nilaiSheet = ss.getSheetByName("web_nilai");
      var presensiSheet = ss.getSheetByName("web_presensi");
      var sesiSheet = ss.getSheetByName("web_sesi_ujian");

      // Privasi: nomor & email walmur TIDAK PERNAH dikirim ke klien.
      // email_penguji hanya dikirim bila request terverifikasi sebagai petugas.
      var reqEmail = ((e && e.parameter && e.parameter.email) || "").trim().toLowerCase();
      var verified = reqEmail ? (verifyPetugas(ss, reqEmail).status === "success") : false;

      var jadwals = jadwalSheetToObjects(jadwalSheet);
      var pengujis = sheetToObjects(pengujiSheet);
      var nilais = sheetToObjects(nilaiSheet);
      var presensis = sheetToObjects(presensiSheet);
      var sesis = sheetToObjects(sesiSheet);

      for (var pi = 0; pi < jadwals.length; pi++) {
        delete jadwals[pi]["nomor_walmur"];
        delete jadwals[pi]["email_walmur"];
      }

      if (!verified) {
        for (var pj = 0; pj < pengujis.length; pj++) {
          delete pengujis[pj]["email_penguji"];
        }
        for (var pk = 0; pk < nilais.length; pk++) {
          delete nilais[pk]["email_penguji"];
        }
      }

      return jsonResponse({
        status: "success",
        data: {
          jadwal: jadwals,
          penguji: pengujis,
          nilai: nilais,
          presensi: presensis,
          sesi: sesis
        }
      });
    }

    if (action === "verifyLogin") {
      var email = (e.parameter.email || "").trim().toLowerCase();
      var authResult = verifyPetugas(ss, email);
      return jsonResponse(authResult);
    }

    return jsonResponse({ status: "error", message: "Invalid action" });
  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

// POST Handler (With Concurrency Control Lock)
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Tunggu maksimal 30 detik untuk acquire script lock
    lock.waitLock(30000);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    initSheets(ss);

    var postData = {};
    if (e && e.postData && e.postData.contents) {
      postData = JSON.parse(e.postData.contents);
    }

    var action = postData.action;

    // 1. LOGIN VERIFY
    if (action === "login") {
      var email = (postData.email || "").trim().toLowerCase();
      var auth = verifyPetugas(ss, email);
      return jsonResponse(auth);
    }

    // 2. SUBMIT PRESENSI
    if (action === "submitAttendance") {
      var sheetPresensi = ss.getSheetByName("web_presensi");
      var timestamp = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
      var day = timestamp.split(" ")[0];

      // Dedupe: tolak duplikat id_siswa + tipe yang sudah tercatat hari ini (cegah dobel antar perangkat)
      var pValues = sheetPresensi.getDataRange().getValues();
      for (var p = 1; p < pValues.length; p++) {
        var rowTime = String(pValues[p][0] || "");
        if (rowTime.indexOf(day) === 0 &&
            String(pValues[p][1]) === String(postData.id_siswa) &&
            String(pValues[p][3]) === String(postData.tipe_presensi)) {
          return jsonResponse({
            status: "already",
            message: "Presensi " + postData.nama_siswa + " (" + postData.tipe_presensi + ") sudah tercatat hari ini."
          });
        }
      }

      sheetPresensi.appendRow([
        timestamp,
        postData.id_siswa,
        postData.nama_siswa,
        postData.tipe_presensi, // "Siswa" | "Walmur"
        postData.petugas_timekeeper,
        "Hadir"
      ]);

      return jsonResponse({
        status: "success",
        message: "Presensi " + postData.nama_siswa + " (" + postData.tipe_presensi + ") berhasil dicatat!",
        timestamp: timestamp
      });
    }

    // 3. SUBMIT NILAI / UPDATE NILAI
    if (action === "submitGrade") {
      var sheetNilai = ss.getSheetByName("web_nilai");
      var timestamp = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
      var values = sheetNilai.getDataRange().getValues();
      var existingRowIndex = -1;

      // Cek apakah siswa + kategori ujian ini sudah pernah dinilai (untuk update / edit)
      for (var r = 1; r < values.length; r++) {
        if (String(values[r][1]) === String(postData.id_siswa) && String(values[r][3]) === String(postData.kategori_ujian)) {
          existingRowIndex = r + 1; // 1-indexed for Sheet
          break;
        }
      }

      var detailJsonStr = typeof postData.detail_skor_json === "object" ? JSON.stringify(postData.detail_skor_json) : postData.detail_skor_json;

      if (existingRowIndex > 0) {
        // Update existing row
        sheetNilai.getRange(existingRowIndex, 1, 1, 9).setValues([[
          timestamp,
          postData.id_siswa,
          postData.nama_siswa,
          postData.kategori_ujian,
          postData.nama_penguji,
          postData.email_penguji,
          detailJsonStr,
          postData.skor_akhir_rata2,
          postData.catatan_umum
        ]]);
      } else {
        // Append new row
        sheetNilai.appendRow([
          timestamp,
          postData.id_siswa,
          postData.nama_siswa,
          postData.kategori_ujian,
          postData.nama_penguji,
          postData.email_penguji,
          detailJsonStr,
          postData.skor_akhir_rata2,
          postData.catatan_umum
        ]);
      }

      return jsonResponse({
        status: "success",
        message: "Nilai ujian " + postData.kategori_ujian + " untuk " + postData.nama_siswa + " berhasil disimpan!"
      });
    }

    // 4. ADMIN CRUD - ADD JADWAL
    if (action === "adminAddSchedule") {
      var jSheet = ss.getSheetByName("web_jadwal");
      var s = postData.siswa;
      jSheet.appendRow([
        s.id, s.nama_siswa, s.kelas, s.gender, "", "", s.grade,
        s.ruangan_siswa, s.ord_alq_arab, s.ord_catung_eng, s.waktu_all, s.waktu_alq_arab,
        s.waktu_catung_eng, s.ruangan_walmur, s.penguji_alq_arab, s.penguji_catung_eng,
        s.timekeeper_siswa, s.interview_walmur, s.timekeeper_walmur, s.waktu_interview,
        s.hari_tanggal, s.status, s.status_kehadiran_siswa || "", s.status_kehadiran_walmur || ""
      ]);
      return jsonResponse({ status: "success", message: "Jadwal siswa berhasil ditambahkan." });
    }

    // 5. ADMIN CRUD - UPDATE JADWAL
    if (action === "adminUpdateSchedule") {
      var jSheet = ss.getSheetByName("web_jadwal");
      var s = postData.siswa;
      var vals = jSheet.getDataRange().getValues();
      var found = false;
      for (var i = 1; i < vals.length; i++) {
        if (String(vals[i][0]) === String(s.id)) {
          jSheet.getRange(i + 1, 1, 1, 24).setValues([[
            s.id, s.nama_siswa, s.kelas, s.gender, vals[i][4], vals[i][5], s.grade,
            s.ruangan_siswa, s.ord_alq_arab, s.ord_catung_eng, s.waktu_all, s.waktu_alq_arab,
            s.waktu_catung_eng, s.ruangan_walmur, s.penguji_alq_arab, s.penguji_catung_eng,
            s.timekeeper_siswa, s.interview_walmur, s.timekeeper_walmur, s.waktu_interview,
            s.hari_tanggal, s.status, s.status_kehadiran_siswa || "", s.status_kehadiran_walmur || ""
          ]]);
          found = true;
          break;
        }
      }
      return jsonResponse({ status: found ? "success" : "error", message: found ? "Jadwal berhasil diperbarui." : "ID tidak ditemukan" });
    }

    // 6. ADMIN CRUD - DELETE JADWAL
    if (action === "adminDeleteSchedule") {
      var jSheet = ss.getSheetByName("web_jadwal");
      var vals = jSheet.getDataRange().getValues();
      for (var i = 1; i < vals.length; i++) {
        if (String(vals[i][0]) === String(postData.id)) {
          jSheet.deleteRow(i + 1);
          return jsonResponse({ status: "success", message: "Jadwal siswa berhasil dihapus." });
        }
      }
      return jsonResponse({ status: "error", message: "ID siswa tidak ditemukan." });
    }

    // 7. ADMIN - SIMPAN MODE UJIAN PER TANGGAL
    if (action === "adminSaveSession") {
      var sesiSheet = ss.getSheetByName("web_sesi_ujian");
      var sesi = postData.sesi || {};
      var sesiVals = sesiSheet.getDataRange().getValues();
      var sesiUpdatedAt = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
      var sesiRowIndex = -1;
      var sesiId = String(sesi.id_sesi || "").trim();
      var sesiTanggal = String(sesi.hari_tanggal || "").trim();

      for (var si = 1; si < sesiVals.length; si++) {
        var rowId = String(sesiVals[si][0] || "").trim();
        var rowTanggal = dateKey(sesiVals[si][1]);
        if ((sesiId && rowId === sesiId) || (sesiTanggal && rowTanggal === dateKey(sesiTanggal))) {
          sesiRowIndex = si + 1;
          if (!sesiId) sesiId = rowId;
          break;
        }
      }

      if (!sesiId) {
        sesiId = "SESI-" + String(Date.now()).slice(-6);
      }

      var sesiMode = String(sesi.mode_ujian || "").trim().toLowerCase() === "online" ? "Online" : "Offline";
      var sesiRow = [
        sesiId,
        sesiTanggal,
        sesiMode,
        String(sesi.catatan || "").trim(),
        sesiUpdatedAt
      ];

      if (sesiRowIndex > 0) {
        sesiSheet.getRange(sesiRowIndex, 1, 1, 5).setValues([sesiRow]);
      } else {
        sesiSheet.appendRow(sesiRow);
      }

      return jsonResponse({ status: "success", message: "Mode ujian per tanggal berhasil disimpan.", id_sesi: sesiId });
    }

    // 8. ADMIN - HAPUS MODE UJIAN PER TANGGAL
    if (action === "adminDeleteSession") {
      var sesiSheet = ss.getSheetByName("web_sesi_ujian");
      var sesiVals = sesiSheet.getDataRange().getValues();
      for (var sd = 1; sd < sesiVals.length; sd++) {
        if (String(sesiVals[sd][0]) === String(postData.id_sesi)) {
          sesiSheet.deleteRow(sd + 1);
          return jsonResponse({ status: "success", message: "Sesi ujian berhasil dihapus." });
        }
      }
      return jsonResponse({ status: "error", message: "Sesi ujian tidak ditemukan." });
    }

    // 9. ADMIN - DELETE NILAI (by id_siswa + kategori_ujian, konsisten dgn submitGrade)
    if (action === "deleteGrade") {
      var nSheet = ss.getSheetByName("web_nilai");
      var nVals = nSheet.getDataRange().getValues();
      var deleted = 0;
      for (var d = nVals.length - 1; d >= 1; d--) {
        if (String(nVals[d][1]) === String(postData.id_siswa) && String(nVals[d][3]) === String(postData.kategori_ujian)) {
          nSheet.deleteRow(d + 1);
          deleted++;
        }
      }
      return jsonResponse({ status: deleted > 0 ? "success" : "error", message: deleted > 0 ? "Entri nilai berhasil dihapus." : "Entri nilai tidak ditemukan." });
    }

    return jsonResponse({ status: "error", message: "Aksi tidak dikenali: " + action });

  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

// Helper: Verifikasi Petugas
function verifyPetugas(ss, email) {
  if (!email) {
    return { status: "error", message: "Email wajib diisi" };
  }

  var isSuperAdmin = (email === ADMIN_EMAIL);
  var pengujiSheet = ss.getSheetByName("web_penguji");
  var pengujiData = pengujiSheet ? pengujiSheet.getDataRange().getValues() : [];
  
  var officialName = "";
  for (var i = 1; i < pengujiData.length; i++) {
    var rowEmail = String(pengujiData[i][1] || "").trim().toLowerCase();
    if (rowEmail === email) {
      officialName = String(pengujiData[i][0] || "").trim();
      break;
    }
  }

  if (isSuperAdmin && !officialName) {
    officialName = "Tim Kurikulum Al-Wildan 29 (Admin)";
  }

  if (!officialName && !isSuperAdmin) {
    return {
      status: "error",
      message: "Email tidak terdaftar di daftar penguji/petugas Al-Wildan 29 Depok."
    };
  }

  // Hitung peran aktif dari sheet web_jadwal
  var jSheet = ss.getSheetByName("web_jadwal");
  var jData = jSheet ? jSheet.getDataRange().getValues() : [];
  
  var isTimekeeper = false;
  var isPenguji = false;

  for (var j = 1; j < jData.length; j++) {
    var p_alq = String(jData[j][14] || "").trim();
    var p_cat = String(jData[j][15] || "").trim();
    var tk_s = String(jData[j][16] || "").trim();
    var int_w = String(jData[j][17] || "").trim();
    var tk_w = String(jData[j][18] || "").trim();

    if (p_alq === officialName || p_cat === officialName || int_w === officialName) {
      isPenguji = true;
    }
    if (tk_s === officialName || tk_w === officialName) {
      isTimekeeper = true;
    }
  }

  var roles = [];
  if (isSuperAdmin) {
    roles.push("ADMIN");
  }
  if (isTimekeeper || isSuperAdmin) {
    roles.push("TIMEKEEPER");
  }
  if (isPenguji || isSuperAdmin) {
    roles.push("PENGUJI");
  }

  if (roles.length === 0) {
    roles.push("PENGUJI"); // default fallback
  }

  return {
    status: "success",
    data: {
      email: email,
      nama: officialName,
      availableRoles: roles,
      activeRole: roles[0]
    }
  };
}

// Convert 2D array to array of objects
function sheetToObjects(sheet) {
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  var result = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var key = String(headers[j]).trim().replace(/\\s+/g, "_").toLowerCase();
      obj[key] = row[j];
    }
    result.push(obj);
  }
  return result;
}
`;
