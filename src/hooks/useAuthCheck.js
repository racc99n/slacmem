import { useState, useEffect } from "react";
import { useLiff } from "react-liff";
import { getSyncStatus } from "../api/syncApi"; // ฟังก์ชันเรียก API

export const useAuthCheck = () => {
  const { liff, isLoggedIn, isReady, error } = useLiff();
  // FIX 1: แก้ไขการประกาศ useState
  const [syncState, setSyncState] = useState({
    loading: true,
    synced: false,
    memberData: null,
  });

  useEffect(() => {
    // ถ้า LIFF ยังไม่พร้อม หรือยังไม่ได้ล็อกอิน ก็ไม่ต้องทำอะไรต่อ
    if (!isReady) {
      return;
    }

    if (!isLoggedIn) {
      // ถ้า LIFF พร้อมแต่ยังไม่ล็อกอิน ให้หยุด loading
      setSyncState((s) => ({ ...s, loading: false }));
      return;
    }

    const checkStatus = async () => {
      try {
        const idToken = liff.getIDToken();
        if (!idToken) {
          throw new Error("Could not get ID Token.");
        }
        const response = await getSyncStatus(idToken); // เรียก API Backend
        setSyncState({
          loading: false,
          synced: response.synced,
          // FIX 3: แก้ไข Typo จาก | | เป็น ||
          memberData: response.memberData || null,
        });
      } catch (err) {
        console.error("Auth Check Failed:", err);
        setSyncState({ loading: false, synced: false, memberData: null });
      }
    };

    checkStatus();
    // FIX 2: เพิ่ม Dependency Array ที่ถูกต้อง
  }, [isReady, isLoggedIn, liff]);

  return { ...syncState, liffError: error, liffIsLoggedIn: isLoggedIn };
};
