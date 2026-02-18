const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const MAX_BATCH_SIZE = 500;

function logInfo(message, payload = {}) {
  console.log(`[adminDeleteUserData] ${message}`, payload);
  logger.info(message, payload);
}

function logError(message, payload = {}) {
  console.error(`[adminDeleteUserData] ${message}`, payload);
  logger.error(message, payload);
}

async function deleteCollectionGroupByField({ collectionId, field, targetUid, deletedPaths }) {
  let totalDeleted = 0;
  let totalFound = 0;
  let batchNumber = 0;

  while (true) {
    const snapshot = await db
      .collectionGroup(collectionId)
      .where(field, "==", targetUid)
      .limit(MAX_BATCH_SIZE)
      .get();

    const fetched = snapshot.size;
    if (fetched === 0) {
      logInfo("query finished (no more docs)", {
        collectionId,
        field,
        targetUid,
        batchNumber,
        totalFound,
        totalDeleted,
      });
      break;
    }

    batchNumber += 1;
    totalFound += fetched;

    logInfo("batch fetched", {
      collectionId,
      field,
      targetUid,
      batchNumber,
      fetched,
      totalFound,
    });

    const batch = db.batch();
    let batchDeletes = 0;

    snapshot.docs.forEach((docSnap) => {
      const path = docSnap.ref.path;
      if (deletedPaths.has(path)) return;
      deletedPaths.add(path);
      batch.delete(docSnap.ref);
      batchDeletes += 1;
    });

    if (batchDeletes === 0) {
      logInfo("batch skipped (all docs already scheduled)", {
        collectionId,
        field,
        targetUid,
        batchNumber,
      });
      continue;
    }

    await batch.commit();
    totalDeleted += batchDeletes;

    logInfo("batch deleted", {
      collectionId,
      field,
      targetUid,
      batchNumber,
      batchDeletes,
      totalDeleted,
    });
  }

  return { found: totalFound, deleted: totalDeleted };
}

async function deleteUserSubcollection({ targetUid, subcollection, deletedPaths }) {
  let totalDeleted = 0;
  let totalFound = 0;
  let batchNumber = 0;

  while (true) {
    const snapshot = await db
      .collection("users")
      .doc(targetUid)
      .collection(subcollection)
      .limit(MAX_BATCH_SIZE)
      .get();

    const fetched = snapshot.size;
    if (fetched === 0) {
      logInfo("user subcollection finished (no more docs)", {
        targetUid,
        subcollection,
        batchNumber,
        totalFound,
        totalDeleted,
      });
      break;
    }

    batchNumber += 1;
    totalFound += fetched;

    const batch = db.batch();
    let batchDeletes = 0;

    snapshot.docs.forEach((docSnap) => {
      const path = docSnap.ref.path;
      if (deletedPaths.has(path)) return;
      deletedPaths.add(path);
      batch.delete(docSnap.ref);
      batchDeletes += 1;
    });

    if (batchDeletes === 0) {
      logInfo("user subcollection batch skipped (already scheduled)", {
        targetUid,
        subcollection,
        batchNumber,
      });
      continue;
    }

    await batch.commit();
    totalDeleted += batchDeletes;

    logInfo("user subcollection batch deleted", {
      targetUid,
      subcollection,
      batchNumber,
      batchDeletes,
      totalDeleted,
    });
  }

  return { found: totalFound, deleted: totalDeleted };
}

exports.adminDeleteUserData = onCall(async (request) => {
  const requesterUid = request.auth?.uid ?? null;
  const targetUid = typeof request.data?.targetUid === "string" ? request.data.targetUid.trim() : "";
  const mode = request.data?.mode === "TIME_ONLY" ? "TIME_ONLY" : "ALL";

  logInfo("request received", {
    requesterUid,
    targetUid,
    mode,
  });

  if (!requesterUid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }

  if (!targetUid) {
    throw new HttpsError("invalid-argument", "targetUid es requerido.");
  }

  try {
    const requesterSnap = await db.collection("users").doc(requesterUid).get();
    const requesterRole = requesterSnap.exists ? requesterSnap.get("role") : null;

    logInfo("admin check", {
      requesterUid,
      requesterRole,
      isAdmin: requesterRole === "admin",
      targetUid,
    });

    if (requesterRole !== "admin") {
      throw new HttpsError("permission-denied", "Not authorized");
    }

    const deletedPaths = new Set();

    const deleted = {
      timeEntries: 0,
      hourRequests: 0,
      extraActivities: 0,
    };

    const relatedDeleted = {
      usersHours: 0,
      usersHourRequests: 0,
      usersExtraActivities: 0,
    };

    const timeByUid = await deleteCollectionGroupByField({
      collectionId: "timeEntries",
      field: "uid",
      targetUid,
      deletedPaths,
    });
    const timeByUserId = await deleteCollectionGroupByField({
      collectionId: "timeEntries",
      field: "userId",
      targetUid,
      deletedPaths,
    });
    deleted.timeEntries = timeByUid.deleted + timeByUserId.deleted;

    if (mode === "ALL") {
      const hourByUid = await deleteCollectionGroupByField({
        collectionId: "hourRequests",
        field: "uid",
        targetUid,
        deletedPaths,
      });
      const hourByUserId = await deleteCollectionGroupByField({
        collectionId: "hourRequests",
        field: "userId",
        targetUid,
        deletedPaths,
      });
      deleted.hourRequests = hourByUid.deleted + hourByUserId.deleted;

      const extraByUid = await deleteCollectionGroupByField({
        collectionId: "extraActivities",
        field: "uid",
        targetUid,
        deletedPaths,
      });
      const extraByUserId = await deleteCollectionGroupByField({
        collectionId: "extraActivities",
        field: "userId",
        targetUid,
        deletedPaths,
      });
      deleted.extraActivities = extraByUid.deleted + extraByUserId.deleted;
    }

    const userHours = await deleteUserSubcollection({
      targetUid,
      subcollection: "hours",
      deletedPaths,
    });
    relatedDeleted.usersHours = userHours.deleted;

    if (mode === "ALL") {
      const userHourRequests = await deleteUserSubcollection({
        targetUid,
        subcollection: "hourRequests",
        deletedPaths,
      });
      relatedDeleted.usersHourRequests = userHourRequests.deleted;

      const userExtraActivities = await deleteUserSubcollection({
        targetUid,
        subcollection: "extraActivities",
        deletedPaths,
      });
      relatedDeleted.usersExtraActivities = userExtraActivities.deleted;
    }

    logInfo("completed", {
      requesterUid,
      targetUid,
      mode,
      deleted,
      relatedDeleted,
    });

    return {
      ok: true,
      deleted,
    };
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "unknown";

    logError("failed", {
      requesterUid,
      targetUid,
      mode,
      code,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
    });

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError("internal", "Error interno al borrar datos del colaborador.");
  }
});
