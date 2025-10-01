"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type DocumentData } from "firebase/firestore";
import DepositForm from "./DepositForm";
import type { User } from "firebase/auth";

interface AccountViewProps {
  account: DocumentData;
  user: User;
}

export default function AccountView({ account, user }: AccountViewProps) {
  const formattedBalance = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
  }).format(account.balance || 0);

  return (
    <div className="flex flex-col items-center pt-10 animate-fade-in-up gap-8">
      <Card className="w-full max-w-md text-center shadow-lg border">
        <CardHeader>
          <CardTitle className="!text-2xl">{account.name}</CardTitle>
          <CardDescription>
            Here is your current account status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 pb-8">
          <p className="text-sm text-muted-foreground">Current Balance</p>
          <p className="text-4xl font-bold text-primary">
            {formattedBalance}
          </p>
        </CardContent>
      </Card>
      <DepositForm account={account} user={user} />
    </div>
  );
}

    