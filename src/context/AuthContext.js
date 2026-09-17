// src/context/AuthContext.js

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, getDocFromCache } from "firebase/firestore";
import { auth, db } from "../firebase";
import { clearFirestoreReadCache } from "../services/firestoreReadCache";

const AuthContext = createContext(null);

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

function parseAssignedGrades(profile = {}) {
  const source =
    profile.assignedGrades ||
    profile.sectionalHeadGrades ||
    profile.grades ||
    profile.assignedGrade ||
    profile.sectionalHeadGrade ||
    [];
  const rawValues = Array.isArray(source) ? source : [source];

  return [
    ...new Set(
      rawValues
        .map((value) => Number(String(value ?? "").match(/\d+/)?.[0] || 0))
        .filter(Boolean)
    ),
  ].sort((a, b) => a - b);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let callbackVersion = 0;
    let lastUid;
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      const version = ++callbackVersion;
      setLoading(true);

      try {
        const nextUid = firebaseUser?.uid || null;
        if (lastUid !== nextUid) {
          clearFirestoreReadCache();
          lastUid = nextUid;
        }
        setUser(firebaseUser);

        if (!firebaseUser) {
          setProfile(null);
          return;
        }

        const userRef = doc(db, "users", firebaseUser.uid);
        // Render from the already-persisted profile immediately when possible,
        // then revalidate in the background. A cache miss still uses the server
        // before protected routes are shown.
        let snap;
        let loadedFromCache = true;
        try {
          snap = await getDocFromCache(userRef);
        } catch {
          loadedFromCache = false;
          snap = await getDoc(userRef);
        }
        if (version !== callbackVersion) return;

        if (snap.exists()) {
          setProfile({
            id: snap.id,
            uid: firebaseUser.uid,
            email: firebaseUser.email || "",
            ...snap.data(),
          });
        } else {
          setProfile({
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            email: firebaseUser.email || "",
            role: null,
          });
        }

        setLoading(false);
        setAuthReady(true);

        // Cached roles only affect navigation; Firestore Rules remain the
        // authority. Refresh the profile without putting the whole app back
        // behind the startup loader.
        if (loadedFromCache) {
          getDoc(userRef)
            .then((freshSnap) => {
              if (version !== callbackVersion) return;
              if (!freshSnap.exists()) return;
              setProfile({
                id: freshSnap.id,
                uid: firebaseUser.uid,
                email: firebaseUser.email || "",
                ...freshSnap.data(),
              });
            })
            .catch((error) => console.error("AuthContext profile refresh error:", error));
        }
      } catch (error) {
        console.error("AuthContext profile load error:", error);
        if (version === callbackVersion) setProfile(null);
      } finally {
        if (version === callbackVersion) {
          setLoading(false);
          setAuthReady(true);
        }
      }
    });

    return () => {
      callbackVersion += 1;
      unsub();
    };
  }, []);

  const logout = () => signOut(auth);

  const value = useMemo(() => {
    const role = normalizeRole(profile?.role);
    const hasITTeacherCapability =
      role === "it_teacher" ||
      profile?.isITTeacher === true ||
      profile?.canAccessAllReports === true;
    const hasSectionalHeadCapability =
      role === "sectional_head" || profile?.isSectionalHead === true;
    const hasSubjectTeacherCapability =
      role === "teacher" || hasITTeacherCapability || profile?.isSubjectTeacher === true;
    const assignedGrades = parseAssignedGrades(profile || {});
    const isAdmin = role === "admin";
    const isAccount = role === "account";
    const isPrefect = role === "prefect" || profile?.isPrefect === true;
    const canAccessAllReports = isAdmin || hasITTeacherCapability;

    return {
      user,
      profile,
      loading,
      authReady,
      logout,

      role,
      isAdmin,
      isAccount,
      isPrefect,
      isTeacher: hasSubjectTeacherCapability,
      isSubjectTeacher: hasSubjectTeacherCapability,
      isITTeacher: hasITTeacherCapability,
      isSectionalHead: hasSectionalHeadCapability,
      canAccessAllReports,
      assignedGrades,

      isClassTeacher: profile?.isClassTeacher === true,
      classGrade: profile?.classGrade || null,
      classSection: profile?.classSection || null,
    };
  }, [user, profile, loading, authReady]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
