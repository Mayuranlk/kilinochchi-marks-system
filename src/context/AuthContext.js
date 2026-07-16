// src/context/AuthContext.js

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

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
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);

      try {
        setUser(firebaseUser);

        if (!firebaseUser) {
          setProfile(null);
          return;
        }

        const userRef = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(userRef);

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
      } catch (error) {
        console.error("AuthContext profile load error:", error);
        setProfile(null);
      } finally {
        setLoading(false);
        setAuthReady(true);
      }
    });

    return () => unsub();
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
