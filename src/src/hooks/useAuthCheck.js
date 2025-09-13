import { useState, useEffect } from 'react';
import { useLiff } from 'react-liff';
import { getSyncStatus } from '../api/syncApi'; // ฟังก์ชันเรียก API

export const useAuthCheck = () => {
  const { liff, isLoggedIn, isReady, error } = useLiff();
  const = useState({
    loading: true,
    synced: false,
    memberData: null,
  });

  useEffect(() => {
    if (!isReady ||!isLoggedIn) {
      if (isReady &&!isLoggedIn) {
        // ถ้า LIFF พร้อมแต่ยังไม่ล็อกอิน ให้แสดงหน้าให้ล็อกอิน
        setSyncState(s => ({...s, loading: false }));
      }
      return;
    }

    const checkStatus = async () => {
      try {
        const idToken = liff.getIDToken();
        if (!idToken) {
          throw new Error('Could not get ID Token.');
        }
        const response = await getSyncStatus(idToken); // เรียก API Backend
        setSyncState({
          loading: false,
          synced: response.synced,
          memberData: response.memberData |

| null,
        });
      } catch (err) {
        console.error('Auth Check Failed:', err);
        setSyncState({ loading: false, synced: false, memberData: null });
      }
    };

    checkStatus();
  },);

  return {...syncState, liffError: error, liffIsLoggedIn: isLoggedIn };
};