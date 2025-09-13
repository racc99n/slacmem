import React from "react";
import { useAuthCheck } from "./hooks/useAuthCheck";
import LoginForm from "./components/LoginForm";
import MemberCard from "./components/MemberCard";
import LoadingSpinner from "./components/LoadingSpinner";

function App() {
  const { loading, synced, memberData, liffError, liffIsLoggedIn } =
    useAuthCheck();

  if (liffError) {
    return <div>Error initializing LIFF.</div>;
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!liffIsLoggedIn) {
    // สามารถสร้างปุ่มให้ผู้ใช้กดเพื่อ liff.login()
    return <div>Please log in to LINE.</div>;
  }

  return (
    <div className="app-container">
      {synced ? <MemberCard data={memberData} /> : <LoginForm />}
    </div>
  );
}

export default App;
