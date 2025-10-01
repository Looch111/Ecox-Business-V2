"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { verifyFlutterwaveTransaction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type VerificationStatus = "verifying" | "success" | "failed";

function PaymentStatusContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState<VerificationStatus>("verifying");
  const [message, setMessage] = useState("Verifying your payment...");

  useEffect(() => {
    const transaction_id = searchParams.get("transaction_id");
    const tx_ref = searchParams.get("tx_ref");
    const paymentStatus = searchParams.get("status");

    const verifyPayment = async () => {
      if (paymentStatus !== "successful" || !transaction_id || !tx_ref) {
        setStatus("failed");
        setMessage(
          "Payment was not successful or is missing required details."
        );
        return;
      }

      try {
        const uid = tx_ref.split("-")[2];
        const amount = Number(localStorage.getItem(`tx_amount_${tx_ref}`) || "0");
        localStorage.removeItem(`tx_amount_${tx_ref}`);

        if (!uid || amount === 0) {
            throw new Error("Could not retrieve transaction details. Please contact support.");
        }

        const result = await verifyFlutterwaveTransaction(
          transaction_id,
          amount,
          uid
        );

        if (result.success) {
          setStatus("success");
          setMessage(
            `Successfully added ₦${result.amount?.toLocaleString()} to your account!`
          );
          toast({
            title: "Deposit Successful!",
            description: `₦${result.amount?.toLocaleString()} has been added to your account.`,
          });
        } else {
          throw new Error(result.message || "Server-side verification failed.");
        }
      } catch (error: any) {
        setStatus("failed");
        setMessage(
          error.message ||
            "An error occurred during verification. Please contact support."
        );
        toast({
          variant: "destructive",
          title: "Verification Failed",
          description: error.message,
        });
      }
    };

    verifyPayment();
  }, [searchParams, toast]);

  const renderIcon = () => {
    switch (status) {
      case "verifying":
        return <Loader2 className="h-12 w-12 animate-spin text-primary" />;
      case "success":
        return <CheckCircle className="h-12 w-12 text-green-500" />;
      case "failed":
        return <AlertTriangle className="h-12 w-12 text-destructive" />;
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4">
      <Card className="w-full max-w-md animate-fade-in-up">
        <CardHeader className="items-center text-center">
          {renderIcon()}
          <CardTitle className="text-2xl pt-4">
            {status === "verifying" && "Processing Payment"}
            {status === "success" && "Payment Successful"}
            {status === "failed" && "Payment Failed"}
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button
            className="w-full"
            onClick={() => router.push("/")}
            disabled={status === "verifying"}
          >
            Return to Dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function PaymentStatusPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen w-full items-center justify-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
      }
    >
      <PaymentStatusContent />
    </Suspense>
  );
}
