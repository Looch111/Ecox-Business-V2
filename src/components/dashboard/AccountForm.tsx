"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { addAccount, getInitialFollowers } from "@/app/actions";
import { Switch } from "../ui/switch";
import { useFlutterwave, closePaymentModal } from "flutterwave-react-v3";
import { useRouter, useSearchParams } from "next/navigation";

const accountFormSchema = z.object({
  name: z.string().min(2, {
    message: "Account name must be at least 2 characters.",
  }),
  bearerToken: z.string().min(10, {
    message: "Please enter a valid bearer token.",
  }),
  additionalFollowers: z.coerce
    .number()
    .min(0, { message: "Must be a positive number" })
    .default(1),
  followerTarget: z.coerce
    .number()
    .min(0, { message: "Must be a positive number" })
    .default(1),
  enableFollowBackGoal: z.boolean().default(true),
  initialFollowers: z.number().min(0).default(0),
});

type AccountFormValues = z.infer<typeof accountFormSchema>;

interface AccountFormProps {
  user: User;
}

const NAIRA_PER_FOLLOWER = 2.6;

export default function AccountForm({ user }: AccountFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingFollowers, setIsFetchingFollowers] = useState(false);
  const [paymentSuccessful, setPaymentSuccessful] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      name: "",
      bearerToken: "",
      additionalFollowers: 1,
      followerTarget: 1,
      enableFollowBackGoal: true,
      initialFollowers: 0,
    },
  });

  const bearerTokenValue = useWatch({
    control: form.control,
    name: "bearerToken",
  });
  const initialFollowers = useWatch({
    control: form.control,
    name: "initialFollowers",
  });
  const additionalFollowers = useWatch({
    control: form.control,
    name: "additionalFollowers",
  });

  useEffect(() => {
    if (searchParams.get("status") === "successful") {
      setPaymentSuccessful(true);
      toast({
        title: "Payment Confirmed!",
        description: "You can now submit your account details.",
      });
      // Clean the URL
      router.replace("/");
    }
  }, [searchParams, router, toast]);

  const paymentAmount = Number(additionalFollowers) * NAIRA_PER_FOLLOWER;

  const flutterwaveConfig = {
    public_key: "FLWPUBK_TEST-9972db282f658db461af332dd2e2ca37-X",
    tx_ref: `ecox-${Date.now()}-${user.uid}`,
    amount: paymentAmount,
    currency: "NGN",
    payment_options: "card,mobilemoney,ussd",
    redirect_url: `${window.location.origin}/?payment=complete`,
    customer: {
      email: user.email!,
      name: form.getValues("name") || "Ecox User",
    },
    customizations: {
      title: "Ecox Follower Growth",
      description: `Payment for ${additionalFollowers} additional followers`,
      logo: "https://i.imgur.com/ofWHc95.png",
    },
  };

  const handleFlutterwavePayment = useFlutterwave(flutterwaveConfig);

  useEffect(() => {
    const newFollowerTarget =
      Number(initialFollowers || 0) + Number(additionalFollowers || 0);
    form.setValue("followerTarget", newFollowerTarget);
  }, [initialFollowers, additionalFollowers, form]);

  useEffect(() => {
    const fetchFollowers = async () => {
      if (bearerTokenValue && bearerTokenValue.length >= 10) {
        setIsFetchingFollowers(true);
        try {
          const { count } = await getInitialFollowers(bearerTokenValue);
          form.setValue("initialFollowers", count, { shouldValidate: true });
          toast({
            title: "Followers Fetched",
            description: `Initial follower count set to ${count}.`,
          });
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: "Failed to Fetch Followers",
            description: error.message,
          });
          form.setValue("initialFollowers", 0);
        } finally {
          setIsFetchingFollowers(false);
        }
      }
    };

    const timeoutId = setTimeout(fetchFollowers, 500);
    return () => clearTimeout(timeoutId);
  }, [bearerTokenValue, form, toast]);

  async function onSubmit(values: AccountFormValues) {
    setIsSubmitting(true);
    try {
      await addAccount({
        ...values,
        uid: user.uid,
      });
      toast({
        title: "Account Submitted!",
        description: "Your account details have been saved successfully.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: error.message || "An unexpected error occurred.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg animate-fade-in-up border">
      <CardHeader>
        <CardTitle>Add Your Account</CardTitle>
        <CardDescription>
          Fill in your account details, complete payment, and then submit.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., My Awesome Brand" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bearerToken"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bearer Token</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type="password"
                        placeholder="Enter your secret token"
                        {...field}
                      />
                      {isFetchingFollowers && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                      )}
                    </div>
                  </FormControl>
                  <FormDescription>
                    Your token is stored securely and is never shared.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="additionalFollowers"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Followers Target</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="1" {...field} />
                  </FormControl>
                  <FormDescription>
                    Your current follower count is {initialFollowers}. Your new
                    target will be {form.getValues("followerTarget")}. Amount: ₦
                    {paymentAmount.toFixed(2)}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="enableFollowBackGoal"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Enable Follow Back Goal
                    </FormLabel>
                    <FormDescription>
                      This is enabled by default and cannot be changed.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled
                      aria-readonly
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex-col sm:flex-row gap-4">
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => {
                if (!form.getValues("name")) {
                  toast({
                    variant: "destructive",
                    title: "Missing Information",
                    description: "Please enter your Account Name before paying.",
                  });
                  return;
                }
                 if (paymentAmount <= 0) {
                  toast({
                    variant: "destructive",
                    title: "Invalid Amount",
                    description: "Number of additional followers must be greater than 0.",
                  });
                  return;
                }
                handleFlutterwavePayment({
                  callback: (response) => {
                     // This callback is executed when the user is redirected back to the app.
                     // The logic is now handled by the useEffect hook that checks URL params.
                    closePaymentModal(); // close the modal immediately
                  },
                  onClose: () => {
                     toast({
                        title: "Payment Modal Closed",
                        description:
                          "If payment was not completed, you can try again.",
                      });
                  },
                });
              }}
              disabled={paymentSuccessful || isSubmitting}
            >
              Pay ₦{paymentAmount.toFixed(2)} with Flutterwave
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={isSubmitting || !paymentSuccessful}
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Submit Account
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
