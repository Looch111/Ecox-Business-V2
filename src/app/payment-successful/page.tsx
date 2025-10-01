import Link from 'next/link';
import {CheckCircle2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';

export default function PaymentSuccessfulPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center shadow-lg animate-fade-in-up border">
        <CardHeader>
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
            <CheckCircle2 className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="mt-4 !text-2xl">Payment Successful!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pb-8">
          <p className="text-muted-foreground">
            Thank you for your payment. Your transaction was completed
            successfully.
          </p>
          <p className="text-muted-foreground text-sm">
            You may now return to the dashboard and submit your account.
          </p>
          <Button asChild className="mt-4">
            <Link href="/">Return to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
