const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { google } = require("googleapis");
const admin = require("firebase-admin");

const SHEET_TAB = "RRSS";
const COLLECTION = "client_content_requests";
const db = admin.firestore();

async function getSheetIdForBrand(brandId) {
  const snap = await db.collection("cmhub_brands").doc(brandId).get();
  const sheetId = snap.data()?.sheetId;
  if (!sheetId) throw new HttpsError("not-found", `La marca "${brandId}" no tiene un Google Sheet configurado. Agrégalo en Configuración → Sheet ID.`);
  return {
    sheetId,
    brandName: snap.data()?.name ?? brandId,
    responsible: snap.data()?.responsible ?? null,
    responsibleId: snap.data()?.responsibleId ?? null,
  };
}

// Column indices (0-based) in the Google Sheet
const COL = {
  fecha: 0,         // A: Fecha solicitada
  formato: 1,       // B: Formato
  requerimiento: 2, // C: Requerimiento
  pais: 3,          // D: País
  objetivo: 4,      // E: Objetivo
  deadline: 5,      // F: Deadline puesto por FB
  canal: 6,         // G: Por dónde lo enviarás
  update: 7,        // H: UPDATE
  // I (index 8): checkbox boolean — skip
  status: 9,        // J: STATUS
  portalId: 10,     // K: PORTAL_ID — managed by this sync
};

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const authClient = await auth.getClient();
  return google.sheets({ version: "v4", auth: authClient });
}


function str(val) {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

// Firestore auto-IDs are exactly 20 alphanumeric chars
function isFirestoreId(val) {
  return /^[A-Za-z0-9]{20}$/.test(val);
}

function parseSheetDate(val) {
  if (!val) return "";
  const s = String(val).trim();

  // Google Sheets serial date number (int or float, e.g. 46175 or 46175.5)
  if (/^\d{5,6}(\.\d+)?$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(parseFloat(s)) * 86400000);
    return d.toISOString().split("T")[0];
  }

  // n1/n2/yyyy — detect DD/MM vs MM/DD
  // If first number > 12 → must be day (DD/MM). If second > 12 → must be month (MM/DD).
  // Both ≤ 12 → assume DD/MM (Latin American default).
  const m1 = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m1) {
    let [, a, b, y] = m1;
    const year = y.length === 2 ? `20${y}` : y;
    let day, mo;
    if (parseInt(a) > 12) {
      // First must be day → DD/MM
      day = a; mo = b;
    } else if (parseInt(b) > 12) {
      // Second must be month (>12 is impossible for month) — actually second > 12 = day
      // So format is MM/DD
      mo = a; day = b;
    } else {
      // Both ≤ 12: assume DD/MM (Latin American)
      day = a; mo = b;
    }
    return `${year}-${mo.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // "26-jun", "26 jun", "jul-01"
  const months = { ene:1,feb:2,mar:3,abr:4,may:5,jun:6,jul:7,ago:8,sep:9,oct:10,nov:11,dic:12 };
  const m2 = s.match(/^(\d{1,2})[\s\-\/]([a-záéíóú]{3})/i);
  if (m2) {
    const mo = months[m2[2].toLowerCase()];
    if (mo) return `2026-${String(mo).padStart(2, "0")}-${m2[1].padStart(2, "0")}`;
  }
  const m3 = s.match(/^([a-záéíóú]{3})[\s\-\/](\d{1,2})/i);
  if (m3) {
    const mo = months[m3[1].toLowerCase()];
    if (mo) return `2026-${String(mo).padStart(2, "0")}-${m3[2].padStart(2, "0")}`;
  }
  return s;
}

// ─── Sheets → Firestore ──────────────────────────────────────────────────────
// Called from admin panel. brandId tells us which client this sheet belongs to.
exports.syncSheetToFirestore = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Se requiere autenticación.");

  const { brandId } = request.data;
  if (!brandId) throw new HttpsError("invalid-argument", "brandId requerido.");

  const { sheetId: SHEET_ID } = await getSheetIdForBrand(brandId);

  const sheets = await getSheetsClient();
  const tabTitle = SHEET_TAB; // eslint-disable-line no-unused-vars
  // Row 1 is empty, row 2 is the purple header row, data starts at row 3.
  // Reading from A2 so rows[0] = header, rows[i>=1] = data (sheetRow = i + 2).
  const range = `${tabTitle}!A2:K`;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  const rows = response.data.values || [];
  if (rows.length < 2) return { created: 0, updated: 0, total: 0 };

  // Ensure PORTAL_ID header exists in column K (K2 = the header row)
  const header = rows[0];
  if (!str(header[COL.portalId]).toUpperCase().includes("PORTAL")) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${tabTitle}!K2`,
      valueInputOption: "RAW",
      requestBody: { values: [["PORTAL_ID"]] },
    });
  }

  let created = 0, updated = 0;
  let batch = db.batch();
  let batchCount = 0;
  const batches = [batch];
  const sheetWrites = []; // rows where we need to write back the new PORTAL_ID

  // Carry-forward: many rows leave col A blank, reusing the date from the row above
  let lastFechaStr = "";

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const requerimiento = str(row[COL.requerimiento]);
    if (!requerimiento) continue;

    const portalId = isFirestoreId(str(row[COL.portalId])) ? str(row[COL.portalId]) : "";
    const rawStatus = str(row[COL.status]).toUpperCase();
    const status = rawStatus.includes("FINAL") ? "finalizado" : "pendiente";

    // Propagate date from previous row when column A is blank
    const parsedFecha = parseSheetDate(row[COL.fecha]);
    if (parsedFecha && /^\d{4}-\d{2}-\d{2}$/.test(parsedFecha)) lastFechaStr = parsedFecha;

    // sheetFecha: fecha de la solicitud según columna A (para referencia/display).
    // createdAt para registros nuevos: serverTimestamp → el momento del sync.
    // Esto garantiza que filas nuevas en una sync reciente tengan timestamp actual
    // y aparezcan primero al ordenar por fecha de ingreso.
    const sheetFecha = lastFechaStr || "";

    // Fields that the Sheet owns
    const sheetsFields = {
      brandId,
      requestedBy: "Sheets",
      formato: str(row[COL.formato]),
      requerimiento,
      pais: str(row[COL.pais]),
      objetivo: str(row[COL.objetivo]),
      deadline: parseSheetDate(row[COL.deadline]),
      canal: str(row[COL.canal]),
      sheetRow: i + 2,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (portalId) {
      // Already linked: update only Sheet-owned fields (preserve portal status/update/clientNote)
      const ref = db.collection(COLLECTION).doc(portalId);
      batches[batches.length - 1].update(ref, sheetsFields);
      updated++;
    } else {
      // New row: create Firestore doc, will write ID back to Sheet
      const ref = db.collection(COLLECTION).doc();
      batches[batches.length - 1].set(ref, {
        ...sheetsFields,
        status,
        update: str(row[COL.update]),
        _fromSheet: true,
        sheetFecha,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      sheetWrites.push({ rowIndex: i + 2, portalId: ref.id }); // i+2: offset for empty row1 + header row2
      created++;
    }

    batchCount++;
    if (batchCount % 400 === 0) {
      batches.push(db.batch());
    }
  }

  // Commit all batches sequentially
  for (const b of batches) {
    await b.commit();
  }

  // Write PORTAL_IDs back into column K for newly created docs
  if (sheetWrites.length > 0) {
    const data = sheetWrites.map(({ rowIndex, portalId: pid }) => ({
      range: `${tabTitle}!K${rowIndex}`,
      values: [[pid]],
    }));
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { valueInputOption: "RAW", data },
    });
  }

  return { created, updated, total: created + updated };
});

