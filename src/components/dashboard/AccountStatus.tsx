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
  onAddNew: () => void;
}

export default function AccountStatus({ account, onAddNew }: AccountStatusProps) {
  return (
    <div className="flex items-start justify-center pt-10 animate-fade-in-up">
      <Card className="w-full max-w-2xl shadow-lg border">
        <CardHeader>
          <CardTitle>Your Submission is Processing</CardTitle>
          <CardDescription>
            We have received your account details and are currently processing
            your request. You can see the details of your submission below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-center p-4 bg-secondary/30 rounded-lg">
            <Loader2 className="mr-3 h-5 w-5 animate-spin text-primary" />
            <span className="font-medium text-primary">
              Status: Processing
            </span>
          </div>

          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" /> Account Name
              </span>
              <span className="font-medium">{account.name}</span>
            </div>
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
          </div>
          <p className="text-xs text-muted-foreground text-center pt-4">
            No further action is needed from you at this time. This status will
            update automatically. Submitting another account will overwrite this one.
          </p>
        </CardContent>
        <CardFooter>
          <Button onClick={onAddNew} className="w-full">
            <PlusCircle className="mr-2 h-4 w-4" />
            Submit Another Account
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
