"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useFlutterwave, closePaymentModal } from "flutterwave-react-v3";
import type { User } from "firebase/auth";

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
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const depositSchema = z.object({
  amount: z.coerce
    .number()
    .min(100, { message: "Deposit must be at least ₦100." }),
});

type DepositFormValues = z.infer<typeof depositSchema>;

interface DepositFormProps {
  user: User;
  onShowForm: () => void;
}

export default function DepositForm({
  user,
  onShowForm,
}: DepositFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<DepositFormValues>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      amount: 100,
    },
  });

  const amount = form.watch("amount");
  const tx_ref = `ecox-deposit-${user.uid}-${Date.now()}`;

  const flutterwaveConfig = {
    public_key: "FLWPUBK_TEST-9972db282f658db461af332dd2e2ca37-X",
    tx_ref,
    amount,
    currency: "NGN",
    payment_options: "card,banktransfer,ussd",
    redirect_url: `${window.location.origin}/payment-status`,
    customer: {
      email: user.email!,
      name: user.displayName || user.email!,
    },
    customizations: {
      title: "Ecox User Hub Deposit",
      description: "Fund your Ecox account balance.",
      logo: "https://i.imgur.com/o7gCwJ9.jpeg",
    },
  };

  const handleFlutterwavePayment = useFlutterwave(flutterwaveConfig);

  async function onSubmit(values: DepositFormValues) {
    setIsSubmitting(true);
    localStorage.setItem(`tx_amount_${tx_ref}`, String(values.amount));
    
    // Hand off to flutterwave
    handleFlutterwavePayment({
      callback: (response) => {
        closePaymentModal(); // Close the flutterwave modal
        setIsSubmitting(false);
        onShowForm(); // Close our app's deposit form view
        
        // The redirect_url will handle verification, but we can toast on failure.
        if (response.status !== "successful" && response.status !== "completed") {
            toast({
                variant: "destructive",
                title: "Payment Not Completed",
                description: "Your payment was not completed successfully.",
            });
        }
      },
      onClose: () => {
        setIsSubmitting(false);
        onShowForm();
      },
    });
  }

  return (
      <Card className="w-full max-w-2xl mx-auto shadow-lg animate-fade-in-up border">
        <CardHeader>
          <CardTitle>Deposit Funds</CardTitle>
          <CardDescription>
            Add funds to your account balance. This balance will be used to pay for account submissions.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <CardContent>
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (NGN)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="1000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex-col gap-4">
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Pay ₦{amount || 0} with Flutterwave
              </Button>
               <Button
                variant="outline"
                className="w-full"
                onClick={onShowForm}
              >
                Back to Account Form
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
  );
}
