"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db, auth, signOut } from "@/lib/firebase";
import AccountForm from "./AccountForm";
import SubmittedView from "./SubmittedView";
import { Loader2, LogOut } from "lucide-react";
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
        <svg width="42" height="43" viewBox="0 0 42 43" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M21 42.5347C32.598 42.5347 42 33.1326 42 21.5347C42 9.93669 32.598 0.534668 21 0.534668C9.40202 0.534668 0 9.93669 0 21.5347C0 33.1326 9.40202 42.5347 21 42.5347Z" fill="url(#paint0_linear_68_64)"/> <path d="M21 40.8283C31.6556 40.8283 40.2938 32.1902 40.2938 21.5345C40.2938 10.8788 31.6556 2.24072 21 2.24072C10.3443 2.24072 1.70618 10.8788 1.70618 21.5345C1.70618 32.1902 10.3443 40.8283 21 40.8283Z" fill="url(#paint1_linear_68_64)"/> <path opacity="0.3" d="M20.8579 40.379C31.1169 40.379 39.4334 32.0625 39.4334 21.8035C39.4334 11.5446 31.1169 3.22803 20.8579 3.22803C10.599 3.22803 2.28247 11.5446 2.28247 21.8035C2.28247 32.0625 10.599 40.379 20.8579 40.379Z" fill="#8EFB90"/> <path d="M20.999 40.1104C31.258 40.1104 39.5745 31.7939 39.5745 21.535C39.5745 11.276 31.258 2.95947 20.999 2.95947C10.74 2.95947 2.42352 11.276 2.42352 21.535C2.42352 31.7939 10.74 40.1104 20.999 40.1104Z" fill="url(#paint2_linear_68_64)"/> <path opacity="0.4" d="M21.4307 3.4301C31.6816 3.85665 39.6445 12.5122 39.2179 22.7631C39.061 26.5236 37.7899 29.9701 35.7458 32.8144C37.9895 29.8865 39.3954 26.2728 39.5609 22.3093C39.9874 12.0584 32.0246 3.4028 21.7737 2.97625C15.2833 2.70666 9.44122 5.80514 5.91278 10.7122C9.47022 6.07131 15.1451 3.16905 21.4307 3.4318V3.4301Z" fill="url(#paint3_linear_68_64)"/> <path opacity="0.3" d="M34.6684 28.2968C37.9579 20.4677 34.2777 11.4543 26.4486 8.1648C18.6194 4.87534 9.60603 8.55548 6.31657 16.3846C3.02711 24.2138 6.70725 33.2272 14.5364 36.5166C22.3655 39.8061 31.379 36.126 34.6684 28.2968Z" fill="#082A15"/> <path d="M35.9099 25.2946C37.9859 17.0601 32.9935 8.70182 24.759 6.62583C16.5245 4.54983 8.16627 9.54226 6.09028 17.7767C4.01429 26.0112 9.00671 34.3694 17.2412 36.4454C25.4756 38.5214 33.8339 33.529 35.9099 25.2946Z" fill="url(#paint4_linear_68_64)"/> <path d="M35.1691 22.125C34.8432 29.9513 28.2351 36.0306 20.4087 35.7047C12.5823 35.3788 6.5031 28.7706 6.82898 20.9443C7.15487 13.1179 13.763 7.03868 21.5894 7.36456C29.4158 7.69045 35.495 14.2986 35.1691 22.125Z" fill="white"/> <path opacity="0.2" d="M18.665 11.654C27.1499 12.0072 33.741 19.1716 33.3878 27.6566C33.3332 28.9738 33.0961 30.2398 32.7327 31.4461C34.862 28.9294 36.2116 25.7217 36.3601 22.1728C36.7132 13.6878 30.1222 6.52348 21.6372 6.17029C14.4711 5.87171 8.26394 10.5365 6.28986 17.102C9.25183 13.6008 13.7289 11.4476 18.665 11.6523V11.654Z" fill="#6EFBC3"/> <path opacity="0.2" d="M21.8044 33.4764C13.3194 33.1232 6.72833 25.9588 7.08152 17.4739C7.13441 16.2198 7.3511 15.0135 7.68381 13.8584C6.48264 15.9383 5.74385 18.327 5.63636 20.8948C5.28317 29.3798 11.8743 36.5441 20.3592 36.8973C27.5884 37.1993 33.8451 32.4492 35.7594 25.7916C32.9886 30.5878 27.7215 33.7255 21.8044 33.4781V33.4764Z" fill="#43D7A1"/> <path fillRule="evenodd" clipRule="evenodd" d="M24.3535 20.6203C21.7089 22.2327 19.3458 24.5958 17.2642 27.7079C20.3797 28.1481 23.5482 27.2865 26.0153 25.309C28.6258 23.2189 30.1904 20.0897 30.2962 16.7472C30.7637 21.8232 27.887 26.6176 23.1881 28.5934C18.4893 30.5692 13.0499 29.2708 9.75006 25.3858C13.4628 30.8251 20.8148 32.3505 26.3856 28.8391C31.9564 25.3277 33.753 18.0388 30.4498 12.3418C30.2826 14.5786 28.6634 15.9982 25.5973 16.6005C17.8853 18.1514 14.9284 21.8249 16.7267 27.6192C19.0933 24.0003 21.6372 21.6679 24.3535 20.6203Z" fill="url(#paint5_linear_68_64)"/> <mask id="mask0_68_64" style={{maskType:"luminance"}} maskUnits="userSpaceOnUse" x="9" y="12" width="24" height="19"> <path d="M24.3535 20.6203C21.7089 22.2327 19.3458 24.5958 17.2642 27.7079C20.3797 28.1481 23.5482 27.2865 26.0153 25.309C28.6258 23.2189 30.1904 20.0897 30.2962 16.7472C30.7637 21.8232 27.887 26.6176 23.1881 28.5934C18.4893 30.5692 13.0499 29.2708 9.75006 25.3858C13.4628 30.8251 20.8148 32.3505 26.3856 28.8391C31.9564 25.3277 33.753 18.0388 30.4498 12.3418C30.2826 14.5786 28.6634 15.9982 25.5973 16.6005C17.8853 18.1514 14.9284 21.8249 16.7267 27.6192C19.0933 24.0003 21.6372 21.6679 24.3535 20.6203Z" fill="white"/> </mask> <g mask="url(#mask0_68_64)"> <path d="M11.6018 10.0681L9.08032 30.9351L31.8631 33.688L34.3846 12.8211L11.6018 10.0681Z" fill="url(#paint6_linear_68_64)"/> </g> <path fillRule="evenodd" clipRule="evenodd" d="M9.44464 19.2705C9.42929 20.3778 10.163 21.1473 11.6457 21.5773C15.372 22.6778 16.6653 24.6126 15.529 27.3852C14.5223 25.5016 13.374 24.2424 12.0824 23.6094C13.3126 24.5188 14.3722 25.7831 15.2611 27.4057C13.7102 27.4859 12.1882 26.9228 11.0604 25.8428C9.37981 24.2339 8.92425 21.4749 9.44464 19.2705Z" fill="url(#paint7_linear_68_64)"/> <mask id="mask1_68_64" style={{maskType:"luminance"}} maskUnits="userSpaceOnUse" x="9" y="19" width="7" height="9"> <path d="M9.44464 19.2705C9.42929 20.3778 10.163 21.1473 11.6457 21.5773C15.372 22.6778 16.6653 24.6126 15.529 27.3852C14.5223 25.5016 13.374 24.2424 12.0824 23.6094C13.3126 24.5188 14.3722 25.7831 15.2611 27.4057C13.7102 27.4859 12.1882 26.9228 11.0604 25.8428C9.37981 24.2339 8.92425 21.4749 9.44464 19.2705Z" fill="white"/> </mask> <g mask="url(#mask1_68_64)"> <path d="M9.19237 19.2424L8.27539 26.8311L16.2807 27.7984L17.1977 20.2098L9.19237 19.2424Z" fill="url(#paint8_linear_68_64)"/> </g> <path fillRule="evenodd" clipRule="evenodd" d="M14.8294 15.0479C14.408 15.7389 14.5837 16.4947 15.3566 17.3171C17.2897 19.3936 17.3853 21.0929 15.6381 22.4118C15.7064 20.8524 15.4505 19.6341 14.8755 18.7554C15.3105 19.7843 15.5068 20.9735 15.4624 22.3248C14.4574 21.7993 13.7101 20.8797 13.4013 19.7809C12.944 18.1446 13.6811 16.2405 14.8294 15.0479Z" fill="url(#paint9_linear_68_64)"/> <mask id="mask2_68_64" style={{maskType:"luminance"}} maskUnits="userSpaceOnUse" x="13" y="15" width="4" height="8"> <path d="M14.8294 15.0479C14.408 15.7389 14.5837 16.4947 15.3566 17.3171C17.2897 19.3936 17.3853 21.0929 15.6381 22.4118C15.7064 20.8524 15.4505 19.6341 14.8755 18.7554C15.3105 19.7843 15.5068 20.9735 15.4624 22.3248C14.4574 21.7993 13.7101 20.8797 13.4013 19.7809C12.944 18.1446 13.6811 16.2405 14.8294 15.0479Z" fill="white"/> </mask> <g mask="url(#mask2_68_64)"> <path d="M13.3409 14.869L12.4755 22.0308L17.2031 22.602L18.0685 15.4403L13.3409 14.869Z" fill="url(#paint10_linear_68_64)"/> </g> <defs> <linearGradient id="paint0_linear_68_64" x1="-1.49585" y1="29.4259" x2="38.0824" y2="15.5431" gradientUnits="userSpaceOnUse"> <stop stopColor="#8DFBC2"/> <stop offset="0.23" stopColor="#5EC845"/> <stop offset="0.67" stopColor="#4EFB7C"/> <stop offset="1" stopColor="#5EFB33"/> </linearGradient> <linearGradient id="paint1_linear_68_64" x1="-0.418506" y1="23.607" x2="42.86" y2="19.4181" gradientUnits="userSpaceOnUse"> <stop stopColor="#8DFBC2"/> <stop offset="0.23" stopColor="#5EC845"/> <stop offset="0.67" stopColor="#4EFB7C"/> <stop offset="1" stopColor="#5EFB33"/> </linearGradient> <linearGradient id="paint2_linear_68_64" x1="8.72033" y1="35.4799" x2="34.9355" y2="5.70383" gradientUnits="userSpaceOnUse"> <stop offset="0.26" stopColor="#19AD26"/> <stop offset="1" stopColor="#5EFB33"/> </linearGradient> <linearGradient id="paint3_linear_68_64" x1="5.91107" y1="17.8851" x2="39.5745" y2="17.8851" gradientUnits="userSpaceOnUse"> <stop offset="0.26" stopColor="#19AD26"/> <stop offset="1" stopColor="#5EFB33"/> </linearGradient> <linearGradient id="paint4_linear_68_64" x1="18.3226" y1="31.4173" x2="24.9648" y2="6.89915" gradientUnits="userSpaceOnUse"> <stop stopColor="#8DFBC2"/> <stop offset="0.23" stopColor="#5EC845"/> <stop offset="0.67" stopColor="#4EFB7C"/> <stop offset="1" stopColor="#5EFB33"/> </linearGradient> <linearGradient id="paint5_linear_68_64" x1="31.9871" y1="2.90988" x2="-3.18469" y2="68.3105" gradientUnits="userSpaceOnUse"> <stop stopColor="#8DFBC2"/> <stop offset="0.23" stopColor="#5EC845"/> <stop offset="0.67" stopColor="#4EFB7C"/> <stop offset="1" stopColor="#5EFB33"/> </linearGradient> <linearGradient id="paint6_linear_68_64" x1="31.9454" y1="2.88802" x2="-3.22639" y2="68.287" gradientUnits="userSpaceOnUse"> <stop stopColor="#8DFBC2"/> <stop offset="0.23" stopColor="#5EC845"/> <stop offset="0.67" stopColor="#4EFB7C"/> <stop offset="1" stopColor="#5EFB33"/> </linearGradient> <linearGradient id="paint7_linear_68_64" x1="25.3789" y1="-0.644343" x2="-9.79284" y2="64.7546" gradientUnits="userSpaceOnUse"> <stop stopColor="#8DFBC2"/> <stop offset="0.23" stopColor="#5EC845"/> <stop offset="0.67" stopColor="#4EFB7C"/> <stop offset="1" stopColor="#5EFB33"/> </linearGradient> <linearGradient id="paint8_linear_68_64" x1="25.6531" y1="-0.495995" x2="-9.51865" y2="64.9029" gradientUnits="userSpaceOnUse"> <stop stopColor="#8DFBC2"/> <stop offset="0.23" stopColor="#5EC845"/> <stop offset="0.67" stopColor="#4EFB7C"/> <stop offset="1" stopColor="#5EFB33"/> </linearGradient> <linearGradient id="paint9_linear_68_64" x1="25.6536" y1="-0.495697" x2="-9.51818" y2="64.9032" gradientUnits="userSpaceOnUse"> <stop stopColor="#8DFBC2"/> <stop offset="0.23" stopColor="#5EC845"/> <stop offset="0.67" stopColor="#4EFB7C"/> <stop offset="1" stopColor="#5EFB33"/> </linearGradient> <linearGradient id="paint10_linear_68_64" x1="25.6246" y1="-0.512004" x2="-9.54718" y2="64.8869" gradientUnits="userSpaceOnUse"> <stop stopColor="#8DFBC2"/> <stop offset="0.23" stopColor="#5EC845"/> <stop offset="0.67" stopColor="#4EFB7C"/> <stop offset="1" stopColor="#5EFB33"/> </linearGradient> </defs> </svg>
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
