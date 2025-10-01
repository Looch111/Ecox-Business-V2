"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useFlutterwave, closePaymentModal } from "flutterwave-react-v3";
import type { User } from "firebase/auth";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { verifyFlutterwaveTransaction } from "@/app/actions";

const depositSchema = z.object({
  amount: z.coerce
    .number()
    .min(100, { message: "Deposit must be at least ₦100." }),
});

type DepositFormValues = z.infer<typeof depositSchema>;

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

export default function DepositModal({
  isOpen,
  onClose,
  user,
}: DepositModalProps) {
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

    // Manually construct the URL
    const paymentUrl = new URL('https://checkout.flutterwave.com/v3/hosted/pay');
    const params = {
      public_key: flutterwaveConfig.public_key,
      tx_ref: flutterwaveConfig.tx_ref,
      amount: String(flutterwaveConfig.amount),
      currency: flutterwaveConfig.currency,
      payment_options: flutterwaveConfig.payment_options,
      redirect_url: flutterwaveConfig.redirect_url,
      'customer[email]': flutterwaveConfig.customer.email,
      'customer[name]': flutterwaveConfig.customer.name,
      'customizations[title]': flutterwaveConfig.customizations.title,
      'customizations[description]': flutterwaveConfig.customizations.description,
      'customizations[logo]': flutterwaveConfig.customizations.logo,
    };
    
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        paymentUrl.searchParams.set(key, value);
      }
    }
    
    // Open in a new tab
    window.open(paymentUrl.toString(), '_blank');

    onClose();
    setIsSubmitting(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] max-w-lg rounded-lg px-6">
        <DialogHeader>
          <DialogTitle>Deposit Funds</DialogTitle>
          <DialogDescription>
            Add funds to your account balance. This balance will be used to pay for account submissions.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
            <DialogFooter>
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
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
