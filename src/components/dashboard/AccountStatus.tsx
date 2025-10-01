"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, User, Target, Hash, PlusCircle } from "lucide-react";
import { DocumentData } from "firebase/firestore";

interface AccountStatusProps {
  account: DocumentData;
}

export default function AccountStatus({ account }: AccountStatusProps) {
  return (
    <div className="animate-fade-in-up">
      <Card className="w-full shadow-lg border">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">{account.name}</CardTitle>
            <div className="flex items-center p-2 bg-secondary/30 rounded-lg text-xs">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
              <span className="font-medium text-primary">
                Processing
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <Hash className="h-4 w-4" /> Initial Followers
              </span>
              <span className="font-medium">{account.initialFollowers}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4" /> Follower Target
              </span>
              <span className="font-medium text-green-400">
                {account.followerTarget}
              </span>
            </div>
          <p className="text-xs text-muted-foreground text-center pt-2">
            This status will update automatically. Submitting another account will not affect this one.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
