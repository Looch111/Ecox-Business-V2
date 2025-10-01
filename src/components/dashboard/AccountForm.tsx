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
import { Loader2, Sparkles } from "lucide-react";
import {
  addAccount,
  getInitialFollowers,
  getUsernameSuggestions,
} from "@/app/actions";
import { Textarea } from "../ui/textarea";
import { Switch } from "../ui/switch";

const accountFormSchema = z.object({
  name: z.string().min(2, {
    message: "Account name must be at least 2 characters.",
  }),
  bearerToken: z.string().min(10, {
    message: "Please enter a valid bearer token.",
  }),
  targets: z.string().optional(),
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

export default function AccountForm({ user }: AccountFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isFetchingFollowers, setIsFetchingFollowers] = useState(false);
  const { toast } = useToast();

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      name: "",
      bearerToken: "",
      targets: "",
      followerTarget: 1,
      enableFollowBackGoal: true,
      initialFollowers: 0,
    },
  });

  const bearerTokenValue = useWatch({
    control: form.control,
    name: "bearerToken",
  });

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

    const timeoutId = setTimeout(fetchFollowers, 500); // Debounce API call
    return () => clearTimeout(timeoutId);
  }, [bearerTokenValue, form, toast]);

  const handleSuggestUsernames = async () => {
    const accountName = form.getValues("name");
    if (!accountName) {
      form.setError("name", {
        type: "manual",
        message: "Please enter an account name before suggesting targets.",
      });
      return;
    }

    setIsSuggesting(true);
    try {
      const result = await getUsernameSuggestions({ accountName });
      if (result.suggestedUsernames && result.suggestedUsernames.length > 0) {
        form.setValue("targets", result.suggestedUsernames.join(", "));
        toast({
          title: "Suggestions Loaded",
          description: "AI-powered target usernames have been populated.",
        });
      } else {
        toast({
          title: "No Suggestions Found",
          description: "Could not generate suggestions for this account name.",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Suggestion Failed",
        description: error.message || "An error occurred.",
      });
    } finally {
      setIsSuggesting(false);
    }
  };

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
          Fill in your account details below. This can only be done once.
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
              name="followerTarget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Follower Target</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="1" {...field} />
                  </FormControl>
                  <FormDescription>
                    Number of followers to target.
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
            <FormField
              control={form.control}
              name="targets"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-4">
                    <FormLabel>Target Usernames</FormLabel>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleSuggestUsernames}
                      disabled={isSuggesting}
                      className="shrink-0"
                    >
                      {isSuggesting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4 text-primary" />
                      )}
                      Suggest with AI
                    </Button>
                  </div>
                  <FormControl>
                    <Textarea
                      placeholder="username1, username2, username3"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Comma-separated list of target accounts.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={isSubmitting}
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
