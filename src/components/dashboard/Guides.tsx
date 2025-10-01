"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import KiwiGuide from "./KiwiGuide";
import TokenGuide from "./TokenGuide";

interface GuideSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KiwiGuideSheet({ open, onOpenChange }: GuideSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-2xl sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Important: Use Kiwi Browser</SheetTitle>
          <SheetDescription>
            Please follow this guide for a smooth experience.
          </SheetDescription>
        </SheetHeader>
        <div className="py-4">
          <KiwiGuide onNext={() => onOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function TokenGuideSheet({ open, onOpenChange }: GuideSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-2xl sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>How to Get Your Bearer Token</SheetTitle>
          <SheetDescription>
            Watch the video below to find the required token from your account.
          </SheetDescription>
        </SheetHeader>
        <div className="py-4">
          <TokenGuide onNext={() => onOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