// ─── Firestore → Sheets ──────────────────────────────────────────────────────
// When STATUS or UPDATE changes in the portal, write it back to the Sheet row.
exports.onContentRequestWrite = onDocumentWritten(
  `${COLLECTION}/{docId}`,
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    if (!after) return; // document deleted — nothing to write back
    if (!before) return; // new doc created — Sheet already has the values

    // Solo propagar al Sheet cuando status o update cambian.
    // El sync Sheets→Firestore no toca estos campos (sheetsFields no los incluye),
    // así que este trigger nunca crea un loop, independientemente de _fromSheet.
    const statusChanged = before.status !== after.status;
    const updateChanged = before.update !== after.update;
    if (!statusChanged && !updateChanged) return;

    const sheetRow = after.sheetRow;
    if (!sheetRow) return; // doc not linked to a Sheet row

    try {
      const { sheetId: SHEET_ID } = await getSheetIdForBrand(after.brandId).catch(() => ({ sheetId: null }));
      if (!SHEET_ID) return;
      const sheets = await getSheetsClient();
      const tabTitle = SHEET_TAB; // eslint-disable-line no-unused-vars
      const statusValue = after.status === "finalizado" ? "FINALIZADO" : "PENDIENTE";

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          valueInputOption: "RAW",
          data: [
            { range: `${tabTitle}!H${sheetRow}`, values: [[after.update || ""]] },
            { range: `${tabTitle}!J${sheetRow}`, values: [[statusValue]] },
          ],
        },
      });
    } catch (err) {
      console.error("[onContentRequestWrite] Sheet write-back failed:", err.message);
    }
  }
);

