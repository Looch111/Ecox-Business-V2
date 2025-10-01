"use client";

import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

interface TokenGuideProps {
  onNext: () => void;
}

const steps = [
  {
    title: "Step 1: Open Developer Tools",
    description:
      "On the Ecox website, right-click anywhere on the page and select 'Inspect' to open the developer tools. Then, navigate to the 'Network' tab.",
    imageId: "token-guide-step1",
  },
  {
    title: "Step 2: Find the API Request",
    description:
      "With the Network tab open, perform an action on the site (like refreshing the page or clicking your profile). Look for a request to 'api.ecox.network'. Select it.",
    imageId: "token-guide-step2",
  },
  {
    title: "Step 3: Locate the Bearer Token",
    description:
      "In the 'Headers' tab for the selected request, scroll down to the 'Request Headers' section. Find the 'Authorization' header. The value starting with 'Bearer ' is your token.",
    imageId: "token-guide-step3",
  },
  {
    title: "Step 4: Copy the Token",
    description:
      "Carefully copy the entire token string, without the word 'Bearer ' at the beginning. You will need to paste this into the form on the next page.",
    imageId: "token-guide-step4",
  },
];

export default function TokenGuide({ onNext }: TokenGuideProps) {
  return (
    <div className="flex items-start justify-center pt-10 animate-fade-in-up">
      <Card className="w-full max-w-2xl shadow-lg border">
        <CardHeader>
          <CardTitle>How to Get Your Bearer Token</CardTitle>
          <CardDescription>
            Follow these steps to find the required token from your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Carousel className="w-full">
            <CarouselContent>
              {steps.map((step, index) => {
                const imageData = PlaceHolderImages.find(
                  (img) => img.id === step.imageId
                );
                return (
                  <CarouselItem key={index}>
                    <div className="p-1">
                      <div className="flex flex-col items-center justify-center gap-4 text-center">
                        <div className="w-full aspect-video bg-muted rounded-lg overflow-hidden relative">
                          {imageData && (
                             <Image
                               src={imageData.imageUrl}
                               alt={step.title}
                               fill
                               className="object-cover"
                               data-ai-hint={imageData.imageHint}
                             />
                          )}
                        </div>
                        <div className="space-y-2">
                           <h3 className="font-semibold text-lg text-foreground">
                            {step.title}
                           </h3>
                           <p className="text-sm text-muted-foreground">
                            {step.description}
                           </p>
                        </div>
                      </div>
                    </div>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            <CarouselPrevious className="ml-12" />
            <CarouselNext className="mr-12" />
          </Carousel>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={onNext}>I Have My Token, Continue</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
