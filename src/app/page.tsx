"use client";

import { Suspense, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import AuthForm from "@/components/auth/AuthForm";
import Dashboard from "@/components/dashboard/Dashboard";
import { Loader2 } from "lucide-react";

function HomePageContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main>
      {!user ? (
        <div className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 md:p-8">
          <AuthForm />
        </div>
      ) : (
        <Dashboard user={user} />
      )}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomePageContent />
    </Suspense>
  );
}
