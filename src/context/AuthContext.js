// src/context/AuthContext.js

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext(null);

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
    const role = profile?.role || null;

    return {
      user,
      profile,
      loading,
      authReady,
      logout,

      role,
      isAdmin: role === "admin",
      isTeacher: role === "teacher",

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