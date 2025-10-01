"use server";

import { z } from "zod";
import {
  suggestTargetUsernames,
  type SuggestTargetUsernamesInput,
} from "@/ai/flows/suggest-target-usernames";
import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

const accountSchema = z.object({
  uid: z.string(),
  name: z.string().min(2),
  bearerToken: z.string().min(10),
  desiredFollowers: z.number().min(0),
  targets: z.string().optional(),
  followerTarget: z.number().min(0),
  enableFollowBackGoal: z.boolean(),
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
    desiredFollowers,
    targets,
    followerTarget,
    enableFollowBackGoal,
  } = validatedData.data;

  try {
    await addDoc(collection(db, "accounts"), {
      uid,
      name,
      bearerToken,
      desiredFollowers,
      active: true,
      targetUsernames: targets
        ? targets
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      followerTarget,
      enableFollowBackGoal,
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
