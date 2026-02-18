const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const MAX_BATCH_SIZE = 500;

async function deleteRefsInBatches(refs, deletedPaths, label) {
  let deleted = 0;

  for (let index = 0; index < refs.length; index += MAX_BATCH_SIZE) {
    const chunk = refs.slice(index, index + MAX_BATCH_SIZE);
    const batch = db.batch();

    chunk.forEach((ref) => {
      if (deletedPaths.has(ref.path)) return;
      deletedPaths.add(ref.path);
      batch.delete(ref);
      deleted += 1;
    });

    if (!chunk.length) continue;
    await batch.commit();
  }

  if (deleted > 0) {
    logger.info("adminDeleteUserData deleted documents", {
      label,
      deleted,
    });
  }

  return deleted;
}

async function collectRefsByFields(collectionId, targetUid, fields) {
  const refs = [];

  for (const field of fields) {
    let snapshot = await db.collectionGroup(collectionId).where(field, "==", targetUid).limit(MAX_BATCH_SIZE).get();
    while (!snapshot.empty) {
      snapshot.docs.forEach((docSnap) => refs.push(docSnap.ref));
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      snapshot = await db
        .collectionGroup(collectionId)
        .where(field, "==", targetUid)
        .startAfter(lastDoc)
        .limit(MAX_BATCH_SIZE)
        .get();
    }
  }

  return refs;
}

async function collectRefsFromUserSubcollection(targetUid, subcollection) {
  const refs = [];
  let snapshot = await db.collection("users").doc(targetUid).collection(subcollection).limit(MAX_BATCH_SIZE).get();

  while (!snapshot.empty) {
    snapshot.docs.forEach((docSnap) => refs.push(docSnap.ref));
    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    snapshot = await db
      .collection("users")
      .doc(targetUid)
      .collection(subcollection)
      .startAfter(lastDoc)
      .limit(MAX_BATCH_SIZE)
      .get();
  }

  return refs;
}

exports.adminDeleteUserData = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }

  const requesterSnap = await db.collection("users").doc(callerUid).get();
  const requesterRole = requesterSnap.exists ? requesterSnap.get("role") : null;

  if (requesterRole !== "admin") {
    throw new HttpsError("permission-denied", "Solo admin puede borrar datos de colaboradores.");
  }

  const targetUid = typeof request.data?.targetUid === "string" ? request.data.targetUid.trim() : "";
  const mode = request.data?.mode === "TIME_ONLY" ? "TIME_ONLY" : "ALL";

  if (!targetUid) {
    throw new HttpsError("invalid-argument", "targetUid es requerido.");
  }

  const deleted = {
    timeEntries: 0,
    hourRequests: 0,
    extraActivities: 0,
    userHoursSubcollection: 0,
    userHourRequestsSubcollection: 0,
    userExtraActivitiesSubcollection: 0,
  };

  const deletedPaths = new Set();

  const timeRefs = await collectRefsByFields("timeEntries", targetUid, ["uid", "userId"]);
  deleted.timeEntries = await deleteRefsInBatches(timeRefs, deletedPaths, "timeEntries");

  if (mode === "ALL") {
    const hourRefs = await collectRefsByFields("hourRequests", targetUid, ["uid", "userId"]);
    deleted.hourRequests = await deleteRefsInBatches(hourRefs, deletedPaths, "hourRequests");

    const extraRefs = await collectRefsByFields("extraActivities", targetUid, ["uid", "userId"]);
    deleted.extraActivities = await deleteRefsInBatches(extraRefs, deletedPaths, "extraActivities");
  }

  const userHoursRefs = await collectRefsFromUserSubcollection(targetUid, "hours");
  deleted.userHoursSubcollection = await deleteRefsInBatches(userHoursRefs, deletedPaths, "users/{uid}/hours");

  if (mode === "ALL") {
    const userHourRequestsRefs = await collectRefsFromUserSubcollection(targetUid, "hourRequests");
    deleted.userHourRequestsSubcollection = await deleteRefsInBatches(
      userHourRequestsRefs,
      deletedPaths,
      "users/{uid}/hourRequests",
    );

    const userExtraActivitiesRefs = await collectRefsFromUserSubcollection(targetUid, "extraActivities");
    deleted.userExtraActivitiesSubcollection = await deleteRefsInBatches(
      userExtraActivitiesRefs,
      deletedPaths,
      "users/{uid}/extraActivities",
    );
  }

  logger.info("adminDeleteUserData completed", {
    callerUid,
    targetUid,
    mode,
    deleted,
  });

  return {
    ok: true,
    deleted,
  };
});
