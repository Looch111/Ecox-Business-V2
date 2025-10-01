"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Target, Hash, CheckCircle } from "lucide-react";
import { DocumentData } from "firebase/firestore";

interface AccountStatusProps {
  account: DocumentData;
}

export default function AccountStatus({ account }: AccountStatusProps) {
  const isCompleted = account.status === 'done';

  return (
    <div className="animate-fade-in-up">
      <Card className="w-full shadow-lg border">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">{account.name}</CardTitle>
            {isCompleted ? (
              <div className="flex items-center p-2 bg-green-500/10 rounded-lg text-xs">
                <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                <span className="font-medium text-green-500">
                  Completed
                </span>
              </div>
            ) : (
              <div className="flex items-center p-2 bg-secondary/30 rounded-lg text-xs">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
                <span className="font-medium text-primary">
                  Processing
                </span>
              </div>
            )}
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
            {isCompleted 
              ? "This task has been completed successfully."
              : "This status will update automatically. Submitting another account will not affect this one."
            }
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
