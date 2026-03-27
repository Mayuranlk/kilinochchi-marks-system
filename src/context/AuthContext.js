import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) {
          // ── include uid so profile.uid works everywhere ──
          setProfile({ id: snap.id, uid: u.uid, ...snap.data() });
        } else {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const logout = () => signOut(auth);

  const isAdmin       = profile?.role === "admin";
  const isTeacher     = profile?.role === "teacher";

  // ── Class Teacher flags ──
  const isClassTeacher = profile?.isClassTeacher === true;
  const classGrade     = profile?.classGrade     || null;
  const classSection   = profile?.classSection   || null;

  return (
    <AuthContext.Provider value={{
      user, profile, loading, logout,
      isAdmin, isTeacher,
      isClassTeacher, classGrade, classSection,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}