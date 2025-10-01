"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useFlutterwave, closePaymentModal } from "flutterwave-react-v3";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import type { User } from "firebase/auth";
import type { DocumentData } from "firebase/firestore";
import { addFundsToAccount } from "@/app/actions";
import { useRouter, useSearchParams } from "next/navigation";

const depositFormSchema = z.object({
  amount: z.coerce.number().min(100, {
    message: "Minimum deposit is ₦100.",
  }),
});

type DepositFormValues = z.infer<typeof depositFormSchema>;

interface DepositFormProps {
  account: DocumentData;
  user: User;
}

export default function DepositForm({ account, user }: DepositFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const form = useForm<DepositFormValues>({
    resolver: zodResolver(depositFormSchema),
    defaultValues: {
      amount: 100,
    },
  });

  const amount = form.watch("amount");

  const flutterwaveConfig = {
    public_key: "FLWPUBK-c48c48a76b32c630f9a2637f64d08432-X",
    tx_ref: `${account.name}-deposit-${Date.now()}`,
    amount,
    currency: "NGN",
    payment_options: "card,banktransfer,ussd",
    customer: {
      email: user.email!,
      name: account.name,
    },
    customizations: {
      title: "Fund Your Ecox Account",
      description: `Deposit for ${account.name}`,
    },
    redirect_url: `${window.location.origin}${window.location.pathname}?deposit=complete`,
  };

  const handleFlutterwavePayment = useFlutterwave(flutterwaveConfig);

  useEffect(() => {
    const paymentStatus = searchParams.get("status");

    if (paymentStatus === "successful") {
      const txRef = searchParams.get("tx_ref");
      const transactionAmount = localStorage.getItem(txRef || "");

      if (transactionAmount) {
        const handleFundUpdate = async () => {
          setIsSubmitting(true);
          try {
            await addFundsToAccount({
              accountId: account.id,
              amount: Number(transactionAmount),
            });
            toast({
              title: "Deposit Successful!",
              description: `₦${transactionAmount} has been added to your account.`,
            });
            localStorage.removeItem(txRef!);
          } catch (error: any) {
            toast({
              variant: "destructive",
              title: "Funding Failed",
              description:
                error.message ||
                "There was an issue updating your balance. Please contact support.",
            });
          } finally {
            setIsSubmitting(false);
            router.replace(window.location.pathname);
          }
        };

        handleFundUpdate();
      }
    }
  }, [searchParams, account.id, router, toast]);

  function onSubmit(values: DepositFormValues) {
    // Store amount in local storage before redirecting
    localStorage.setItem(flutterwaveConfig.tx_ref, String(values.amount));

    handleFlutterwavePayment({
      callback: () => {}, // Callback is handled by redirect
      onClose: () => {},
    });
  }

  return (
    <Card className="w-full max-w-md shadow-lg border">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle>Fund Your Account</CardTitle>
            <CardDescription>
              Add money to your balance to be used for services.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (NGN)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="100" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                `Deposit ₦${amount || 0}`
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
