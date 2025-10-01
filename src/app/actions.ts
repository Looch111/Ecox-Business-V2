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

  try {
    await addDoc(collection(db, "accounts"), {
      uid,
      name,
      bearerToken,
      active: true,
      targetUsernames: [],
      followerTarget,
      enableFollowBackGoal,
      initialFollowers,
      createdAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error: any) {
    console.error("Failed to add account:", error);
    throw new Error("Failed to save account to database.");
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
    await setDoc(doc(db, "users", uid), { hasAgreedToTerms: true }, { merge: true });
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
