"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Target, Hash, CheckCircle, TrendingUp } from "lucide-react";
import { DocumentData } from "firebase/firestore";
import { Progress } from "@/components/ui/progress";

interface AccountStatusProps {
  account: DocumentData;
}

export default function AccountStatus({ account }: AccountStatusProps) {
  const isCompleted = account.status === 'done';
  const initialFollowers = account.initialFollowers || 0;
  const followerTarget = account.followerTarget || 0;
  const netGained = account.netFollowBacks || 0;
  
  const goal = followerTarget - initialFollowers;
  const progress = goal > 0 ? Math.min((netGained / goal) * 100, 100) : 0;

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
        <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <Hash className="h-4 w-4" /> Initial Followers
              </span>
              <span className="font-medium">{initialFollowers}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4" /> Follower Target
              </span>
              <span className="font-medium text-green-400">
                {followerTarget}
              </span>
            </div>

            {!isCompleted && goal > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                   <span className="text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Net Gain
                  </span>
                  <span className="font-medium">{netGained} / {goal} Followers</span>
                </div>
                <Progress value={progress} className="h-2"/>
              </div>
            )}

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
