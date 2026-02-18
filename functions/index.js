const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const MAX_BATCH_SIZE = 500;

async function deleteCollectionGroupByField({ collectionId, field, targetUid, deletedPaths }) {
  let totalDeleted = 0;
  let batchNumber = 0;

  while (true) {
    const snapshot = await db
      .collectionGroup(collectionId)
      .where(field, "==", targetUid)
      .limit(MAX_BATCH_SIZE)
      .get();

    const fetched = snapshot.size;
    if (fetched === 0) {
      logger.info("adminDeleteUserData no more docs for query", {
        collectionId,
        field,
        targetUid,
        batchNumber,
      });
      break;
    }

    batchNumber += 1;
    logger.info("adminDeleteUserData batch fetched", {
      collectionId,
      field,
      targetUid,
      batchNumber,
      fetched,
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
      logger.warn("adminDeleteUserData fetched docs but all were already scheduled/deleted", {
        collectionId,
        field,
        targetUid,
        batchNumber,
      });
      break;
    }

    await batch.commit();
    totalDeleted += batchDeletes;

    logger.info("adminDeleteUserData batch deleted", {
      collectionId,
      field,
      targetUid,
      batchNumber,
      batchDeletes,
      totalDeleted,
    });
  }

  return totalDeleted;
}

async function deleteUserSubcollection({ targetUid, subcollection, deletedPaths }) {
  let totalDeleted = 0;
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
      logger.info("adminDeleteUserData no more docs for user subcollection", {
        targetUid,
        subcollection,
        batchNumber,
      });
      break;
    }

    batchNumber += 1;
    logger.info("adminDeleteUserData user subcollection batch fetched", {
      targetUid,
      subcollection,
      batchNumber,
      fetched,
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
      logger.warn("adminDeleteUserData user subcollection fetched docs but none deletable", {
        targetUid,
        subcollection,
        batchNumber,
      });
      break;
    }

    await batch.commit();
    totalDeleted += batchDeletes;

    logger.info("adminDeleteUserData user subcollection batch deleted", {
      targetUid,
      subcollection,
      batchNumber,
      batchDeletes,
      totalDeleted,
    });
  }

  return totalDeleted;
}

exports.adminDeleteUserData = onCall(async (request) => {
  const requesterUid = request.auth?.uid ?? null;
  const targetUid = typeof request.data?.targetUid === "string" ? request.data.targetUid.trim() : "";
  const mode = request.data?.mode === "TIME_ONLY" ? "TIME_ONLY" : "ALL";

  logger.info("adminDeleteUserData request received", {
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

    logger.info("adminDeleteUserData requester role loaded", {
      requesterUid,
      requesterRole,
      targetUid,
    });

    if (requesterRole !== "admin") {
      throw new HttpsError("permission-denied", "Solo admin puede borrar datos de colaboradores.");
    }

    const deletedPaths = new Set();
    const deleted = {
      timeEntries: 0,
      hourRequests: 0,
      extraActivities: 0,
      userHoursSubcollection: 0,
      userHourRequestsSubcollection: 0,
      userExtraActivitiesSubcollection: 0,
    };

    deleted.timeEntries += await deleteCollectionGroupByField({
      collectionId: "timeEntries",
      field: "uid",
      targetUid,
      deletedPaths,
    });
    deleted.timeEntries += await deleteCollectionGroupByField({
      collectionId: "timeEntries",
      field: "userId",
      targetUid,
      deletedPaths,
    });

    if (mode === "ALL") {
      deleted.hourRequests += await deleteCollectionGroupByField({
        collectionId: "hourRequests",
        field: "uid",
        targetUid,
        deletedPaths,
      });
      deleted.hourRequests += await deleteCollectionGroupByField({
        collectionId: "hourRequests",
        field: "userId",
        targetUid,
        deletedPaths,
      });

      deleted.extraActivities += await deleteCollectionGroupByField({
        collectionId: "extraActivities",
        field: "uid",
        targetUid,
        deletedPaths,
      });
      deleted.extraActivities += await deleteCollectionGroupByField({
        collectionId: "extraActivities",
        field: "userId",
        targetUid,
        deletedPaths,
      });
    }

    deleted.userHoursSubcollection = await deleteUserSubcollection({
      targetUid,
      subcollection: "hours",
      deletedPaths,
    });

    if (mode === "ALL") {
      deleted.userHourRequestsSubcollection = await deleteUserSubcollection({
        targetUid,
        subcollection: "hourRequests",
        deletedPaths,
      });
      deleted.userExtraActivitiesSubcollection = await deleteUserSubcollection({
        targetUid,
        subcollection: "extraActivities",
        deletedPaths,
      });
    }

    logger.info("adminDeleteUserData completed", {
      requesterUid,
      targetUid,
      mode,
      deleted,
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

    logger.error("adminDeleteUserData failed", {
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