// ─── Nueva solicitud → Sheet ─────────────────────────────────────────────────
// When a new doc is created from the client portal (not from sync), append a row to the Sheet.
exports.onContentRequestCreated = onDocumentCreated(
  `${COLLECTION}/{docId}`,
  async (event) => {
    const data = event.data?.data();
    if (!data || data._fromSheet) return;

    // Notificaciones: responsable de la marca + equipo del área asignada
    try {
      const { brandName, responsible, responsibleId } = await getSheetIdForBrand(data.brandId)
        .catch(() => ({ brandName: data.brandId, responsible: null, responsibleId: null, sheetId: null }));

      const notifiedIds = new Set();
      const area = data.area ?? "Agencia";
      const link = `/admin/contenidos/clientes/${data.brandId}?tab=solicitudes`;
      const shortReq = `${(data.requerimiento || "").slice(0, 80)}${(data.requerimiento || "").length > 80 ? "…" : ""}`;

      // 1. Notificar al responsable de la marca
      // Prioriza responsibleId (UID directo); fallback a búsqueda por nombre para marcas legacy.
      if (responsibleId) {
        const respDoc = await db.collection("userDirectory").doc(responsibleId).get();
        if (respDoc.exists) {
          notifiedIds.add(responsibleId);
          await db.collection("notifications").add({
            userId: responsibleId,
            type: "content_request_new",
            category: "Solicitudes",
            title: `Nueva solicitud · ${brandName}`,
            message: `${data.requestedBy || "Un cliente"} solicitó: ${data.formato} — ${shortReq}`,
            link,
            brandId: data.brandId,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      } else if (responsible) {
        // Fallback legacy: buscar por nombre en múltiples campos
        const byName = await db.collection("userDirectory")
          .where("name", "==", responsible).limit(1).get();
        const respDoc = byName.empty
          ? await db.collection("userDirectory").where("displayName", "==", responsible).limit(1).get()
          : byName;
        if (!respDoc.empty) {
          const respId = respDoc.docs[0].id;
          notifiedIds.add(respId);
          await db.collection("notifications").add({
            userId: respId,
            type: "content_request_new",
            category: "Solicitudes",
            title: `Nueva solicitud · ${brandName}`,
            message: `${data.requestedBy || "Un cliente"} solicitó: ${data.formato} — ${shortReq}`,
            link,
            brandId: data.brandId,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }

      // 2. Notificar al equipo del área asignada (evitar duplicado con el responsable)
      const areaSnap = await db.collection("userDirectory")
        .where("category", "==", area)
        .where("status", "==", "active")
        .get();
      for (const memberDoc of areaSnap.docs) {
        if (notifiedIds.has(memberDoc.id)) continue;
        await db.collection("notifications").add({
          userId: memberDoc.id,
          type: "content_request_new",
          category: "Solicitudes",
          title: `Nueva solicitud · ${area}`,
          message: `${data.requestedBy || "Un cliente"} (${brandName}) solicitó: ${data.formato} — ${shortReq}`,
          link,
          brandId: data.brandId,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (err) {
      console.error("[onContentRequestCreated] notification failed:", err.message);
    }

    try {
      const { sheetId: SHEET_ID } = await getSheetIdForBrand(data.brandId).catch(() => ({ sheetId: null }));
      if (!SHEET_ID) return; // esta marca no tiene Sheet configurado, salir sin error
      const sheets = await getSheetsClient();
      const tabTitle = SHEET_TAB;

      const toDisplayDate = (iso) => {
        if (!iso) return "";
        try {
          const d = new Date(iso);
          if (isNaN(d.getTime())) return iso;
          return `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${String(d.getUTCFullYear()).slice(-2)}`;
        } catch { return iso; }
      };

      const fechaDisplay = data.createdAt?.toDate
        ? toDisplayDate(data.createdAt.toDate().toISOString())
        : toDisplayDate(new Date().toISOString());

      const row = [
        fechaDisplay,               // A: Fecha solicitada
        data.formato || "",         // B: Formato
        data.requerimiento || "",   // C: Requerimiento
        data.pais || "",            // D: País
        data.objetivo || "",        // E: Objetivo
        data.deadline || "",        // F: Deadline
        data.canal || "",           // G: Canal
        data.update || "",          // H: UPDATE
        "",                         // I: checkbox (vacío)
        data.status === "finalizado" ? "FINALIZADO" : "PENDIENTE", // J: STATUS
        event.params.docId,         // K: PORTAL_ID
      ];

      const appendRes = await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `${tabTitle}!A:K`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [row] },
      });

      // Extract row number from the response range (e.g. "RRSS!A256:K256")
      const updatedRange = appendRes.data.updates?.updatedRange || "";
      const rowMatch = updatedRange.match(/!A(\d+):/);
      const sheetRow = rowMatch ? parseInt(rowMatch[1]) : null;

      if (sheetRow) {
        await db.collection(COLLECTION).doc(event.params.docId).update({ sheetRow });
      }
    } catch (err) {
      console.error("[onContentRequestCreated] Sheet append failed:", err.message);
    }
  }
);
