"use client";

import { CheckCircle2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SubmittedView() {
  return (
    <div className="flex items-start justify-center pt-10 animate-fade-in-up">
      <Card className="w-full max-w-md text-center shadow-lg transition-all hover:shadow-xl border">
        <CardHeader>
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
            <CheckCircle2 className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="mt-4 !text-2xl">Submission Complete</CardTitle>
          <CardDescription>Thank you for your submission.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 pb-8">
          <p className="text-lg font-medium text-foreground">
            You have already submitted your account details.
          </p>
          <p className="text-muted-foreground text-sm">
            We are processing your account. If you need to make changes, please
            contact support.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
