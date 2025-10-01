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

interface TokenGuideProps {
  onNext: () => void;
}

export default function TokenGuide({ onNext }: TokenGuideProps) {
  return (
    <div className="flex items-start justify-center pt-10 animate-fade-in-up">
      <Card className="w-full max-w-2xl shadow-lg border">
        <CardHeader>
          <CardTitle>How to Get Your Bearer Token</CardTitle>
          <CardDescription>
            Watch the video below to find the required token from your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full aspect-video bg-muted rounded-lg overflow-hidden relative">
            <video
              className="w-full h-full object-cover"
              src="https://www.w3schools.com/html/mov_bbb.mp4"
              controls
              autoPlay
              muted
              loop
            >
              Your browser does not support the video tag.
            </video>
          </div>
           <div className="prose dark:prose-invert max-w-none text-sm text-muted-foreground space-y-2 mt-4">
              <p>
                The video above demonstrates how to find your bearer token using your browser's developer tools. 
                You will need to copy this token and paste it into the form on the next page.
              </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={onNext}>I Have My Token, Continue</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
