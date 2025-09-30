"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db, auth, signOut } from "@/lib/firebase";
import AccountForm from "./AccountForm";
import SubmittedView from "./SubmittedView";
import { Loader2, LogOut, Zap } from "lucide-react";
import { Button } from "../ui/button";
import { useToast } from "@/hooks/use-toast";

interface DashboardProps {
  user: User;
}

export default function Dashboard({ user }: DashboardProps) {
  const [hasAccount, setHasAccount] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, "accounts"), where("uid", "==", user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setHasAccount(!snapshot.empty);
        setLoading(false);
      },
      (error) => {
        console.error("Error checking for account:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not check your account status.",
        });
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user, toast]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Logout Failed",
        description: error.message,
      });
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col min-h-screen p-4 sm:p-6 md:p-8">
      <header className="flex items-center justify-between py-4 px-6 bg-card/80 backdrop-blur-sm rounded-lg shadow-sm mb-8 border sticky top-4 z-10">
        <div className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold font-headline">Ecox User Hub</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {user.email}
          </span>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="h-5 w-5" />
            <span className="sr-only">Logout</span>
          </Button>
        </div>
      </header>

      <main className="flex-grow">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : hasAccount ? (
          <SubmittedView />
        ) : (
          <AccountForm user={user} />
        )}
      </main>

      <footer className="text-center py-4 text-sm text-muted-foreground mt-8">
        © {new Date().getFullYear()} Ecox. All rights reserved.
      </footer>
    </div>
  );
}
