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
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { Label } from "../ui/label";
import { type User } from "firebase/auth";
import { agreeToTerms } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface InstructionsProps {
  user: User;
  onNext: () => void;
}

export default function Instructions({ user, onNext }: InstructionsProps) {
  const [agreed, setAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleAgreeAndContinue = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to agree to the terms.",
      });
      return;
    }
    setIsLoading(true);
    try {
      await agreeToTerms(user.uid);
      onNext();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.message || "Could not save your agreement. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-start justify-center pt-10 animate-fade-in-up">
      <Card className="w-full max-w-2xl shadow-lg border">
        <CardHeader>
          <CardTitle>Welcome to Ecox User Hub</CardTitle>
          <CardDescription>
            Please read the following instructions carefully before proceeding.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="prose dark:prose-invert max-w-none text-sm text-muted-foreground space-y-4">
            <p>
              This platform is designed to help you grow your Ecox account by
              automating certain interactions. To use this service, you will
              need to provide a bearer token from your Ecox account.
            </p>
            <h3 className="text-foreground font-semibold">Terms of Service</h3>
            <ul className="list-disc list-outside space-y-2 pl-4">
              <li>
                You agree not to misuse the service or use it for any illegal
                activities.
              </li>
              <li>
                We are not responsible for any actions taken on your account.
                Use of this service is at your own risk.
              </li>
              <li>
                Your bearer token is sensitive information. We store it securely,
                but you should understand the risks of sharing it.
              </li>
              <li>
                The service will perform automated actions on your behalf, such
                as following and unfollowing other users.
              </li>
              <li>
                There will be no refunds for any payments made for this service.
              </li>
            </ul>
          </div>
          <div className="flex items-center space-x-2 mt-6">
            <Checkbox
              id="terms"
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked as boolean)}
            />
            <Label
              htmlFor="terms"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I have read and agree to the terms and conditions.
            </Label>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleAgreeAndContinue}
            disabled={!agreed || isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Agree & Continue
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
