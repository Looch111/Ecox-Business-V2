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
import { addFundsToAccount } from "@/app/actions";

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

  const flutterwaveConfig = {
    public_key: "FLWPUBK_TEST-9972db282f658db461af332dd2e2ca37-X",
    tx_ref: `ecox-deposit-${user.uid}-${Date.now()}`,
    amount,
    currency: "NGN",
    payment_options: "card,banktransfer,ussd",
    customer: {
      email: user.email!,
      name: user.displayName || user.email!,
    },
    customizations: {
      title: "Ecox User Hub Deposit",
      description: "Fund your Ecox account balance.",
      logo: "https://i.imgur.com/h52p32L.png",
    },
  };

  const handleFlutterwavePayment = useFlutterwave(flutterwaveConfig);

  async function onSubmit(values: DepositFormValues) {
    setIsSubmitting(true);
    handleFlutterwavePayment({
      callback: async (response) => {
        if (response.status === "successful") {
          try {
            await addFundsToAccount(user.uid, values.amount);
            toast({
              title: "Deposit Successful!",
              description: `₦${values.amount} has been added to your account.`,
            });
            onClose();
            form.reset();
          } catch (error: any) {
            toast({
              variant: "destructive",
              title: "Update Failed",
              description: error.message,
            });
          }
        } else {
          toast({
            variant: "destructive",
            title: "Payment Failed",
            description: "Your payment was not successful. Please try again.",
          });
        }
        closePaymentModal();
        setIsSubmitting(false);
      },
      onClose: () => {
        setIsSubmitting(false);
      },
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] px-6">
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
