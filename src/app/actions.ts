"use server";

import { z } from "zod";
import {
  suggestTargetUsernames,
  type SuggestTargetUsernamesInput,
} from "@/ai/flows/suggest-target-usernames";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  increment,
  runTransaction,
} from "firebase/firestore";

const accountSchema = z.object({
  uid: z.string(),
  name: z.string().min(2),
  bearerToken: z.string().min(10),
  followerTarget: z.number().min(0),
  enableFollowBackGoal: z.boolean(),
  initialFollowers: z.number().min(0),
});

export async function addAccount(data: z.infer<typeof accountSchema>) {
  const validatedData = accountSchema.safeParse(data);
  if (!validatedData.success) {
    throw new Error("Invalid account data provided.");
  }

  const {
    uid,
    name,
    bearerToken,
    followerTarget,
    enableFollowBackGoal,
    initialFollowers,
  } = validatedData.data;

  const cost = followerTarget * 2.5;

  try {
    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, "users", uid);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists() || (userDoc.data().balance || 0) < cost) {
        throw new Error("Insufficient balance to perform this action.");
      }

      transaction.update(userRef, { balance: increment(-cost) });

      transaction.set(doc(collection(db, "accounts")), {
        uid,
        name,
        bearerToken,
        active: true,
        targetUsernames: [],
        followerTarget: initialFollowers + followerTarget,
        enableFollowBackGoal,
        initialFollowers,
        createdAt: serverTimestamp(),
      });
    });

    return { success: true };
  } catch (error: any) {
    console.error("Failed to add account:", error);
    throw new Error(
      error.message || "Failed to save account to database."
    );
  }
}

export async function addFundsToAccount(uid: string, amount: number) {
  if (!uid || !amount) {
    throw new Error("User ID and amount are required.");
  }
  if (amount <= 0) {
    throw new Error("Amount must be a positive number.");
  }

  try {
    const userRef = doc(db, "users", uid);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      await setDoc(userRef, { balance: amount });
    } else {
      await updateDoc(userRef, {
        balance: increment(amount),
      });
    }
    return { success: true };
  } catch (error: any) {
    console.error("Failed to add funds:", error);
    throw new Error("Could not update user balance.");
  }
}

export async function verifyFlutterwaveTransaction(
  transaction_id: string,
  tx_ref: string
): Promise<{ success: boolean; amount?: number; message?: string }> {
  if (!transaction_id || !tx_ref) {
    return {
      success: false,
      message: "Transaction ID and reference are required for verification.",
    };
  }
  
  const uid = tx_ref.split("-")[2];
  if (!uid) {
    return {
      success: false,
      message: "Could not extract user ID from transaction reference.",
    };
  }


  try {
    const response = await fetch(
      `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        },
      }
    );

    const data = await response.json();

    if (
      data.status === "success" &&
      data.data?.status === "successful" &&
      data.data?.tx_ref === tx_ref
    ) {
      await addFundsToAccount(uid, data.data.amount);
      return { success: true, amount: data.data.amount };
    } else {
      return {
        success: false,
        message: data.message || "Transaction verification failed with Flutterwave.",
      };
    }
  } catch (error: any) {
    console.error("Flutterwave verification error:", error);
    return {
      success: false,
      message: error.message || "An internal error occurred during verification.",
    };
  }
}

export async function getUsernameSuggestions(
  input: SuggestTargetUsernamesInput
) {
  try {
    return await suggestTargetUsernames(input);
  } catch (error) {
    console.error("AI suggestion error:", error);
    throw new Error("Could not fetch AI suggestions.");
  }
}

export async function getInitialFollowers(
  bearerToken: string
): Promise<{ count: number }> {
  try {
    const response = await fetch(
      "https://api.ecox.network/api/v1/user/list-follow?offset=1&limit=1&type=follower",
      {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: "Could not parse error response." }));
      const errorMessage = errorData.message || `API Error: ${response.status}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return { count: data.total ?? 0 };
  } catch (error: any) {
    console.error("Error fetching initial followers:", error);
    throw new Error(
      error.message || "Could not retrieve initial follower count."
    );
  }
}

export async function agreeToTerms(
  uid: string
): Promise<{ success: boolean }> {
  if (!uid) {
    throw new Error("User ID is required.");
  }
  try {
    const userRef = doc(db, "users", uid);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      await setDoc(userRef, { hasAgreedToTerms: true, balance: 0 });
    } else {
      await updateDoc(userRef, { hasAgreedToTerms: true });
    }
    return { success: true };
  } catch (error: any) {
    console.error("Failed to update user terms agreement:", error);
    throw new Error("Could not save terms agreement.");
  }
}

export async function hasAgreedToTerms(
  uid: string
): Promise<{ hasAgreed: boolean }> {
  if (!uid) {
    return { hasAgreed: false };
  }
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    return { hasAgreed: userDoc.exists() && userDoc.data().hasAgreedToTerms === true };
  } catch (error) {
    console.error("Failed to check user terms agreement:", error);
    return { hasAgreed: false };
  }
}
