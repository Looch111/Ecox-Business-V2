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
import { HelpCircle, Loader2 } from "lucide-react";
import { addAccount, getInitialFollowers } from "@/app/actions";
import { Switch } from "../ui/switch";
import { KiwiGuideSheet, TokenGuideSheet } from "./Guides";

const accountFormSchema = z.object({
  name: z.string().min(2, {
    message: "Account name must be at least 2 characters.",
  }),
  bearerToken: z.string().min(10, {
    message: "Please enter a valid bearer token.",
  }),
  followerTarget: z.coerce
    .number()
    .min(1, { message: "Target must be at least 1." }),
  enableFollowBackGoal: z.boolean().default(true),
  initialFollowers: z.number().min(0).default(0),
});

type AccountFormValues = z.infer<typeof accountFormSchema>;

interface AccountFormProps {
  user: User;
  balance: number;
}

export default function AccountForm({ user, balance }: AccountFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingFollowers, setIsFetchingFollowers] = useState(false);
  const [isKiwiGuideOpen, setIsKiwiGuideOpen] = useState(false);
  const [isTokenGuideOpen, setIsTokenGuideOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      name: "",
      bearerToken: "",
      followerTarget: 1,
      enableFollowBackGoal: true,
      initialFollowers: 0,
    },
  });

  const bearerTokenValue = useWatch({
    control: form.control,
    name: "bearerToken",
  });

  const followerTargetValue = useWatch({
    control: form.control,
    name: "followerTarget",
  });
  
  const initialFollowers = useWatch({
    control: form.control,
    name: "initialFollowers",
  });
  
  const cost = Number(followerTargetValue) * 2.5;
  const totalFollowers = (Number(initialFollowers) || 0) + (Number(followerTargetValue) || 0);

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
    if (balance < cost) {
      toast({
        variant: "destructive",
        title: "Insufficient Balance",
        description: `Your balance is too low to submit. Required: ₦${cost.toFixed(2)}. Please deposit more funds.`,
      });
      return;
    }
    
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
      form.reset();
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
    <>
      <Card className="w-full max-w-2xl mx-auto shadow-lg animate-fade-in-up border">
        <CardHeader>
          <CardTitle>Add Your Account</CardTitle>
          <CardDescription>
            Fill in your account details to get started. Need help? Use the
            guides below.
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
                    <div className="flex items-center justify-between">
                      <FormLabel>Bearer Token</FormLabel>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsKiwiGuideOpen(true)}
                          className="gap-1.5 text-xs px-2"
                        >
                          <HelpCircle className="h-4 w-4" />
                          Kiwi Guide
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsTokenGuideOpen(true)}
                          className="gap-1.5 text-xs px-2"
                        >
                          <HelpCircle className="h-4 w-4" />
                          Token Guide
                        </Button>
                      </div>
                    </div>
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
                name="followerTarget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Follower Growth Target</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="100" {...field} />
                    </FormControl>
                    <FormDescription>
                      Enter the number of new followers you want to gain. Your
                      total follower count will be {totalFollowers}. Cost: ₦{cost.toFixed(2)}
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
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Pay ₦{cost.toFixed(2)}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
      <KiwiGuideSheet open={isKiwiGuideOpen} onOpenChange={setIsKiwiGuideOpen} />
      <TokenGuideSheet
        open={isTokenGuideOpen}
        onOpenChange={setIsTokenGuideOpen}
      />
    </>
  );
}
