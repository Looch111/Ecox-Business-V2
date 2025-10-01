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

interface KiwiGuideProps {
  onNext: () => void;
}

export default function KiwiGuide({ onNext }: KiwiGuideProps) {
  return (
    <div className="flex items-start justify-center pt-10 animate-fade-in-up">
      <Card className="w-full max-w-2xl shadow-lg border">
        <CardHeader>
          <CardTitle>Important: Use Kiwi Browser</CardTitle>
          <CardDescription>
            Please follow this guide for a smooth experience.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="prose dark:prose-invert max-w-none text-sm text-muted-foreground space-y-4">
            <p>
              To get your bearer token, it is crucial that you use the{" "}
              <a
                href="https://play.google.com/store/apps/details?id=com.kiwibrowser.browser"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Kiwi Browser
              </a>{" "}
              on an Android device. This browser allows you to use desktop developer tools.
            </p>
            <h3 className="text-foreground font-semibold">Critical Reminder</h3>
            <ul className="list-disc list-outside space-y-2 pl-4">
              <li>
                Log into your Ecox account within the Kiwi Browser.
              </li>
              <li>
                <span className="font-bold text-destructive">Do not log out</span> of your Ecox account from the Kiwi browser at any point during this process.
              </li>
              <li>
                You must complete all steps, from getting the token to submitting the form, in the same session.
              </li>
            </ul>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={onNext}>
            I Understand, Continue
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
