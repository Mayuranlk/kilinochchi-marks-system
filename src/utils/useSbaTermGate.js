import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocFromServer, getDocsFromServer, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { buildSbaRoster, sbaScopeKey } from "./sbaLogic";
import { getSbaCompletion } from "./sbaCompletion";

export function useSbaTermGate({ isAdmin, settings, term, classContext, subject, assessmentId, students, enrollments }) {
  const required = !isAdmin && settings.requireSbaCompletion === true && assessmentId === "__TERM__";
  const contextReady = Boolean(term?.id && classContext && subject?.subjectId);
  const scope = contextReady ? sbaScopeKey(term, classContext) : "";
  const [loaded, setLoaded] = useState({ scope: "", records: [], error: "" });
  const roster = useMemo(() => contextReady ? buildSbaRoster({
    assignment: { ...classContext, ...subject }, term, students, enrollments,
  }).map((row) => ({ ...row, subjectId: subject.subjectId })) : [], [contextReady, classContext, subject, term, students, enrollments]);
  useEffect(() => {
    setLoaded({ scope: "", records: [], error: "" });
    if (!required || !scope) return undefined;
    return onSnapshot(query(collection(db, "sbaMarks"), where("scopeKey", "==", scope)), { includeMetadataChanges: true },
      (snapshot) => {
        if (!snapshot.metadata.fromCache) setLoaded({ scope, records: snapshot.docs.map((item) => ({ ...item.data(), id: item.id })), error: "" });
      },
      () => setLoaded({ scope, records: [], error: "Could not verify SBA completion. Refresh and try again." }));
  }, [required, scope]);
  const completion = getSbaCompletion(roster, loaded.records, term, classContext || {});
  const reason = !required ? "" : !contextReady ? "Select a term, class and subject to check SBA completion." :
    loaded.scope !== scope ? "Checking SBA completion..." : loaded.error ||
    (!completion.complete ? `Enter SBA Marks to Enable term marks entry. ${completion.pending} of ${completion.total} enrolled students still need saved SBA marks or Absent.` : "");
  async function verifyBeforeSave(rows) {
    if (isAdmin || assessmentId !== "__TERM__") return;
    const currentSettings = await getDocFromServer(doc(db, "systemSettings", "marksEntry"));
    if (currentSettings.data()?.requireSbaCompletion !== true) return;
    if (!contextReady) throw new Error("Select a valid term, class and subject before checking SBA.");
    const snapshot = await getDocsFromServer(query(collection(db, "sbaMarks"), where("scopeKey", "==", scope)));
    const records = snapshot.docs.map((item) => ({ ...item.data(), id: item.id }));
    if (!getSbaCompletion(roster, records, term, classContext).complete || !getSbaCompletion(rows, records, term, classContext).complete)
      throw new Error("Enter SBA Marks to Enable term marks entry. Save SBA marks or Absent for every enrolled student first.");
  }
  return { locked: Boolean(reason), reason, verifyBeforeSave };
}
